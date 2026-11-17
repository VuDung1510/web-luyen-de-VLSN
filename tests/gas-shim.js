// Giả lập tối thiểu các dịch vụ Google Apps Script để chạy Code.gs bằng Node (chỉ dùng cho kiểm thử).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

function makeSheet(name) {
  let data = [];
  const formats = {};
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
    getDataRange: () => sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), Math.max(sh.getLastColumn(), 1)),
    getRange: (r, c, nr = 1, nc = 1) => {
      const range = {
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
          for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (data[r - 1 + i]) data[r - 1 + i][c - 1 + j] = '';
          return range;
        },
        setNumberFormat: (f) => { formats[`${r},${c}`] = f; return range; },
        setFontWeight: () => range, setBackground: () => range, setFontColor: () => range
      };
      return range;
    },
    deleteRow: (r) => { data.splice(r - 1, 1); },
    setFrozenRows: () => {}
  };
  return sh;
}

function createContext(opts = {}) {
  const sheets = {};
  const order = [];
  const props = {};
  const cache = {};
  const mails = [];
  const spreadsheet = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => { sheets[n] = makeSheet(n); order.push(n); return sheets[n]; },
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
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
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
        get: k => (cache[k] && cache[k].exp > Date.now() ? cache[k].v : null),
        put: (k, v, s = 600) => { cache[k] = { v, exp: Date.now() + s * 1000 }; },
        remove: k => { delete cache[k]; }
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
    _sheets: sheets, _mails: mails, _cache: cache
  };
  vm.createContext(ctx);
  const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  vm.runInContext(code + '\n;this.__ROUTES = ROUTES; this.__MEMO = function(){ MEMO_ = {}; };', ctx, { filename: 'Code.gs' });
  ctx.call = (action, body = {}) => {
    ctx.__MEMO(); // mỗi request Apps Script là 1 lần chạy mới
    const out = ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ action }, body)) } });
    return JSON.parse(out.getContent());
  };
  return ctx;
}

module.exports = { createContext };
