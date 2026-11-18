// Giả lập tối thiểu các dịch vụ Google Apps Script để chạy Code.gs bằng Node (chỉ dùng cho kiểm thử).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

// Chờ đồng bộ (giả lập chi phí gọi dịch vụ Google). Chặn cả tiến trình, giống một lần chạy Apps Script.
const SLEEP_BUF = new Int32Array(new SharedArrayBuffer(4));
function busySleep(ms) { if (ms > 0) Atomics.wait(SLEEP_BUF, 0, 0, ms); }
const CACHE_MAX_BYTES = 100 * 1024; // CacheService: tối đa 100 KB mỗi giá trị
const CACHE_MAX_TTL = 21600;        // tối đa 6 giờ

function makeSheet(name, env, tag) {
  let data = [];
  const formats = {};
  // tag: id của bảng tính ngoài (vd kho câu hỏi mở bằng openById) → mọi lần ghi đếm thêm vào stats.extWrites[tag]
  const wrote = () => {
    env.stats.writes[name] = (env.stats.writes[name] || 0) + 1;
    if (tag) env.stats.extWrites[tag] = (env.stats.extWrites[tag] || 0) + 1;
  };
  const sh = {
    name,
    _data: () => data,
    getName: () => name,
    getLastRow: () => {
      for (let r = data.length - 1; r >= 0; r--) if (data[r] && data[r].some(v => v !== '' && v != null)) return r + 1;
      return 0;
    },
    getLastColumn: () => data.reduce((m, row) => {
      let c = 0;
      (row || []).forEach((v, i) => { if (v !== '' && v != null) c = i + 1; });
      return Math.max(m, c);
    }, 0),
    getMaxRows: () => Math.max(1000, data.length),
    getDataRange: () => {
      env.stats.reads[name] = (env.stats.reads[name] || 0) + 1;
      const range = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), Math.max(sh.getLastColumn(), 1));
      const raw = range.getValues;
      range.getValues = () => {
        busySleep(env.sheetReadMs);
        if (env.hooks.onReadSheet) env.hooks.onReadSheet(name);
        return raw();
      };
      return range;
    },
    getRange: (r, c, nr = 1, nc = 1) => {
      const range = {
        getSheet: () => sh,
        getRow: () => r,
        getValues: () => {
          env.stats.cells[name] = (env.stats.cells[name] || 0) + nr * nc;
          env.stats.ranges[name] = (env.stats.ranges[name] || 0) + 1;
          const out = [];
          for (let i = 0; i < nr; i++) {
            const row = [];
            for (let j = 0; j < nc; j++) {
              const v = data[r - 1 + i] ? data[r - 1 + i][c - 1 + j] : undefined;
              row.push(v === undefined || v === null ? '' : v);
            }
            out.push(row);
          }
          return out;
        },
        setValues: (vals) => {
          if (vals.length !== nr || vals.some(row => row.length !== nc)) throw new Error(`setValues: kích thước sai (${vals.length}x${vals[0] && vals[0].length} vs ${nr}x${nc})`);
          wrote();
          for (let i = 0; i < nr; i++) {
            data[r - 1 + i] = data[r - 1 + i] || [];
            for (let j = 0; j < nc; j++) {
              let v = vals[i][j];
              if (typeof v === 'string' && v.startsWith("'")) v = v.slice(1);
              data[r - 1 + i][c - 1 + j] = v;
            }
          }
          return range;
        },
        clearContent: () => {
          wrote();
          for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (data[r - 1 + i]) data[r - 1 + i][c - 1 + j] = '';
          return range;
        },
        setNumberFormat: (f) => { formats[`${r},${c}`] = f; return range; },
        setFontWeight: () => range, setBackground: () => range, setFontColor: () => range
      };
      return range;
    },
    deleteRow: (r) => { wrote(); data.splice(r - 1, 1); },
    appendRow: (row) => { wrote(); data.push(row.slice()); return sh; },
    insertRows: () => { wrote(); return sh; },
    insertRowBefore: () => { wrote(); return sh; },
    insertColumns: () => { wrote(); return sh; },
    _setData: (rows) => { data = rows.map((r) => r.slice()); },
    setFrozenRows: () => {}
  };
  return sh;
}

/**
 * opts.quiet       — không in Logger.log
 * opts.codePath    — file máy chủ cần nạp (mặc định apps-script/Code.gs; SERVER_COMPAT dùng tests/fixtures/Code-1.0.0.gs)
 * opts.sheetReadMs — chi phí giả mỗi lần đọc cả trang tính (getDataRange().getValues()); mặc định env SHEET_READ_MS hoặc 0
 * opts.cacheMs     — chi phí giả mỗi lần gọi CacheService; mặc định env CACHE_MS hoặc 0
 * Thống kê: ctx._stats = { reads: {trang tính: số lần getDataRange}, writes: {...}, cacheCalls, flushes }, ctx._resetStats().
 * Móc kiểm thử: ctx._hooks.onReadSheet(name) chạy ngay khi một trang tính được đọc (giả lập tranh chấp).
 */
function createContext(opts = {}) {
  const sheets = {};
  const order = [];
  const props = {};
  const cache = {};
  const mails = [];
  const env = {
    sheetReadMs: +(opts.sheetReadMs != null ? opts.sheetReadMs : process.env.SHEET_READ_MS || 0),
    cacheMs: +(opts.cacheMs != null ? opts.cacheMs : process.env.CACHE_MS || 0),
    stats: null,
    hooks: {},
    clockOffset: 0, // đồng hồ giả (ms) cộng vào nowMs_() của Code.gs
    makeCopyMs: +(opts.makeCopyMs || 0) // chi phí GIẢ mỗi lần makeCopy (chỉ cộng vào đồng hồ giả, không chờ thật)
  };
  const resetStats = () => {
    env.stats = { reads: {}, writes: {}, cacheCalls: 0, flushes: 0, cells: {}, ranges: {}, extWrites: {}, openById: 0,
      makeCopy: 0, setSharing: {}, getFilesByName: 0, folderScans: 0 };
  };
  resetStats();
  const cacheCall = () => { env.stats.cacheCalls++; busySleep(env.cacheMs); };
  const cacheGet = (k) => (cache[k] && cache[k].exp > Date.now() ? cache[k].v : null);
  const cachePut = (k, v, s) => {
    v = String(v);
    if (String(k).length > 250) throw new Error('Argument too large: key');
    if (Buffer.byteLength(v, 'utf8') > CACHE_MAX_BYTES) throw new Error('Argument too large: value');
    s = s == null ? 600 : Math.min(+s, CACHE_MAX_TTL);
    cache[k] = { v, exp: Date.now() + s * 1000 };
  };
  const spreadsheet = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => { sheets[n] = makeSheet(n, env); order.push(n); return sheets[n]; },
    getSheets: () => order.map(n => sheets[n]),
    deleteSheet: (s) => { delete sheets[s.name]; order.splice(order.indexOf(s.name), 1); },
    getUrl: () => 'https://docs.google.com/spreadsheets/d/FAKE/edit'
  };
  // Bảng tính khác (vd kho câu hỏi) mở bằng SpreadsheetApp.openById: ctx._addSpreadsheet(id, { 'Tên trang': [[...], ...] })
  const external = {};
  const addSpreadsheet = (id, tabs) => {
    const tsheets = {};
    Object.keys(tabs).forEach((n) => { tsheets[n] = makeSheet(n, env, id); tsheets[n]._setData(tabs[n]); });
    external[id] = {
      getId: () => id,
      getSheetByName: (n) => tsheets[n] || null,
      getSheets: () => Object.keys(tsheets).map((n) => tsheets[n]),
      insertSheet: (n) => { env.stats.extWrites[id] = (env.stats.extWrites[id] || 0) + 1; tsheets[n] = makeSheet(n, env, id); return tsheets[n]; },
      deleteSheet: () => { env.stats.extWrites[id] = (env.stats.extWrites[id] || 0) + 1; },
      getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id + '/edit',
      _sheets: tsheets
    };
    return external[id];
  };
  // Drive giả: thư mục, file, makeCopy (đếm + chi phí giả), setSharing (đếm theo id file)
  const drive = { folders: {}, files: {}, seq: 0 };
  const iter = (arr) => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
  const newId = (p) => p + (++drive.seq).toString(36).padStart(4, '0') + crypto.randomBytes(3).toString('hex');
  function mkFile(name, folderId, blobObj) {
    const id = newId('F');
    const f = {
      id, name, folderId, blob: blobObj || null, copyOf: null,
      getId: () => id, getName: () => name, getBlob: () => f.blob,
      setSharing: () => { env.stats.setSharing[id] = (env.stats.setSharing[id] || 0) + 1; return f; },
      makeCopy: (n, folder) => {
        env.stats.makeCopy++;
        env.clockOffset += env.makeCopyMs;
        const c = mkFile(n || name, folder ? folder.getId() : null, f.blob);
        c.copyOf = id;
        return c;
      }
    };
    drive.files[id] = f;
    if (folderId && drive.folders[folderId]) drive.folders[folderId].fileIds.push(id);
    return f;
  }
  function mkFolder(name, parentId) {
    const id = newId('D');
    const d = {
      id, name, fileIds: [], folderIds: [],
      getId: () => id, getName: () => name,
      getFiles: () => { env.stats.folderScans++; return iter(d.fileIds.map((x) => drive.files[x])); },
      getFolders: () => iter(d.folderIds.map((x) => drive.folders[x])),
      createFile: (b) => mkFile((b && b.name) || 'file', id, b),
      createFolder: (n) => mkFolder(n, id)
    };
    drive.folders[id] = d;
    if (parentId && drive.folders[parentId]) drive.folders[parentId].folderIds.push(id);
    return d;
  }
  const tzFormat = (d, tz, fmt) => {
    const t = new Date(d.getTime() + 7 * 3600 * 1000); // giờ VN
    const p = (n, l = 2) => String(n).padStart(l, '0');
    return fmt
      .replace('yyyy', t.getUTCFullYear()).replace('yy', p(t.getUTCFullYear() % 100))
      .replace('MM', p(t.getUTCMonth() + 1)).replace('dd', p(t.getUTCDate()))
      .replace('HH', p(t.getUTCHours())).replace('mm', p(t.getUTCMinutes())).replace('ss', p(t.getUTCSeconds()));
  };
  const blob = (bytes, mime, name) => ({
    getBytes: () => bytes, getDataAsString: () => Buffer.from(bytes).toString('utf8'), mime, name
  });
  const ctx = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      flush: () => { env.stats.flushes++; },
      openById: (id) => {
        env.stats.openById++;
        if (!external[id]) throw new Error('Không tìm thấy bảng tính có id ' + id + ' hoặc không có quyền truy cập.');
        return external[id];
      }
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: tzFormat,
      computeHmacSha256Signature: (value, key) => [...crypto.createHmac('sha256', key).update(value).digest()],
      base64EncodeWebSafe: (b) => Buffer.from(typeof b === 'string' ? Buffer.from(b, 'utf8') : b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: (s) => [...Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')],
      base64Decode: (s) => [...Buffer.from(s, 'base64')],
      newBlob: (data, mime, name) => blob(typeof data === 'string' ? [...Buffer.from(data, 'utf8')] : data, mime, name),
      sleep: () => {}
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => { cacheCall(); return cacheGet(k); },
        getAll: (keys) => {
          cacheCall();
          const out = {};
          keys.forEach((k) => { const v = cacheGet(k); if (v != null) out[k] = v; });
          return out;
        },
        put: (k, v, s) => { cacheCall(); cachePut(k, v, s); },
        putAll: (obj, s) => {
          cacheCall();
          Object.keys(obj).forEach((k) => {
            const v = String(obj[k]);
            if (Buffer.byteLength(v, 'utf8') > CACHE_MAX_BYTES) throw new Error('Argument too large: value');
          });
          Object.keys(obj).forEach((k) => cachePut(k, obj[k], s));
        },
        remove: (k) => { cacheCall(); delete cache[k]; },
        removeAll: (keys) => { cacheCall(); keys.forEach((k) => { delete cache[k]; }); }
      })
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t) => ({ _text: t, setMimeType() { return this; }, getContent() { return this._text; } })
    },
    UrlFetchApp: {
      fetch: (url) => {
        const tok = decodeURIComponent(url.split('id_token=')[1] || '');
        // token giả: "fake:<email>:<aud>"
        const [kind, email, aud] = tok.split(':');
        if (kind !== 'fake') return { getResponseCode: () => 400, getContentText: () => '{}' };
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ email, aud, email_verified: 'true', name: email }) };
      }
    },
    MailApp: { sendEmail: (m) => mails.push(m) },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 },
      getFolderById: (id) => { if (!drive.folders[id]) throw new Error('Không tìm thấy thư mục ' + id); return drive.folders[id]; },
      getFileById: (id) => { if (!drive.files[id]) throw new Error('Không tìm thấy file ' + id); return drive.files[id]; },
      getFilesByName: (n) => { env.stats.getFilesByName++; return iter(Object.values(drive.files).filter((f) => f.name === n)); },
      createFolder: (n) => mkFolder(n, null)
    },
    Logger: { log: (...a) => opts.quiet ? null : console.log(...a) },
    Session: { getScriptTimeZone: () => 'Asia/Ho_Chi_Minh' },
    _sheets: sheets, _mails: mails, _cache: cache, _hooks: env.hooks, _env: env, _props: props,
    _external: external, _addSpreadsheet: addSpreadsheet,
    _drive: {
      folders: drive.folders, files: drive.files,
      addFolder: (name, parentId) => mkFolder(name, parentId).id,
      addFile: (name, folderId) => mkFile(name, folderId, blob([137, 80, 78, 71], 'image/png', name)).id
    }
  };
  Object.defineProperty(ctx, '_stats', { get: () => env.stats });
  ctx._resetStats = resetStats;
  vm.createContext(ctx);
  const codePath = opts.codePath || path.join(__dirname, '..', 'apps-script', 'Code.gs');
  const code = fs.readFileSync(codePath, 'utf8');
  vm.runInContext(code + '\n;this.__ROUTES = ROUTES; this.__MEMO = function(){ MEMO_ = {}; };', ctx, { filename: 'Code.gs' });
  // Đồng hồ giả cho việc chia lô (Code.gs ≥ 1.3.0 đọc giờ qua nowMs_()); ctx._clock.advance(ms) để tua.
  if (typeof ctx.nowMs_ === 'function') ctx.nowMs_ = () => Date.now() + env.clockOffset;
  ctx._clock = { advance: (ms) => { env.clockOffset += ms; }, offset: () => env.clockOffset };
  ctx.call = (action, body = {}) => {
    ctx.__MEMO(); // mỗi request Apps Script là 1 lần chạy mới
    const out = ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ action }, body)) } });
    return JSON.parse(out.getContent());
  };
  return ctx;
}

module.exports = { createContext };
