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
    // Không gọi lại publicConfig nếu bản lưu mới hơn 10 phút (bootstrap cũng trả cấu hình).
    // K-2 (Pha 6): bản lưu là của máy chủ cũ (không có features) thì luôn hỏi lại — giáo viên vừa triển khai máy chủ mới
    // thì F5 là thấy ngay, không phải chờ bản lưu hết hạn.
    if (!App.pubFresh() || !(saved && Array.isArray(saved.features))) refreshPub();
    window.addEventListener('hashchange', route);
    route();
    booted = true;
  }
  let booted = false;

  function refreshPub() {
    return api('publicConfig', {}, { tokenKey: false, retries: 2 }).then((p) => { App.savePub(p); applyPub(p); }).catch(() => {});
  }

  function applyPub(p) {
    const featuresChanged = JSON.stringify((pub && pub.features) || null) !== JSON.stringify(p.features || null);
    // đã biết máy chủ (bản lưu có version) rồi thấy danh sách tính năng khác: máy chủ vừa được cập nhật / quay về
    const serverSwitched = featuresChanged && !!(pub && pub.version);
    pub = p;
    if (serverSwitched && user && booted && !store.get('ld_attempt', null) && !/^#\/(lam-bai|luyen-tap\/lam)/.test(location.hash)) {
      // K-2: máy chủ vừa đổi (cũ → mới): vẽ lại màn đang xem theo tính năng mới (không đụng bài đang làm)
      setTimeout(route, 0);
    } else if (featuresChanged && user) {
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
    // Sổ tay (Pha 7): máy chủ có tính năng "notebook" VÀ giáo viên không tắt BAT_SO_TAY
    const nn = document.getElementById('navNotebook');
    if (nn) nn.classList.toggle('hidden', !notebookAllowed(p));
    // Pha 5: chân trang là chữ thương hiệu cố định trong index.html — không ghi tên giáo viên
  }

  function practiceAllowed(p) {
    p = p || pub;
    return App.has('practice') && !!(p && p.practice);
  }

  function notebookAllowed(p) {
    p = p || pub;
    return App.has('notebook') && !!(p && p.notebook);
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
      case 'so-tay': setNav('notebook'); return viewNotebook();
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
    let h = `<h1>Xin chào, ${esc(user.hoTen.split(' ').slice(-1)[0])} 👋</h1>` + (notebookAllowed() ? '<div id="nbBanner"></div>' : '');
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
    nbHomeBanner();
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
        ${e.canStart ? (App.has('goal') ? goalBoxHtml(e) : '') + (notebookAllowed() ? '<div id="nbRemind"></div>' : '') + '<button class="btn btn-primary btn-block" id="btnStart">Bắt đầu làm bài</button>' : `<div class="notice warn">${esc(e.trangThaiText)} — bạn không thể làm đề này lúc này.</div>`}
        <div style="text-align:center;margin-top:12px"><a href="#/">← Quay lại</a></div></div>`;
      const goalIn = document.getElementById('goal');
      if (goalIn) {
        goalIn.oninput = () => { goalIn.value = goalIn.value.replace(/[^0-9,.]/g, ''); markChips(); };
        const markChips = () => document.querySelectorAll('[data-goal]').forEach((c) => c.classList.toggle('sel', c.dataset.goal === goalIn.value));
        document.querySelectorAll('[data-goal]').forEach((c) => { c.onclick = () => { goalIn.value = c.dataset.goal; markChips(); }; });
        markChips();
      }
      const b = document.getElementById('btnStart');
      nbExamReminder(b); // Pha 7b: "Điều cần nhớ" từ sổ tay, phải tick "Em đã đọc" mới bắt đầu được
      if (b) b.onclick = () => withBusy(b, async () => {
        const rb = document.getElementById('nbReadOk');
        if (rb && !rb.checked) { toast('Hãy đọc "Điều cần nhớ" và tick "Em đã đọc" trước khi bắt đầu', 'err'); return; }
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
    // Pha 7: giây từ lúc bắt đầu tới lần sửa đáp án cuối của từng câu (sổ tay dùng để gợi ý chia thời gian)
    const startMs = att.endAt - att.durationSec * 1000;
    const mark = (stt) => { att.times = att.times || {}; att.times[stt] = Math.max(0, Math.round((Date.now() - startMs) / 1000)); };
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
        mark(stt);
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
        mark(stt);
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
      mark(inp.dataset.short);
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
          const r = await api('submitExam', { attemptToken: att.attemptToken, answers: att.answers, times: att.times || {} }, { retries: 1 });
          clearInterval(timerId);
          store.del(ATTEMPT_KEY);
          // Dữ liệu cũ của trang chủ / lịch sử / thống kê không còn đúng: xóa rồi làm mới ngầm
          App.cacheDel('home', 'history', 'stats', 'practice', 'history_luyen', 'notebook');
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
      nbAfterResult(v);
      return;
    }
    const actions = `<div class="row no-print" style="margin-top:12px"><a class="btn" href="#/">← Trang chủ</a>
      <a class="btn" href="#/lam-bai/${encodeURIComponent(v.examId)}">Làm lại đề này</a>
      ${pub.showLeaderboard ? `<a class="btn" href="#/bang-xep-hang/${encodeURIComponent(v.examId)}">Bảng xếp hạng</a>` : ''}
      <button class="btn" onclick="window.print()">In / Lưu PDF</button></div>`;
    $app.innerHTML = App.resultHtml(v, { actions });
    math($app);
    nbAfterResult(v);
  }

  /* ---------- sổ tay cá nhân (Pha 7a, 7b) — docs/spec/pha-7-so-tay.md, mẫu docs/spec/mau-so-tay.html ---------- */
  const NB_LOAI = {
    CONG_THUC: { ten: 'Nhớ nhầm công thức', mau: 'var(--nb-ct)' },
    DOC_DE: { ten: 'Đọc sai đề / bỏ sót dữ kiện', mau: 'var(--nb-dd)' },
    TINH_TOAN: { ten: 'Tính toán / quên đổi đơn vị', mau: 'var(--nb-tt)' },
    SOT: { ten: 'Sót ý / sót câu / quên không làm', mau: 'var(--nb-sot)' },
    HONG_KT: { ten: 'Chưa biết làm', mau: 'var(--nb-hkt)' },
    DOAN_MO: { ten: 'Đoán mò', mau: 'var(--nb-hkt)' },
    CHUA_RO: { ten: 'Chưa phân loại', mau: 'var(--nb-cr)' }
  };
  const NB_NGOO = ['CONG_THUC', 'DOC_DE', 'TINH_TOAN', 'SOT'];
  const NB_PICK = ['CONG_THUC', 'DOC_DE', 'TINH_TOAN', 'SOT', 'HONG_KT', 'DOAN_MO'];
  const NB_Y = { DON_VI: 'đơn vị', BAM_MAY: 'bấm máy' };
  const NB_MAU = { do: 'Đỏ: chưa làm đúng lại', vang: 'Vàng: đang tiến bộ', xanh: 'Xanh: đã khắc phục' };
  const NB_SEV = { do: 0, vang: 1, xanh: 2 };
  const NB_PHAN = { 1: 'I', 2: 'II', 3: 'III' };
  const NB_EMPTY = () => ({ loai: '', src: '', mau: '', q: '', from: '', chuong: '' });
  const nb = { data: null, filter: NB_EMPTY(), open: new Set(), detail: {}, loading: {}, tab: 'sotay', hkt: false, fix: new Set(), tools: {}, saving: {} };

  /* Thang đơn vị (công cụ "Tính toán / quên đổi đơn vị", §5.3): [đơn vị, số mũ của 10 so với đơn vị chuẩn] */
  const NB_DL = {
    chieuDai: { ten: 'Chiều dài', chuan: 'm', thang: [['km', 3], ['hm', 2], ['dam', 1], ['m', 0], ['dm', -1], ['cm', -2], ['mm', -3], ['µm', -6], ['nm', -9]] },
    dienTich: { ten: 'Diện tích', chuan: 'm²', thang: [['km²', 6], ['m²', 0], ['dm²', -2], ['cm²', -4], ['mm²', -6]] },
    theTich: { ten: 'Thể tích', chuan: 'm³', thang: [['m³', 0], ['dm³ (lít)', -3], ['cm³ (mL)', -6], ['mm³', -9]] },
    khoiLuong: { ten: 'Khối lượng', chuan: 'kg', thang: [['tấn', 3], ['kg', 0], ['g', -3], ['mg', -6]], khac: ['1 u ≈ 1,66·10⁻²⁷ kg'] },
    thoiGian: { ten: 'Thời gian', chuan: 's', thang: [['s', 0], ['ms', -3], ['µs', -6], ['ns', -9]], khac: ['1 phút = 60 s', '1 h = 3 600 s', '1 ngày = 86 400 s'] },
    vanToc: { ten: 'Vận tốc', chuan: 'm/s', thang: [['m/s', 0], ['dm/s', -1], ['cm/s', -2], ['mm/s', -3]], khac: ['1 km/h = 1/3,6 m/s'] },
    apSuat: { ten: 'Áp suất', chuan: 'Pa', thang: [['MPa', 6], ['kPa', 3], ['hPa', 2], ['Pa', 0]], khac: ['1 atm ≈ 1,013·10⁵ Pa', '1 bar = 10⁵ Pa', '1 mmHg ≈ 133,3 Pa'] },
    nangLuong: { ten: 'Năng lượng', chuan: 'J', thang: [['MJ', 6], ['kJ', 3], ['J', 0], ['mJ', -3]], khac: ['1 eV = 1,6·10⁻¹⁹ J', '1 MeV = 1,6·10⁻¹³ J', '1 kWh = 3,6·10⁶ J', '1 cal ≈ 4,186 J'] },
    congSuat: { ten: 'Công suất', chuan: 'W', thang: [['MW', 6], ['kW', 3], ['W', 0], ['mW', -3]] },
    dienTichQ: { ten: 'Điện tích', chuan: 'C', thang: [['C', 0], ['mC', -3], ['µC', -6], ['nC', -9], ['pC', -12]], khac: ['e = 1,6·10⁻¹⁹ C'] },
    dienDung: { ten: 'Điện dung', chuan: 'F', thang: [['F', 0], ['mF', -3], ['µF', -6], ['nF', -9], ['pF', -12]] },
    dongDien: { ten: 'Cường độ dòng điện', chuan: 'A', thang: [['kA', 3], ['A', 0], ['mA', -3], ['µA', -6]] },
    hieuDienThe: { ten: 'Hiệu điện thế', chuan: 'V', thang: [['kV', 3], ['V', 0], ['mV', -3], ['µV', -6]] },
    tanSo: { ten: 'Tần số', chuan: 'Hz', thang: [['GHz', 9], ['MHz', 6], ['kHz', 3], ['Hz', 0]] },
    camUngTu: { ten: 'Cảm ứng từ', chuan: 'T', thang: [['T', 0], ['mT', -3], ['µT', -6]], khac: ['1 G (gauss) = 10⁻⁴ T'] },
    doPhongXa: { ten: 'Độ phóng xạ', chuan: 'Bq', thang: [['GBq', 9], ['MBq', 6], ['kBq', 3], ['Bq', 0]], khac: ['1 Ci = 3,7·10¹⁰ Bq'] },
    goc: { ten: 'Góc', chuan: 'rad', dacBiet: '180° = π rad, nên số đo độ × π/180 = số đo radian.' },
    nhietDo: { ten: 'Nhiệt độ', chuan: 'K', dacBiet: 'Nhiệt độ đổi bằng phép cộng, không nhân 10ⁿ: T (K) = t (°C) + 273. Hiệu nhiệt độ thì như nhau: Δt = 10 °C ứng với ΔT = 10 K.' }
  };
  const NB_KW_GIAI = [
    ['SAI / KHÔNG đúng', 'Đề hỏi phát biểu sai: tìm câu sai, không phải câu đúng.'],
    ['ít nhất / tối đa / tối thiểu', 'Đề hỏi giá trị biên, thường phải xét điều kiện rồi mới tính.'],
    ['làm tròn đến …', 'Đáp án Phần III phải làm tròn đúng chữ số đề yêu cầu.'],
    ['đơn vị của kết quả', 'Đơn vị đề hỏi (kPa, cm/s, MeV…) có thể khác đơn vị của dữ kiện.'],
    ['bỏ qua / lấy g = …', 'Điều kiện được phép bỏ qua và giá trị bắt buộc phải dùng.'],
    ['ban đầu / từ trạng thái nghỉ', 'Cho biết vận tốc đầu bằng 0 hoặc trạng thái xuất phát.'],
    ['ngay sau / ngay trước / độ lớn', 'Thời điểm phải xét và việc chỉ lấy giá trị dương.']
  ];
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const pow10 = (n) => '10' + String(n).split('').map((c) => SUP[c] || c).join('');
  const nbNum = (s) => { const x = parseFloat(String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.')); return isNaN(x) ? null : x; };

  function notebookOffHtml() {
    return `<h1>Sổ tay của em</h1><div class="card empty" id="notebookOff">Mục Sổ tay hiện chưa mở. Khi giáo viên bật, các câu em làm sai sẽ được tập hợp ở đây.
      <div style="margin-top:10px"><a class="btn" href="#/">← Trang chủ</a></div></div>`;
  }

  /** Sổ tay: bản lưu trên máy nếu có, rồi hỏi máy chủ (dùng ở trang chủ, trước khi làm đề, trang kết quả). */
  async function nbFetch(fresh) {
    if (!notebookAllowed()) return null;
    const hit = !fresh && App.cacheGet('notebook');
    if (hit && hit.d) return hit.d;
    const tok = App.cacheToken();
    const d = await api('notebook');
    App.cacheSet('notebook', d, tok);
    return d;
  }

  function viewNotebook() {
    // Vòng 2 (R-6): giáo viên đã tắt sổ tay thì không vẽ bản lưu cũ trên máy
    if (!notebookAllowed()) { App.cacheDel('notebook'); $app.innerHTML = notebookOffHtml(); refreshPub(); return; }
    nb.open = new Set(); nb.detail = {}; nb.loading = {}; nb.tools = {}; nb.fix = new Set();
    nb.filter = NB_EMPTY();
    nb.tab = 'sotay'; // Vòng 2 (R-7): điện thoại luôn mở tab Sổ tay trước
    return cached('notebook', () => api('notebook'), renderNotebook, { skeleton: () => { $app.innerHTML = App.skeletonHtml('table'); } })
      .catch((e) => {
        if (e.unsupported || /tắt sổ tay/.test(e.message)) {
          App.cacheDel('notebook');
          $app.innerHTML = notebookOffHtml();
          refreshPub();
          return;
        }
        $app.innerHTML = errorBox(e);
      });
  }

  const nbGroupOf = (it) => (NB_NGOO.indexOf(it.loi.ma) >= 0 ? 'ngoo' : 'hong');
  const nbSrcId = (it) => (it.nguon.luyenTap ? 'LT' : 'E:' + it.nguon.examId);
  const nbDay = (s) => { const m = /^(\d{1,2})\/(\d{1,2})/.exec(String(s || '')); return m ? m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') : ''; };
  const nbFind = (key) => nb.data.items.find((x) => x.key === key);

  function renderNotebook(d) {
    nb.data = d;
    const t = d.tongHop;
    const canFix = practiceAllowed() && d.items.some((x) => x.mau !== 'xanh');
    let h = `<div class="nb-head"><div><h1>Sổ tay của em</h1>
      <p class="muted" id="nbMeta">${t.tong} câu đã sai · ${t.chuaKhacPhuc} câu chưa làm đúng lại · ${t.lapLai} lỗi đang lặp lại</p></div>
      ${canFix ? `<div class="nb-fixbar"><button class="btn btn-primary" data-nbstart="ON_NHANH">Ôn trước giờ kiểm tra <small>5 câu · 7 phút</small></button>
        <button class="btn" data-nbstart="MUOI_CAU">Đề khắc phục <small>10 câu · 15 phút</small></button></div>` : ''}</div>`;
    if (!d.items.length) {
      $app.innerHTML = h + `<div class="card empty" id="nbEmpty">Em chưa có câu sai nào. Sau mỗi bài làm, các câu sai sẽ tự vào sổ tay để em xem lại.
        <div style="margin-top:10px"><a class="btn" href="#/">← Trang chủ</a></div></div>`;
      return;
    }
    const srcs = [];
    const seen = {};
    d.items.forEach((it) => { const k = nbSrcId(it); if (!seen[k]) { seen[k] = 1; srcs.push([k, it.nguon.luyenTap ? 'Bài luyện tập' : it.nguon.tieuDe]); } });
    h += `<div class="nb-tabs" role="tablist" aria-label="Chọn nửa màn hình">
        <button role="tab" id="nbTabBook" aria-selected="${nb.tab === 'sotay'}" data-nbtab="sotay">Sổ tay</button>
        <button role="tab" id="nbTabList" aria-selected="${nb.tab === 'cau'}" data-nbtab="cau">Câu đã sai (${d.items.length})</button></div>
      <div class="nb-split" id="nbSplit" data-tab="${nb.tab}">
        <section class="nb-pane nb-list-pane" aria-labelledby="nbListTitle">
          <div class="nb-pane-title"><h2 id="nbListTitle">Câu đã sai</h2><span class="muted num" id="nbCount"></span></div>
          <div class="nb-filters">
            <select id="nbfLoai" aria-label="Lọc theo loại lỗi"><option value="">Mọi loại lỗi</option>${NB_NGOO.map((m) => `<option value="${m}">${esc(NB_LOAI[m].ten)}</option>`).join('')}
              <option value="HONG">Hổng kiến thức</option><option value="CHUA_RO">Chưa phân loại</option></select>
            <select id="nbfSrc" aria-label="Lọc theo đề"><option value="">Mọi đề</option>${srcs.map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('')}</select>
            <select id="nbfMau" aria-label="Lọc theo mức độ"><option value="">Mọi mức độ</option>${Object.keys(NB_MAU).map((k) => `<option value="${k}">${NB_MAU[k]}</option>`).join('')}</select>
            <input id="nbfQ" type="search" placeholder="Tìm theo bài, chương, đề…" aria-label="Tìm theo bài, chương, đề">
          </div>
          <div id="nbActive"></div><div id="nbList"></div>
        </section>
        <aside class="nb-pane nb-book-pane" aria-labelledby="nbBookTitle"><div class="nb-book" id="nbBook"></div></aside>
      </div>`;
    $app.innerHTML = h;
    const f = nb.filter;
    document.getElementById('nbfLoai').value = f.loai;
    document.getElementById('nbfSrc').value = f.src;
    document.getElementById('nbfMau').value = f.mau;
    document.getElementById('nbfQ').value = f.q;
    nbRenderBook();
    nbRenderList();
    const onFilter = () => {
      // Vòng 2 (R-2): luôn tạo lại nb.filter (bấm trong sổ có thể đã thay object), bỏ lọc chương ẩn
      nb.filter = { loai: document.getElementById('nbfLoai').value, src: document.getElementById('nbfSrc').value,
        mau: document.getElementById('nbfMau').value, q: document.getElementById('nbfQ').value.trim(), from: '', chuong: '' };
      nbRenderList();
    };
    ['nbfLoai', 'nbfSrc', 'nbfMau'].forEach((id) => { document.getElementById(id).onchange = onFilter; });
    document.getElementById('nbfQ').oninput = onFilter;
    $app.querySelector('.nb-tabs').onclick = (e) => { const b = e.target.closest('[data-nbtab]'); if (b) nbSetTab(b.dataset.nbtab); };
    $app.querySelector('.nb-head').onclick = nbStartClick;
    const list = document.getElementById('nbList'), book = document.getElementById('nbBook');
    list.onclick = nbListClick;
    book.onclick = nbBookClick;
    [list, book].forEach((el) => {
      el.addEventListener('input', nbInput);
      el.addEventListener('change', nbChange);
    });
    document.getElementById('nbActive').onclick = (e) => { if (e.target.closest('[data-nbclear]')) { nb.filter = NB_EMPTY(); renderNotebook(nb.data); } };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(nbSnapBook);
  }

  function nbSetTab(tab) {
    nb.tab = tab;
    const sp = document.getElementById('nbSplit');
    if (sp) sp.dataset.tab = tab;
    document.getElementById('nbTabBook').setAttribute('aria-selected', String(tab === 'sotay'));
    document.getElementById('nbTabList').setAttribute('aria-selected', String(tab === 'cau'));
    if (tab === 'sotay') nbSnapBook();
  }

  function nbPasses(it) {
    const f = nb.filter;
    if (f.loai === 'HONG' ? !(it.loi.ma === 'HONG_KT' || it.loi.ma === 'DOAN_MO') : f.loai && it.loi.ma !== f.loai) return false;
    if (f.src && nbSrcId(it) !== f.src) return false;
    if (f.mau && it.mau !== f.mau) return false;
    if (f.chuong && (it.chuong !== f.chuong || nbGroupOf(it) === 'ngoo')) return false;
    if (f.q) {
      const hay = (it.bai + ' ' + it.chuong + ' ' + it.nguon.tieuDe).toLowerCase();
      if (!hay.includes(f.q.toLowerCase())) return false;
    }
    return true;
  }

  function nbTag(it) {
    const L = NB_LOAI[it.loi.ma] || NB_LOAI.CHUA_RO;
    const ask = it.loi.nguon === 'MAY' && it.loi.canHoi;
    const y = it.loi.y && NB_Y[it.loi.y] ? ' · ' + NB_Y[it.loi.y] : '';
    const title = it.loi.nguon === 'HS' ? 'Em chọn' : it.loi.nguon === 'MAY' ? (ask ? 'Máy đoán, chưa chắc chắn' : 'Máy nhận ra') : 'Chưa phân loại';
    return `<span class="nb-tag${ask ? ' guess' : ''}" title="${title}"><i class="nb-sw" style="background:${L.mau}"></i>${esc(L.ten)}${y}${ask ? ' ?' : ''}</span>`;
  }

  function nbRenderList() {
    const d = nb.data;
    const el = document.getElementById('nbList');
    if (!el) return;
    const ng = d.tongHop.saiNgoo.map((s) => s.ma);
    const order = (it) => (nbGroupOf(it) === 'ngoo' ? ng.indexOf(it.loi.ma) * 10 + NB_SEV[it.mau] : 100 + NB_SEV[it.mau]);
    const all = d.items.filter(nbPasses).sort((a, b) => (order(a) - order(b)) || String(b.nguon.nopLuc).localeCompare(String(a.nguon.nopLuc)));
    document.getElementById('nbCount').textContent = `${all.length}/${d.items.length} câu`;
    document.getElementById('nbActive').innerHTML = nb.filter.from ? `<div class="nb-active"><span class="muted">Đang xem:</span><button class="nb-pill" data-nbclear="1">${esc(nb.filter.from)} ✕</button></div>` : '';
    if (!all.length) { el.innerHTML = '<div class="card empty">Không có câu nào khớp bộ lọc.</div>'; return; }
    const groups = [['Sai ngoo', all.filter((i) => nbGroupOf(i) === 'ngoo')], ['Hổng kiến thức và chưa phân loại', all.filter((i) => nbGroupOf(i) !== 'ngoo')]];
    const keep = nbKeepFocus(el);
    el.innerHTML = groups.filter((g) => g[1].length).map(([ten, its]) => `<div class="nb-group">${ten}</div><div class="nb-items">${its.map(nbItemHtml).join('')}</div>`).join('');
    math(el);
    keep();
    const need = [...nb.open].filter((k) => !nb.detail[k] && !nb.loading[k] && all.some((x) => x.key === k));
    if (need.length) nbLoadDetail(need);
  }

  function nbItemHtml(it) {
    const open = nb.open.has(it.key);
    const n = it.nguon;
    const sub = [n.luyenTap ? 'Luyện tập: ' + n.tieuDe : n.tieuDe, nbDay(n.nopLuc), it.bai].filter(Boolean).map(esc).join(' · ');
    return `<div class="nb-item${open ? ' open' : ''}${it.mau === 'xanh' ? ' done' : ''}" data-key="${esc(it.key)}">
      <button class="nb-row" data-nbopen="${esc(it.key)}" aria-expanded="${open}">
        <i class="nb-dot ${it.mau}" title="${NB_MAU[it.mau]}"></i>
        <span class="nb-row-main"><span class="nb-row-title">Câu ${esc(n.stt)} · Phần ${NB_PHAN[it.phan] || esc(it.phan)}</span> ${nbTag(it)}${it.coGhiChu ? ' <span class="nb-note-ic" title="Có ghi chú">✎</span>' : ''}
          <span class="nb-row-sub">${sub}</span></span>
        <span class="nb-row-side">${it.lanSai > 1 ? `<span class="nb-count">sai ${it.lanSai} lần</span>` : ''}${it.mau === 'xanh' ? '<span class="nb-fixed">Đã khắc phục</span>' : ''}<span class="nb-chev" aria-hidden="true">▸</span></span>
      </button>${open ? `<div class="nb-detail">${nbDetailHtml(it)}</div>` : ''}</div>`;
  }

  function nbAnswerText(it, a) {
    if (it.loai === 'DS') return String(a || '').split('').map((x) => (x === 'D' ? 'Đ' : x === 'S' ? 'S' : '–')).join(' ');
    return a || '(bỏ trống)';
  }

  function nbDetailHtml(it) {
    const x = nb.detail[it.key];
    if (!x) return nb.loading[it.key] === 'err' ? '<div class="notice warn">Chưa tải được câu này. <button class="btn btn-sm" data-nbretry="1">Thử lại</button></div>' : loadingHtml('Đang tải câu…');
    let h = `<div class="nb-meta muted">${[it.chuong === 'Chưa rõ chương' ? '' : it.chuong, x.bai || it.bai, App.LEVELS[x.mucDo || it.mucDo] || x.mucDo || it.mucDo].filter(Boolean).map(esc).join(' · ')}</div>`;
    if (x.go) {
      h += `<div class="notice warn">${esc(x.noiDung)}</div><div class="small">Em trả lời: <b>${esc(nbAnswerText(it, x.answer))}</b></div>`;
    } else {
      if (x.daSua) h += '<div class="notice">Câu này đã được thầy sửa sau khi em làm; nội dung dưới đây là bản hiện tại.</div>';
      h += `<div class="q-body">${rich(x.noiDung)}</div>${x.hinhAnh ? `<img class="q-img" src="${esc(x.hinhAnh)}" alt="Hình câu ${esc(it.nguon.stt)}" loading="lazy">` : ''}`;
      if (it.loai === 'TN') {
        h += '<div class="nb-opts">' + ['A', 'B', 'C', 'D'].map((k) => {
          const em = x.answer === k, dung = x.dapAn != null && String(x.dapAn).toUpperCase().trim() === k;
          return `<div class="nb-opt${em ? ' em' : ''}${dung ? ' dung' : ''}"><b>${k}.</b> ${rich(x[k])}${em ? '<span class="nb-lab bad">EM CHỌN</span>' : ''}${dung ? '<span class="nb-lab good">ĐÁP ÁN</span>' : ''}</div>`;
        }).join('') + '</div>';
        if (!x.answer) h += '<div class="small nb-bad">Em bỏ trống câu này.</div>';
      } else if (it.loai === 'DS') {
        const ans = String(x.answer || '____').split('');
        const key = x.dapAn != null ? String(x.dapAn).toUpperCase().replace(/Đ/g, 'D').replace(/[^DS]/g, '').split('') : null;
        h += '<div class="nb-opts one">' + ['A', 'B', 'C', 'D'].map((k, i) => {
          const sai = key && ans[i] !== key[i];
          const v = (c) => (c === 'D' ? 'Đ' : c === 'S' ? 'S' : '–');
          return `<div class="nb-opt${sai ? ' em' : ''}"><b>${'abcd'[i]})</b> ${rich(x[k])} <span class="nb-lab">Em: ${v(ans[i])}${key ? ' · Đáp án: ' + v(key[i]) : ''}</span></div>`;
        }).join('') + '</div>';
      } else {
        h += `<div class="nb-ans"><span>Em trả lời: <b class="nb-bad num">${esc(x.answer || '(bỏ trống)')}</b></span>${x.dapAn != null ? `<span>Đáp án: <b class="nb-good num">${esc(String(x.dapAn).split('|').join(' hoặc '))}</b></span>` : ''}</div>`;
      }
      if (x.an) h += `<div class="nb-lock">${esc(x.anNote)}</div>`;
      else if (x.loiGiai) h += `<details class="nb-sol"><summary>Xem lời giải</summary><div class="solution">${rich(x.loiGiai)}</div></details>`;
    }
    // Em sai vì sao? — chọn / đổi loại lỗi (Pha 7b, TC-7.10)
    const src = it.loi.nguon === 'HS' ? 'Em đã chọn loại lỗi này.'
      : it.loi.nguon === 'MAY' ? (it.loi.canHoi ? 'Máy đoán loại lỗi này nhưng chưa chắc chắn. Em xác nhận hoặc chọn lại nhé.' : 'Máy nhận ra loại lỗi này từ câu trả lời của em. Em vẫn đổi được nếu thấy chưa đúng.')
      : 'Máy chưa đoán được. Em chọn giúp loại lỗi của câu này.';
    const busy = nb.saving[it.key] ? ' disabled' : '';
    h += `<div><div class="nb-blk">Em sai vì sao?</div><div class="nb-chips">${NB_PICK.map((ma) => {
      const on = it.loi.ma === ma;
      return `<button class="nb-chip${on ? ' on' : ''}${on && it.loi.canHoi ? ' ask' : ''}" data-nbma="${ma}" aria-pressed="${on}"${busy}><i class="nb-sw" style="background:${NB_LOAI[ma].mau}"></i>${esc(NB_LOAI[ma].ten)}</button>`;
    }).join('')}</div>`;
    if (it.loi.ma === 'TINH_TOAN') {
      h += `<div class="nb-chips nb-sub"><span class="muted small">Cụ thể:</span>${Object.keys(NB_Y).map((y) =>
        `<button class="nb-chip sm${it.loi.y === y ? ' on' : ''}" data-nby="${y}" aria-pressed="${it.loi.y === y}"${busy}>${y === 'DON_VI' ? 'Quên / đổi sai đơn vị' : 'Bấm máy / tính nhầm'}</button>`).join('')}</div>`;
    }
    h += `<div class="nb-src">${src}${it.loi.nguon === 'HS' ? ' <button class="nb-link" data-nbreset="1">Bỏ chọn của em</button>' : ''}</div></div>`;
    h += nbToolHtml(it, x);
    h += `<div><div class="nb-blk">Ghi chú cho câu này <span class="nb-saved" data-nbsaved="${esc(it.key)}"></span></div>
      <textarea class="nb-note-in" data-nbnote="${esc(it.key)}" rows="2" maxlength="500" placeholder="Em rút ra điều gì từ câu này?">${esc(x.ghiChu || '')}</textarea></div>`;
    if (it.nguon.resultId) h += `<div class="row"><a class="btn btn-sm" href="#/ket-qua/${encodeURIComponent(it.nguon.resultId)}">Xem lại bài làm</a></div>`;
    return h;
  }

  /* ---------- công cụ sửa từng loại lỗi (§5) ---------- */
  function nbToolHtml(it, x) {
    const m = it.loi.ma;
    if (m === 'CONG_THUC') return `<div class="nb-tool"><h4>Thẻ công thức</h4>${nbFormulaCards(x.congThuc, x.bai || it.bai)}</div>`;
    if (m === 'DOC_DE') return x.go ? '' : `<div class="nb-tool"><h4>Tập gạch từ khóa</h4>${nbKwTool('kw:' + it.key, x.noiDung)}</div>`;
    if (m === 'TINH_TOAN' && it.loi.y === 'BAM_MAY') {
      const a = nbNum(x.answer), d = x.dapAn != null ? nbNum(String(x.dapAn).split('|')[0]) : null;
      const nguoc = a != null && d != null && d !== 0 && Math.abs(a + d) <= Math.abs(d) * 0.01;
      return `<div class="nb-tool"><h4>Kiểm tra phép tính</h4>${nguoc ? '<div class="nb-fb bad">Đáp án của em ngược dấu với đáp án đúng.</div>' : ''}
        <ul class="nb-tips"><li>Viết quy ước dấu trước khi thay số (ví dụ khí thực hiện công thì A &lt; 0).</li><li>Ước lượng bậc độ lớn của kết quả trước khi bấm máy.</li><li>Bấm máy lại lần hai theo thứ tự khác.</li></ul></div>`;
    }
    if (m === 'TINH_TOAN') return `<div class="nb-tool"><h4>Chọn lại đơn vị đúng</h4>${nbUnitTool('u:' + it.key, it, x)}</div>`;
    if (m === 'SOT') return `<div class="nb-tool"><h4>Chia thời gian từng phần</h4>${nbTimePlan(x.thoiGian, it.loai === 'DS')}</div>`;
    if (m === 'HONG_KT' || m === 'DOAN_MO') {
      return `<div class="nb-tool"><h4>${m === 'DOAN_MO' ? 'Đoán mò được tính là chưa biết làm' : 'Học lại phần này'}</h4>
        <div class="small">Đọc kĩ lời giải${x.an ? ' (sẽ hiện khi đề công bố)' : ''}, rồi luyện thêm câu cùng bài "${esc(x.bai || it.bai)}". Câu này được ưu tiên đưa vào đề khắc phục.</div>
        ${practiceAllowed() ? '<div class="row"><a class="btn btn-sm" href="#/luyen-tap">Mở Luyện tập</a></div>' : ''}</div>`;
    }
    return '<div class="nb-tool"><div class="small">Chọn loại lỗi ở trên để nhận cách sửa phù hợp.</div></div>';
  }

  function nbFormulaCards(list, bai) {
    if (!list || !list.length) return `<div class="nb-fb">Thầy chưa nhập công thức cho bài "${esc(bai || '')}". Em ghi công thức đúng vào ô ghi chú bên dưới để nhớ.</div>`;
    const tex = (s) => (/\$/.test(s) ? s : '$' + s + '$');
    return list.map((f) => `<div class="nb-fcard">${f.ten ? `<div class="muted small">${esc(f.ten)}</div>` : ''}
      ${f.tenGoiNho ? `<div class="nb-nick">${esc(f.tenGoiNho)}</div>` : ''}<div class="nb-ct">${rich(tex(f.congThuc))}</div>
      <dl>${f.phamVi ? `<dt>Phạm vi</dt><dd>${esc(f.phamVi)}</dd>` : ''}${f.dauHieu ? `<dt>Dấu hiệu</dt><dd>${esc(f.dauHieu)}</dd>` : ''}</dl></div>`).join('');
  }

  /** Chữ thường của câu hỏi để gạch từ khóa: bỏ công thức $…$, thẻ HTML, khối bảng. */
  function nbPlain(s) {
    return String(s || '').replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, ' [công thức] ').replace(/<[^>]+>/g, ' ').replace(/\[\/?BẢNG\][\s\S]*?(\[\/BẢNG\]|$)/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function nbTokens(text) {
    const kws = (nb.data && nb.data.tuKhoa) || [];
    const toks = nbPlain(text).split(' ').filter(Boolean).map((raw) => ({ raw, w: raw.toLowerCase().replace(/[.,;:?!()"“”]/g, '') }));
    const kw = new Array(toks.length).fill(false);
    kws.forEach((k) => {
      const parts = k.split(/\s+/).map((p) => p.replace(/[.,;:?!()"“”]/g, '')).filter(Boolean);
      if (!parts.length) return;
      for (let i = 0; i + parts.length <= toks.length; i++) {
        if (parts.every((p, j) => toks[i + j].w === p)) for (let j = 0; j < parts.length; j++) kw[i + j] = true;
      }
    });
    toks.forEach((t, i) => { t.kw = kw[i]; t.so = /\d/.test(t.w); });
    return toks;
  }
  function nbKwTool(tkey, text) {
    const st = nb.tools[tkey] || (nb.tools[tkey] = { sel: [], checked: false });
    const toks = nbTokens(text);
    const html = toks.map((t, i) => {
      const sel = st.sel.indexOf(i) >= 0;
      let c = 'nb-tok' + (sel ? ' sel' : '');
      if (st.checked && t.kw) c += sel ? ' kw' : ' kw miss';
      if (st.checked && t.so && !sel) c += ' so';
      return `<button class="${c}" data-kwtok="${i}" data-tool="${esc(tkey)}" aria-pressed="${sel}">${esc(t.raw)}</button>`;
    }).join(' ');
    let res = '';
    if (st.checked) {
      const idx = toks.map((t, i) => (t.kw ? i : -1)).filter((i) => i >= 0);
      const got = idx.filter((i) => st.sel.indexOf(i) >= 0).length;
      const miss = idx.filter((i) => st.sel.indexOf(i) < 0).map((i) => toks[i].raw.replace(/[.,;:?!()"“”]/g, ''));
      res = idx.length ? `<div class="nb-fb ${miss.length ? 'bad' : 'good'}">Em gạch được ${got}/${idx.length} từ khóa.${miss.length ? ' Bỏ sót: ' + miss.map((m) => '“' + esc(m) + '”').join(', ') + '.' : ' Tốt lắm!'} Dữ kiện số được tô xanh.</div>`
        : '<div class="nb-fb">Câu này không có từ khóa trong danh sách. Hãy chú ý các dữ kiện số (tô xanh) và đơn vị của chúng.</div>';
    }
    return `<div class="muted small">Chạm vào những từ em thấy quan trọng, rồi bấm So sánh.</div>
      <div class="nb-kw-text">${html}</div>
      <div class="row"><button class="btn btn-sm btn-primary" data-kwcheck="1" data-tool="${esc(tkey)}">So sánh</button><button class="btn btn-sm" data-kwreset="1" data-tool="${esc(tkey)}">Làm lại</button></div>
      ${res}<div class="nb-kw-legend"><span class="a">Em gạch</span><span class="b">Từ khóa em bỏ sót</span><span class="c">Dữ kiện số</span></div>`;
  }
  function nbKwExplain() {
    return `<ul class="nb-kwlist">${NB_KW_GIAI.map(([k, g]) => `<li><b>${esc(k)}</b>: ${esc(g)}</li>`).join('')}</ul>`;
  }

  /**
   * Thang đơn vị. Với câu (it, x): em chọn đại lượng, đơn vị em đã dùng, rồi đơn vị đúng → lưu vào chi tiết lỗi (notebookTag).
   * Không có câu: chế độ tra cứu (bấm hai đơn vị để xem cách đổi).
   */
  function nbUnitTool(tkey, it, x) {
    const ct = (x && x.chiTietLoi) || {};
    const st = nb.tools[tkey] || (nb.tools[tkey] = { dl: NB_DL[ct.dl] ? ct.dl : 'chieuDai', em: ct.dvEm || '', dung: ct.dvDung || '', wrong: '' });
    const d = NB_DL[st.dl];
    let h = `<label class="small nb-dl">Đại lượng${it ? ' em đổi sai' : ''}: <select data-unitdl="1" data-tool="${esc(tkey)}">${Object.keys(NB_DL).map((k) => `<option value="${k}"${k === st.dl ? ' selected' : ''}>${esc(NB_DL[k].ten)}</option>`).join('')}</select></label>`;
    st.lech = nbLech(it, x);
    if (st.lech) h += `<div class="nb-fb bad">Đáp án của em lệch đúng ${pow10(st.lech)} lần so với đáp án đúng.</div>`;
    if (d.dacBiet) return h + `<div class="nb-fb">${esc(d.dacBiet)}</div>`;
    const exp = {};
    d.thang.forEach(([u, e]) => { exp[u] = e; });
    const rungs = d.thang.map(([u, e], i) => {
      let c = 'nb-rung';
      if (u === d.chuan) c += ' chuan';
      if (st.em === u) c += ' em';
      if (st.dung === u) c += ' ok';
      if (st.wrong === u) c += ' wrong';
      const step = i < d.thang.length - 1 ? `<span class="nb-step">×${pow10(e - d.thang[i + 1][1])}</span>` : '';
      return `<button class="${c}" data-unit="${esc(u)}" data-tool="${esc(tkey)}">${esc(u)}</button>${step}`;
    }).join('');
    h += `<div class="nb-ladder-wrap"><div class="nb-ladder" role="group" aria-label="Thang đơn vị ${esc(d.ten)}">${rungs}</div></div>
      <div class="muted small">Sang phải một bậc thì nhân với số ghi giữa hai bậc. Đơn vị chuẩn SI: <b>${esc(d.chuan)}</b> (khung đậm).</div>`;
    if (d.khac) h += `<div class="nb-other small muted">Đơn vị khác: ${d.khac.map(esc).join(' · ')}</div>`;
    const em = st.em && exp[st.em] != null ? st.em : '', dung = st.dung && exp[st.dung] != null ? st.dung : '';
    if (em && st.wrong && exp[st.wrong] != null) h += `<div class="nb-fb bad">Đổi từ ${esc(em)} sang ${esc(st.wrong)} chỉ lệch ${pow10(Math.abs(exp[em] - exp[st.wrong]))} lần, nhưng đáp án của em lệch ${pow10(Math.abs(st.lech))} lần. Em thử chọn lại nhé.</div>`;
    else if (em && dung) h += `<div class="nb-fb good">1 ${esc(em)} = ${pow10(exp[em] - exp[dung])} ${esc(dung)}${it ? `: số đo theo ${esc(em)} phải nhân với ${pow10(exp[em] - exp[dung])} để ra ${esc(dung)}.` : '.'}</div>`;
    else if (em) h += `<div class="nb-fb">${it ? `Em đã dùng <b>${esc(em)}</b>. Bấm vào đơn vị đúng mà dữ kiện này phải đổi sang.` : `Đã chọn ${esc(em)}. Bấm đơn vị muốn đổi sang.`}</div>`;
    else h += `<div class="nb-fb">${it ? 'Bấm vào đơn vị <b>em đã dùng</b> khi làm câu này.' : 'Bấm hai đơn vị để xem cách đổi.'}</div>`;
    return h;
  }

  /** Số mũ n khi đáp án Phần III của em lệch đúng 10ⁿ lần so với đáp án đúng (chỉ khi đáp án đã công bố). */
  function nbLech(it, x) {
    if (!it || !x || x.dapAn == null || it.loai !== 'TL') return 0;
    const a = nbNum(x.answer), d = nbNum(String(x.dapAn).split('|')[0]);
    if (!a || !d || a / d <= 0) return 0;
    const n = Math.round(Math.log10(a / d));
    return n && Math.abs(a / d / Math.pow(10, n) - 1) <= 0.01 ? n : 0;
  }

  /** Thời gian đề xuất (tỉ lệ đề 50 phút: 15 / 15 / 12 / 8) và lúc em làm xong từng phần (nếu bài có t). */
  function nbTimePlan(tg, ds) {
    const phut = (tg && tg.phut) || 50, k = phut / 50;
    const f = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
    const xong = tg && tg.xong;
    const plan = [['Phần I', 15, '1'], ['Phần II', 15, '2'], ['Phần III', 12, '3'], ['Kiểm tra lại', 8, null]];
    let moc = 0;
    const rows = plan.map(([ten, p, key]) => {
      moc += p * k;
      const thuc = key && xong && xong[key] != null ? xong[key] / 60 : null;
      const tre = thuc != null && thuc > moc + 0.5;
      return `<tr><td>${ten}</td><td class="num">${f(p * k)}′</td><td class="num">${key ? 'trước phút ' + f(moc) : 'cuối giờ'}</td>
        <td class="num">${thuc != null ? `<b class="${tre ? 'nb-bad' : 'nb-good'}">phút ${f(thuc)}</b>` : '—'}</td></tr>`;
    }).join('');
    return `<div class="muted small">Đề ${f(phut)} phút${xong ? ' · cột cuối là lúc em sửa đáp án cuối cùng của phần đó' : ''}</div>
      <div class="table-wrap"><table class="nb-plan"><thead><tr><th>Phần</th><th class="num">Đề xuất</th><th class="num">Mốc</th><th class="num">Em xong</th></tr></thead><tbody>${rows}</tbody></table></div>
      <ul class="nb-tips"><li>Câu nào quá 1–2 phút thì đánh dấu, làm sau.</li><li>Chừa ${f(8 * k)} phút cuối để dò lại cả bài${ds ? ', nhất là từng ý a, b, c, d của Phần II' : ''}.</li><li>Trước khi nộp, mở danh sách câu, kiểm tra không còn câu nào trống.</li></ul>`;
  }

  /* ---------- tải chi tiết, lưu phân loại, ghi chú ---------- */
  async function nbLoadDetail(keys) {
    keys = keys.filter((k) => !nb.detail[k]).slice(0, 20);
    if (!keys.length) return;
    keys.forEach((k) => { nb.loading[k] = 1; });
    const my = App.currentView();
    try {
      const r = await api('notebookItem', { keys });
      r.items.forEach((x) => { nb.detail[x.key] = x; delete nb.loading[x.key]; });
    } catch (e) {
      keys.forEach((k) => { nb.loading[k] = 'err'; });
      toast(e.message, 'err');
    }
    if (App.currentView() === my && document.getElementById('nbList')) { nbRenderList(); nbRenderBook(); }
  }

  /** Lưu loại lỗi em chọn (ma = '' → bỏ chọn), rồi tải lại sổ tay (màu, tỉ lệ thay đổi). */
  async function nbSaveTag(key, ma, y, chiTiet) {
    const it = nbFind(key);
    if (!it || nb.saving[key]) return;
    nb.saving[key] = 1;
    const my = App.currentView();
    try {
      await api('notebookTag', { items: [{ key, ma, y, chiTiet }] });
      if (nb.detail[key] && chiTiet) nb.detail[key].chiTietLoi = Object.assign({ y }, chiTiet);
      const tok = App.cacheToken();
      const d = await api('notebook');
      App.cacheSet('notebook', d, tok);
      if (App.currentView() === my && document.getElementById('nbList')) {
        // Vòng 3 (V2-1): giữ ghi chú đang có ở máy (có thể chưa lưu xong) thay vì bản máy chủ vừa trả
        if (nb.data) {
          d.ghiChuChung = nb.data.ghiChuChung;
          const local = {};
          nb.data.items.forEach((x) => { local[x.key] = x.coGhiChu; });
          d.items.forEach((x) => { if (x.key in local) x.coGhiChu = local[x.key]; });
        }
        nb.data = d; delete nb.saving[key]; nbRenderBook(); nbRenderList(); nbMeta();
      }
    } catch (e) { toast(e.message, 'err'); }
    delete nb.saving[key];
  }
  function nbMeta() {
    const t = nb.data.tongHop, el = document.getElementById('nbMeta');
    if (el) el.textContent = `${t.tong} câu đã sai · ${t.chuaKhacPhuc} câu chưa làm đúng lại · ${t.lapLai} lỗi đang lặp lại`;
  }

  /* Vòng 2 (R-2): chữ đang gõ ghi ngay vào trạng thái (vẽ lại không mất chữ, không mất con trỏ); lưu lên máy chủ sau 1,2 s;
     rời trang / đổi màn / ẩn tab thì gửi ngay các ghi chú còn chờ. */
  const nbNoteTimers = {}, nbNotePending = {}, nbNoteInflight = {};
  function nbSetLocalNote(key, text) {
    if (key === '_CHUNG') { if (nb.data) nb.data.ghiChuChung = text; return; }
    if (nb.detail[key]) nb.detail[key].ghiChu = text;
    const it = nb.data && nbFind(key);
    if (it) it.coGhiChu = !!text.trim();
  }
  function nbStatusEl(key) {
    return key === '_CHUNG' ? document.getElementById('nbGsaved') : document.querySelector(`[data-nbsaved="${CSS.escape(key)}"]`);
  }
  async function nbSendNote(key, keepalive) {
    clearTimeout(nbNoteTimers[key]);
    delete nbNoteTimers[key];
    if (!(key in nbNotePending)) return;
    // Vòng 3 (V2-2): đang gửi bản trước thì chờ nó xong rồi gửi bản mới (không để bản cũ ghi sau bản mới).
    // Riêng lúc rời trang (keepalive) thì gửi luôn.
    if (nbNoteInflight[key] && !keepalive) return;
    const text = nbNotePending[key];
    delete nbNotePending[key];
    nbNoteInflight[key] = true;
    try {
      await api('notebookNote', { key, text }, { keepalive });
      // R-3: không bỏ bản lưu sổ tay, chỉ cập nhật nó
      if (nb.data) App.cacheSet('notebook', nb.data, App.cacheToken());
      const st = nbStatusEl(key);
      if (st && !(key in nbNotePending)) st.textContent = 'Đã lưu';
    } catch (e) {
      if (!(key in nbNotePending)) nbNotePending[key] = text; // giữ lại để thử lần sau
      const st = nbStatusEl(key);
      if (st) st.textContent = 'Chưa lưu được';
      if (!keepalive) toast(e.message, 'err');
      delete nbNoteInflight[key];
      return;
    }
    delete nbNoteInflight[key];
    if (key in nbNotePending && !nbNoteTimers[key]) nbSendNote(key, false);
  }
  function nbQueueNote(key, text) {
    nbSetLocalNote(key, text);
    nbNotePending[key] = text;
    const st = nbStatusEl(key);
    if (st) st.textContent = 'Đang lưu…';
    clearTimeout(nbNoteTimers[key]);
    nbNoteTimers[key] = setTimeout(() => nbSendNote(key, false), 1200);
  }
  function nbFlushNotes() { Object.keys(nbNotePending).forEach((k) => nbSendNote(k, true)); }
  window.addEventListener('pagehide', nbFlushNotes);
  window.addEventListener('hashchange', nbFlushNotes);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') nbFlushNotes(); });
  /** Ô ghi chú đang có con trỏ: sau khi vẽ lại thì đặt lại con trỏ đúng chỗ. */
  function nbKeepFocus(root) {
    const a = document.activeElement;
    if (!a || !root.contains(a) || !a.dataset || a.dataset.nbnote == null) return () => {};
    const key = a.dataset.nbnote, s0 = a.selectionStart, s1 = a.selectionEnd;
    return () => {
      const t = root.querySelector(`[data-nbnote="${CSS.escape(key)}"]`);
      if (!t) return;
      t.focus();
      try { t.setSelectionRange(s0, s1); } catch (e) { /* bỏ qua */ }
    };
  }

  /* ---------- sự kiện ---------- */
  function nbToolEvent(e) {
    const t = e.target.closest('[data-tool]');
    if (!t) return false;
    const tkey = t.dataset.tool;
    if (t.dataset.kwtok != null) {
      const st = nb.tools[tkey], i = +t.dataset.kwtok;
      st.sel = st.sel.indexOf(i) >= 0 ? st.sel.filter((v) => v !== i) : st.sel.concat(i);
      return true;
    }
    if (t.dataset.kwcheck) { nb.tools[tkey].checked = true; return true; }
    if (t.dataset.kwreset) { nb.tools[tkey] = { sel: [], checked: false }; return true; }
    if (t.dataset.unit != null) {
      const st = nb.tools[tkey], u = t.dataset.unit;
      const item = tkey.indexOf('u:') === 0 ? nbFind(tkey.slice(2)) : null;
      if (!st.em || (st.em && st.dung) || (!item && st.em === u)) { st.em = u; st.dung = ''; st.wrong = ''; }
      else if (u !== st.em) {
        // Vòng 2 (K-2): đã biết đáp án lệch 10ⁿ thì cặp đơn vị phải lệch đúng 10ⁿ
        const d = NB_DL[st.dl], exp = {};
        (d.thang || []).forEach(([v, n]) => { exp[v] = n; });
        if (st.lech && Math.abs(exp[st.em] - exp[u]) !== Math.abs(st.lech)) { st.wrong = u; st.dung = ''; return true; }
        st.dung = u; st.wrong = '';
        if (item) nbSaveTag(item.key, 'TINH_TOAN', 'DON_VI', { dl: st.dl, dvEm: st.em, dvDung: u });
      }
      return true;
    }
    return false;
  }

  function nbListClick(e) {
    const retry = e.target.closest('[data-nbretry]');
    if (retry) {
      const key = retry.closest('.nb-item').dataset.key;
      delete nb.loading[key];
      nbLoadDetail([key]);
      nbRenderList();
      return;
    }
    const item = e.target.closest('.nb-item');
    const key = item && item.dataset.key;
    const chip = e.target.closest('[data-nbma]');
    if (chip && key) {
      const it = nbFind(key);
      if (it && !(it.loi.nguon === 'HS' && it.loi.ma === chip.dataset.nbma)) nbSaveTag(key, chip.dataset.nbma, chip.dataset.nbma === 'TINH_TOAN' ? (it.loi.y || '') : '');
      return;
    }
    const ych = e.target.closest('[data-nby]');
    if (ych && key) { nbSaveTag(key, 'TINH_TOAN', ych.dataset.nby, ych.dataset.nby === 'DON_VI' && nb.tools['u:' + key] ? { dl: nb.tools['u:' + key].dl } : undefined); return; }
    if (e.target.closest('[data-nbreset]') && key) { nbSaveTag(key, ''); return; }
    if (nbToolEvent(e)) { nbRenderList(); return; }
    const b = e.target.closest('[data-nbopen]');
    if (!b) return;
    const k = b.dataset.nbopen;
    if (nb.open.has(k)) nb.open.delete(k); else nb.open.add(k);
    nbRenderList();
  }

  function nbInput(e) {
    const ta = e.target.closest('[data-nbnote]');
    if (!ta) return;
    const key = ta.dataset.nbnote;
    if (key === '_CHUNG') nbGrowNote(ta);
    nbQueueNote(key, ta.value.slice(0, 500));
  }
  function nbChange(e) {
    const s = e.target.closest('[data-unitdl]');
    if (!s) return;
    nb.tools[s.dataset.tool] = { dl: s.value, em: '', dung: '', wrong: '' };
    if (s.closest('#nbBook')) nbRenderBook(); else nbRenderList();
  }

  /** Pha 7c: bắt đầu đề khắc phục (đi qua hộp mục tiêu điểm như các bài luyện khác). */
  function nbStartClick(e) {
    const b = e.target.closest('[data-nbstart]');
    if (!b) return false;
    const body = { kieu: 'KHAC_PHUC', mau: b.dataset.nbstart };
    if (b.dataset.ma) body.ma = b.dataset.ma;
    startPractice(b, body);
    return true;
  }

  function nbBookClick(e) {
    if (nbStartClick(e)) return;
    const fx = e.target.closest('[data-nbfix]');
    if (fx) {
      const ma = fx.dataset.nbfix;
      if (nb.fix.has(ma)) nb.fix.delete(ma); else { nb.fix.add(ma); nbBookNeed(ma); }
      nbRenderBook();
      return;
    }
    if (nbToolEvent(e)) { nbRenderBook(); return; }
    const t = e.target.closest('[data-nbtype]');
    const c = e.target.closest('[data-nbch]');
    if (!t && !c) return;
    if (t) {
      const ma = t.dataset.nbtype;
      nb.filter = { loai: ma, src: '', mau: '', q: '', from: ma === 'CHUA_RO' ? 'Chưa phân loại' : NB_LOAI[ma].ten, chuong: '' };
    } else {
      nb.filter = { loai: '', src: '', mau: '', q: '', from: 'Hổng kiến thức · ' + c.dataset.nbch, chuong: c.dataset.nbch };
    }
    ['nbfLoai', 'nbfSrc', 'nbfMau', 'nbfQ'].forEach((id) => { document.getElementById(id).value = id === 'nbfLoai' && t ? t.dataset.nbtype : ''; });
    nbRenderList();
    nbSetTab('cau');
    if (window.matchMedia('(min-width: 901px)').matches) document.getElementById('nbListTitle').scrollIntoView({ block: 'start' });
  }

  /** Mở "Cách sửa" trong sổ: tải chi tiết các câu cần (thẻ công thức, câu để gạch từ khóa, thời gian). */
  function nbBookNeed(ma) {
    const its = nb.data.items.filter((x) => x.loi.ma === ma);
    const want = ma === 'CONG_THUC' ? its : ma === 'DOC_DE' || ma === 'SOT' ? its.slice(0, 1) : [];
    nbLoadDetail(want.map((x) => x.key));
  }
  const nbLatest = (ma) => nb.data.items.filter((x) => x.loi.ma === ma).sort((a, b) => NB_SEV[a.mau] - NB_SEV[b.mau])[0];
  function nbBookFix(ma) {
    if (ma === 'CONG_THUC') {
      const its = nb.data.items.filter((x) => x.loi.ma === ma);
      if (its.some((x) => !nb.detail[x.key])) return loadingHtml('Đang tải thẻ công thức…');
      const seen = {}, list = [];
      its.forEach((x) => (nb.detail[x.key].congThuc || []).forEach((f) => { const k = f.ten + '|' + f.congThuc; if (!seen[k]) { seen[k] = 1; list.push(f); } }));
      return `<div class="nb-tool">${list.length ? nbFormulaCards(list) : '<div class="nb-fb">Thầy chưa nhập thẻ công thức cho các bài em hay nhầm. Em ghi công thức đúng vào ô Ghi chú của em bên dưới.</div>'}</div>`;
    }
    if (ma === 'DOC_DE') {
      const it = nbLatest(ma), x = it && nb.detail[it.key];
      return `<div class="nb-tool"><h4>Từ khóa dễ đọc sai</h4>${nbKwExplain()}${it ? (x ? (x.go ? '' : `<h4>Luyện gạch từ khóa (câu ${esc(it.nguon.stt)}, ${esc(it.nguon.tieuDe)})</h4>${nbKwTool('kwb:' + it.key, x.noiDung)}`) : loadingHtml()) : ''}</div>`;
    }
    if (ma === 'TINH_TOAN') {
      return `<div class="nb-tool"><h4>Thang đổi đơn vị</h4>${nbUnitTool('ub', null, null)}<h4>Khi bấm máy</h4>
        <ul class="nb-tips"><li>Đổi hết về đơn vị chuẩn trước khi thay số.</li><li>Ước lượng bậc độ lớn trước khi bấm máy.</li><li>Viết quy ước dấu (Q, A…) trước khi tính.</li></ul></div>`;
    }
    if (ma === 'SOT') {
      const it = nbLatest(ma), x = it && nb.detail[it.key];
      return `<div class="nb-tool">${it && !x && nb.loading[it.key] === 1 ? loadingHtml() : nbTimePlan(x && x.thoiGian, true)}</div>`;
    }
    return '';
  }

  function nbRenderBook() {
    const el = document.getElementById('nbBook');
    if (!el || !nb.data) return;
    const t = nb.data.tongHop;
    const segColor = (ma) => (NB_LOAI[ma] || NB_LOAI.CHUA_RO).mau;
    let h = `<div class="nb-book-head"><h2 id="nbBookTitle">Sổ tay</h2><div class="nb-legend"><span><i class="nb-dot do"></i>Lặp lại</span><span><i class="nb-dot vang"></i>Đang mắc</span><span><i class="nb-dot xanh"></i>Đã khắc phục</span></div></div>`;
    h += `<div class="nb-ratio-row"><div class="nb-ratio" role="img" aria-label="Tỉ lệ các loại lỗi">${t.tiLe.map((s) => `<i style="width:${(s.so / t.tong) * 100}%;background:${segColor(s.ma)}" title="${esc(s.ten)}: ${s.so} câu"></i>`).join('')}</div></div>`;
    h += `<div class="nb-ratio-legend">${t.tiLe.map((s) => `<span><i class="nb-sw" style="background:${segColor(s.ma)}"></i>${esc(s.ten)} <b class="num">${s.tiLe}%</b></span>`).join('')}</div>`;
    h += `<div class="nb-sec"><div class="nb-sec-h"><h3>Sai ngoo</h3><span class="muted">sửa được ngay bằng thói quen</span></div>`;
    h += t.saiNgoo.length ? t.saiNgoo.map((s) => {
      const open = nb.fix.has(s.ma);
      return `<div class="nb-err"><div class="nb-err-line"><i class="nb-dot ${s.mau}" title="${s.lapLai ? 'Lặp lại' : s.mau === 'vang' ? 'Đang mắc' : 'Đã khắc phục'}"></i>
        <button class="nb-err-name" data-nbtype="${s.ma}" title="Xem các câu thuộc lỗi này">${esc(s.ten)}</button>
        <span class="nb-err-meta">${s.lapLai ? '<span class="nb-rep">Lặp lại</span>' : ''}<span class="num"><b>${s.so}</b> câu · ${s.tiLe}%</span></span></div>
        <div class="nb-err-sub"><div class="nb-err-bar"><i style="width:${s.tiLe}%;background:${segColor(s.ma)}"></i></div>
          ${practiceAllowed() && s.mau !== 'xanh' ? `<button class="nb-fix-toggle" data-nbstart="MOT_LOI" data-ma="${s.ma}" title="Đề 5 câu, 7 phút cho lỗi này">Ôn lỗi này</button>` : ''}
          <button class="nb-fix-toggle" data-nbfix="${s.ma}" aria-expanded="${open}">${open ? 'Thu gọn ▾' : 'Cách sửa ▸'}</button></div>
        ${open ? `<div class="nb-fix-panel">${nbBookFix(s.ma)}</div>` : ''}</div>`;
    }).join('') : '<div class="muted nb-line">Chưa có lỗi nào thuộc nhóm này.</div>';
    h += '</div>';
    const hk = t.hongKT;
    if (hk.so) {
      h += `<details class="nb-hkt nb-sec" id="nbHkt"${nb.hkt ? ' open' : ''}><summary><h3>Hổng kiến thức</h3><span class="nb-more"><span class="closed">${hk.so} câu · Xem bản đồ ▸</span><span class="opened">Thu gọn ▾</span></span></summary>
        <div class="nb-hkt-sum">Gồm câu chưa biết làm${hk.doanMo ? `, ${hk.doanMo} câu đoán mò` : ''}${hk.chuaRo ? ` và ${hk.chuaRo} câu chưa phân loại` : ''}.</div>
        ${hk.chuong.map((c) => `<div class="nb-map-ch"><i class="nb-dot ${c.mau}"></i><button class="nb-err-name" data-nbch="${esc(c.chuong)}">${esc(c.chuong)}</button><span class="num">${c.so} câu</span></div>
          ${c.bai.map((b) => `<div class="nb-map-bai"><span>${esc(b.bai)}</span><span class="num">${b.so}</span></div>`).join('')}`).join('')}
        ${hk.chuaRo ? `<button class="nb-link" data-nbtype="CHUA_RO">Phân loại ${hk.chuaRo} câu còn lại ▸</button>` : ''}
        ${practiceAllowed() && hk.so > hk.chuaRo ? `<div><button class="nb-link" data-nbstart="MOT_LOI" data-ma="HONG">Ôn phần hổng kiến thức (5 câu · 7 phút) ▸</button></div>` : ''}</details>`;
    }
    h += `<div class="nb-sec"><div class="nb-sec-h"><h3>Ghi chú của em</h3><span class="nb-saved" id="nbGsaved"></span></div>
      <textarea class="nb-notes" id="nbGnote" data-nbnote="_CHUNG" maxlength="500" aria-label="Ghi chú của em" placeholder="Viết điều em muốn nhớ trước mỗi bài kiểm tra…">${esc(nb.data.ghiChuChung || '')}</textarea></div>`;
    const keep = nbKeepFocus(el);
    el.innerHTML = h;
    math(el);
    keep();
    const det = document.getElementById('nbHkt');
    if (det) det.addEventListener('toggle', () => { nb.hkt = det.open; });
    nbSnapBook();
  }

  /* Giữ chữ khớp dòng kẻ 32px: khối "Cách sửa" bù cho tròn bội 32px; ô ghi chú cao theo số dòng (không thanh cuộn). */
  const NB_LN = 32;
  function nbGrowNote(t) {
    t = t || document.getElementById('nbGnote');
    if (!t) return;
    t.style.height = '0px';
    t.style.height = Math.max(4, Math.ceil(t.scrollHeight / NB_LN)) * NB_LN + 'px';
  }
  function nbSnapBook() {
    document.querySelectorAll('#nbBook .nb-fix-panel').forEach((p) => {
      p.style.paddingBottom = '0px';
      const r = p.getBoundingClientRect().height % NB_LN;
      p.style.paddingBottom = (r > 0.5 ? NB_LN - r : 0) + 'px';
    });
    nbGrowNote();
  }
  window.addEventListener('resize', () => { if (document.getElementById('nbBook')) nbSnapBook(); });

  /* ---------- lời nhắc ở trang chủ, trước khi làm đề, trang kết quả (Pha 7b) ---------- */
  async function nbHomeBanner() {
    const el = document.getElementById('nbBanner');
    if (!el) return;
    try {
      const d = await nbFetch();
      if (!d || !document.getElementById('nbBanner')) return;
      const lap = d.tongHop.saiNgoo.filter((s) => s.lapLai);
      el.innerHTML = lap.length ? `<a class="notice nb-banner" href="#/so-tay"><b>Em có ${lap.length} lỗi đang lặp lại:</b> ${lap.map((s) => esc(s.ten)).join(', ')}. <span class="nb-banner-go">Xem sổ tay →</span></a>` : '';
    } catch (e) { /* không chặn trang chủ */ }
  }

  /** Hộp "Điều cần nhớ" trước khi làm đề thi: bắt buộc tick "Em đã đọc" (TC-7.16). Lỗi tải sổ tay thì không chặn. */
  async function nbExamReminder(btn) {
    const box = document.getElementById('nbRemind');
    if (!box || !btn) return;
    btn.disabled = true;
    let d = null;
    try { d = await nbFetch(true); } catch (e) { d = null; } // Vòng 2 (R-6): không dùng lời nhắc cũ lưu trên máy
    if (!document.getElementById('nbRemind')) return;
    const list = (d && d.nhacNho) || [];
    if (!list.length) { box.remove(); btn.disabled = false; return; }
    const note = String((d && d.ghiChuChung) || '').trim();
    box.innerHTML = `<div class="nb-remind"><div class="nb-blk">Điều cần nhớ, lấy từ sổ tay của em</div><ul>
      ${list.map((r) => `<li><i class="nb-dot ${r.mau}"></i><span><b>${esc(r.ten)}${r.lapLai ? ' (lặp lại)' : ''}.</b> ${esc(r.nhac)}</span></li>`).join('')}
      ${note ? `<li><i class="nb-dot" style="background:var(--primary)"></i><span><b>Ghi chú của em.</b> ${esc(note).replace(/\n/g, ' · ')}</span></li>` : ''}</ul>
      <label class="nb-check"><input type="checkbox" id="nbReadOk"> Em đã đọc và sẽ chú ý những điều trên</label></div>`;
    document.getElementById('nbReadOk').onchange = (e) => { btn.disabled = !e.target.checked; };
  }

  /**
   * Trang kết quả: thẻ "Sổ tay" có khung "Em sai vì sao?" (TC-7.9). Khung mở sẵn ở lần xem đầu của mỗi bài
   * (nằm trong trang, không che điểm và lời giải), bỏ qua được; nút "Phân loại lỗi" mở lại.
   */
  async function nbAfterResult(v) {
    if (!notebookAllowed() || !v || !v.id) return;
    const wrongs = (v.items || []).filter((it) => !(it.score >= it.max - 1e-9 && it.max > 0));
    const kp = (v.khacPhuc || []).filter((x) => x.truoc !== x.sau);
    if (!wrongs.length && !kp.length) return;
    const my = App.currentView();
    let r = { items: [], daPhanLoai: true };
    if (wrongs.length) { try { r = await api('notebookResult', { resultId: v.id }); } catch (e) { if (!kp.length) return; } }
    if (App.currentView() !== my || (!r.items.length && !kp.length)) return;
    const seenKey = 'ld_nbwhy_' + v.id;
    const st = { open: !r.daPhanLoai && !store.get(seenKey, false), pick: {} };
    if (st.open) store.set(seenKey, true);
    r.items.forEach((x) => { st.pick[x.key] = x.loi.nguon === 'HS' || (x.loi.nguon === 'MAY' && !x.loi.canHoi) ? x.loi.ma : ''; });
    const snippet = (stt) => {
      const it = (v.items || []).find((q) => q.stt === stt);
      const t = nbPlain(it && it.noiDung);
      return t.length > 120 ? t.slice(0, 120) + '…' : t;
    };
    const card = document.createElement('div');
    card.className = 'card nb-result no-print';
    card.id = 'nbResult';
    const draw = () => {
      const lap = r.items.filter((x) => x.lapLai);
      const MAU = { do: 'đỏ', vang: 'vàng', xanh: 'xanh' };
      let h = `<div class="card-title"><h2>Sổ tay</h2><div class="row">${st.open || !r.items.length ? '' : '<button class="btn btn-sm btn-primary" data-why="open">Phân loại lỗi</button>'}<a class="btn btn-sm" href="#/so-tay">Mở sổ tay</a></div></div>
        ${kp.length ? `<div class="nb-kp"><b>Câu đã sai trước đây vừa đổi màu:</b>${kp.map((x) => `<div><i class="nb-dot ${x.truoc}"></i> → <i class="nb-dot ${x.sau}"></i> Câu ${esc(x.stt)} · ${esc(x.luyenTap ? 'Luyện tập: ' + x.tieuDe : x.tieuDe)}: ${MAU[x.truoc] || '—'} → <b>${MAU[x.sau]}</b>${x.sau === 'xanh' ? ' (đã khắc phục)' : ''}</div>`).join('')}</div>` : ''}
        ${r.items.length ? `<div>Bài này có <b>${r.items.length}</b> câu sai${r.daPhanLoai ? ', em đã phân loại đủ' : ''}.</div>` : '<div>Bài này không có câu sai.</div>'}
        ${lap.length ? `<div class="nb-lap">${lap.map((x) => `Câu ${x.stt}: <b>${esc(NB_LOAI[x.loi.ma].ten)}</b>: lỗi này em đã mắc ${x.soCauLoai || 'nhiều'} lần.`).join('<br>')}</div>` : ''}`;
      if (st.open) {
        h += `<h3 style="margin-top:14px">Em sai vì sao?</h3><p class="muted small" style="margin-top:-4px">Chọn lý do cho từng câu để sổ tay nhắc đúng lỗi của em. Có thể bỏ qua và chọn sau trong Sổ tay. Chip có dấu ? là máy đoán, chưa chắc chắn.</p>
          <div class="nb-why">${r.items.map((x) => `<div class="nb-why-item" data-key="${esc(x.key)}"><div class="small"><b>Câu ${x.stt}.</b> ${esc(snippet(x.stt))}${x.lapLai ? '<span class="nb-rep">Lỗi lặp lại</span>' : ''}</div>
            <div class="nb-chips">${NB_PICK.map((ma) => {
              const on = st.pick[x.key] === ma, ask = !st.pick[x.key] && x.loi.nguon === 'MAY' && x.loi.canHoi && x.loi.ma === ma;
              return `<button class="nb-chip${on ? ' on' : ''}${ask ? ' ask' : ''}" data-whyma="${ma}" aria-pressed="${on}"><i class="nb-sw" style="background:${NB_LOAI[ma].mau}"></i>${esc(NB_LOAI[ma].ten)}</button>`;
            }).join('')}</div></div>`).join('')}</div>
          <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-why="skip">Bỏ qua</button><button class="btn btn-primary" data-why="save" id="nbWhySave">Lưu</button></div>`;
      }
      card.innerHTML = h;
    };
    draw();
    const first = $app.querySelector('.card');
    if (first && first.parentNode) first.parentNode.insertBefore(card, first.nextSibling); else $app.prepend(card);
    card.onclick = async (e) => {
      const chip = e.target.closest('[data-whyma]');
      if (chip) {
        const key = chip.closest('[data-key]').dataset.key;
        st.pick[key] = st.pick[key] === chip.dataset.whyma ? '' : chip.dataset.whyma;
        draw();
        return;
      }
      const b = e.target.closest('[data-why]');
      if (!b) return;
      if (b.dataset.why === 'open') { st.open = true; draw(); return; }
      if (b.dataset.why === 'skip') { st.open = false; draw(); return; }
      await withBusy(b, async () => {
        const items = r.items.filter((x) => st.pick[x.key] && !(x.loi.nguon === 'HS' && x.loi.ma === st.pick[x.key]))
          .map((x) => ({ key: x.key, ma: st.pick[x.key], y: st.pick[x.key] === x.loi.ma ? x.loi.y || '' : '' }));
        try {
          if (items.length) await api('notebookTag', { items });
          App.cacheDel('notebook');
          items.forEach((it) => { const x = r.items.find((y) => y.key === it.key); if (x) x.loi = { ma: it.ma, nguon: 'HS', canHoi: false }; });
          r.daPhanLoai = r.items.every((x) => x.loi.nguon === 'HS');
          st.open = false;
          draw();
          toast(items.length ? 'Đã lưu vào sổ tay' : 'Không có thay đổi', 'ok');
        } catch (err) { toast(err.message, 'err'); }
      });
    };
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
    if (notebookAllowed()) {
      h += `<div class="card section-gap nb-pt-fix" id="ptFix"><h3>🔧 Đề khắc phục từ sổ tay</h3>
        <p class="muted small">Làm lại câu em từng sai và câu tương tự cùng bài. Làm đúng thì câu sai trong sổ tay chuyển vàng, rồi xanh.</p>
        <div class="row"><button class="btn btn-primary" data-nbstart="ON_NHANH" ${busy ? 'disabled' : ''}>Ôn trước giờ kiểm tra <small>5 câu · 7 phút</small></button>
          <button class="btn" data-nbstart="MUOI_CAU" ${busy ? 'disabled' : ''}>Đề khắc phục <small>10 câu · 15 phút</small></button>
          <a class="btn btn-ghost" href="#/so-tay">Mở sổ tay</a></div></div>`;
    }
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
    const pf = document.getElementById('ptFix');
    if (pf) pf.onclick = nbStartClick;
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
