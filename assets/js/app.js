/* Trang học sinh */
(function () {
  'use strict';
  const { api, esc, fmtNum, fmtClock, rich, math, toast, modal, confirmBox, loadingHtml, withBusy, store, cached } = App;
  App.tokenKey = 'ld_token';
  const $app = document.getElementById('app');
  const ATTEMPT_KEY = 'ld_attempt';
  let pub = { appName: 'Luyện đề Vật lý', googleClientId: '', showLeaderboard: true };
  let user = store.get('ld_user', null);
  let timerId = null;
  if (user) App.setCacheScope('local', user.id);

  App.setAuthErrorHandler((msg) => { logout(true); toast(msg, 'err'); });

  /* ---------- khởi động ---------- */
  async function boot() {
    if (!App.CFG.API_URL) {
      $app.innerHTML = `<div class="card narrow"><h1>Chưa kết nối máy chủ</h1>
        <p>Trang web cần được nối với máy chủ Google Apps Script trước khi dùng.</p>
        <p class="muted">Giáo viên: mở file <code>assets/js/config.js</code> và dán URL ứng dụng web vào <code>API_URL</code>. Xem hướng dẫn trong README.</p></div>`;
      return;
    }
    const saved = store.get('ld_pub', null);
    if (saved) applyPub(saved);
    // Không gọi lại publicConfig nếu bản lưu mới hơn 10 phút (bootstrap cũng trả cấu hình)
    if (!App.pubFresh()) refreshPub();
    window.addEventListener('hashchange', route);
    route();
  }

  function refreshPub() {
    return api('publicConfig', {}, { tokenKey: false, retries: 2 }).then((p) => { App.savePub(p); applyPub(p); }).catch(() => {});
  }

  function applyPub(p) {
    const featuresChanged = JSON.stringify((pub && pub.features) || null) !== JSON.stringify(p.features || null);
    pub = p;
    if (featuresChanged && user) {
      renderUserBox();
      // N-2: cấu hình máy chủ về sau lần vẽ đầu → vẽ lại Lịch sử để có bộ lọc "Đề thi / Luyện tập"
      if (/^#\/lich-su/.test(location.hash) && !document.getElementById('histSeg') && App.has('practice')) { App.newView(); viewHistory(); }
    }
    document.getElementById('appName').textContent = p.appName;
    document.title = p.appName;
    document.getElementById('navBoard').classList.toggle('hidden', !p.showLeaderboard);
    // Luyện tập: máy chủ có tính năng "practice" VÀ giáo viên bật CHO_LUYEN_TAP (máy chủ 1.0.0: không có mục này)
    const np = document.getElementById('navPractice');
    if (np) np.classList.toggle('hidden', !practiceAllowed(p));
    // Pha 5: chân trang là chữ thương hiệu cố định trong index.html — không ghi tên giáo viên
  }

  function practiceAllowed(p) {
    p = p || pub;
    return App.has('practice') && !!(p && p.practice);
  }

  function renderUserBox() {
    const box = document.getElementById('userBox');
    const nav = document.getElementById('nav');
    if (!user) { box.innerHTML = ''; nav.classList.add('hidden'); return; }
    nav.classList.remove('hidden');
    // Nút Đổi PIN chỉ hiện khi máy chủ có tính năng changePin (máy chủ 1.0.0 đang chạy thật thì ẩn)
    box.innerHTML = `<span class="small"><b>${esc(user.hoTen)}</b> <span class="muted">· ${esc(user.lop)}</span></span>
      ${App.has('changePin') ? '<button class="btn btn-sm" id="btnPin">Đổi PIN</button>' : ''}<button class="btn btn-sm" id="btnLogout">Đăng xuất</button>`;
    const bp = document.getElementById('btnPin');
    if (bp) bp.onclick = changePinDialog;
    document.getElementById('btnLogout').onclick = async () => {
      if (await confirmBox('Đăng xuất?', 'Bạn có chắc muốn đăng xuất?', 'Đăng xuất')) logout();
    };
  }

  function changePinDialog() {
    modal(`<h2>Đổi mã PIN</h2>
      <div class="field"><label for="pOld">PIN hiện tại</label><input id="pOld" class="pin-input" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password"></div>
      <div class="field"><label for="pNew">PIN mới (4 số)</label><input id="pNew" class="pin-input" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></div>
      <div class="field"><label for="pNew2">Nhập lại PIN mới</label><input id="pNew2" class="pin-input" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></div>
      <p class="muted small">Không dùng PIN dễ đoán như 0000, 1111, 1234. Quên PIN thì nhờ giáo viên đặt lại.</p>
      <div class="modal-actions"><button class="btn" data-close="">Hủy</button><button class="btn btn-primary" id="pGo">Đổi PIN</button></div>`, {
      onOpen(m, close) {
        m.querySelectorAll('input').forEach((i) => { i.oninput = () => { i.value = i.value.replace(/\D/g, '').slice(0, 4); }; });
        m.querySelector('#pOld').focus();
        m.querySelector('#pGo').onclick = (e) => withBusy(e.currentTarget, async () => {
          const o = m.querySelector('#pOld').value, n = m.querySelector('#pNew').value, n2 = m.querySelector('#pNew2').value;
          if (!/^\d{4}$/.test(o) || !/^\d{4}$/.test(n)) return toast('PIN gồm đúng 4 chữ số', 'err');
          if (n !== n2) return toast('Hai lần nhập PIN mới không khớp', 'err');
          try {
            await api('changePin', { oldPin: o, newPin: n });
            close('ok');
            toast('Đã đổi PIN. Lần sau hãy đăng nhập bằng PIN mới.', 'ok');
          } catch (err) {
            if (err.unsupported) { close(null); renderUserBox(); toast('Chức năng đổi PIN sẽ có sau khi giáo viên cập nhật máy chủ.'); return; }
            toast(err.message, 'err');
          }
        });
      }
    });
  }

  function logout(silent) {
    store.del('ld_token'); store.del('ld_user'); store.del(ATTEMPT_KEY);
    App.clearCache();
    App.setCacheScope(null);
    homeInflight = null;
    user = null;
    if (!silent) toast('Đã đăng xuất');
    location.hash = '#/dang-nhap';
    route();
  }

  function setNav(key) {
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
  }

  function route() {
    App.newView();
    clearInterval(timerId);
    document.getElementById('topbar').classList.remove('hidden');
    document.getElementById('footer').classList.remove('hidden');
    const h = location.hash.replace(/^#\/?/, '');
    const [page, arg] = h.split('/');
    if (!user || !store.get('ld_token')) { renderUserBox(); return viewLogin(); }
    renderUserBox();
    window.scrollTo(0, 0);
    switch (page) {
      case 'lam-bai': return viewExamIntro(decodeURIComponent(arg || ''));
      case 'ket-qua': setNav(''); return viewResult(decodeURIComponent(arg || ''));
      case 'luyen-tap': setNav('practice'); return viewPractice(arg || '');
      case 'lich-su': setNav('history'); return viewHistory();
      case 'thong-ke': setNav('stats'); return viewStats();
      case 'bang-xep-hang': setNav('board'); return viewBoard(decodeURIComponent(arg || ''));
      default: setNav('home'); return viewHome();
    }
  }

  /* ---------- đăng nhập ---------- */
  function viewLogin() {
    $app.innerHTML = `<div class="narrow">
      <div class="card">
        <h1 style="text-align:center">Đăng nhập</h1>
        <p class="muted" style="text-align:center;margin-top:-4px">Chọn lớp, tên của em và nhập mã PIN</p>
        <div class="field"><label for="selClass">Lớp</label><select id="selClass"><option value="">Đang tải…</option></select></div>
        <div class="field"><label for="selStudent">Họ và tên</label><select id="selStudent" disabled><option value="">— Chọn lớp trước —</option></select></div>
        <div class="field"><label for="pin">Mã PIN (4 số)</label>
          <input id="pin" class="pin-input" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="••••">
          <span class="hint">Mặc định là ngày + tháng sinh. Ví dụ sinh ngày 05/03 → PIN là <b>0503</b>.</span></div>
        <button class="btn btn-primary btn-block" id="btnLogin">Đăng nhập</button>
        <div id="gArea" class="hidden"><div class="divider">hoặc</div><div class="gbtn" id="gBtn"></div></div>
      </div>
      <p class="muted small" style="text-align:center">Chưa có tài khoản hoặc quên PIN? Hãy báo giáo viên.</p>
    </div>`;
    const selC = document.getElementById('selClass');
    const selS = document.getElementById('selStudent');
    const pin = document.getElementById('pin');
    const last = store.get('ld_last', {});
    api('listClasses', {}, { tokenKey: false, retries: 2 }).then((cls) => {
      selC.innerHTML = '<option value="">— Chọn lớp —</option>' + cls.map((c) => `<option value="${esc(c)}" ${c === last.lop ? "selected" : ""}>${esc(c)}</option>`).join('');
      if (last.lop && cls.includes(last.lop)) loadStudents(last.lop, last.id);
    }).catch((e) => { selC.innerHTML = '<option value="">Lỗi tải danh sách</option>'; toast(e.message, 'err'); });
    function loadStudents(lop, sel) {
      selS.disabled = true;
      selS.innerHTML = '<option>Đang tải…</option>';
      api('listStudentsInClass', { lop }, { tokenKey: false, retries: 2 }).then((list) => {
        selS.innerHTML = '<option value="">— Chọn tên —</option>' + list.map((s) => `<option value="${esc(s.id)}" ${s.id === sel ? 'selected' : ''}>${esc(s.hoTen)}</option>`).join('');
        selS.disabled = false;
      }).catch((e) => toast(e.message, 'err'));
    }
    selC.onchange = () => selC.value ? loadStudents(selC.value) : (selS.innerHTML = '<option value="">— Chọn lớp trước —</option>', selS.disabled = true);
    pin.oninput = () => { pin.value = pin.value.replace(/\D/g, '').slice(0, 4); };
    const doLogin = (btn) => withBusy(btn, async () => {
      if (!selS.value) return toast('Hãy chọn lớp và họ tên', 'err');
      if (!/^\d{4}$/.test(pin.value)) return toast('PIN gồm 4 chữ số', 'err');
      try {
        const r = await api('loginPin', { studentId: selS.value, pin: pin.value }, { tokenKey: false });
        store.set('ld_last', { lop: selC.value, id: selS.value });
        loginDone(r);
      } catch (e) { toast(e.message, 'err'); pin.select(); }
    });
    document.getElementById('btnLogin').onclick = (e) => doLogin(e.currentTarget);
    pin.onkeydown = (e) => { if (e.key === 'Enter') doLogin(document.getElementById('btnLogin')); };
    if (pub.googleClientId) {
      document.getElementById('gArea').classList.remove('hidden');
      App.renderGoogleButton(document.getElementById('gBtn'), pub.googleClientId, onGoogle);
    }
  }

  async function onGoogle(credential) {
    try {
      const r = await api('loginGoogle', { credential, as: 'student' }, { tokenKey: false });
      if (r.token) return loginDone(r);
      if (!r.needLink) return toast('Email ' + r.email + ' chưa được gắn với học sinh nào. Hãy báo giáo viên hoặc đăng nhập bằng PIN.', 'err');
      linkDialog(credential, r.email);
    } catch (e) { toast(e.message, 'err'); }
  }

  function linkDialog(credential, email) {
    const cls = Array.from(document.querySelectorAll('#selClass option')).map((o) => o.value).filter(Boolean);
    modal(`<h2>Liên kết tài khoản Google</h2>
      <p>Email <b>${esc(email)}</b> chưa gắn với học sinh nào. Xác minh một lần bằng PIN để lần sau chỉ cần bấm "Đăng nhập bằng Google".</p>
      <div class="field"><label>Lớp</label><select id="lkClass"><option value="">— Chọn lớp —</option>${cls.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label>Họ và tên</label><select id="lkStudent" disabled></select></div>
      <div class="field"><label>Mã PIN</label><input id="lkPin" class="pin-input" inputmode="numeric" maxlength="4"></div>
      <div class="modal-actions"><button class="btn" data-close="">Hủy</button><button class="btn btn-primary" id="lkGo">Liên kết & đăng nhập</button></div>`, {
      onOpen(m, close) {
        const c = m.querySelector('#lkClass'), s = m.querySelector('#lkStudent');
        c.onchange = async () => {
          const list = await api('listStudentsInClass', { lop: c.value }, { tokenKey: false });
          s.innerHTML = list.map((x) => `<option value="${esc(x.id)}">${esc(x.hoTen)}</option>`).join('');
          s.disabled = false;
        };
        m.querySelector('#lkGo').onclick = (e) => withBusy(e.currentTarget, async () => {
          try {
            const r = await api('linkGoogle', { credential, studentId: s.value, pin: m.querySelector('#lkPin').value }, { tokenKey: false });
            close('ok');
            toast('Đã liên kết Google thành công', 'ok');
            loginDone(r);
          } catch (err) { toast(err.message, 'err'); }
        });
      }
    });
  }

  function loginDone(r) {
    App.clearCache(); // không để sót dữ liệu của người dùng trước trên máy dùng chung
    store.set('ld_token', r.token);
    store.set('ld_user', r.user);
    user = r.user;
    App.setCacheScope('local', user.id);
    if (!location.hash || location.hash === '#/dang-nhap') location.hash = '#/';
    route();
  }

  /* ---------- trang chủ ---------- */
  // Máy chủ mới: 1 lần gọi bootstrap. Máy chủ cũ (1.0.0): listExams + myResults song song.
  let homeInflight = null;
  function loadHome() {
    if (homeInflight) return homeInflight;
    const uid = user && user.id;
    const tok = App.cacheToken();
    const mine = () => user && user.id === uid;
    const p = (async () => {
      if (App.canTry('bootstrap')) {
        try {
          const b = await api('bootstrap');
          if (b.pub) { App.savePub(b.pub); applyPub(b.pub); }
          if (!mine()) throw new Error('Đã đổi tài khoản.');
          if (b.me && b.me.id === user.id && (b.me.hoTen !== user.hoTen || b.me.lop !== user.lop)) {
            user = Object.assign({}, user, b.me); store.set('ld_user', user); renderUserBox();
          }
          App.cacheSet('history', b.results, tok);
          return { exams: b.exams, results: b.results };
        } catch (e) { if (!e.unsupported) throw e; }
      }
      const [exams, results] = await Promise.all([api('listExams'), api('myResults')]);
      if (!mine()) throw new Error('Đã đổi tài khoản.');
      App.cacheSet('history', results, tok);
      return { exams, results };
    })();
    homeInflight = p;
    p.then(() => { if (homeInflight === p) homeInflight = null; }, () => { if (homeInflight === p) homeInflight = null; });
    return p;
  }

  function viewHome() {
    return cached('home', loadHome, renderHome, { skeleton: () => { $app.innerHTML = App.skeletonHtml('cards'); } })
      .catch((e) => { $app.innerHTML = errorBox(e); });
  }

  function renderHome(d) {
    const pending = store.get(ATTEMPT_KEY, null);
    const { exams, results } = d;
    const scores = results.map((r) => r.diem);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const open = exams.filter((e) => e.open);
    const other = exams.filter((e) => !e.open);
    let h = `<h1>Xin chào, ${esc(user.hoTen.split(' ').slice(-1)[0])} 👋</h1>`;
    if (pending && pending.endAt > Date.now() && pending.studentId === user.id) {
      h += `<div class="notice warn" style="margin-bottom:16px"><b>Bạn đang làm dở ${pending.practice ? 'bài luyện' : 'đề'} "${esc(pending.exam.tieuDe)}".</b>
        Còn khoảng ${fmtClock((pending.endAt - Date.now()) / 1000)}. <a href="${resumeHref(pending)}">Tiếp tục làm bài →</a></div>`;
    }
    h += `<div class="stats">
      <div class="stat"><b>${results.length}</b><span>Bài đã làm</span></div>
      <div class="stat"><b>${avg == null ? '—' : fmtNum(avg)}</b><span>Điểm trung bình</span></div>
      <div class="stat"><b>${scores.length ? fmtNum(Math.max(...scores)) : '—'}</b><span>Điểm cao nhất</span></div>
      <div class="stat"><b>${open.length}</b><span>Đề đang mở</span></div></div>`;
    if (practiceAllowed()) {
      h += `<a class="card practice-teaser" id="homePractice" href="#/luyen-tap"><b>🎯 Luyện tập</b>
        <span class="muted small">Tự tạo đề theo bài, luyện lại câu đã sai, đề nhanh 10 phút — có lời giải ngay, không tính xếp hạng.</span><span class="spacer"></span><span>Vào luyện →</span></a>`;
    }
    h += '<h2>Đề đang mở</h2>';
    h += open.length ? `<div class="grid grid-3">${open.map(examCard).join('')}</div>` : '<div class="card empty">Hiện chưa có đề nào đang mở.</div>';
    if (other.length) h += `<h2 class="section-gap">Đề khác</h2><div class="grid grid-3">${other.map(examCard).join('')}</div>`;
    if (results.length) {
      h += `<div class="card-title section-gap"><h2>Bài làm gần đây</h2><a href="#/lich-su">Xem tất cả →</a></div>` + resultsTable(results.slice(0, 5));
    }
    $app.innerHTML = h;
  }

  const resumeHref = (p) => (p.practice ? '#/luyen-tap/lam' : '#/lam-bai/' + encodeURIComponent(p.exam.id));

  function examCard(e) {
    const left = e.soLanLam ? Math.max(0, e.soLanLam - e.daLam) : null;
    let btn;
    if (e.canStart) btn = `<a class="btn btn-primary" href="#/lam-bai/${encodeURIComponent(e.id)}">${e.daLam ? 'Làm lại' : 'Bắt đầu làm bài'}</a>`;
    else if (e.lastResultId) btn = `<a class="btn" href="#/ket-qua/${encodeURIComponent(e.lastResultId)}">Xem kết quả</a>`;
    else btn = `<button class="btn" disabled>${esc(e.trangThaiText)}</button>`;
    return `<div class="card exam-card">
      <div class="row" style="justify-content:space-between"><span class="badge ${e.open ? 'badge-good' : ''}">${esc(e.trangThaiText)}</span>
        ${e.diemCaoNhat != null ? `<span class="badge ${App.scoreClass(e.diemCaoNhat)}">Cao nhất: ${fmtNum(e.diemCaoNhat)}</span>` : ''}</div>
      <h3>${esc(e.tieuDe)}</h3>
      ${e.moTa ? `<div class="muted small">${esc(e.moTa)}</div>` : ''}
      <div class="exam-meta"><span>⏱ ${e.thoiGian} phút</span><span>📝 ${e.soCau} câu</span>
        <span>🔁 ${left == null ? 'Không giới hạn lượt' : 'Còn ' + left + '/' + e.soLanLam + ' lượt'}</span>
        ${e.ketThuc ? `<span>⏰ Hạn: ${esc(App.fmtDateIso(e.ketThuc))}</span>` : ''}</div>
      ${btn}</div>`;
  }

  function resultsTable(rs) {
    return `<div class="table-wrap"><table><thead><tr><th>Đề</th><th class="num">Điểm</th><th class="num">Mục tiêu</th><th class="num">Số câu đúng</th><th>Thời gian</th><th>Nộp lúc</th><th></th></tr></thead><tbody>
      ${rs.map((r) => `<tr><td>${esc(r.tieuDe)}</td><td class="num"><span class="badge ${App.scoreClass(r.diem)}">${fmtNum(r.diem)}</span></td>
        <td class="num nowrap">${r.mucTieu == null ? '—' : fmtNum(r.mucTieu) + (r.diem >= r.mucTieu ? ' <span style="color:var(--good)">✓</span>' : ' <span style="color:var(--bad)">✗</span>')}</td>
        <td class="num">${r.soCauDung}/${r.tongCau}</td><td class="nowrap">${esc(r.thoiGianLam)}</td><td class="nowrap">${esc(r.nopLuc)}</td>
        <td><a href="#/ket-qua/${encodeURIComponent(r.id)}">Xem</a></td></tr>`).join('')}</tbody></table></div>`;
  }

  /* ---------- làm bài ---------- */
  async function viewExamIntro(examId) {
    const pending = store.get(ATTEMPT_KEY, null);
    if (pending && pending.exam.id === examId && pending.studentId === user.id && pending.endAt + 5 * 3600000 > Date.now()) return runExam(pending); // hết giờ → runExam tự nộp
    $app.innerHTML = loadingHtml();
    try {
      // cần biết máy chủ có tính năng "goal" chưa trước khi vẽ ô mục tiêu
      const [exams] = await Promise.all([api('listExams'), store.get('ld_pub', null) ? null : refreshPub()]);
      const e = exams.find((x) => x.id === examId);
      if (!e) throw new Error('Không tìm thấy đề.');
      $app.innerHTML = `<div class="card" style="max-width:640px;margin:0 auto">
        <h1>${esc(e.tieuDe)}</h1>${e.moTa ? `<p class="muted">${esc(e.moTa)}</p>` : ''}
        <div class="stats"><div class="stat"><b>${e.thoiGian}′</b><span>Thời gian</span></div><div class="stat"><b>${e.soCau}</b><span>Số câu</span></div>
          <div class="stat"><b>${e.soLanLam ? e.daLam + '/' + e.soLanLam : e.daLam}</b><span>Lượt đã làm</span></div></div>
        <ul class="small">
          <li>Đồng hồ bắt đầu chạy ngay khi bấm <b>Bắt đầu</b>. Hết giờ bài sẽ <b>tự động nộp</b>.</li>
          <li>Bài làm được lưu trên máy — lỡ tải lại trang vẫn làm tiếp được.</li>
          <li>Phần trả lời ngắn: ghi số, dùng dấu phẩy cho phần thập phân (ví dụ <b>12,5</b>).</li>
          <li>Phần Đúng/Sai: chọn Đ hoặc S cho từng ý a, b, c, d.</li></ul>
        ${e.canStart ? (App.has('goal') ? goalBoxHtml(e) : '') + '<button class="btn btn-primary btn-block" id="btnStart">Bắt đầu làm bài</button>' : `<div class="notice warn">${esc(e.trangThaiText)} — bạn không thể làm đề này lúc này.</div>`}
        <div style="text-align:center;margin-top:12px"><a href="#/">← Quay lại</a></div></div>`;
      const goalIn = document.getElementById('goal');
      if (goalIn) {
        goalIn.oninput = () => { goalIn.value = goalIn.value.replace(/[^0-9,.]/g, ''); markChips(); };
        const markChips = () => document.querySelectorAll('[data-goal]').forEach((c) => c.classList.toggle('sel', c.dataset.goal === goalIn.value));
        document.querySelectorAll('[data-goal]').forEach((c) => { c.onclick = () => { goalIn.value = c.dataset.goal; markChips(); }; });
        markChips();
      }
      const b = document.getElementById('btnStart');
      if (b) b.onclick = () => withBusy(b, async () => {
        // Ô mục tiêu chỉ có khi máy chủ hỗ trợ (cờ "goal"); máy chủ cũ thì bắt đầu luôn, không gửi mục tiêu
        const pend = store.get(ATTEMPT_KEY, null);
        if (pend && pend.practice && pend.studentId === user.id && pend.endAt > Date.now()) { toast('Bạn đang làm dở một bài luyện — hãy nộp bài đó trước.', 'err'); return; }
        const body = { examId };
        if (goalIn) {
          const g = parseFloat(String(goalIn.value).replace(',', '.'));
          if (!goalIn.value.trim()) { toast('Hãy đặt mục tiêu điểm cho lần làm này', 'err'); goalIn.focus(); return; }
          if (isNaN(g) || g <= 0 || g > 10) { toast('Mục tiêu là số từ 0 đến 10, ví dụ 7 hoặc 8,5', 'err'); goalIn.focus(); return; }
          body.mucTieu = g;
        }
        try {
          const s = await api('startExam', body);
          const offset = s.serverNow - Date.now();
          const att = {
            attemptToken: s.attemptToken, exam: s.exam, questions: s.questions, studentId: user.id, mucTieu: s.mucTieu,
            endAt: s.startedAt + s.durationSec * 1000 - offset, durationSec: s.durationSec, answers: {}, flags: {}
          };
          store.set(ATTEMPT_KEY, att);
          runExam(att);
        } catch (err) { toast(err.message, 'err'); }
      });
    } catch (e) { $app.innerHTML = errorBox(e); }
  }

  function goalBoxHtml(e) {
    const last = e.diemGanNhat;
    const suggest = last == null ? '' : fmtNum(Math.min(10, Math.ceil((last + 0.5) * 2) / 2));
    const hist = last == null ? 'Lần đầu làm đề này — hãy đặt mục tiêu vừa sức.'
      : `Lần trước: <b>${fmtNum(last)}</b>${e.mucTieuGanNhat != null ? ` (mục tiêu ${fmtNum(e.mucTieuGanNhat)})` : ''} · Cao nhất: <b>${fmtNum(e.diemCaoNhat)}</b>`;
    return `<div class="goal-box"><label for="goal"><b>🎯 Mục tiêu điểm lần này</b></label>
      <div class="muted small">${hist}</div>
      <div class="row" style="margin-top:8px"><input id="goal" class="goal-input" inputmode="decimal" autocomplete="off" placeholder="VD: 8" value="${suggest}" aria-describedby="goalHint"><span class="muted">/ 10 điểm</span></div>
      <div class="chips" style="margin-top:8px">${['5', '6,5', '8', '9', '10'].map((v) => `<button type="button" class="chip goal-chip" data-goal="${v}">${v}</button>`).join('')}</div>
      <div class="muted small" id="goalHint" style="margin-top:6px">Sau khi nộp bài, bạn sẽ thấy mình đã đạt mục tiêu chưa.</div></div>`;
  }

  function runExam(att) {
    document.getElementById('topbar').classList.add('hidden');
    document.getElementById('footer').classList.add('hidden');
    const qs = att.questions;
    const save = () => store.set(ATTEMPT_KEY, att);
    let html = `<div class="exam-bar"><div class="exam-bar-in">
        <div style="min-width:0;flex:1"><div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(att.exam.tieuDe)}</div>
          <div class="row" style="flex-wrap:nowrap"><div class="progress"><i id="prog"></i></div><span class="small nowrap" id="progText"></span></div></div>
        <div class="timer" id="timer" aria-live="off">--:--</div>
        <button class="btn btn-primary" id="btnSubmit">Nộp bài</button></div></div>
      <div class="exam-wrap" id="examWrap">`;
    if (att.thongBao && att.thongBao.length) {
      html += `<div class="notice warn" id="examNotes" style="margin-top:12px">${att.thongBao.map(esc).join('<br>')}</div>`;
    }
    let lastPart = null;
    qs.forEach((q, i) => {
      if (q.phan !== lastPart) { lastPart = q.phan; html += `<h2 class="part-title">${App.PARTS[q.phan] || 'Phần ' + q.phan}</h2>`; }
      html += `<div class="q" id="q-${q.stt}" data-stt="${q.stt}">
        <div class="q-head"><span class="q-num">Câu ${i + 1}</span>
          <button class="flag-btn ${att.flags[q.stt] ? 'on' : ''}" data-flag="${q.stt}">⚑ ${att.flags[q.stt] ? 'Đã đánh dấu' : 'Đánh dấu'}</button></div>
        <div class="q-body">${rich(q.noiDung)}</div>
        ${q.hinhAnh ? `<img class="q-img" src="${esc(q.hinhAnh)}" alt="Hình minh họa câu ${i + 1}" loading="lazy">` : ''}
        ${answerUi(q, att.answers[q.stt])}</div>`;
    });
    html += `<div style="text-align:center;margin-top:24px"><button class="btn btn-primary" id="btnSubmit2">Nộp bài</button></div></div>
      <button class="btn qnav-fab" id="btnNav" aria-expanded="false">☰ Danh sách câu</button>
      <div class="card qnav hidden" id="qnav"><div class="card-title"><h3>Chuyển đến câu</h3><button class="btn btn-sm btn-ghost" id="navClose">✕</button></div>
        <div class="qnav-grid" id="qnavGrid"></div>
        <div class="legend"><span><i class="sw done"></i>Đã làm</span><span><i class="sw"></i>Chưa làm</span><span><i class="sw flag"></i>Đánh dấu xem lại</span></div>
        <div class="small" id="navSummary" style="margin-top:8px"></div></div>`;
    $app.innerHTML = html;
    math($app);

    const wrap = document.getElementById('examWrap');
    wrap.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-opt]');
      if (opt) {
        const stt = opt.closest('.q').dataset.stt;
        att.answers[stt] = att.answers[stt] === opt.dataset.opt ? '' : opt.dataset.opt;
        opt.parentElement.querySelectorAll('[data-opt]').forEach((b) => b.classList.toggle('sel', b.dataset.opt === att.answers[stt]));
        save(); updateProgress();
        return;
      }
      const tf = e.target.closest('[data-tf]');
      if (tf) {
        const stt = tf.closest('.q').dataset.stt;
        const [idx, val] = tf.dataset.tf.split(':');
        const arr = Array.isArray(att.answers[stt]) ? att.answers[stt] : ['', '', '', ''];
        arr[+idx] = arr[+idx] === val ? '' : val;
        att.answers[stt] = arr;
        tf.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.tf === idx + ':' + arr[+idx]));
        save(); updateProgress();
        return;
      }
      const fl = e.target.closest('[data-flag]');
      if (fl) {
        const stt = fl.dataset.flag;
        att.flags[stt] = !att.flags[stt];
        fl.classList.toggle('on', att.flags[stt]);
        fl.textContent = '⚑ ' + (att.flags[stt] ? 'Đã đánh dấu' : 'Đánh dấu');
        save(); updateProgress();
      }
    });
    wrap.addEventListener('input', (e) => {
      const inp = e.target.closest('[data-short]');
      if (!inp) return;
      inp.value = inp.value.replace(/[^0-9,.\-+eE ]/g, '');
      att.answers[inp.dataset.short] = inp.value.trim();
      save(); updateProgress();
    });

    const nav = document.getElementById('qnav');
    const btnNav = document.getElementById('btnNav');
    const toggleNav = (show) => { nav.classList.toggle('hidden', !show); btnNav.setAttribute('aria-expanded', String(show)); };
    btnNav.onclick = () => toggleNav(nav.classList.contains('hidden'));
    document.getElementById('navClose').onclick = () => toggleNav(false);
    document.getElementById('qnavGrid').onclick = (e) => {
      const b = e.target.closest('[data-go]');
      if (!b) return;
      document.getElementById('q-' + b.dataset.go).scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (window.innerWidth < 900) toggleNav(false);
    };

    function isDone(q) {
      const a = att.answers[q.stt];
      if (q.loai === 'DS') return Array.isArray(a) && a.every(Boolean);
      return a != null && String(a).trim() !== '';
    }
    function updateProgress() {
      const done = qs.filter(isDone).length;
      document.getElementById('prog').style.width = (done / qs.length * 100) + '%';
      document.getElementById('progText').textContent = done + '/' + qs.length;
      document.getElementById('qnavGrid').innerHTML = qs.map((q, i) =>
        `<button data-go="${q.stt}" class="${isDone(q) ? 'done' : ''} ${att.flags[q.stt] ? 'flag' : ''}" aria-label="Câu ${i + 1}${isDone(q) ? ', đã làm' : ', chưa làm'}${att.flags[q.stt] ? ', đánh dấu' : ''}">${i + 1}</button>`).join('');
      const left = qs.map((q, i) => (isDone(q) ? null : i + 1)).filter(Boolean);
      const flagged = qs.map((q, i) => (att.flags[q.stt] ? i + 1 : null)).filter(Boolean);
      document.getElementById('navSummary').innerHTML =
        (left.length ? `Còn <b>${left.length}</b> câu chưa làm: ${left.join(', ')}` : '<b style="color:var(--good)">✓ Đã làm hết các câu</b>') +
        (flagged.length ? `<br>Đánh dấu xem lại: ${flagged.join(', ')}` : '');
      document.getElementById('btnNav').innerHTML = '☰ Danh sách câu' + (left.length ? ` <span class="badge badge-bad">${left.length} chưa làm</span>` : '');
    }
    updateProgress();

    let submitting = false;
    const timerEl = document.getElementById('timer');
    function tick() {
      const left = (att.endAt - Date.now()) / 1000;
      timerEl.textContent = fmtClock(left);
      timerEl.classList.toggle('low', left <= 60);
      if (left <= 0 && !submitting) { clearInterval(timerId); toast('Hết giờ! Bài đang được nộp tự động…'); submit(true); }
    }
    clearInterval(timerId);
    timerId = setInterval(tick, 500);
    tick();

    async function submit(auto) {
      if (submitting) return;
      if (!auto) {
        const blank = qs.filter((q) => !isDone(q)).length;
        const ok = await confirmBox('Nộp bài?', blank ? `Bạn còn <b>${blank} câu</b> chưa làm xong. Vẫn nộp bài?` : 'Bạn đã làm hết các câu. Nộp bài ngay?', 'Nộp bài');
        if (!ok) return;
      }
      submitting = true;
      const btns = [document.getElementById('btnSubmit'), document.getElementById('btnSubmit2')];
      btns.forEach((b) => { b.disabled = true; b.textContent = 'Đang nộp…'; });
      for (let i = 0; i < 4; i++) {
        try {
          const r = await api('submitExam', { attemptToken: att.attemptToken, answers: att.answers }, { retries: 1 });
          clearInterval(timerId);
          store.del(ATTEMPT_KEY);
          // Dữ liệu cũ của trang chủ / lịch sử / thống kê không còn đúng: xóa rồi làm mới ngầm
          App.cacheDel('home', 'history', 'stats', 'practice', 'history_luyen');
          homeInflight = null;
          // thẻ kho lấy SAU khi xóa: nếu đăng xuất / đổi tài khoản trước khi dữ liệu về thì không cất (R-1)
          const tok = App.cacheToken();
          loadHome().then((d) => App.cacheSet('home', d, tok)).catch(() => {});
          api('myStats').then((d) => App.cacheSet('stats', d, tok)).catch(() => {});
          store.set('ld_lastResult', r);
          location.hash = '#/ket-qua/' + encodeURIComponent(r.id);
          return;
        } catch (e) {
          if (/không hợp lệ|quá hạn|không còn|tắt luyện tập/.test(e.message)) { store.del(ATTEMPT_KEY); toast(e.message, 'err'); location.hash = att.practice ? '#/luyen-tap' : '#/'; return; }
          if (i === 3) {
            submitting = false;
            btns.forEach((b) => { b.disabled = false; b.textContent = 'Nộp lại'; });
            toast('Chưa nộp được: ' + e.message + ' — Bài làm vẫn được lưu, hãy bấm Nộp lại.', 'err');
          } else await App.sleep(1500 * (i + 1));
        }
      }
    }
    document.getElementById('btnSubmit').onclick = () => submit(false);
    document.getElementById('btnSubmit2').onclick = () => submit(false);
  }

  function answerUi(q, a) {
    if (q.loai === 'DS') {
      const arr = Array.isArray(a) ? a : ['', '', '', ''];
      return '<div>' + ['A', 'B', 'C', 'D'].map((k, i) => `<div class="tf-row"><div class="tf-text"><b>${'abcd'[i]})</b> ${rich(q[k])}</div>
        <div class="tf-btns"><button data-tf="${i}:D" class="${arr[i] === 'D' ? 'sel' : ''}" aria-label="Ý ${'abcd'[i]} đúng">Đ</button>
        <button data-tf="${i}:S" class="${arr[i] === 'S' ? 'sel' : ''}" aria-label="Ý ${'abcd'[i]} sai">S</button></div></div>`).join('') + '</div>';
    }
    if (q.loai === 'TL') {
      return `<input class="short-input" data-short="${q.stt}" inputmode="decimal" autocomplete="off" placeholder="Nhập đáp số" value="${esc(a || '')}" aria-label="Đáp số câu ${q.stt}">`;
    }
    return '<div class="opts">' + ['A', 'B', 'C', 'D'].map((k) =>
      `<button class="opt ${a === k ? 'sel' : ''}" data-opt="${k}"><span class="key">${k}</span><span>${rich(q[k])}</span></button>`).join('') + '</div>';
  }

  /* ---------- kết quả ---------- */
  async function viewResult(id) {
    let v = store.get('ld_lastResult', null);
    if (!v || v.id !== id) {
      $app.innerHTML = loadingHtml('Đang tải kết quả…');
      try { v = await api('getResult', { resultId: id }); } catch (e) { $app.innerHTML = errorBox(e); return; }
    }
    store.del('ld_lastResult');
    if (v.luyenTap) {
      const acts = `<div class="row no-print" style="margin-top:12px"><a class="btn" href="#/luyen-tap">← Luyện tập</a>
        <a class="btn btn-primary" href="#/luyen-tap" id="btnMorePractice">Luyện tiếp</a>
        <button class="btn" onclick="window.print()">In / Lưu PDF</button></div>`;
      setNav('practice');
      $app.innerHTML = App.resultHtml(v, { actions: acts });
      math($app);
      return;
    }
    const actions = `<div class="row no-print" style="margin-top:12px"><a class="btn" href="#/">← Trang chủ</a>
      <a class="btn" href="#/lam-bai/${encodeURIComponent(v.examId)}">Làm lại đề này</a>
      ${pub.showLeaderboard ? `<a class="btn" href="#/bang-xep-hang/${encodeURIComponent(v.examId)}">Bảng xếp hạng</a>` : ''}
      <button class="btn" onclick="window.print()">In / Lưu PDF</button></div>`;
    $app.innerHTML = App.resultHtml(v, { actions });
    math($app);
  }

  /* ---------- lịch sử ---------- */
  function viewHistory() {
    // Bộ lọc "Đề thi / Luyện tập" chỉ khi máy chủ có tính năng practice (máy chủ cũ bỏ qua tham số loai)
    const filter = App.has('practice');
    const mode = filter && store.get('ld_hist_mode', 'thi') === 'luyen' ? 'luyen' : 'thi';
    const seg = filter ? `<div class="seg" id="histSeg" role="group" aria-label="Lọc lịch sử" style="margin-bottom:12px">
      <button data-h="thi" class="${mode === 'thi' ? 'active' : ''}">Đề thi</button><button data-h="luyen" class="${mode === 'luyen' ? 'active' : ''}">Luyện tập</button></div>` : '';
    const key = mode === 'luyen' ? 'history_luyen' : 'history';
    const load = () => (mode === 'luyen' ? api('myResults', { loai: 'luyen' }) : api('myResults'));
    return cached(key, load, (rs) => {
      $app.innerHTML = '<h1>Lịch sử làm bài</h1>' + seg + (rs.length ? resultsTable(rs)
        : `<div class="card empty">${mode === 'luyen' ? 'Bạn chưa làm bài luyện tập nào.' : 'Bạn chưa làm bài nào.'}</div>`);
      const sg = document.getElementById('histSeg');
      if (sg) sg.onclick = (e) => {
        const b = e.target.closest('[data-h]');
        if (!b || b.dataset.h === mode) return;
        store.set('ld_hist_mode', b.dataset.h);
        App.newView();
        viewHistory();
      };
    }, { skeleton: () => { $app.innerHTML = '<h1>Lịch sử làm bài</h1>' + seg + App.skeletonHtml('table'); } }).catch((e) => { $app.innerHTML = errorBox(e); });
  }

  /* ---------- luyện tập (Pha 4) ---------- */
  function practiceOffHtml() {
    return `<h1>Luyện tập</h1><div class="card empty" id="practiceOff">Mục Luyện tập hiện chưa mở. Khi giáo viên bật, em sẽ tự tạo được đề luyện ở đây.
      <div style="margin-top:10px"><a class="btn" href="#/">← Trang chủ</a></div></div>`;
  }

  function viewPractice(arg) {
    const pending = store.get(ATTEMPT_KEY, null);
    if (arg === 'lam') {
      if (pending && pending.practice && pending.studentId === user.id && pending.endAt + 5 * 3600000 > Date.now()) return runExam(pending);
      location.hash = '#/luyen-tap';
      return;
    }
    if (!App.has('practice')) { $app.innerHTML = practiceOffHtml(); return; }
    return cached('practice', () => api('practiceMeta'), renderPractice, { skeleton: () => { $app.innerHTML = App.skeletonHtml('cards'); } })
      .catch((e) => {
        if (e.unsupported || /tắt luyện tập/.test(e.message)) {
          App.cacheDel('practice');
          $app.innerHTML = practiceOffHtml();
          refreshPub();
          return;
        }
        $app.innerHTML = errorBox(e);
      });
  }

  function renderPractice(m) {
    const pending = store.get(ATTEMPT_KEY, null);
    const busy = pending && pending.studentId === user.id && pending.endAt > Date.now();
    const sum = (d) => d.TN + d.DS + d.TL;
    const byCh = {};
    const chOrder = [];
    m.cay.forEach((x) => { if (!byCh[x.chuong]) { byCh[x.chuong] = []; chOrder.push(x.chuong); } byCh[x.chuong].push(x); });
    const sel = new Set(store.get('ld_pt_bai', []));
    const so = Object.assign({ TN: 10, DS: 2, TL: 3, phut: 30 }, store.get('ld_pt_so', {}));
    const n = m.nhanh;
    const total = m.cay.reduce((s, x) => s + sum(x.dem), 0);
    let h = `<h1>Luyện tập</h1><p class="muted" style="margin-top:-6px">Bài luyện không tính vào bảng xếp hạng. Nộp bài xong có đáp án và lời giải ngay.</p>`;
    if (busy) h += `<div class="notice warn" style="margin-bottom:16px"><b>Bạn đang làm dở "${esc(pending.exam.tieuDe)}".</b> <a href="${resumeHref(pending)}">Tiếp tục làm bài →</a></div>`;
    h += `<div class="stats"><div class="stat"><b>${m.soBai}</b><span>Bài luyện đã làm</span></div>
      <div class="stat"><b>${m.diemTB == null ? '—' : fmtNum(m.diemTB)}</b><span>Điểm luyện trung bình</span></div>
      <div class="stat"><b>${total}</b><span>Câu có thể luyện</span></div></div>`;
    if (!total && !m.soCauSai) {
      $app.innerHTML = h + '<div class="card empty" id="ptEmpty">Giáo viên chưa đưa câu nào vào luyện tập cho khối lớp của em.</div>';
      return;
    }
    const opt = (x) => `<option value="${esc(x.bai)}">${esc(x.bai)} (${sum(x.dem)} câu)</option>`;
    h += `<div class="grid grid-3 practice-cards">
      <div class="card"><h3>✍️ Tự tạo đề</h3><p class="muted small">Chọn chương, bài và số câu mỗi phần (5–40 câu, 5–90 phút).</p>
        <a class="btn" href="#ptBuilder" id="ptGoBuild">Chọn bài ↓</a></div>
      <div class="card"><h3>🔁 Luyện câu đã sai (${m.soCauSai})</h3><p class="muted small">Làm lại những câu em chưa được trọn điểm (tối đa 20 câu, câu sai gần nhất trước).</p>
        <button class="btn btn-primary" id="ptWrong" ${m.soCauSai && !busy ? '' : 'disabled'}>${m.soCauSai ? 'Luyện ' + m.soCauSai + ' câu' : 'Chưa có câu sai'}</button></div>
      <div class="card"><h3>⚡ Đề nhanh ${n.phut} phút</h3><p class="muted small">Một bài: ${n.TN} câu Phần I, ${n.DS} câu Phần II, ${n.TL} câu Phần III.</p>
        <select id="ptQuickBai" aria-label="Chọn bài cho đề nhanh">${chOrder.map((c) => `<optgroup label="${esc(c)}">${byCh[c].map(opt).join('')}</optgroup>`).join('')}</select>
        <button class="btn btn-primary" id="ptQuick" style="margin-top:8px" ${total && !busy ? '' : 'disabled'}>Làm đề nhanh</button></div></div>`;
    const chk = (cls, val, label, on, extra) => `<label class="chk"><input type="checkbox" class="${cls}" value="${esc(val)}" ${extra || ''} ${on ? 'checked' : ''}> ${label}</label>`;
    h += `<div class="card section-gap" id="ptBuilder"><h2>Tự tạo đề</h2>
      <div class="bank-tree practice-tree" id="ptTree">${chOrder.map((c, ci) => {
        const bais = byCh[c];
        const all = bais.every((x) => sel.has(x.bai));
        return `<details ${bais.some((x) => sel.has(x.bai)) || ci === 0 ? 'open' : ''}><summary>${chk('pt-ch', c, `<b>${esc(c)}</b> <span class="muted">(${bais.reduce((s, x) => s + sum(x.dem), 0)})</span>`, all, `data-ci="${ci}"`)}</summary>
          ${bais.map((x) => `<div class="bai">${chk('pt-bai', x.bai, `${esc(x.bai)} <span class="muted" title="Phần I · Phần II · Phần III">(${x.dem.TN}·${x.dem.DS}·${x.dem.TL})</span>`, sel.has(x.bai), `data-ci="${ci}"`)}</div>`).join('')}</details>`;
      }).join('')}</div>
      <div class="row practice-so" style="margin-top:12px">
        <label class="small">Phần I <input class="so" type="number" min="0" max="40" id="ptTN" value="${so.TN}"></label>
        <label class="small">Phần II <input class="so" type="number" min="0" max="40" id="ptDS" value="${so.DS}"></label>
        <label class="small">Phần III <input class="so" type="number" min="0" max="40" id="ptTL" value="${so.TL}"></label>
        <label class="small">Thời gian <input class="so" type="number" min="5" max="90" id="ptPhut" value="${so.phut}"> phút</label></div>
      <div class="muted small" id="ptSum" style="margin:8px 0"></div>
      <button class="btn btn-primary" id="ptStart" ${busy ? 'disabled' : ''}>Tạo đề và bắt đầu</button></div>`;
    $app.innerHTML = h;

    const chosen = () => [...document.querySelectorAll('.pt-bai:checked')].map((x) => x.value);
    const readSo = () => ({ TN: +document.getElementById('ptTN').value || 0, DS: +document.getElementById('ptDS').value || 0, TL: +document.getElementById('ptTL').value || 0, phut: +document.getElementById('ptPhut').value || 0 });
    const drawSum = () => {
      const bs = new Set(chosen());
      const have = { TN: 0, DS: 0, TL: 0 };
      m.cay.forEach((x) => { if (bs.has(x.bai)) ['TN', 'DS', 'TL'].forEach((k) => { have[k] += x.dem[k]; }); });
      const s = readSo();
      store.set('ld_pt_bai', [...bs]); store.set('ld_pt_so', s);
      document.getElementById('ptSum').innerHTML = bs.size
        ? `Đã chọn ${bs.size} bài · có sẵn Phần I ${have.TN} · Phần II ${have.DS} · Phần III ${have.TL} câu. Đề: <b>${s.TN + s.DS + s.TL}</b> câu, ${s.phut} phút.`
        : 'Chưa chọn bài nào — đánh dấu một hoặc nhiều bài ở trên.';
    };
    const tree = document.getElementById('ptTree');
    tree.addEventListener('change', (e) => {
      const t = e.target;
      if (t.classList.contains('pt-ch')) tree.querySelectorAll(`.pt-bai[data-ci="${t.dataset.ci}"]`).forEach((b) => { b.checked = t.checked; });
      else if (t.classList.contains('pt-bai')) {
        const ch = tree.querySelector(`.pt-ch[data-ci="${t.dataset.ci}"]`);
        if (ch) ch.checked = [...tree.querySelectorAll(`.pt-bai[data-ci="${t.dataset.ci}"]`)].every((b) => b.checked);
      }
      drawSum();
    });
    // bấm vào ô chọn chương không đóng/mở cây
    tree.querySelectorAll('summary .chk').forEach((l) => l.addEventListener('click', (e) => e.stopPropagation()));
    document.querySelectorAll('.practice-so input').forEach((i) => { i.oninput = drawSum; });
    drawSum();
    document.getElementById('ptGoBuild').onclick = (e) => { e.preventDefault(); document.getElementById('ptBuilder').scrollIntoView({ behavior: 'smooth' }); };
    document.getElementById('ptStart').onclick = (e) => {
      const bai = chosen();
      const s = readSo();
      const t = s.TN + s.DS + s.TL;
      if (!bai.length) return toast('Hãy chọn ít nhất một bài', 'err');
      if (t < 5 || t > 40) return toast('Tổng số câu phải từ 5 đến 40', 'err');
      if (s.phut < 5 || s.phut > 90) return toast('Thời gian từ 5 đến 90 phút', 'err');
      startPractice(e.currentTarget, { kieu: 'TU_TAO', bai, so: { TN: s.TN, DS: s.DS, TL: s.TL }, phut: s.phut });
    };
    const w = document.getElementById('ptWrong');
    w.onclick = () => startPractice(w, { kieu: 'CAU_SAI' });
    const q = document.getElementById('ptQuick');
    q.onclick = () => startPractice(q, { kieu: 'NHANH', bai: [document.getElementById('ptQuickBai').value] });
  }

  /** Hỏi mục tiêu điểm (có "Bỏ qua") rồi gọi practiceStart và vào làm bài. */
  async function startPractice(btn, body) {
    const pending = store.get(ATTEMPT_KEY, null);
    if (pending && pending.studentId === user.id && pending.endAt > Date.now()) {
      toast('Bạn đang làm dở một bài — hãy nộp bài đó trước.', 'err');
      return;
    }
    if (App.has('goal')) {
      const g = await goalDialog();
      if (g === null) return; // Hủy
      if (g !== 'skip') body.mucTieu = g;
    }
    return withBusy(btn, async () => {
      try {
        const s = await api('practiceStart', body);
        const offset = s.serverNow - Date.now();
        const att = {
          attemptToken: s.attemptToken, exam: s.exam, questions: s.questions, studentId: user.id, mucTieu: s.mucTieu, practice: true, kieu: s.kieu,
          thongBao: s.thongBao || [], endAt: s.startedAt + s.durationSec * 1000 - offset, durationSec: s.durationSec, answers: {}, flags: {}
        };
        store.set(ATTEMPT_KEY, att);
        if (location.hash !== '#/luyen-tap/lam') history.replaceState(null, '', '#/luyen-tap/lam');
        runExam(att);
      } catch (err) {
        if (err.unsupported || /tắt luyện tập/.test(err.message)) { App.cacheDel('practice'); refreshPub(); }
        toast(err.message, 'err');
      }
    });
  }

  function goalDialog() {
    return modal(`<h2>🎯 Mục tiêu điểm lần này</h2>
      <p class="muted small">Đặt mục tiêu giúp em biết mình tiến bộ đến đâu. Có thể bỏ qua.</p>
      <div class="row"><input id="ptGoal" class="goal-input" inputmode="decimal" autocomplete="off" placeholder="VD: 8"><span class="muted">/ 10 điểm</span></div>
      <div class="chips" style="margin-top:8px">${['5', '6,5', '8', '9', '10'].map((v) => `<button type="button" class="chip goal-chip" data-goal="${v}">${v}</button>`).join('')}</div>
      <div class="modal-actions"><button class="btn" data-close="">Hủy</button><button class="btn" data-close="skip" id="ptGoalSkip">Bỏ qua</button>
        <button class="btn btn-primary" id="ptGoalOk">Bắt đầu</button></div>`, {
      onOpen(mm, close) {
        const inp = mm.querySelector('#ptGoal');
        const mark = () => mm.querySelectorAll('[data-goal]').forEach((c) => c.classList.toggle('sel', c.dataset.goal === inp.value));
        inp.oninput = () => { inp.value = inp.value.replace(/[^0-9,.]/g, ''); mark(); };
        mm.querySelectorAll('[data-goal]').forEach((c) => { c.onclick = () => { inp.value = c.dataset.goal; mark(); }; });
        inp.focus();
        const go = () => {
          if (!inp.value.trim()) return close('skip');
          const g = parseFloat(inp.value.replace(',', '.'));
          if (isNaN(g) || g <= 0 || g > 10) { toast('Mục tiêu là số từ 0 đến 10, ví dụ 7 hoặc 8,5', 'err'); inp.focus(); return; }
          close(g);
        };
        mm.querySelector('#ptGoalOk').onclick = go;
        inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
      }
    }).then((v) => (v === '' || v == null ? null : v));
  }

  /* ---------- thống kê ---------- */
  function viewStats() {
    return cached('stats', () => api('myStats'), renderStats, { skeleton: () => { $app.innerHTML = App.skeletonHtml('stats'); } })
      .catch((e) => { $app.innerHTML = errorBox(e); });
  }

  function renderStats(s) {
    {
      if (!s.count) { $app.innerHTML = '<h1>Thống kê</h1><div class="card empty">Làm ít nhất một bài để xem thống kê.</div>'; return; }
      $app.innerHTML = `<h1>Thống kê học tập</h1>
        <div class="stats"><div class="stat"><b>${s.count}</b><span>Bài đã làm</span></div>
          <div class="stat"><b>${fmtNum(s.avg)}</b><span>Điểm trung bình</span></div>
          <div class="stat"><b>${fmtNum(s.best)}</b><span>Điểm cao nhất</span></div></div>
        <div class="card"><h2>Nhận xét chung</h2><ul class="fb-list">${s.advice.map((a) => `<li class="fb-tip"><span class="ic">➜</span><span>${esc(a)}</span></li>`).join('')}</ul></div>
        <div class="card"><h2>Điểm qua các lần làm bài</h2><div class="chart-box"><canvas id="chTimeline" aria-label="Biểu đồ điểm theo thời gian"></canvas></div></div>
        <div class="grid grid-2 section-gap"><div class="card"><h3>Tỉ lệ điểm theo chủ đề</h3>${App.barsHtml(s.byTopic)}</div>
          <div class="card"><h3>Theo mức độ</h3>${App.barsHtml(s.byLevel)}<div style="height:14px"></div><h3>Theo dạng câu</h3>${App.barsHtml(s.byType)}</div></div>`;
      const primary = App.cssVar('--primary');
      App.chart('chTimeline', {
        type: 'line',
        data: {
          labels: s.timeline.map((t, i) => 'Lần ' + (i + 1)),
          datasets: [{ label: 'Điểm', data: s.timeline.map((t) => t.diem), borderColor: primary, backgroundColor: primary, tension: 0.25, pointRadius: 4 },
            { label: 'Mục tiêu', data: s.timeline.map((t) => t.mucTieu), borderColor: App.cssVar('--accent'), backgroundColor: App.cssVar('--accent'), borderDash: [6, 4], pointStyle: 'rectRot', pointRadius: 4, spanGaps: true, tension: 0 }]
        },
        options: {
          maintainAspectRatio: false, scales: { y: { min: 0, max: 10, ticks: { stepSize: 2 } } },
          plugins: { legend: { display: s.timeline.some((t) => t.mucTieu != null) }, tooltip: { callbacks: { title: (it) => s.timeline[it[0].dataIndex].tieuDe, afterTitle: (it) => s.timeline[it[0].dataIndex].nopLuc } } }
        }
      });
    }
  }

  /* ---------- bảng xếp hạng ---------- */
  function viewBoard(examId) {
    const lopOnly = store.get('ld_board_lop', false);
    return cached('board_' + (examId || '') + '_' + (lopOnly ? 1 : 0), () => api('leaderboard', { examId, lop: lopOnly ? user.lop : '' }),
      (d) => renderBoard(d, examId, lopOnly), { skeleton: () => { $app.innerHTML = App.skeletonHtml('table'); } })
      .catch((e) => { $app.innerHTML = errorBox(e); });
  }

  function renderBoard(d, examId, lopOnly) {
    {
      const isExam = !!examId;
      let h = `<h1>Bảng xếp hạng</h1><div class="row" style="margin-bottom:12px">
        <select id="bExam" style="max-width:420px"><option value="">Tổng hợp (trung bình điểm cao nhất mỗi đề)</option>
          ${d.exams.map((e) => `<option value="${esc(e.id)}" ${e.id === examId ? 'selected' : ''}>${esc(e.tieuDe)}</option>`).join('')}</select>
        <label class="row small" style="gap:6px"><input type="checkbox" id="bLop" style="width:auto;min-height:0" ${lopOnly ? 'checked' : ''}> Chỉ lớp ${esc(user.lop)}</label></div>`;
      if (d.me) h += `<div class="notice" style="margin-bottom:12px">Bạn đang xếp hạng <b>${d.me.hang}/${d.total}</b> với <b>${fmtNum(d.me.diem)}</b> điểm.</div>`;
      h += d.rows.length ? `<div class="table-wrap"><table><thead><tr><th class="num">Hạng</th><th>Họ tên</th><th>Lớp</th><th class="num">Điểm</th>
        ${isExam ? '<th>Thời gian</th>' : '<th class="num">Số đề</th>'}</tr></thead><tbody>
        ${d.rows.map((r) => `<tr class="${r.laToi ? 'me' : ''}"><td class="num">${medal(r.hang)}</td><td>${esc(r.hoTen)}</td><td>${esc(r.lop)}</td>
          <td class="num"><b>${fmtNum(r.diem)}</b></td>${isExam ? `<td class="nowrap">${esc(r.thoiGianLam)}</td>` : `<td class="num">${r.soDe}</td>`}</tr>`).join('')}
        </tbody></table></div>` : '<div class="card empty">Chưa có ai làm bài.</div>';
      $app.innerHTML = h;
      document.getElementById('bExam').onchange = (e) => { location.hash = '#/bang-xep-hang/' + encodeURIComponent(e.target.value); };
      document.getElementById('bLop').onchange = (e) => { store.set('ld_board_lop', e.target.checked); App.newView(); viewBoard(examId); };
    }
  }
  const medal = (n) => (n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : n);

  function errorBox(e) {
    return `<div class="card empty"><p><b>Có lỗi:</b> ${esc(e.message)}</p><button class="btn" onclick="location.reload()">Tải lại trang</button></div>`;
  }

  boot();
})();
