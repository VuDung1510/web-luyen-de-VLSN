/* Tiện ích dùng chung cho trang học sinh và trang quản trị */
(function () {
  'use strict';
  const CFG = window.APP_CONFIG || {};

  /* ---------- lưu trữ an toàn ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* bỏ qua */ } }
  };

  /* ---------- cờ tính năng của máy chủ ----------
   * publicConfig (từ máy chủ 1.2.0) trả features: [...]. Thiếu features = máy chủ 1.0.0.
   * Giao diện bật nút theo danh sách này, không so số phiên bản. */
  const PUB_KEY = 'ld_pub', PUB_TIME_KEY = 'ld_pub_t', PUB_MAX_AGE = 10 * 60 * 1000;
  const unsupported = {}; // action/tính năng máy chủ báo "Không có chức năng" trong phiên này
  const FEATURE_OF = {
    changePin: 'changePin', bootstrap: 'bootstrap', adminBootstrap: 'bootstrap',
    adminBankMeta: 'bank', adminBankList: 'bank', adminBankSource: 'bank', adminBankMatrix: 'bank', adminBankToQuestions: 'bank',
    practiceMeta: 'practice', practiceStart: 'practice', adminPracticeSync: 'practice', adminPracticeList: 'practice', adminPracticeToggle: 'practice'
  };
  function savePub(p) { store.set(PUB_KEY, p); store.set(PUB_TIME_KEY, Date.now()); }
  function pubFresh() { return !!store.get(PUB_KEY, null) && Date.now() - (+store.get(PUB_TIME_KEY, 0) || 0) < PUB_MAX_AGE; }
  /** Máy chủ chắc chắn có tính năng f (đã biết cấu hình và trong danh sách features). */
  function has(f) {
    const p = store.get(PUB_KEY, null);
    return !!(p && Array.isArray(p.features) && p.features.indexOf(f) >= 0) && !unsupported[f];
  }
  /** Đáng thử gọi action (chưa biết cấu hình máy chủ thì cứ thử, lỗi "Không có chức năng" sẽ dùng đường dự phòng). */
  function canTry(action) {
    const f = FEATURE_OF[action] || action;
    if (unsupported[action] || unsupported[f]) return false;
    const p = store.get(PUB_KEY, null);
    return !p || has(f);
  }

  /* ---------- gọi máy chủ ---------- */
  let onAuthError = null;
  async function api(action, body, opts) {
    opts = opts || {};
    if (!CFG.API_URL) throw new Error('Chưa cấu hình địa chỉ máy chủ (API_URL trong assets/js/config.js).');
    const payload = Object.assign({ action }, body || {});
    if (opts.tokenKey !== false) {
      const tok = store.get(opts.tokenKey || App.tokenKey);
      if (tok && !payload.token) payload.token = tok;
    }
    let res, data;
    for (let attempt = 0; attempt < (opts.retries || 1) + 1; attempt++) {
      try {
        res = await fetch(CFG.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          redirect: 'follow'
        });
        data = await res.json();
        break;
      } catch (e) {
        if (attempt >= (opts.retries || 1)) {
          const err = new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
          err.network = true;
          throw err;
        }
        await sleep(800 * (attempt + 1));
      }
    }
    if (!data.ok) {
      const msg = String(data.error || 'Lỗi không xác định');
      if (/^AUTH:/.test(msg)) {
        clearCache();
        if (onAuthError) onAuthError(msg.replace(/^AUTH:\s*/, ''));
        const err = new Error(msg.replace(/^AUTH:\s*/, ''));
        err.auth = true;
        throw err;
      }
      const m = msg.match(/^Không có chức năng: (\S+)/);
      if (m) {
        // Máy chủ cũ chưa có action này: ghi nhớ trong phiên, nơi gọi tự dùng đường dự phòng (không hiện lỗi đỏ).
        unsupported[m[1]] = true;
        if (FEATURE_OF[m[1]]) unsupported[FEATURE_OF[m[1]]] = true;
        const err = new Error('Chức năng này cần cập nhật máy chủ.');
        err.unsupported = true;
        throw err;
      }
      throw new Error(msg);
    }
    return data.data;
  }

  /* ---------- bộ đệm trình duyệt: "hiện ngay – cập nhật ngầm" ----------
   * Học sinh: localStorage, khóa ld_c_v1_<mã HS>_<tên>, tổng ≤ 1 MB/người (quá thì bỏ khóa cũ nhất).
   * Giáo viên: sessionStorage (mất khi đóng tab), khóa ld_c_v1_admin_<tên>.
   * Không bao giờ lưu dữ liệu có đáp án, lời giải hay PIN. */
  const C_ROOT = 'ld_c_', C_PREFIX = 'ld_c_v1_', C_MAX = 1024 * 1024;
  const FORBIDDEN = /"(dapAn|loiGiai|pin)"\s*:/;
  let scope = null; // { st: Storage, prefix }
  const storageOf = (kind) => { try { return kind === 'session' ? window.sessionStorage : window.localStorage; } catch (e) { return null; } };
  function setCacheScope(kind, id) {
    const st = storageOf(kind);
    scope = st && id ? { st, prefix: C_PREFIX + String(id).replace(/[^\w-]/g, '') + '_', limit: kind === 'session' ? Infinity : C_MAX } : null;
  }
  function scopeKeys() {
    const out = [];
    if (!scope) return out;
    try { for (let i = 0; i < scope.st.length; i++) { const k = scope.st.key(i); if (k && k.indexOf(scope.prefix) === 0) out.push(k); } } catch (e) { /* bỏ qua */ }
    return out;
  }
  function cacheGet(key) {
    if (!scope) return null;
    try { const v = JSON.parse(scope.st.getItem(scope.prefix + key)); return v && 'd' in v ? v : null; } catch (e) { return null; }
  }
  let epoch = 0; // tăng mỗi lần cacheDel: lời gọi bắt đầu trước khi xóa sẽ không cất lại bản cũ
  /** Thẻ "kho hiện tại": lấy trước khi gọi máy chủ, đưa vào cacheSet để không ghi nhầm kho người khác / bản cũ. */
  function cacheToken() { return { sc: scope, ep: epoch }; }
  function cacheSet(key, data, tok) {
    if (!scope) return;
    if (tok && (tok.sc !== scope || tok.ep !== epoch)) return;
    let json;
    try { json = JSON.stringify({ t: Date.now(), d: data }); } catch (e) { return; }
    if (FORBIDDEN.test(json)) return; // an toàn: không lưu đáp án / lời giải / PIN
    const full = scope.prefix + key;
    const size = (k) => { try { return (k.length + (scope.st.getItem(k) || '').length) * 2; } catch (e) { return 0; } };
    if ((full.length + json.length) * 2 > scope.limit) return;
    const others = scopeKeys().filter((k) => k !== full).map((k) => {
      let t = 0;
      try { t = JSON.parse(scope.st.getItem(k)).t || 0; } catch (e) { /* hỏng → bỏ trước */ }
      return { k, t, n: size(k) };
    }).sort((a, b) => a.t - b.t);
    let total = others.reduce((s, o) => s + o.n, 0) + (full.length + json.length) * 2;
    while (total > scope.limit && others.length) { const o = others.shift(); total -= o.n; try { scope.st.removeItem(o.k); } catch (e) { /* bỏ qua */ } }
    for (let i = 0; i < 3; i++) {
      try { scope.st.setItem(full, json); return; } catch (e) {
        const o = others.shift(); // kho đầy: bỏ khóa cũ nhất rồi thử lại
        if (!o) return;
        try { scope.st.removeItem(o.k); } catch (e2) { /* bỏ qua */ }
      }
    }
  }
  /** Xóa khóa đệm trong phạm vi hiện tại; tên kết thúc bằng * là xóa theo tiền tố. */
  function cacheDel(...keys) {
    epoch++;
    if (!scope) return;
    scopeKeys().forEach((k) => {
      const name = k.slice(scope.prefix.length);
      if (keys.some((p) => (p.endsWith('*') ? name.indexOf(p.slice(0, -1)) === 0 : name === p))) { try { scope.st.removeItem(k); } catch (e) { /* bỏ qua */ } }
    });
  }
  /** Đăng xuất / lỗi AUTH: xóa mọi ld_c_* trong cả hai kho, và ld_lastResult. */
  function clearCache() {
    ['local', 'session'].forEach((kind) => {
      const st = storageOf(kind);
      if (!st) return;
      try {
        const del = [];
        for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k && (k.indexOf(C_ROOT) === 0 || k === 'ld_lastResult')) del.push(k); }
        del.forEach((k) => st.removeItem(k));
      } catch (e) { /* bỏ qua */ }
    });
  }

  let viewId = 0;
  /** Gọi ở đầu mỗi lần chuyển màn: dữ liệu về muộn của màn cũ sẽ không vẽ đè màn mới. */
  function newView() { ++viewId; syncPill(false); return viewId; }
  /** Màn đang xem: lấy ở đầu màn, so lại sau mỗi `await` (đã chuyển màn thì không vẽ). */
  const currentView = () => viewId;
  const viewIs = (id) => id === viewId;

  // Chỉ báo "Đang cập nhật…" đếm theo từng màn: chỉ hiện khi màn ĐANG XEM còn lời gọi chưa xong
  const syncing = {};
  function syncPill(on, id) {
    if (id != null) {
      syncing[id] = Math.max(0, (syncing[id] || 0) + (on ? 1 : -1));
      if (!syncing[id]) delete syncing[id];
    }
    let el = document.getElementById('syncPill');
    if (!el) {
      if (!document.body) return;
      el = document.createElement('div');
      el.id = 'syncPill';
      el.className = 'sync-pill hidden';
      el.setAttribute('role', 'status');
      el.innerHTML = '<span class="spinner"></span><span>Đang cập nhật…</span>';
      document.body.appendChild(el);
    }
    el.classList.toggle('hidden', !syncing[viewId]);
  }

  /**
   * Có bản lưu thì vẽ ngay render(data, {stale:true}) rồi gọi loader() ngầm; dữ liệu mới khác thì vẽ lại (giữ vị trí cuộn).
   * Chưa có bản lưu thì vẽ opts.skeleton() rồi chờ loader(). Lỗi mạng khi đã có bản lưu: chỉ hiện thông báo nhẹ.
   */
  async function cached(key, loader, render, opts) {
    opts = opts || {};
    const my = viewId;
    let hit = cacheGet(key);
    if (hit) {
      try { render(hit.d, { stale: true }); } catch (e) {
        // bản lưu hỏng / sai định dạng: bỏ đi, tải lại như chưa có đệm
        hit = null;
        cacheDel(key);
      }
    }
    const tok = cacheToken(); // đổi người dùng / xóa đệm giữa chừng thì không ghi dữ liệu cũ vào kho
    if (hit) syncPill(true, my);
    else if (opts.skeleton) opts.skeleton();
    try {
      const d = await loader();
      cacheSet(key, d, tok);
      if (my === viewId && (!hit || JSON.stringify(hit.d) !== JSON.stringify(d))) {
        const y = window.scrollY;
        render(d, { stale: false });
        if (hit) window.scrollTo(0, y);
      }
      return d;
    } catch (e) {
      if (my !== viewId) return undefined; // đã sang màn khác (hoặc lỗi AUTH đã chuyển về đăng nhập): không vẽ lỗi đè lên
      if (hit && !e.auth && !e.unsupported) {
        // đang hiện bản lưu: giữ nguyên, chỉ báo nhẹ (mất mạng hoặc máy chủ tạm lỗi)
        toast(e.network ? 'Mất kết nối — đang hiện dữ liệu đã lưu trên máy.' : 'Chưa cập nhật được (' + e.message + ') — đang hiện dữ liệu đã lưu.');
        return hit.d;
      }
      throw e;
    } finally {
      if (hit) syncPill(false, my);
    }
  }

  /** Khung xương khi chưa có dữ liệu. kind: 'cards' (trang chủ), 'table' (bảng), 'stats' */
  function skeletonHtml(kind) {
    const line = (w) => `<div class="skeleton sk-line" style="width:${w}"></div>`;
    const stats = (n) => `<div class="stats">${'<div class="stat skeleton sk-stat"></div>'.repeat(n)}</div>`;
    let h = `<div class="sk-wrap" aria-busy="true" aria-label="Đang tải">${line('40%').replace('sk-line', 'sk-line sk-title')}`;
    if (kind === 'cards') h += stats(4) + line('25%') + `<div class="grid grid-3">${'<div class="card skeleton sk-card"></div>'.repeat(3)}</div>`;
    else if (kind === 'stats') h += stats(3) + '<div class="card skeleton sk-card"></div><div class="card skeleton sk-chart"></div>';
    else h += `<div class="table-wrap sk-table">${Array.from({ length: 6 }, () => `<div class="sk-row">${line('100%')}</div>`).join('')}</div>`;
    return h + '</div>';
  }

  /* ---------- định dạng ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtNum = (n, d) => {
    if (n == null || n === '' || isNaN(n)) return '—';
    const v = Math.round(Number(n) * 100) / 100;
    return (d != null ? v.toFixed(d) : String(v)).replace('.', ',');
  };
  const fmtDateIso = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    const p = (x) => String(x).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const fmtClock = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const p = (x) => String(x).padStart(2, '0');
    return (h ? h + ':' + p(m) : p(m)) + ':' + p(s);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const scoreClass = (d) => (d >= 8 ? 'badge-good' : d < 5 ? 'badge-bad' : 'badge-primary');
  const gradeName = (d) => (d >= 9 ? 'Xuất sắc' : d >= 8 ? 'Giỏi' : d >= 6.5 ? 'Khá' : d >= 5 ? 'Trung bình' : 'Cần cố gắng');
  const LEVELS = { NB: 'Nhận biết', TH: 'Thông hiểu', VD: 'Vận dụng', VDC: 'Vận dụng cao' };
  const TYPES = { TN: 'Trắc nghiệm', DS: 'Đúng/Sai', TL: 'Trả lời ngắn' };
  const PRACTICE_KIEU = { TU_TAO: 'Tự tạo đề', CAU_SAI: 'Luyện câu đã sai', NHANH: 'Đề nhanh' };
  const PARTS = { 1: 'PHẦN I. Trắc nghiệm nhiều phương án lựa chọn', 2: 'PHẦN II. Trắc nghiệm đúng sai', 3: 'PHẦN III. Trắc nghiệm trả lời ngắn' };

  /**
   * Nội dung câu hỏi: giữ xuống dòng, cho phép **đậm**, *nghiêng*, ảnh ![](url); công thức $...$ do KaTeX hiển thị.
   * Khối bảng (định dạng kho câu hỏi): dòng "[BẢNG] Cột 1 | Cột 2" rồi các dòng "ô | ô" liền sau → <table>.
   */
  function rich(text) {
    // tách công thức ra trước để không bị định dạng nhầm
    const keep = [];
    const s = String(text == null ? '' : text).replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/g, (m) => { keep.push(m); return `\u0000${keep.length - 1}\u0000`; });
    const inline = (t) => {
      let h = esc(t);
      h = h.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (m, alt, url) => `<img src="${url}" alt="${alt}" loading="lazy">`);
      h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
      h = h.replace(/(^|[^*\\])\*([^*\n]+)\*/g, '$1<i>$2</i>');
      return h.replace(/\n/g, '<br>');
    };
    const lines = s.split('\n');
    const out = [];
    let buf = [];
    const flush = () => { if (buf.length) out.push(inline(buf.join('\n'))); buf = []; };
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*\[BẢNG\]\s*(.*)$/i);
      if (!m) { buf.push(lines[i]); continue; }
      if (buf.length && buf[buf.length - 1].trim() === '') buf.pop(); // dòng trống ngay trước bảng
      flush();
      const rows = m[1].trim() ? [m[1]] : [];
      while (i + 1 < lines.length && lines[i + 1].indexOf('|') >= 0 && lines[i + 1].trim()) rows.push(lines[++i]);
      const cells = rows.map((r) => r.split('|').map((c) => c.trim()));
      const n = Math.max(1, ...cells.map((r) => r.length));
      const tr = (r, tag) => `<tr>${Array.from({ length: n }, (_, j) => `<${tag}>${inline(r[j] || '')}</${tag}>`).join('')}</tr>`;
      out.push(`<div class="table-wrap q-table-wrap"><table class="q-table">${cells.length ? `<thead>${tr(cells[0], 'th')}</thead>` : ''}<tbody>${cells.slice(1).map((r) => tr(r, 'td')).join('')}</tbody></table></div>`);
    }
    flush();
    // dấu phẩy thập phân kiểu Việt Nam trong công thức: 2,67 → 2{,}67 để KaTeX không chèn khoảng trắng
    return out.join('').replace(/\u0000(\d+)\u0000/g, (m, i) => esc(keep[+i].replace(/(\d),(?=\d)/g, '$1{,}')));
  }

  function math(el) {
    if (!el || !window.renderMathInElement) return;
    try {
      window.renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    } catch (e) { /* bỏ qua lỗi công thức */ }
  }

  /* ---------- giao diện nhỏ ---------- */
  function toast(msg, type) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; wrap.setAttribute('role', 'status'); document.body.appendChild(wrap); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), type === 'err' ? 6000 : 3500);
  }

  function modal(html, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'overlay';
      ov.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
      document.body.appendChild(ov);
      const close = (v) => { ov.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape' && !opts.sticky) close(null); };
      document.addEventListener('keydown', onKey);
      ov.addEventListener('click', (e) => {
        if (e.target === ov && !opts.sticky) close(null);
        const b = e.target.closest('[data-close]');
        if (b) close(b.getAttribute('data-close'));
      });
      if (opts.onOpen) opts.onOpen(ov.querySelector('.modal'), close);
      math(ov);
    });
  }

  function confirmBox(title, text, okText, danger) {
    return modal(`<h2>${esc(title)}</h2><p>${text}</p>
      <div class="modal-actions"><button class="btn" data-close="">Hủy</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-close="ok">${esc(okText || 'Đồng ý')}</button></div>`).then((v) => v === 'ok');
  }

  const loadingHtml = (t) => `<div class="loading"><div class="spinner"></div><div>${esc(t || 'Đang tải…')}</div></div>`;

  async function withBusy(btn, fn) {
    const old = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:3px"></span> Đang xử lý…'; }
    try { return await fn(); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = old; } }
  }

  /* ---------- Google ---------- */
  let gsiPromise = null;
  function loadGoogle() {
    if (gsiPromise) return gsiPromise;
    gsiPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve(window.google);
      s.onerror = () => reject(new Error('Không tải được Google Sign-In'));
      document.head.appendChild(s);
    });
    return gsiPromise;
  }
  async function renderGoogleButton(el, clientId, callback) {
    if (!clientId || !el) return false;
    try {
      const google = await loadGoogle();
      google.accounts.id.initialize({ client_id: clientId, callback: (r) => callback(r.credential), ux_mode: 'popup' });
      google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'vi', width: Math.min(320, el.clientWidth || 320) });
      return true;
    } catch (e) { el.innerHTML = `<span class="muted small">${esc(e.message)}</span>`; return false; }
  }

  /* ---------- hiển thị kết quả (dùng cho cả HS và GV) ---------- */
  function barsHtml(groups, labelKey) {
    if (!groups || !groups.length) return '<div class="muted small">Chưa có dữ liệu.</div>';
    return '<div class="bars">' + groups.map((g) => {
      const cls = g.pct >= 80 ? 'hi' : g.pct < 50 ? 'lo' : '';
      return `<div class="bar-row"><div>${esc(g[labelKey || 'name'])} <span class="muted small">(${g.count} câu)</span></div>
        <div class="bar" role="img" aria-label="${g.pct}%"><i class="${cls}" style="width:${Math.max(2, g.pct)}%"></i></div><b class="num">${g.pct}%</b></div>`;
    }).join('') + '</div>';
  }

  const FB_ICON = { good: '✓', warn: '!', info: 'i', tip: '➜' };
  function feedbackHtml(list) {
    if (!list || !list.length) return '';
    return '<ul class="fb-list">' + list.map((f) => `<li class="fb-${f.type}"><span class="ic">${FB_ICON[f.type] || '•'}</span><span>${esc(f.text)}</span></li>`).join('') + '</ul>';
  }

  function questionReviewHtml(it) {
    const head = `<div class="q-head"><span><span class="q-num">Câu ${it.stt}</span>
      <span class="badge">${TYPES[it.loai] || it.loai}</span> ${it.chuDe ? `<span class="badge">${esc(it.chuDe)}</span>` : ''}
      ${it.mucDo ? `<span class="badge">${LEVELS[it.mucDo] || esc(it.mucDo)}</span>` : ''}</span>
      <span class="review-tag ${it.correct ? 'ok' : 'no'}">${it.correct ? '✓ Đúng' : (it.score > 0 ? '◐ Đúng một phần' : '✗ Sai')} · ${fmtNum(it.score)}/${fmtNum(it.max)}</span></div>`;
    let body = `<div class="q-body">${rich(it.noiDung)}</div>${it.hinhAnh ? `<img class="q-img" src="${esc(it.hinhAnh)}" alt="Hình câu ${it.stt}" loading="lazy">` : ''}`;
    if (it.go) {
      // bài luyện tập: câu đã bị xóa khỏi pool / đề nguồn đã sửa (Pha 4)
      body = `<div class="notice warn q-gone">Câu đã bị gỡ khỏi ngân hàng.</div><div class="muted small" style="margin-top:6px">Bạn trả lời: <b>${esc(it.loai === 'DS' ? String(it.answer || '').replace(/D/g, 'Đ') : it.answer || '(bỏ trống)')}</b></div>`;
    } else if (it.an) {
      // câu đang nằm trong đề thi chưa kết thúc: không có đáp án / lời giải (Pha 4, R-2)
      if (it.loai !== 'TL') body += '<div>' + ['A', 'B', 'C', 'D'].map((k, i) => `<div class="small"><b>${it.loai === 'DS' ? 'abcd'[i] + ')' : k + '.'}</b> ${rich(it[k])}</div>`).join('') + '</div>';
      body += `<div class="small" style="margin-top:6px">Bạn trả lời: <b>${esc(it.loai === 'DS' ? String(it.answer || '').replace(/D/g, 'Đ') : it.answer || '(bỏ trống)')}</b></div>
        <div class="notice q-hidden" style="margin-top:6px">${esc(it.anNote || 'Đáp án và lời giải sẽ hiện khi đề thi chứa câu này kết thúc.')}</div>`;
    } else if (it.loai === 'TN') {
      body += '<div class="opts">' + ['A', 'B', 'C', 'D'].map((k) => {
        const cls = k === it.dapAn ? 'right' : (k === it.answer ? 'wrong' : '');
        return `<button class="opt ${cls}" disabled><span class="key">${k}</span><span>${rich(it[k])}</span></button>`;
      }).join('') + '</div>';
      if (!it.answer) body += '<div class="muted small" style="margin-top:6px">Bạn chưa chọn đáp án.</div>';
    } else if (it.loai === 'DS') {
      const ans = String(it.answer || '____').split('');
      const key = String(it.dapAn || '').split('');
      body += '<div>' + ['A', 'B', 'C', 'D'].map((k, i) => {
        const btn = (v) => {
          let cls = '';
          if (ans[i] === v) cls = ans[i] === key[i] ? 'right' : 'wrong';
          else if (key[i] === v) cls = 'key-mark';
          return `<button class="${cls}" disabled>${v === 'D' ? 'Đ' : 'S'}</button>`;
        };
        return `<div class="tf-row"><div class="tf-text"><b>${'abcd'[i]})</b> ${rich(it[k])}</div><div class="tf-btns">${btn('D')}${btn('S')}</div></div>`;
      }).join('') + '</div><div class="muted small">Đáp án đúng: <b>' + key.map((x) => (x === 'D' ? 'Đ' : 'S')).join(' ') + '</b> · Bạn đúng ' + (it.nCorrect || 0) + '/4 ý.</div>';
    } else {
      body += `<div>Bạn trả lời: <b>${esc(it.answer || '(bỏ trống)')}</b> · Đáp án: <b>${esc(String(it.dapAn || '').split('|').join(' hoặc '))}</b></div>`;
    }
    if (it.loiGiai) body += `<div class="solution"><b>Lời giải:</b> ${rich(it.loiGiai)}</div>`;
    return `<div class="q" id="rv-${it.stt}" data-status="${itemStatus(it)}">${head}${body}</div>`;
  }

  /** ok | part (đúng một phần) | wrong | blank (bỏ trống) */
  function itemStatus(it) {
    const blank = !it.answer || /^_+$/.test(String(it.answer));
    if (it.score >= it.max - 1e-9 && it.max > 0) return 'ok';
    if (blank) return 'blank';
    return it.score > 0 ? 'part' : 'wrong';
  }

  /* ---------- khung "Mục tiêu" ---------- */
  function goalHtml(v, opts) {
    const g = v.goal;
    if (!g) return '';
    const pct = Math.max(3, Math.min(100, Math.round(v.diem / g.mucTieu * 100)));
    const nWrong = (v.items || []).filter((it) => itemStatus(it) !== 'ok').length;
    if (g.dat) {
      const next = Math.min(10, Math.ceil((v.diem + 0.5) * 2) / 2);
      const msg = g.chenh >= 1.5 ? `Bạn đã vượt xa mục tiêu! Lần sau hãy thử thách bản thân với mục tiêu <b>${fmtNum(next)}</b> điểm.`
        : v.diem >= 10 ? 'Điểm tuyệt đối — xuất sắc! Thử sức với đề khó hơn nhé.'
        : `Giữ vững phong độ này nhé! Lần sau có thể đặt mục tiêu <b>${fmtNum(next)}</b> điểm.`;
      return `<div class="card goal-card goal-ok"><div class="goal-head"><span class="goal-ic">🎉</span><div>
        <h2>Đạt mục tiêu!</h2><div>Mục tiêu <b>${fmtNum(g.mucTieu)}</b> · Đạt <b>${fmtNum(v.diem)}</b>${g.chenh > 0 ? ` · vượt ${fmtNum(g.chenh)} điểm` : ''}</div></div></div>
        <p style="margin:10px 0 0">${msg}</p></div>`;
    }
    const gap = -g.chenh;
    const cheer = gap <= 0.5 ? 'Chỉ thiếu một chút nữa thôi! Đúng thêm 1–2 câu là bạn chạm mục tiêu rồi.'
      : gap <= 1.5 ? 'Bạn đang ở rất gần mục tiêu. Xem lại các câu sai, lấp chỗ còn hổng là lần sau sẽ đạt.'
      : gap <= 3 ? 'Đừng nản! Mục tiêu vẫn trong tầm tay — luyện thêm vài đề cùng chủ đề sẽ giúp bạn tiến bộ rõ rệt.'
      : 'Không sao cả, mỗi lần làm bài là một lần học thêm. Hãy ôn lại phần cơ bản rồi chinh phục dần — có thể đặt mục tiêu vừa sức hơn để tiến từng bước.';
    const prog = g.lanTruoc != null && v.diem > g.lanTruoc ? `<p style="margin:8px 0 0">📈 Bạn đã tiến bộ <b>+${fmtNum(v.diem - g.lanTruoc)}</b> điểm so với lần làm trước — đang đi đúng hướng!</p>` : '';
    let plan = '';
    if (!opts.showName && v.luyenTap) {
      // bài luyện tập (Pha 4): không gợi ý đề thi; mời luyện tiếp
      const steps = [];
      if (nWrong) steps.push(`<button class="btn btn-sm" data-showwrong>📖 Xem lời giải ${nWrong} câu chưa đúng</button>`);
      steps.push('<a class="btn btn-sm" href="#/luyen-tap">🔁 Luyện tiếp</a>');
      plan = `<h3 style="margin-top:16px">Kế hoạch để đạt mục tiêu</h3><div class="row">${steps.join('')}</div>`;
    } else if (!opts.showName) {
      const steps = [];
      if (v.reveal && nWrong) steps.push(`<button class="btn btn-sm" data-showwrong>📖 Xem lời giải ${nWrong} câu chưa đúng</button>`);
      if (g.lamLai) steps.push(`<a class="btn btn-sm" href="#/lam-bai/${encodeURIComponent(v.examId)}">🔁 Làm lại đề này</a>`);
      const sug = (g.goiY || []).map((x) => `<a class="sug" href="#/lam-bai/${encodeURIComponent(x.id)}">
          <b>${esc(x.tieuDe)}</b><span class="small">${esc(x.lyDo)}</span>
          <span class="muted small">${x.soCau} câu · ${x.thoiGian} phút${x.diemCaoNhat != null ? ' · bạn từng đạt ' + fmtNum(x.diemCaoNhat) : ''}</span></a>`).join('');
      plan = `<h3 style="margin-top:16px">Kế hoạch để đạt mục tiêu</h3>
        ${steps.length ? `<div class="row">${steps.join('')}</div>` : ''}
        ${sug ? `<div class="small muted" style="margin:12px 0 6px">Đề luyện tập có nội dung tương tự:</div><div class="sug-list">${sug}</div>`
          : '<div class="small muted" style="margin-top:10px">Hiện chưa có đề tương tự đang mở — hãy làm lại đề này sau khi xem lời giải.</div>'}`;
    }
    return `<div class="card goal-card goal-miss"><div class="goal-head"><span class="goal-ic">💪</span><div>
      <h2>Chưa đạt mục tiêu — còn thiếu ${fmtNum(gap)} điểm</h2><div>Mục tiêu <b>${fmtNum(g.mucTieu)}</b> · Đạt <b>${fmtNum(v.diem)}</b></div></div></div>
      <div class="goal-bar" role="img" aria-label="Đạt ${pct}% mục tiêu"><i style="width:${pct}%"></i><span>${pct}% mục tiêu</span></div>
      <p style="margin:10px 0 0">${cheer}</p>${prog}${plan}</div>`;
  }

  /* ---------- khung "Nhận xét" chia mục ---------- */
  function reviewSummaryHtml(v) {
    const items = v.items || [];
    // 1) Kết quả từng phần
    const parts = {};
    items.forEach((it) => {
      const p = it.phan || (it.loai === 'TN' ? 1 : it.loai === 'DS' ? 2 : 3);
      const g = parts[p] = parts[p] || { p, loai: it.loai, n: 0, ok: 0, ideas: 0, score: 0, max: 0 };
      g.n++; g.score += +it.score || 0; g.max += +it.max || 0;
      if (itemStatus(it) === 'ok') g.ok++;
      g.ideas += +it.nCorrect || 0;
    });
    const PART_NAME = { 1: 'Phần I · Trắc nghiệm', 2: 'Phần II · Đúng/Sai', 3: 'Phần III · Trả lời ngắn' };
    const partCards = Object.keys(parts).sort().map((k) => {
      const g = parts[k];
      const pct = g.max ? Math.round(g.score / g.max * 100) : 0;
      const main = g.loai === 'DS' ? `${g.ideas}/${g.n * 4} ý đúng` : `${g.ok}/${g.n} câu đúng`;
      const cls = pct >= 80 ? 'hi' : pct < 50 ? 'lo' : '';
      return `<div class="part-card"><div class="muted small">${PART_NAME[k] || 'Phần ' + k}</div><b>${main}</b>
        <div class="bar"><i class="${cls}" style="width:${Math.max(2, pct)}%"></i></div><div class="small muted">${fmtNum(g.score)}/${fmtNum(g.max)} điểm</div></div>`;
    }).join('');

    // 2) Câu cần xem lại
    let review = '';
    if (v.reveal) {
      const bad = items.filter((it) => itemStatus(it) !== 'ok');
      const LABEL = { wrong: 'Sai', part: 'Đúng một phần', blank: 'Bỏ trống' };
      const chip = (it) => {
        const st = itemStatus(it);
        const extra = it.loai === 'DS' ? ` · ${it.nCorrect || 0}/4 ý` : '';
        return `<button class="chip chip-${st}" data-jump="${it.stt}" title="${esc(it.chuDe || '')}">Câu ${it.stt}<span>${LABEL[st]}${extra}</span></button>`;
      };
      review = `<div class="fb-sec"><h3>Câu cần xem lại ${bad.length ? `<span class="muted small">(${bad.length} câu — bấm để xem lời giải)</span>` : ''}</h3>
        ${bad.length ? `<div class="chips">${['wrong', 'part', 'blank'].map((s) => bad.filter((it) => itemStatus(it) === s).map(chip).join('')).join('')}</div>`
          : '<div class="notice">🎉 Bạn làm đúng tất cả các câu!</div>'}</div>`;
    }

    // 3) Nhận xét: gom theo nhóm, bỏ các dòng đã thể hiện ở trên
    const fb = (v.feedback || []).filter((f) => !/^(Kết quả:|Phần (trắc nghiệm|Đúng\/Sai|trả lời ngắn)|Còn bỏ trống|Mục tiêu)/i.test(f.text));
    const list = (arr, type) => `<ul class="fb-list">${arr.map((f) => `<li class="fb-${type}"><span class="ic">${FB_ICON[type]}</span><span>${esc(f.text)}</span></li>`).join('')}</ul>`;
    const good = fb.filter((f) => f.type === 'good');
    const warn = fb.filter((f) => f.type === 'warn');
    const tips = fb.filter((f) => f.type === 'tip' || f.type === 'info');
    let cols = '';
    if (good.length || warn.length) {
      cols = `<div class="grid grid-2 fb-cols">
        <div class="fb-sec"><h3 class="ok-h">✓ Điểm mạnh</h3>${good.length ? list(good, 'good') : '<div class="muted small">Chưa có — cố gắng ở lần sau nhé!</div>'}</div>
        <div class="fb-sec"><h3 class="warn-h">! Cần cải thiện</h3>${warn.length ? list(warn, 'warn') : '<div class="muted small">Không có điểm yếu đáng kể.</div>'}</div></div>`;
    }
    const tipHtml = tips.length ? `<div class="fb-sec"><h3>➜ Lời khuyên</h3>${list(tips, 'tip')}</div>` : '';
    return `<div class="card"><h2>Nhận xét</h2>
      <div class="fb-sec"><h3>Kết quả từng phần</h3><div class="part-cards">${partCards}</div></div>
      ${review}${cols}${tipHtml}</div>`;
  }

  // Bấm chip "Câu x" → cuộn tới câu đó; lọc "Chỉ câu sai"
  document.addEventListener('click', (e) => {
    const j = e.target.closest('[data-jump]');
    if (j) {
      const f = document.querySelector('[data-rvfilter="all"]');
      if (f && !f.classList.contains('active')) f.click();
      const el = document.getElementById('rv-' + j.dataset.jump);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      }
      return;
    }
    if (e.target.closest('[data-showwrong]')) {
      const w = document.querySelector('[data-rvfilter="wrong"]');
      if (w) w.click();
      const d = document.getElementById('rvDetail');
      if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const r = e.target.closest('[data-rvfilter]');
    if (r) {
      const only = r.dataset.rvfilter === 'wrong';
      r.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === r));
      document.querySelectorAll('#rvDetail .q[data-status]').forEach((q) => q.classList.toggle('hidden', only && q.dataset.status === 'ok'));
    }
  });

  function resultHtml(v, opts) {
    opts = opts || {};
    const p = Math.round((v.diem || 0) * 10);
    const ring = v.diem >= 8 ? 'var(--good)' : v.diem < 5 ? 'var(--bad)' : 'var(--primary)';
    let h = `<div class="card"><div class="score-hero">
      <div class="score-ring" style="--p:${p};--ring:${ring}"><div><div><b>${fmtNum(v.diem)}</b><br><span>/ 10 điểm</span></div></div></div>
      <div style="flex:1;min-width:220px">
        <h1 style="margin-bottom:4px">${esc(v.tieuDe)}</h1>
        ${opts.showName ? `<div><b>${esc(v.hoTen)}</b> — Lớp ${esc(v.lop)}</div>` : ''}
        ${v.luyenTap ? `<div class="small"><span class="badge badge-primary" id="practiceBadge">Luyện tập${PRACTICE_KIEU[v.kieu] ? ' · ' + PRACTICE_KIEU[v.kieu] : ''}</span> <span class="muted">không tính vào bảng xếp hạng</span></div>` : ''}
        <div class="row" style="margin:6px 0"><span class="badge ${scoreClass(v.diem)}">${gradeName(v.diem)}</span>
          <span class="badge">Đúng ${v.soCauDung}/${v.tongCau} câu</span><span class="badge">${fmtNum(v.diemGoc)}/${fmtNum(v.diemToiDa)} điểm gốc</span></div>
        <div class="muted small">Thời gian làm: ${esc(v.thoiGianLam)} · Nộp lúc ${esc(v.nopLuc)}${v.ghiChu ? ' · <b>' + esc(v.ghiChu) + '</b>' : ''}</div>
        ${opts.actions || ''}
      </div></div></div>`;
    h += goalHtml(v, opts);
    h += reviewSummaryHtml(v);
    const b = v.breakdown || {};
    h += `<div class="grid grid-2 section-gap">
      <div class="card"><h3>Theo chủ đề</h3>${barsHtml(b.byTopic)}</div>
      <div class="card"><h3>Theo mức độ & dạng câu</h3>${barsHtml(b.byLevel)}<div style="height:14px"></div>${barsHtml(b.byType)}</div></div>`;
    h += '<div class="section-gap" id="rvDetail">';
    if (v.reveal) {
      const nWrong = v.items.filter((it) => itemStatus(it) !== 'ok').length;
      h += `<div class="card-title"><h2>Chi tiết bài làm</h2>${nWrong ? `<div class="seg no-print" role="group" aria-label="Lọc câu">
        <button class="active" data-rvfilter="all">Tất cả (${v.items.length})</button><button data-rvfilter="wrong">Chỉ câu sai (${nWrong})</button></div>` : ''}</div>`;
      h += v.items.map(questionReviewHtml).join('');
    } else {
      h += `<h2>Chi tiết bài làm</h2><div class="notice">${esc(v.revealNote)}</div><div class="table-wrap section-gap"><table><thead><tr><th>Câu</th><th>Dạng</th><th>Chủ đề</th><th>Bạn trả lời</th></tr></thead><tbody>` +
        v.items.map((it) => `<tr><td>${it.stt}</td><td>${TYPES[it.loai] || ''}</td><td>${esc(it.chuDe || '')}</td><td>${esc(it.loai === 'DS' ? String(it.answer || '').replace(/D/g, 'Đ') : it.answer || '—')}</td></tr>`).join('') +
        '</tbody></table></div>';
    }
    return h + '</div>';
  }

  /* ---------- biểu đồ ---------- */
  const charts = {};
  function chart(id, config) {
    if (!window.Chart) return;
    if (charts[id]) charts[id].destroy();
    const el = document.getElementById(id);
    if (!el) return;
    const css = getComputedStyle(document.documentElement);
    window.Chart.defaults.color = css.getPropertyValue('--muted').trim();
    window.Chart.defaults.borderColor = css.getPropertyValue('--border').trim();
    window.Chart.defaults.font.family = css.getPropertyValue('--font').trim();
    charts[id] = new window.Chart(el, config);
  }
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /* ---------- xuất CSV (mở được bằng Excel) ---------- */
  function downloadCsv(filename, rows) {
    const csv = rows.map((r) => r.map((v) => {
      const s = v == null ? '' : String(v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  const App = {
    CFG, store, api, has, canTry, savePub, pubFresh, cached, cacheGet, cacheSet, cacheDel, cacheToken, clearCache, setCacheScope, newView, currentView, viewIs, skeletonHtml,
    esc, fmtNum, fmtDateIso, fmtClock, sleep, rich, math, toast, modal, confirmBox, loadingHtml, withBusy,
    renderGoogleButton, resultHtml, feedbackHtml, barsHtml, questionReviewHtml, chart, cssVar, downloadCsv, scoreClass, gradeName,
    LEVELS, TYPES, PARTS, PRACTICE_KIEU, tokenKey: 'ld_token',
    setAuthErrorHandler(fn) { onAuthError = fn; }
  };
  window.App = App;
})();
