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

function makeSheet(name, env) {
  let data = [];
  const formats = {};
  const wrote = () => { env.stats.writes[name] = (env.stats.writes[name] || 0) + 1; };
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
    hooks: {}
  };
  const resetStats = () => { env.stats = { reads: {}, writes: {}, cacheCalls: 0, flushes: 0 }; };
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
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, flush: () => { env.stats.flushes++; } },
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
      getFolderById: () => ({ createFile: () => ({ setSharing() {}, getId: () => 'IMG' + Date.now() }) }),
      createFolder: () => ({ getId: () => 'FOLDER', createFile: () => ({ setSharing() {}, getId: () => 'IMG' + Date.now() }) })
    },
    Logger: { log: (...a) => opts.quiet ? null : console.log(...a) },
    Session: { getScriptTimeZone: () => 'Asia/Ho_Chi_Minh' },
    _sheets: sheets, _mails: mails, _cache: cache, _hooks: env.hooks, _env: env
  };
  Object.defineProperty(ctx, '_stats', { get: () => env.stats });
  ctx._resetStats = resetStats;
  vm.createContext(ctx);
  const codePath = opts.codePath || path.join(__dirname, '..', 'apps-script', 'Code.gs');
  const code = fs.readFileSync(codePath, 'utf8');
  vm.runInContext(code + '\n;this.__ROUTES = ROUTES; this.__MEMO = function(){ MEMO_ = {}; };', ctx, { filename: 'Code.gs' });
  ctx.call = (action, body = {}) => {
    ctx.__MEMO(); // mỗi request Apps Script là 1 lần chạy mới
    const out = ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ action }, body)) } });
    return JSON.parse(out.getContent());
  };
  return ctx;
}

module.exports = { createContext };
