// Kiểm thử đơn vị bộ đệm trình duyệt trong assets/js/common.js (chạy bằng Node, giả lập window/localStorage/document).
// node tests/common-cache.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function fakeStorage() {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _map: m
  };
}
function fakeEl() {
  const cls = new Set();
  return {
    id: '', className: '', innerHTML: '', textContent: '', children: [], setAttribute() {}, appendChild(c) { this.children.push(c); return c; }, remove() {},
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); }, contains: (c) => cls.has(c) }
  };
}
function load() {
  const local = fakeStorage(), session = fakeStorage();
  const els = {};
  const toasts = [];
  const body = fakeEl();
  const document = {
    body,
    getElementById: (id) => els[id] || null,
    querySelector: (s) => (s === '.toast-wrap' ? els.__toastWrap || null : null),
    createElement: () => fakeEl(),
    addEventListener() {},
    documentElement: {}
  };
  body.appendChild = (c) => { if (c.id) els[c.id] = c; if (c.className === 'toast-wrap') els.__toastWrap = c; c.appendChild = (t) => { toasts.push(t.textContent); return t; }; return c; };
  const window = { APP_CONFIG: { API_URL: 'x' }, localStorage: local, sessionStorage: session, scrollY: 0, scrollTo() {} };
  const ctx = { window, document, localStorage: local, sessionStorage: session, setTimeout: () => 0, getComputedStyle: () => ({ getPropertyValue: () => '' }), console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'common.js'), 'utf8'), ctx);
  return { App: window.App, local, session, els, toasts };
}
const defer = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); return { p, res, rej }; };

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e)); process.exitCode = 1; }
}

(async () => {
  console.log('Bộ đệm trình duyệt (common.js):');

  await t('R-1: làm mới ngầm về sau khi đổi tài khoản không ghi vào kho của người mới', async () => {
    const { App, local } = load();
    App.setCacheScope('local', 'HS0001');
    const tok = App.cacheToken(); // giống app.js sau submitExam
    const stats = defer();
    stats.p.then((d) => App.cacheSet('stats', d, tok));
    // A đăng xuất, B đăng nhập trước khi myStats của A trả về
    App.clearCache(); App.setCacheScope(null); App.setCacheScope('local', 'HS0002');
    stats.res({ count: 3, ten: 'của A' });
    await stats.p; await null;
    assert.deepStrictEqual([...local._map.keys()].filter((k) => k.startsWith('ld_c_')), []);
    // cùng người dùng thì vẫn ghi
    const tok2 = App.cacheToken();
    App.cacheSet('stats', { count: 1 }, tok2);
    assert(local.getItem('ld_c_v1_HS0002_stats'));
  });

  await t('R-9: lời gọi bắt đầu trước cacheDel không cất lại bản cũ', async () => {
    const { App, session } = load();
    App.setCacheScope('session', 'admin');
    const slow = defer();
    const rendered = [];
    const run = App.cached('exams', () => slow.p, (d) => rendered.push(d));
    App.cacheDel('*'); // giáo viên vừa xóa đề
    slow.res(['đề cũ']);
    await run;
    assert.strictEqual(session.getItem('ld_c_v1_admin_exams'), null);
    assert.deepStrictEqual(rendered, [['đề cũ']]); // vẫn vẽ (màn đang xem), chỉ không cất
  });

  await t('R-2: máy chủ lỗi (không phải mất mạng) khi đang có bản lưu → giữ bản lưu, báo nhẹ', async () => {
    const { App, toasts } = load();
    App.setCacheScope('local', 'HS0001');
    App.cacheSet('history', [{ id: 1 }]);
    const rendered = [];
    const d = await App.cached('history', () => Promise.reject(new Error('Service Spreadsheets timed out')), (x) => rendered.push(x));
    assert.strictEqual(JSON.stringify(d), '[{"id":1}]');
    assert.strictEqual(rendered.length, 1);
    assert(toasts.some((x) => /Chưa cập nhật được/.test(x)), toasts);
    // lỗi AUTH vẫn ném ra
    const e = new Error('hết hạn'); e.auth = true;
    await assert.rejects(App.cached('history', () => Promise.reject(e), () => {}));
  });

  await t('R-3: bản lưu hỏng làm render lỗi → tự xóa, hiện khung xương, tải lại', async () => {
    const { App, local } = load();
    App.setCacheScope('local', 'HS0001');
    local.setItem('ld_c_v1_HS0001_stats', JSON.stringify({ t: 1, d: {} }));
    let sk = 0;
    const out = [];
    const render = (s) => { if (!s.timeline) throw new Error('sai định dạng'); out.push(s.count); };
    await App.cached('stats', async () => ({ count: 2, timeline: [] }), render, { skeleton: () => { sk++; } });
    assert.strictEqual(sk, 1);
    assert.deepStrictEqual(out, [2]);
    assert.strictEqual(JSON.parse(local.getItem('ld_c_v1_HS0001_stats')).d.count, 2);
  });

  await t('R-8: chỉ báo "Đang cập nhật…" không hiện sang màn mới và không kẹt', async () => {
    const { App, els } = load();
    App.setCacheScope('local', 'HS0001');
    App.cacheSet('history', [1]);
    App.cacheSet('stats', { a: 1 });
    App.newView();
    const slow = defer();
    const run = App.cached('history', () => slow.p, () => {});
    assert(!els.syncPill.classList.contains('hidden'), 'màn có bản lưu đang cập nhật → hiện');
    App.newView(); // chuyển sang màn làm bài (không có đệm)
    assert(els.syncPill.classList.contains('hidden'), 'màn mới không được thấy chỉ báo');
    const fast = defer();
    const run2 = App.cached('stats', () => fast.p, () => {});
    assert(!els.syncPill.classList.contains('hidden'));
    slow.res([1]); await run;
    assert(!els.syncPill.classList.contains('hidden'), 'màn hiện tại vẫn đang cập nhật');
    fast.res({ a: 1 }); await run2;
    assert(els.syncPill.classList.contains('hidden'), 'xong hết thì ẩn');
  });

  console.log(`\n${passed} kiểm thử đạt${process.exitCode ? ', CÓ LỖI' : ''}.`);
})();
