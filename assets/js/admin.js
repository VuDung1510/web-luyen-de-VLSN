/* Trang quản trị giáo viên */
(function () {
  'use strict';
  const { esc, fmtNum, rich, math, toast, modal, confirmBox, loadingHtml, withBusy, store, cached } = App;
  App.tokenKey = 'ld_admin_token';
  // Mọi lần ghi thành công đều làm dữ liệu đệm của trang quản trị cũ đi → xóa để không hiện lại bản cũ
  const api = (action, body, opts) => App.api(action, body, opts).then((d) => {
    if (/^admin(Save|Delete|Import)/.test(action)) App.cacheDel('*');
    return d;
  });
  const $app = document.getElementById('app');
  let me = store.get('ld_admin_user', null);
  // Đệm trang quản trị: sessionStorage (mất khi đóng tab), chỉ 3 tab Tổng quan, Đề thi, Kết quả; không lưu PIN
  if (me) App.setCacheScope('session', 'admin');
  let pub = store.get('ld_pub', {});
  let studentsCache = null;

  // K-3: vẽ lại màn đăng nhập sau khi nơi gọi đã xử lý lỗi (tránh hộp "Có lỗi" đè lên màn đăng nhập)
  App.setAuthErrorHandler((msg) => { logout(true); setTimeout(route, 0); toast(msg, 'err'); });

  const STATUS = { NHAP: 'Bản nháp', MO: 'Đang mở', DONG: 'Đã đóng' };
  const REVEAL = { NGAY: 'Ngay sau khi nộp', SAU_HAN: 'Sau khi đề đóng / hết hạn', KHONG: 'Không hiện' };

  function boot() {
    if (!App.CFG.API_URL) {
      $app.innerHTML = `<div class="card narrow"><h1>Chưa kết nối máy chủ</h1><p>Mở file <code>assets/js/config.js</code> và dán URL ứng dụng web Apps Script vào <code>API_URL</code>. Xem README để biết cách cài.</p></div>`;
      return;
    }
    if (!App.pubFresh()) api('publicConfig', {}, { tokenKey: false }).then((p) => { pub = p; App.savePub(p); }).catch(() => {});
    window.addEventListener('hashchange', route);
    window.addEventListener('beforeunload', (e) => { if (editorDirty) { e.preventDefault(); e.returnValue = ''; } });
    route();
  }

  function logout(silent) {
    store.del('ld_admin_token'); store.del('ld_admin_user');
    App.clearCache();
    App.setCacheScope(null);
    studentsCache = null;
    // R-13 (Pha 2): thống kê kho, giỏ câu và bộ lọc Ngân hàng thuộc phiên đăng nhập cũ
    bankMeta = null; draftFromBank = null;
    try { sessionStorage.removeItem(CART_KEY); sessionStorage.removeItem(BF_KEY); sessionStorage.removeItem('ld_bank_so'); } catch (e) { /* bỏ qua */ }
    me = null;
    if (!silent) toast('Đã đăng xuất');
    route();
  }

  function renderUserBox() {
    const nav = document.getElementById('nav');
    const box = document.getElementById('userBox');
    if (!me) { nav.classList.add('hidden'); box.innerHTML = ''; return; }
    nav.classList.remove('hidden');
    box.innerHTML = `<a class="btn btn-sm" href="./" target="_blank" rel="noopener">Trang học sinh ↗</a><button class="btn btn-sm" id="btnOut">Đăng xuất</button>`;
    document.getElementById('btnOut').onclick = () => logout();
  }

  let editorDirty = false;
  let editorHash = '';
  function route() {
    if (editorDirty && location.hash === editorHash) return; // quay lại trang soạn sau khi bấm Hủy
    if (editorDirty && !confirm('Đề đang soạn chưa lưu. Rời trang và bỏ các thay đổi?')) { history.back(); return; }
    editorDirty = false;
    App.newView();
    renderUserBox();
    if (!me || !store.get('ld_admin_token')) return viewLogin();
    const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.remove('active'));
    const nav = (k) => { const a = document.querySelector(`[data-nav="${k}"]`); if (a) a.classList.add('active'); };
    window.scrollTo(0, 0);
    switch (parts[0]) {
      case 'de-thi':
        nav('exams');
        if (parts[1] === 'moi') return viewEditor(null);
        if (parts[1] === 'sua') return viewEditor(parts[2]);
        if (parts[1] === 'thong-ke') return viewExamStats(parts[2]);
        return viewExams();
      case 'ngan-hang': nav('bank'); return parts[1] === 'pool' ? viewPool() : viewBank();
      case 'hoc-sinh': nav('students'); return viewStudents();
      case 'ket-qua': nav('results'); return parts[1] === 'xem' ? viewResult(parts[2]) : viewResults();
      case 'bang-diem': nav('gradebook'); return viewGradebook();
      case 'cai-dat': nav('settings'); return viewSettings();
      default: nav('home'); return viewHome();
    }
  }

  const errorBox = (e) => `<div class="card empty"><b>Có lỗi:</b> ${esc(e.message)}<div style="margin-top:10px"><button class="btn" onclick="location.reload()">Tải lại</button></div></div>`;

  /* ================= ĐĂNG NHẬP ================= */
  function viewLogin() {
    $app.innerHTML = `<div class="narrow"><div class="card">
      <h1 style="text-align:center">Đăng nhập quản trị</h1>
      <div id="gArea" class="hidden"><div class="gbtn" id="gBtn"></div><div class="divider">hoặc dùng mật khẩu</div></div>
      <div class="field"><label for="pw">Mật khẩu quản trị</label><input id="pw" type="password" autocomplete="current-password"></div>
      <button class="btn btn-primary btn-block" id="btnLogin">Đăng nhập</button>
      <p class="muted small" style="margin-top:12px">Mật khẩu nằm ở trang tính <b>CaiDat</b> (dòng MAT_KHAU_QUAN_TRI) trong file Google Sheet của bạn.</p>
    </div></div>`;
    const go = (btn) => withBusy(btn, async () => {
      try { done(await api('loginAdminPassword', { password: document.getElementById('pw').value }, { tokenKey: false })); }
      catch (e) { toast(e.message, 'err'); }
    });
    document.getElementById('btnLogin').onclick = (e) => go(e.currentTarget);
    document.getElementById('pw').onkeydown = (e) => { if (e.key === 'Enter') go(document.getElementById('btnLogin')); };
    const showG = (p) => {
      if (!p.googleClientId) return;
      document.getElementById('gArea').classList.remove('hidden');
      App.renderGoogleButton(document.getElementById('gBtn'), p.googleClientId, async (credential) => {
        try { done(await api('loginGoogle', { credential, as: 'teacher' }, { tokenKey: false })); } catch (e) { toast(e.message, 'err'); }
      });
    };
    if (pub.googleClientId || App.pubFresh()) showG(pub);
    else api('publicConfig', {}, { tokenKey: false }).then((p) => { pub = p; showG(p); }).catch(() => {});
    function done(r) {
      App.clearCache();
      store.set('ld_admin_token', r.token);
      store.set('ld_admin_user', r.user);
      me = r.user;
      App.setCacheScope('session', 'admin');
      route();
    }
  }

  /* ================= TỔNG QUAN ================= */
  // Máy chủ mới: adminBootstrap (tổng quan + danh sách đề) trong 1 lần gọi; máy chủ cũ: adminOverview
  async function loadOverview() {
    if (App.canTry('adminBootstrap')) {
      try {
        const tok = App.cacheToken();
        const b = await api('adminBootstrap');
        App.cacheSet('exams', b.exams, tok);
        return b.overview;
      } catch (e) { if (!e.unsupported) throw e; }
    }
    return api('adminOverview');
  }

  function viewHome() {
    $app.onclick = null;
    return cached('home', loadOverview, renderHome, { skeleton: () => { $app.innerHTML = App.skeletonHtml('cards'); } })
      .catch((e) => { $app.innerHTML = errorBox(e); });
  }

  function renderHome(d) {
    // Máy chủ chưa có tính năng mới (bản 1.0.0 đang chạy thật): báo cho giáo viên biết vì sao học sinh không thấy nút
    const p = store.get('ld_pub', null);
    const oldServer = p && !(App.has('changePin') && App.has('goal'));
    $app.innerHTML = `<div class="card-title"><h1 style="margin:0">Tổng quan</h1>
        <div class="row"><a class="btn btn-primary" href="#/de-thi/moi">+ Tạo đề mới</a><a class="btn" href="${esc(d.sheetUrl)}" target="_blank" rel="noopener">Mở Google Sheet ↗</a></div></div>
      ${oldServer ? `<div class="notice warn" id="needUpdate" style="margin-bottom:16px">Máy chủ đang chạy phiên bản ${esc(p.version || d.version || 'cũ')}: nút <b>Đổi PIN</b> của học sinh và ô <b>Mục tiêu điểm</b> đang tạm ẩn. Cần cập nhật máy chủ (bước phát hành).</div>` : ''}
      ${d.googleReady ? '' : '<div class="notice" style="margin-bottom:16px">Đăng nhập Google chưa bật — học sinh đang dùng mã PIN. Muốn bật, xem mục <a href="#/cai-dat">Cài đặt</a>.</div>'}
      <div class="stats">
        <div class="stat"><b>${d.counts.students}</b><span>Học sinh</span></div>
        <div class="stat"><b>${d.counts.openExams}/${d.counts.exams}</b><span>Đề đang mở / tổng</span></div>
        <div class="stat"><b>${d.counts.results}</b><span>Lượt nộp bài</span></div>
        <div class="stat"><b>${d.counts.today}</b><span>Bài nộp hôm nay</span></div>
        <div class="stat"><b>${d.avg == null ? '—' : fmtNum(d.avg)}</b><span>Điểm TB toàn bộ</span></div></div>
      <div class="card-title"><h2 style="margin:0">Bài nộp mới nhất</h2><a href="#/ket-qua">Xem tất cả →</a></div>
      ${resultsTable(d.recent, false)}`;
  }

  function resultsTable(rs, withDelete) {
    if (!rs.length) return '<div class="card empty">Chưa có bài nộp nào.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>Nộp lúc</th><th>Họ tên</th><th>Lớp</th><th>Đề</th><th class="num">Điểm</th><th class="num">Mục tiêu</th><th class="num">Đúng</th><th>Thời gian</th><th></th></tr></thead><tbody>
      ${rs.map((r) => `<tr><td class="nowrap">${esc(r.nopLuc)}</td><td>${esc(r.hoTen)}</td><td>${esc(r.lop)}</td><td>${esc(r.tieuDe)}</td>
        <td class="num"><span class="badge ${App.scoreClass(r.diem)}">${fmtNum(r.diem)}</span></td>
        <td class="num nowrap">${r.mucTieu == null ? '—' : fmtNum(r.mucTieu) + (r.diem >= r.mucTieu ? ' <span style="color:var(--good)" title="Đạt">✓</span>' : ' <span style="color:var(--bad)" title="Chưa đạt">✗</span>')}</td>
        <td class="num">${r.soCauDung}/${r.tongCau}</td>
        <td class="nowrap">${esc(r.thoiGianLam)}${r.ghiChu ? `<br><span class="badge badge-bad">${esc(r.ghiChu)}</span>` : ''}</td>
        <td class="nowrap"><a class="btn btn-sm" href="#/ket-qua/xem/${encodeURIComponent(r.id)}">Xem</a>
        ${withDelete ? `<button class="btn btn-sm btn-danger" data-del-result="${esc(r.id)}">Xóa</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`;
  }

  /* ================= ĐỀ THI ================= */
  function viewExams() {
    $app.onclick = null;
    return cached('exams', () => api('adminListExams'), renderExams, { skeleton: () => { $app.innerHTML = App.skeletonHtml('table'); } })
      .catch((e) => { $app.innerHTML = errorBox(e); });
  }

  function renderExams(list) {
    {
      $app.innerHTML = `<div class="card-title"><h1 style="margin:0">Đề thi</h1><a class="btn btn-primary" href="#/de-thi/moi">+ Tạo đề mới</a></div>
        ${list.length ? `<div class="table-wrap"><table><thead><tr><th>Tên đề</th><th>Trạng thái</th><th>Lớp</th><th class="num">Số câu</th><th class="num">Phút</th><th class="num">Lượt nộp</th><th class="num">Điểm TB</th><th></th></tr></thead><tbody>
        ${list.map((e) => `<tr><td><b>${esc(e.tieuDe)}</b><div class="muted small">${esc(e.id)}${e.ketThuc ? ' · hạn ' + esc(App.fmtDateIso(e.ketThuc)) : ''}</div></td>
          <td><span class="badge ${e.trangThaiText === 'Đang mở' ? 'badge-good' : ''}">${esc(e.trangThaiText)}</span></td>
          <td>${esc(e.lop || 'Tất cả')}</td><td class="num">${e.soCau}</td><td class="num">${e.thoiGian}</td><td class="num">${e.soBai}</td>
          <td class="num">${e.diemTB == null ? '—' : fmtNum(e.diemTB)}</td>
          <td class="nowrap"><a class="btn btn-sm" href="#/de-thi/sua/${encodeURIComponent(e.id)}">Sửa</a>
            <a class="btn btn-sm" href="#/de-thi/thong-ke/${encodeURIComponent(e.id)}">Thống kê</a>
            <button class="btn btn-sm" data-toggle="${esc(e.id)}" data-st="${e.trangThai === 'MO' ? 'DONG' : 'MO'}">${e.trangThai === 'MO' ? 'Đóng đề' : 'Mở đề'}</button>
            <button class="btn btn-sm btn-danger" data-del="${esc(e.id)}" data-name="${esc(e.tieuDe)}">Xóa</button></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="card empty">Chưa có đề nào. Bấm "Tạo đề mới" để bắt đầu.</div>'}`;
      $app.onclick = async (ev) => {
        const del = ev.target.closest('[data-del]');
        if (del) {
          if (!(await confirmBox('Xóa đề?', `Xóa đề <b>${esc(del.dataset.name)}</b> và toàn bộ câu hỏi? Kết quả học sinh đã nộp vẫn được giữ trong trang KetQua.`, 'Xóa đề', true))) return;
          try { await api('adminDeleteExam', { examId: del.dataset.del }); toast('Đã xóa đề', 'ok'); viewExams(); } catch (e) { toast(e.message, 'err'); }
        }
        const tg = ev.target.closest('[data-toggle]');
        if (tg) withBusy(tg, async () => {
          try {
            const d = await api('adminGetExam', { examId: tg.dataset.toggle });
            await api('adminSaveExam', { exam: Object.assign(d.exam, { trangThai: tg.dataset.st }), questions: d.questions });
            toast(tg.dataset.st === 'MO' ? 'Đã mở đề' : 'Đã đóng đề', 'ok');
            viewExams();
          } catch (e) { toast(e.message, 'err'); }
        });
      };
    }
  }

  /* ---------- soạn đề ---------- */
  function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const p = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  const fromLocalInput = (v) => (v ? new Date(v).toISOString() : '');
  const blankQ = (loai) => ({ loai: loai || 'TN', phan: loai === 'DS' ? 2 : loai === 'TL' ? 3 : 1, noiDung: '', hinhAnh: '', A: '', B: '', C: '', D: '', dapAn: '', diem: '', saiSo: '', chuDe: '', mucDo: '', loiGiai: '' });

  async function viewEditor(examId) {
    $app.onclick = null;
    $app.innerHTML = loadingHtml();
    let exam = { tieuDe: '', lop: '', moTa: '', thoiGian: 50, trangThai: 'NHAP', batDau: '', ketThuc: '', soLanLam: 0, hienLoiGiai: 'NGAY', tronCau: false };
    let qs = [];
    let hasResults = false;
    if (examId) {
      try {
        const d = await api('adminGetExam', { examId });
        exam = d.exam;
        qs = d.questions.map((q) => Object.assign(blankQ(q.loai), q, { dapAn: q.loai === 'DS' ? String(q.dapAn).replace(/D/g, 'Đ') : q.dapAn }));
        const list = await api('adminListExams');
        hasResults = (list.find((x) => x.id === examId) || {}).soBai > 0;
      } catch (e) { $app.innerHTML = errorBox(e); return; }
    }
    // Đề tạo từ Ngân hàng câu hỏi: câu đã nạp, CHƯA lưu — giáo viên xem lại rồi bấm Lưu đề
    const draft = !examId ? draftFromBank : null;
    draftFromBank = null;
    if (draft) { qs = draft.questions.map((q) => Object.assign(blankQ(q.loai), q)); exam.tieuDe = draft.tieuDe || ''; }
    if (!qs.length) qs = [blankQ('TN')];

    $app.innerHTML = `<div class="card-title"><h1 style="margin:0">${examId ? 'Sửa đề' : 'Tạo đề mới'}</h1><a href="#/de-thi">← Danh sách đề</a></div>
      ${hasResults ? '<div class="notice warn" style="margin-bottom:12px">Đề này đã có học sinh nộp bài. Sửa đáp án sẽ <b>không</b> chấm lại các bài cũ.</div>' : ''}
      ${draft ? `<div class="notice" id="draftNote" style="margin-bottom:12px">Đã nạp <b>${qs.length}</b> câu từ Ngân hàng câu hỏi. Đề <b>chưa được lưu</b>: kiểm tra lại, đặt tên đề rồi bấm <b>Lưu đề</b>.</div>
        ${draft.canhBao.length ? `<div class="notice warn" id="draftWarn" style="margin-bottom:12px">${draft.canhBao.map(esc).join('<br>')}</div>` : ''}` : ''}
      <div class="card"><div class="form-grid">
        <div class="field" style="grid-column:1/-1"><label>Tên đề *</label><input id="eTitle" value="${esc(exam.tieuDe)}" placeholder="VD: Đề luyện thi TN THPT số 1"></div>
        <div class="field" style="grid-column:1/-1"><label>Mô tả</label><input id="eDesc" value="${esc(exam.moTa)}" placeholder="Ghi chú ngắn cho học sinh (không bắt buộc)"></div>
        <div class="field"><label>Thời gian làm bài (phút)</label><input id="eTime" type="number" min="1" value="${exam.thoiGian}"></div>
        <div class="field"><label>Dành cho lớp</label><input id="eClass" value="${esc(exam.lop)}" placeholder="Để trống = tất cả" list="classList"><span class="hint">Nhiều lớp cách nhau dấu phẩy: 12A1, 12A2</span></div>
        <div class="field"><label>Trạng thái</label><select id="eStatus">${Object.keys(STATUS).map((k) => `<option value="${k}" ${exam.trangThai === k ? 'selected' : ''}>${STATUS[k]}</option>`).join('')}</select></div>
        <div class="field"><label>Số lần làm tối đa</label><input id="eTries" type="number" min="0" value="${exam.soLanLam || 0}"><span class="hint">0 = không giới hạn</span></div>
        <div class="field"><label>Mở lúc (tùy chọn)</label><input id="eStart" type="datetime-local" value="${toLocalInput(exam.batDau)}"></div>
        <div class="field"><label>Đóng lúc (tùy chọn)</label><input id="eEnd" type="datetime-local" value="${toLocalInput(exam.ketThuc)}"></div>
        <div class="field"><label>Hiện đáp án & lời giải</label><select id="eReveal">${Object.keys(REVEAL).map((k) => `<option value="${k}" ${exam.hienLoiGiai === k ? 'selected' : ''}>${REVEAL[k]}</option>`).join('')}</select></div>
        <div class="field"><label>Trộn thứ tự câu</label><select id="eShuffle"><option value="KHONG">Không</option><option value="CO" ${exam.tronCau ? 'selected' : ''}>Có (trộn trong từng phần)</option></select></div>
      </div><datalist id="classList"></datalist></div>
      <div class="card-title section-gap"><h2 style="margin:0">Câu hỏi <span class="muted" id="qCount"></span></h2>
        <div class="row"><button class="btn" id="btnImport">⇪ Nhập nhanh từ Word / Excel</button></div></div>
      <div class="notice small" style="margin-bottom:12px">Công thức viết trong dấu $…$ theo cú pháp LaTeX, ví dụ <code>$v = \\sqrt{2gh}$</code>, <code>$2.10^5$ Pa</code>. **chữ đậm**, xuống dòng giữ nguyên.
        Điểm mặc định theo đề tốt nghiệp: trắc nghiệm 0,25 · Đúng/Sai 1 (đúng 1/2/3/4 ý được 0,1/0,25/0,5/1) · trả lời ngắn 0,25.</div>
      <div id="qList"></div>
      <div class="row" style="margin:8px 0 16px"><button class="btn" data-add="TN">+ Trắc nghiệm</button><button class="btn" data-add="DS">+ Đúng/Sai</button><button class="btn" data-add="TL">+ Trả lời ngắn</button></div>
      <div class="sticky-actions"><button class="btn btn-primary" id="btnSave">💾 Lưu đề</button><span class="muted small" id="saveInfo" style="align-self:center"></span></div>`;

    getStudents().then((sts) => {
      const cls = [...new Set(sts.map((s) => s.lop))].sort();
      document.getElementById('classList').innerHTML = cls.map((c) => `<option value="${esc(c)}">`).join('');
    }).catch(() => {});

    const qList = document.getElementById('qList');
    const markDirty = () => { editorDirty = true; editorHash = location.hash; document.getElementById('saveInfo').textContent = 'Có thay đổi chưa lưu'; };
    $app.querySelectorAll('.card input, .card select').forEach((el) => el.addEventListener('input', markDirty));

    function renderQs() {
      document.getElementById('qCount').textContent = `(${qs.length} câu · tổng ${fmtNum(qs.reduce((s, q) => s + (parseFloat(String(q.diem).replace(',', '.')) || (q.loai === 'DS' ? 1 : 0.25)), 0))} điểm)`;
      let lastPart = null;
      qList.innerHTML = qs.map((q, i) => {
        let head = '';
        if (q.phan !== lastPart) { lastPart = q.phan; head = `<h3 class="part-title">${App.PARTS[q.phan] || 'Phần ' + q.phan}</h3>`; }
        return head + qEditHtml(q, i);
      }).join('');
      qList.querySelectorAll('.preview').forEach((p) => math(p));
    }

    function qEditHtml(q, i) {
      const opt = (k, label) => `<div class="field"><label>${label}</label><textarea rows="1" data-f="${k}" data-i="${i}"${todoCls(q[k])}>${esc(q[k])}</textarea></div>`;
      let ans = '';
      if (q.loai === 'TN') {
        ans = `<div class="field"><label>Đáp án đúng</label><div class="key-pick">${['A', 'B', 'C', 'D'].map((k) => `<button type="button" class="${q.dapAn === k ? 'sel' : ''}" data-key="${k}" data-i="${i}">${k}</button>`).join('')}</div></div>`;
      } else if (q.loai === 'DS') {
        const arr = String(q.dapAn || '').toUpperCase().replace(/D/g, 'Đ').split('');
        ans = `<div class="field"><label>Đáp án từng ý</label><div class="row">${['a', 'b', 'c', 'd'].map((k, j) => `<span class="row" style="gap:4px"><b>${k})</b>
          <span class="key-pick"><button type="button" class="${arr[j] === 'Đ' ? 'sel' : ''}" data-tfkey="${j}:Đ" data-i="${i}">Đ</button><button type="button" class="${arr[j] === 'S' ? 'sel' : ''}" data-tfkey="${j}:S" data-i="${i}">S</button></span></span>`).join('')}</div></div>`;
      } else {
        ans = `<div class="form-grid"><div class="field"><label>Đáp án</label><input data-f="dapAn" data-i="${i}" value="${esc(q.dapAn)}" placeholder="VD: 12,5"><span class="hint">Nhiều đáp án chấp nhận: 0,13|0,125</span></div>
          <div class="field"><label>Sai số cho phép</label><input data-f="saiSo" data-i="${i}" value="${esc(q.saiSo)}" placeholder="0"><span class="hint">VD 0,05 → 12,45–12,55 đều đúng</span></div></div>`;
      }
      const optsHtml = q.loai === 'TL' ? '' : `<div class="opt-grid">${q.loai === 'DS' ? opt('A', 'Ý a)') + opt('B', 'Ý b)') + opt('C', 'Ý c)') + opt('D', 'Ý d)') : opt('A', 'A') + opt('B', 'B') + opt('C', 'C') + opt('D', 'D')}</div>`;
      const todo = hasTodo(q);
      return `<div class="qedit${todo ? ' qedit-todo' : ''}" data-q="${i}">
        <div class="qedit-head"><span class="q-num">Câu ${i + 1}</span>${q.maKho ? `<span class="badge" title="${esc(q.bai)}">Kho: ${esc(q.maKho)}</span>` : ''}${q.thieuHinh && !q.hinhAnh ? '<span class="badge badge-warn" data-thieuhinh="">Kho ghi có hình — chưa có hình</span>' : ''}
          ${todo ? '<span class="badge badge-todo" data-todo="">Còn công thức cần gõ lại ⟦…⟧</span>' : ''}${q.hinhLoi ? `<span class="badge badge-warn" data-hinhloi="">File Word có ${q.hinhLoi > 1 ? q.hinhLoi + ' hình' : 'hình'} cần chụp lại</span>` : ''}
          <select data-f="loai" data-i="${i}" aria-label="Loại câu">${Object.keys(App.TYPES).map((k) => `<option value="${k}" ${q.loai === k ? 'selected' : ''}>${App.TYPES[k]}</option>`).join('')}</select>
          <select data-f="phan" data-i="${i}" aria-label="Phần"><option value="1" ${q.phan == 1 ? 'selected' : ''}>Phần I</option><option value="2" ${q.phan == 2 ? 'selected' : ''}>Phần II</option><option value="3" ${q.phan == 3 ? 'selected' : ''}>Phần III</option></select>
          <span class="spacer"></span>
          <button class="btn btn-sm" data-move="-1" data-i="${i}" title="Lên">↑</button><button class="btn btn-sm" data-move="1" data-i="${i}" title="Xuống">↓</button>
          <button class="btn btn-sm" data-dup="${i}" title="Nhân bản">⧉</button><button class="btn btn-sm btn-danger" data-rm="${i}" title="Xóa câu">✕</button></div>
        <div class="field"><label>Nội dung câu hỏi</label><textarea data-f="noiDung" data-i="${i}" rows="3"${todoCls(q.noiDung)}>${esc(q.noiDung)}</textarea></div>
        <div class="row" style="margin-bottom:10px"><input data-f="hinhAnh" data-i="${i}" value="${esc(q.hinhAnh)}" placeholder="Hình ảnh: dán link ảnh hoặc bấm Tải ảnh" style="flex:1;min-width:200px">
          <label class="btn btn-sm">📷 Tải ảnh<input type="file" accept="image/*" data-upload="${i}" class="hidden"></label></div>
        ${optsHtml}${ans}
        <div class="form-grid"><div class="field"><label>Chủ đề</label><input data-f="chuDe" data-i="${i}" value="${esc(q.chuDe)}" list="topicList" placeholder="VD: Khí lí tưởng"></div>
          <div class="field"><label>Mức độ</label><select data-f="mucDo" data-i="${i}"><option value="">—</option>${Object.keys(App.LEVELS).map((k) => `<option value="${k}" ${q.mucDo === k ? 'selected' : ''}>${App.LEVELS[k]}</option>`).join('')}</select></div>
          <div class="field"><label>Điểm</label><input data-f="diem" data-i="${i}" value="${esc(q.diem)}" placeholder="${q.loai === 'DS' ? '1' : '0,25'}"></div></div>
        <div class="field"><label>Lời giải</label><textarea data-f="loiGiai" data-i="${i}" rows="2"${todoCls(q.loiGiai)}>${esc(q.loiGiai)}</textarea></div>
        <details><summary class="small muted">Xem trước</summary><div class="preview" id="pv-${i}">${previewHtml(q)}</div></details></div>`;
    }

    const previewHtml = (q) => qPreviewHtml(q);

    let pvTimer;
    qList.addEventListener('input', (e) => {
      const el = e.target.closest('[data-f]');
      if (!el) return;
      const i = +el.dataset.i, f = el.dataset.f;
      qs[i][f] = f === 'phan' ? +el.value : el.value;
      markDirty();
      if (el.tagName === 'TEXTAREA') {
        el.classList.toggle('todo', String(el.value).indexOf('⟦') >= 0);
        const box = el.closest('.qedit');
        if (box) { box.classList.toggle('qedit-todo', hasTodo(qs[i])); const b = box.querySelector('[data-todo]'); if (b && !hasTodo(qs[i])) b.remove(); }
      }
      if (f === 'loai') {
        qs[i].phan = el.value === 'DS' ? 2 : el.value === 'TL' ? 3 : 1;
        qs[i].dapAn = '';
        sortByPart(); renderQs(); return;
      }
      if (f === 'phan') { sortByPart(); renderQs(); return; }
      clearTimeout(pvTimer);
      pvTimer = setTimeout(() => { const pv = document.getElementById('pv-' + i); if (pv) { pv.innerHTML = previewHtml(qs[i]); math(pv); } }, 400);
    });
    qList.addEventListener('change', async (e) => {
      const up = e.target.closest('[data-upload]');
      if (!up || !up.files[0]) return;
      const i = +up.dataset.upload;
      const lab = up.parentElement;
      lab.classList.add('disabled'); lab.firstChild.textContent = '⏳ Đang tải…';
      try {
        const { base64, mime } = await shrinkImage(up.files[0]);
        const r = await api('adminUploadImage', { base64, mime, name: up.files[0].name });
        qs[i].hinhAnh = r.url; markDirty(); renderQs();
        toast('Đã tải ảnh lên', 'ok');
      } catch (err) { toast(err.message, 'err'); lab.firstChild.textContent = '📷 Tải ảnh'; }
    });
    qList.addEventListener('click', async (e) => {
      const k = e.target.closest('[data-key]');
      if (k) { qs[+k.dataset.i].dapAn = k.dataset.key; markDirty(); k.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b === k)); return; }
      const tk = e.target.closest('[data-tfkey]');
      if (tk) {
        const i = +tk.dataset.i;
        const [j, v] = tk.dataset.tfkey.split(':');
        const arr = (String(qs[i].dapAn || '').toUpperCase().replace(/D/g, 'Đ') + '____').slice(0, 4).split('');
        arr[+j] = v;
        qs[i].dapAn = arr.join('');
        markDirty();
        tk.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b === tk));
        return;
      }
      const mv = e.target.closest('[data-move]');
      if (mv) {
        const i = +mv.dataset.i, j = i + +mv.dataset.move;
        if (j < 0 || j >= qs.length) return;
        [qs[i], qs[j]] = [qs[j], qs[i]];
        if (qs[i].phan !== qs[j].phan) { const t = qs[i].phan; qs[i].phan = qs[j].phan; qs[j].phan = t; }
        markDirty(); renderQs(); return;
      }
      const dup = e.target.closest('[data-dup]');
      if (dup) { const i = +dup.dataset.dup; qs.splice(i + 1, 0, Object.assign({}, qs[i])); markDirty(); renderQs(); return; }
      const rm = e.target.closest('[data-rm]');
      if (rm) {
        const i = +rm.dataset.rm;
        if (qs[i].noiDung && !(await confirmBox('Xóa câu ' + (i + 1) + '?', 'Câu hỏi sẽ bị xóa khỏi đề.', 'Xóa', true))) return;
        qs.splice(i, 1); markDirty(); renderQs();
      }
    });
    $app.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => {
      qs.push(blankQ(b.dataset.add)); sortByPart(); markDirty(); renderQs();
      const last = qList.querySelectorAll('.qedit');
      const idx = qs.lastIndexOf(qs.filter((q) => q.loai === b.dataset.add).slice(-1)[0]);
      (last[idx] || last[last.length - 1]).scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    function sortByPart() {
      qs = qs.map((q, i) => ({ q, i })).sort((a, b) => (a.q.phan - b.q.phan) || (a.i - b.i)).map((x) => x.q);
    }

    document.getElementById('btnImport').onclick = () => importDialog((newQs, replace) => {
      const mapped = newQs.map((q) => Object.assign(blankQ(q.loai), q));
      qs = replace ? mapped : qs.filter((q) => q.noiDung || q.A).concat(mapped);
      sortByPart(); markDirty(); renderQs();
      toast('Đã thêm ' + newQs.length + ' câu. Kiểm tra lại rồi bấm Lưu đề.', 'ok');
    });

    document.getElementById('btnSave').onclick = (e) => withBusy(e.currentTarget, async () => {
      const ex = {
        id: exam.id || '', tieuDe: document.getElementById('eTitle').value, moTa: document.getElementById('eDesc').value,
        thoiGian: document.getElementById('eTime').value, lop: document.getElementById('eClass').value,
        trangThai: document.getElementById('eStatus').value, soLanLam: document.getElementById('eTries').value,
        batDau: fromLocalInput(document.getElementById('eStart').value), ketThuc: fromLocalInput(document.getElementById('eEnd').value),
        hienLoiGiai: document.getElementById('eReveal').value, tronCau: document.getElementById('eShuffle').value
      };
      const payload = qs.filter((q) => q.noiDung.trim() || q.hinhAnh.trim() || q.A.trim()).map((q) => Object.assign({}, q, { dapAn: q.loai === 'DS' ? String(q.dapAn).replace(/Đ/g, 'D') : q.dapAn }));
      try {
        const r = await api('adminSaveExam', { exam: ex, questions: payload });
        editorDirty = false;
        exam.id = r.id;
        document.getElementById('saveInfo').textContent = 'Đã lưu lúc ' + new Date().toLocaleTimeString('vi-VN');
        toast('Đã lưu đề (' + payload.length + ' câu)', 'ok');
        if (draft) cartSet({ items: [], tieuDe: '' });
        if (!examId) history.replaceState(null, '', '#/de-thi/sua/' + encodeURIComponent(r.id));
      } catch (err) {
        toast(err.message, 'err');
        const m = err.message.match(/^Câu (\d+)/);
        if (m) { const el = qList.querySelectorAll('.qedit')[+m[1] - 1]; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }
    });

    renderQs();
    if (draft) markDirty();
    const tl = document.createElement('datalist');
    tl.id = 'topicList';
    tl.innerHTML = ['Vật lí nhiệt', 'Khí lí tưởng', 'Từ trường', 'Vật lí hạt nhân', 'Dao động', 'Sóng', 'Điện trường', 'Dòng điện', 'Cảm ứng điện từ', 'Động học', 'Động lực học', 'Năng lượng']
      .concat([...new Set(qs.map((q) => q.chuDe).filter(Boolean))]).map((t) => `<option value="${esc(t)}">`).join('');
    $app.appendChild(tl);
  }

  /** force: luôn vẽ lại qua canvas (vd hình BMP từ file Word: máy chủ chỉ nhận png/jpeg/gif/webp) */
  function shrinkImage(file, force) {
    return new Promise((resolve, reject) => {
      if (file.size > 15 * 1024 * 1024) return reject(new Error('Ảnh quá lớn.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
      reader.onload = () => {
        const url = reader.result;
        if (file.type === 'image/svg+xml' || file.type === 'image/gif') return resolve({ base64: url, mime: file.type });
        const img = new Image();
        img.onload = () => {
          const max = 1400;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          if (scale === 1 && file.size < 900 * 1024 && !force) return resolve({ base64: url, mime: file.type });
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const png = file.type === 'image/png' && c.width * c.height < 900000;
          resolve({ base64: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88), mime: png ? 'image/png' : 'image/jpeg' });
        };
        img.onerror = () => reject(new Error('File không phải ảnh hợp lệ.'));
        img.src = url;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Xem trước câu hỏi (trình soạn + hộp nhập) ---------- */
  const TODO_FIELDS = ['noiDung', 'A', 'B', 'C', 'D', 'loiGiai'];
  const hasTodo = (q) => TODO_FIELDS.some((f) => String(q[f] || '').indexOf('⟦') >= 0);
  const todoCls = (v) => (String(v || '').indexOf('⟦') >= 0 ? ' class="todo"' : '');
  /** imgs: { n: blobUrl } — hình của file Word chưa tải lên (mốc {{HINH:n}}) */
  function qPreviewHtml(q, imgs) {
    const r = (t) => {
      let h = rich(String(t || '').replace(/\{\{HINH:(\d+)\}\}/g, '\u0003$1\u0003'));
      h = h.replace(/\u0003(\d+)\u0003/g, (m, n) => (imgs && imgs[n] ? `<img class="q-img" src="${imgs[n]}" alt="Hình ${n}">` : `<span class="badge badge-warn">Hình ${n}</span>`));
      return h.replace(/⟦([^⟧]*)⟧/g, '<mark class="todo-mark">⟦$1⟧</mark>');
    };
    let h = `<div>${r(q.noiDung)}</div>${q.hinhAnh ? `<img class="q-img" src="${esc(q.hinhAnh)}" alt="">` : ''}`;
    if (q.loai !== 'TL') h += ['A', 'B', 'C', 'D'].map((k, j) => `<div><b>${q.loai === 'DS' ? 'abcd'[j] + ')' : k + '.'}</b> ${r(q[k])}</div>`).join('');
    if (q.loiGiai) h += `<div class="solution">${r(q.loiGiai)}</div>`;
    return h;
  }

  /* ---------- Thư viện đọc file: chỉ tải khi mở tab "Tải file lên" (Pha 3) ---------- */
  const LIB_URLS = {
    JSZip: ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'],
    XLSX: ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js']
  };
  const libLoading = {};
  const FILE_EXTS = ['.docx', '.xlsx', '.xls', '.csv', '.txt'];
  function loadLib(name) {
    if (window[name]) return Promise.resolve(window[name]);
    if (libLoading[name]) return libLoading[name];
    const tryUrl = (i) => new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = LIB_URLS[name][i];
      sc.async = true;
      const timer = setTimeout(() => { sc.remove(); reject(new Error('quá thời gian')); }, 20000);
      sc.onload = () => { clearTimeout(timer); window[name] ? resolve(window[name]) : reject(new Error('thiếu ' + name)); };
      sc.onerror = () => { clearTimeout(timer); sc.remove(); reject(new Error('lỗi tải')); };
      document.head.appendChild(sc);
    }).catch((e) => (i + 1 < LIB_URLS[name].length ? tryUrl(i + 1) : Promise.reject(e)));
    libLoading[name] = tryUrl(0).catch(() => { delete libLoading[name]; throw new Error('Không tải được thư viện đọc file, hãy dán văn bản.'); });
    return libLoading[name];
  }
  // công thức đổi từ Word: KaTeX không hiển thị được thì để mốc ⟦…⟧ (dấu phẩy thập phân như rich())
  const katexOk = (t) => {
    if (!window.katex) return true;
    try { window.katex.renderToString(t.replace(/(\d),(?=\d)/g, '$1{,}'), { throwOnError: true }); return true; } catch (e) { return false; }
  };

  function importDialog(onDone) {
    const mopts = { wide: true };
    let blobUrls = [];
    const freeBlobs = () => { blobUrls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) { /* bỏ qua */ } }); blobUrls = []; };
    mopts.onOpen = (m, close) => {
      let mode = 'text', parsed = null, fileRun = 0, busy = false;
      const $ = (sel) => m.querySelector(sel);
      const help = {
        text: `Mỗi câu bắt đầu bằng <b>Câu 1.</b>, <b>Câu 2:</b>… Các dòng <b>PHẦN I / II / III</b> tự xác định dạng câu.
          Phương án <b>A. B. C. D.</b> (cùng dòng hoặc mỗi dòng một phương án; viết <b>*B.</b> để đánh dấu đáp án đúng).
          Đúng/Sai dùng <b>a) b) c) d)</b>, ghi <b>(Đ)</b>/<b>(S)</b> cuối mỗi ý. Có thể thêm dòng <b>Đáp án: …</b>, <b>Lời giải: …</b>,
          hoặc <b>BẢNG ĐÁP ÁN</b> ở cuối (1.B 2.C …). Công thức Word nên đổi sang dạng $…$ (LaTeX) trước khi dán — hoặc dùng tab <b>Tải file lên</b>.`,
        tsv: `Bôi đen các ô trong Excel/Google Sheets rồi dán. Thứ tự cột: <b>Loại | Nội dung | A | B | C | D | Đáp án | Chủ đề | Mức độ | Lời giải | Điểm | Sai số | Hình ảnh</b>.
          Loại: TN / DS / TL (để trống sẽ tự đoán). Đáp án Đúng/Sai dạng ĐSĐS. Nếu có dòng tiêu đề, hệ thống tự nhận cột theo tên.`,
        file: `Chọn file đề <b>Word (.docx)</b> theo mẫu VLSN (PHẦN 1/2/3, Câu 1., A. B. C. D., a) b) c) d)), hoặc <b>Excel (.xlsx) / .csv</b> theo thứ tự cột như tab "Dán từ Excel".
          Công thức gõ bằng <b>Equation</b> của Word được đổi tự động; hình trong file được tải lên khi bấm <b>Thêm vào đề</b>. Web đọc file ngay trên máy, không gửi file đi.`
      };
      const setBtns = (on) => { $('#impAdd').disabled = $('#impReplace').disabled = !on; };
      const setMode = (t) => {
        if (busy) return;
        mode = t; parsed = null; fileRun++;
        m.querySelectorAll('#impTabs button').forEach((b) => b.classList.toggle('active', b.dataset.t === t));
        $('#impHelp').innerHTML = help[t];
        $('#impResult').innerHTML = '';
        $('#impTextWrap').classList.toggle('hidden', t === 'file');
        $('#impFile').classList.toggle('hidden', t !== 'file');
        $('#impCheck').classList.toggle('hidden', t === 'file');
        $('#impProg').classList.add('hidden');
        setBtns(false);
        if (t === 'file') {
          // tải sẵn thư viện ngay khi mở tab (không chặn giao diện); lỗi sẽ báo khi chọn file
          loadLib('JSZip').catch(() => {});
          loadLib('XLSX').catch(() => {});
        }
      };
      const prog = (text, pct) => {
        $('#impProg').classList.remove('hidden');
        $('#impProgText').textContent = text;
        if (pct != null) $('#impProgBar').style.width = Math.max(3, Math.min(100, pct)) + '%';
      };
      const showError = (msg) => {
        $('#impProg').classList.add('hidden');
        $('#impResult').innerHTML = `<div class="notice warn" id="impError" role="alert"><b>Không đọc được file.</b> ${esc(msg)}</div>`;
        setBtns(false);
      };
      const summaryHtml = (p) => {
        const cnt = { TN: 0, DS: 0, TL: 0 };
        const byPart = { 1: 0, 2: 0, 3: 0 };
        p.questions.forEach((q) => { cnt[q.loai] = (cnt[q.loai] || 0) + 1; byPart[q.phan] = (byPart[q.phan] || 0) + 1; });
        let h = `<p id="impCount">Tìm thấy <b>${p.questions.length}</b> câu: ${cnt.TN} trắc nghiệm, ${cnt.DS} đúng/sai, ${cnt.TL} trả lời ngắn.</p>`;
        if (p.kind === 'docx') {
          const st = p.stats;
          h += `<table class="imp-stats" id="impStats"><tbody>
            <tr><th>Số câu theo phần</th><td>Phần I: <b>${byPart[1] || 0}</b> · Phần II: <b>${byPart[2] || 0}</b> · Phần III: <b>${byPart[3] || 0}</b></td></tr>
            <tr><th>Công thức trong câu hỏi</th><td>Đã đổi: <b data-k="mathOk">${st.mathOkInQ}</b> · Chưa đổi được: <b data-k="mathFail" class="${st.mathFailInQ ? 'warn-text' : ''}">${st.mathFailInQ}</b>${st.oleInQ ? ` · MathType (OLE): <b class="warn-text">${st.oleInQ}</b>` : ''}</td></tr>
            <tr><th>Hình</th><td>Sẽ tải lên: <b data-k="imgs">${p.images.length}</b>${st.imagesBad ? ` · Cần chụp lại: <b class="warn-text">${st.imagesBad}</b>` : ''}${st.tables ? ` · Bảng: <b>${st.tables}</b>` : ''}</td></tr>
          </tbody></table>`;
        }
        if (p.kind === 'xlsx' && p.stats.sheet) h += `<p class="small muted">Trang tính: ${esc(p.stats.sheet)}</p>`;
        return h;
      };
      const renderResult = (p, name) => {
        freeBlobs();
        const imgs = {};
        (p.images || []).forEach((im) => { const u = URL.createObjectURL(new Blob([im.data], { type: im.mime })); imgs[im.n] = u; blobUrls.push(u); });
        const typeName = { TN: 'Trắc nghiệm', DS: 'Đúng/Sai', TL: 'Trả lời ngắn' };
        $('#impResult').innerHTML = (name ? `<p class="small muted">File: <b>${esc(name)}</b></p>` : '') + summaryHtml(p) +
          (p.warnings.length ? `<div class="notice warn" id="impWarn"><b>Cần kiểm tra (${p.warnings.length}):</b><br>${p.warnings.map(esc).join('<br>')}</div>` : '') +
          (p.questions.length ? `<div class="imp-list" id="impList">${p.questions.map((q, i) => `<div class="imp-q${hasTodo(q) ? ' imp-todo' : ''}" data-iq="${i}">
            <div class="imp-q-head"><b>Câu ${i + 1}</b> · ${['', 'Phần I', 'Phần II', 'Phần III'][q.phan] || ''} · ${typeName[q.loai]} · Đáp án: <b>${esc(q.dapAn || '—')}</b>${q.mucDo ? ' · ' + esc(q.mucDo) : ''}</div>
            ${qPreviewHtml(q, imgs)}</div>`).join('')}</div>` : '');
        math($('#impResult'));
        setBtns(p.questions.length > 0);
      };
      const handleFile = async (file) => {
        if (!file || busy) return;
        const run = ++fileRun;
        parsed = null; setBtns(false);
        $('#impResult').innerHTML = '';
        let kind;
        try { kind = DocxReader.kindOf(file.name, file.size); } catch (e) { showError(e.message); return; }
        try {
          prog('Đọc file…', 10);
          const libs = { Importer, validate: katexOk, onProgress: (t) => { if (run === fileRun) prog(t, t === 'Đổi công thức…' ? 50 : t === 'Xong' ? 100 : 30); } };
          if (kind === 'docx') libs.JSZip = await loadLib('JSZip');
          if (kind === 'xlsx') libs.XLSX = await loadLib('XLSX');
          const buf = await file.arrayBuffer();
          await new Promise((r) => setTimeout(r, 0)); // vẽ thanh tiến độ trước khi đọc
          const out = await DocxReader.readFile(file.name, buf, libs);
          if (run !== fileRun) return;
          prog('Xong', 100);
          setTimeout(() => { if (run === fileRun && !busy) $('#impProg').classList.add('hidden'); }, 600);
          parsed = out;
          renderResult(out, file.name);
        } catch (e) {
          if (run === fileRun) showError(e && e.message ? e.message : String(e));
        }
      };

      setMode('text');
      $('#impTabs').onclick = (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.t); };
      $('#impText').oninput = () => { parsed = null; setBtns(false); };
      $('#impCheck').onclick = () => {
        const txt = $('#impText').value;
        parsed = mode === 'text' ? Importer.fromText(txt) : Importer.fromTsv(txt);
        parsed.kind = mode;
        renderResult(parsed);
      };
      const input = $('#impFileInput');
      input.onchange = () => { handleFile(input.files[0]); input.value = ''; };
      const drop = $('#impDrop');
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
      drop.addEventListener('drop', (e) => {
        const f = e.dataTransfer && e.dataTransfer.files[0];
        if (!f) return;
        // lọc đuôi như ô chọn file (K-1)
        if (FILE_EXTS.indexOf('.' + String(f.name).toLowerCase().split('.').pop()) < 0) { fileRun++; parsed = null; showError('Chỉ nhận file Word (.docx), Excel (.xlsx), .csv hoặc văn bản .txt.'); return; }
        handleFile(f);
      });

      const finish = async (replace) => {
        if (!parsed || busy) return;
        const qs = parsed.questions.map((q) => Object.assign({}, q));
        const imgs = parsed.images || [];
        if (imgs.length) {
          // hình chỉ tải lên lúc này (sau khi giáo viên bấm thêm); cùng một file hình chỉ tải 1 lần
          busy = true; mopts.sticky = true; setBtns(false);
          m.querySelectorAll('[data-close], #impTabs button').forEach((b) => { b.disabled = true; });
          const urls = {}, byPath = {};
          const paths = [...new Set(imgs.map((im) => im.path))];
          let k = 0;
          const errs = [];
          for (const im of imgs) {
            if (Object.prototype.hasOwnProperty.call(byPath, im.path)) { urls[im.n] = byPath[im.path]; continue; }
            k++;
            prog(`Tải ${paths.length} hình… (${k}/${paths.length})`, (k - 1) / paths.length * 100);
            try {
              const blob = new Blob([im.data], { type: im.mime });
              const { base64, mime } = await shrinkImage(blob, !/^image\/(png|jpeg|gif|webp)$/.test(im.mime));
              const r = await api('adminUploadImage', { base64, mime, name: im.name });
              urls[im.n] = byPath[im.path] = r.url;
            } catch (e) { urls[im.n] = byPath[im.path] = null; errs.push(e.message); }
          }
          prog('Đã tải hình', 100);
          const bad = DocxReader.attachImages(qs, urls);
          bad.forEach((n) => { qs[n - 1].hinhLoi = (qs[n - 1].hinhLoi || 0) + 1; }); // R-7: nhãn "hình cần chụp lại" trong trình soạn
          busy = false; mopts.sticky = false;
          if (bad.length) toast('Không tải được hình ở câu ' + [...new Set(bad)].join(', ') + (errs[0] ? ': ' + errs[0] : '') + '. Có thể bấm "Tải ảnh" trong từng câu.', 'err');
        }
        qs.forEach((q) => { delete q.num; });
        freeBlobs();
        onDone(qs, replace);
        close('ok');
      };
      $('#impAdd').onclick = () => finish(false);
      $('#impReplace').onclick = () => finish(true);
    };
    return modal(`<h2>Nhập nhanh câu hỏi</h2>
      <div class="tabs" id="impTabs"><button class="active" data-t="text">Dán văn bản (Word)</button><button data-t="tsv">Dán từ Excel / Sheets</button><button data-t="file" id="impTabFile">Tải file lên</button></div>
      <div id="impHelp" class="notice small"></div>
      <div class="field" style="margin-top:10px" id="impTextWrap"><textarea id="impText" rows="12" placeholder="Dán nội dung vào đây…"></textarea></div>
      <div id="impFile" class="hidden" style="margin-top:10px">
        <label class="dropzone" id="impDrop"><input type="file" id="impFileInput" accept="${FILE_EXTS.join(',')}" class="hidden">
          <span class="dz-icon" aria-hidden="true">⇪</span>
          <span><b>Kéo thả file vào đây</b> hoặc <span class="btn btn-sm">Chọn file</span></span>
          <span class="small muted">Word (.docx), Excel (.xlsx), .csv hoặc .txt · tối đa 10 MB</span></label>
      </div>
      <div id="impProg" class="imp-prog hidden" aria-live="polite"><div class="progress"><div id="impProgBar"></div></div><span id="impProgText" class="small"></span></div>
      <div id="impResult" class="small"></div>
      <div class="modal-actions"><button class="btn" data-close="">Hủy</button><button class="btn" id="impCheck">Kiểm tra</button>
        <button class="btn" id="impReplace" disabled>Thay toàn bộ câu hiện có</button><button class="btn btn-primary" id="impAdd" disabled>Thêm vào đề</button></div>`, mopts).then((v) => { freeBlobs(); return v; });
  }

  /* ---------- thống kê đề ---------- */
  async function viewExamStats(examId) {
    $app.onclick = null;
    $app.innerHTML = loadingHtml();
    const mode = store.get('ld_stat_mode', 'all');
    const lop = store.get('ld_stat_lop', '');
    try {
      const s = await api('adminExamStats', { examId, mode, lop });
      const sts = await getStudents().catch(() => []);
      const classes = [...new Set(sts.map((x) => x.lop))].sort();
      $app.innerHTML = `<div class="card-title"><div><h1 style="margin:0">${esc(s.exam.tieuDe)}</h1><div class="muted small">Thống kê kết quả</div></div>
        <div class="row"><a class="btn" href="#/de-thi/sua/${encodeURIComponent(examId)}">Sửa đề</a><button class="btn" id="btnCsv">⬇ Xuất Excel (CSV)</button><a href="#/de-thi">← Danh sách đề</a></div></div>
        <div class="row" style="margin-bottom:12px"><select id="sMode" style="width:auto"><option value="all">Tất cả lượt nộp</option><option value="first" ${mode === 'first' ? 'selected' : ''}>Chỉ lần làm đầu tiên</option></select>
          <select id="sLop" style="width:auto"><option value="">Tất cả lớp</option>${classes.map((c) => `<option ${c === lop ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        ${s.count ? `<div class="stats">
          <div class="stat"><b>${s.count}</b><span>Lượt nộp (${s.students} HS)</span></div>
          <div class="stat"><b>${fmtNum(s.avg)}</b><span>Điểm trung bình</span></div>
          <div class="stat"><b>${fmtNum(s.median)}</b><span>Trung vị</span></div>
          <div class="stat"><b>${fmtNum(s.max)} / ${fmtNum(s.min)}</b><span>Cao nhất / thấp nhất</span></div>
          <div class="stat"><b>${s.passRate}%</b><span>Đạt từ 5 điểm</span></div>
          ${s.goalRate != null ? `<div class="stat"><b>${s.goalRate}%</b><span>Đạt mục tiêu tự đặt</span></div>` : ''}</div>
        <div class="grid grid-2"><div class="card"><h3>Phổ điểm</h3><div class="chart-box"><canvas id="chBins" aria-label="Phổ điểm"></canvas></div></div>
          <div class="card"><h3>Tỉ lệ làm đúng từng câu</h3><div class="chart-box"><canvas id="chQ" aria-label="Tỉ lệ đúng theo câu"></canvas></div></div></div>
        <div class="grid grid-2 section-gap"><div class="card"><h3>Theo chủ đề</h3>${App.barsHtml(s.byTopic)}</div>
          <div class="card"><h3>Theo mức độ</h3>${App.barsHtml(s.byLevel)}${s.byClass.length > 1 ? `<h3 style="margin-top:16px">Theo lớp</h3><div class="table-wrap"><table><thead><tr><th>Lớp</th><th class="num">Lượt nộp</th><th class="num">Điểm TB</th></tr></thead><tbody>${s.byClass.map((c) => `<tr><td>${esc(c.lop)}</td><td class="num">${c.n}</td><td class="num">${fmtNum(c.avg)}</td></tr>`).join('')}</tbody></table></div>` : ''}</div></div>
        <h2 class="section-gap">Phân tích từng câu</h2>
        <div class="table-wrap"><table><thead><tr><th>Câu</th><th>Dạng</th><th>Chủ đề</th><th>Mức độ</th><th>Đáp án</th><th class="num">Tỉ lệ điểm</th><th class="num">Bỏ trống</th><th>Phân bố lựa chọn</th></tr></thead><tbody>
          ${s.questions.map((q) => `<tr><td><b>${q.stt}</b></td><td>${App.TYPES[q.loai]}</td><td>${esc(q.chuDe || '')}</td><td>${App.LEVELS[q.mucDo] || ''}</td>
            <td>${esc(q.loai === 'DS' ? String(q.dapAn).replace(/D/g, 'Đ') : q.dapAn)}</td>
            <td class="num"><span class="badge ${q.pct >= 80 ? 'badge-good' : q.pct < 40 ? 'badge-bad' : ''}">${q.pct}%</span></td><td class="num">${q.blank}</td>
            <td class="small">${q.loai === 'TN' ? ['A', 'B', 'C', 'D'].map((k) => `${k === q.dapAn ? '<b>' : ''}${k}: ${q.choices[k] || 0}${k === q.dapAn ? '</b>' : ''}`).join(' · ') : ''}</td></tr>`).join('')}
        </tbody></table></div>
        <h2 class="section-gap">Danh sách bài nộp</h2>${resultsTable(s.results, false)}` : '<div class="card empty">Chưa có học sinh nào nộp bài.</div>'}`;
      document.getElementById('sMode').onchange = (e) => { store.set('ld_stat_mode', e.target.value); viewExamStats(examId); };
      document.getElementById('sLop').onchange = (e) => { store.set('ld_stat_lop', e.target.value); viewExamStats(examId); };
      document.getElementById('btnCsv').onclick = () => App.downloadCsv(`ket-qua-${examId}.csv`, [['STT', 'Họ tên', 'Lớp', 'Điểm (thang 10)', 'Mục tiêu', 'Điểm gốc', 'Số câu đúng', 'Tổng câu', 'Thời gian làm', 'Nộp lúc', 'Ghi chú']]
        .concat(s.results.map((r, i) => [i + 1, r.hoTen, r.lop, fmtNum(r.diem), r.mucTieu == null ? '' : fmtNum(r.mucTieu), fmtNum(r.diemGoc), r.soCauDung, r.tongCau, r.thoiGianLam, r.nopLuc, r.ghiChu || ''])));
      if (!s.count) return;
      const primary = App.cssVar('--primary');
      App.chart('chBins', {
        type: 'bar',
        data: { labels: s.bins.map((_, i) => i + '–' + (i + 1)), datasets: [{ label: 'Số bài', data: s.bins, backgroundColor: primary, borderRadius: 6 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
      const good = App.cssVar('--good'), bad = App.cssVar('--bad');
      App.chart('chQ', {
        type: 'bar',
        data: { labels: s.questions.map((q) => 'C' + q.stt), datasets: [{ label: '% điểm', data: s.questions.map((q) => q.pct), backgroundColor: s.questions.map((q) => (q.pct >= 80 ? good : q.pct < 40 ? bad : primary)), borderRadius: 4 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }
      });
    } catch (e) { $app.innerHTML = errorBox(e); }
  }

  /* ================= NGÂN HÀNG CÂU HỎI (Pha 2) ================= */
  // Giỏ câu (chỉ mã câu, không có đáp án) giữ trong sessionStorage của tab quản trị.
  const CART_KEY = 'ld_bank_cart', BF_KEY = 'ld_bank_filter';
  const sess = {
    get(k, d) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
  };
  const cartGet = () => sess.get(CART_KEY, { items: [], tieuDe: '' });
  const cartSet = (c) => sess.set(CART_KEY, c);
  const PART_SHORT = { 1: 'P1', 2: 'P2', 3: 'P3' };
  let bankMeta = null;
  let draftFromBank = null; // { questions, canhBao, tieuDe } → trình soạn đề mới

  const needUpdateHtml = (ver) => `<h1>Ngân hàng câu hỏi</h1><div class="notice warn" id="bankNeedUpdate">Ngân hàng câu hỏi cần máy chủ mới. Máy chủ đang chạy phiên bản ${esc(ver || 'cũ')}. <b>Cần cập nhật máy chủ (bước phát hành).</b> Các mục khác vẫn dùng bình thường.</div>`;

  async function viewBank() {
    $app.onclick = null;
    const view = App.currentView(); // R-1: dữ liệu về muộn không vẽ đè màn khác
    const p = store.get('ld_pub', null);
    if (!App.canTry('adminBankMeta')) { $app.innerHTML = needUpdateHtml(p && p.version); return; }
    $app.innerHTML = loadingHtml('Đang đọc kho câu hỏi…');
    try {
      if (!bankMeta) bankMeta = await api('adminBankMeta');
    } catch (e) {
      if (!App.viewIs(view)) return;
      if (e.unsupported) { $app.innerHTML = needUpdateHtml(p && p.version); return; }
      $app.innerHTML = `<h1>Ngân hàng câu hỏi</h1><div class="card empty" id="bankError"><b>Chưa đọc được kho:</b> ${esc(e.message)}
        <div class="row" style="margin-top:10px;justify-content:center"><a class="btn" href="#/cai-dat">Mở Cài đặt</a><button class="btn" id="bkRetry">Thử lại</button></div></div>`;
      document.getElementById('bkRetry').onclick = () => { bankMeta = null; viewBank(); };
      return;
    }
    if (!App.viewIs(view)) return; // đã chuyển màn: chỉ giữ bankMeta, không vẽ
    renderBank();
  }

  function renderBank() {
    const m = bankMeta;
    const view = App.currentView();
    const here = () => App.viewIs(view);
    const LIMIT = m.gioiHan || 500;
    const f = Object.assign({ lop: '', chuong: [], bai: [], loai: [], mucDo: [], nguon: '', q: '' }, sess.get(BF_KEY, {}));
    if (f.lop && m.lop.indexOf(f.lop) < 0) f.lop = '';
    const so = sess.get('ld_bank_so', { TN: 18, DS: 4, TL: 6 });
    const chk = (name, val, label, on) => `<label class="chk"><input type="checkbox" data-f="${name}" value="${esc(val)}" ${on ? 'checked' : ''}> ${label}</label>`;
    $app.innerHTML = `${bankTabsHtml('kho')}<div class="card-title"><h1 style="margin:0">Ngân hàng câu hỏi</h1>
        <div class="row"><button class="btn" id="bkReload" title="Đọc lại file kho (sau khi sửa kho)">↻ Đọc lại kho</button></div></div>
      <div class="muted small" id="bkInfo" style="margin-bottom:10px">Kho có <b>${m.tong}</b> câu · có đáp án ${m.coDapAn} · <b>dùng được ${m.dungDuoc}</b>
        (Phần I ${m.theoDang.TN} · Phần II ${m.theoDang.DS} · Phần III ${m.theoDang.TL}) · đọc lúc ${esc(m.docLuc)}.
        Chỉ câu đã có đáp án hợp lệ mới hiện ở đây; câu tự luận (Phần IV) tạm bỏ qua.</div>
      ${(m.canhBao || []).map((c) => `<div class="notice warn small" style="margin-bottom:10px">${esc(c)}</div>`).join('')}
      <div class="bank-layout">
        <aside class="card bank-filter" id="bkFilter">
          <div class="field"><label for="bkLop">Lớp</label><select id="bkLop"><option value="">Tất cả</option>${m.lop.map((l) => `<option ${l === f.lop ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
          <div class="field"><label>Dạng câu</label><div class="chk-row">${chk('loai', 'TN', 'Phần I', f.loai.includes('TN'))}${chk('loai', 'DS', 'Phần II', f.loai.includes('DS'))}${chk('loai', 'TL', 'Phần III', f.loai.includes('TL'))}</div></div>
          <div class="field"><label>Mức độ</label><div class="chk-row">${Object.keys(App.LEVELS).map((k) => chk('mucDo', k, App.LEVELS[k], f.mucDo.includes(k))).join('')}</div></div>
          <div class="field"><label for="bkNguon">Nguồn (đề gốc)</label><select id="bkNguon"><option value="">Tất cả</option>${m.nguon.filter((s) => s.dungDuoc).map((s) => `<option value="${esc(s.ma)}" ${s.ma === f.nguon ? 'selected' : ''}>${esc(s.ten)} (${s.dungDuoc}/${s.soCau})</option>`).join('')}</select></div>
          <div class="field"><label for="bkQ">Tìm chữ</label><input id="bkQ" value="${esc(f.q)}" placeholder="Nội dung hoặc mã câu…"></div>
          <div class="field"><label>Chương → Bài</label><div class="bank-tree" id="bkTree"></div></div>
          <button class="btn btn-sm" id="bkClear">Bỏ lọc</button>
        </aside>
        <section class="bank-main">
          <div class="card bank-tools">
            <div class="row"><b>Ma trận 1 chạm</b>
              <label class="small">P1 <input class="so" type="number" min="0" max="200" id="soTN" value="${so.TN}"></label>
              <label class="small">P2 <input class="so" type="number" min="0" max="200" id="soDS" value="${so.DS}"></label>
              <label class="small">P3 <input class="so" type="number" min="0" max="200" id="soTL" value="${so.TL}"></label>
              <button class="btn btn-primary btn-sm" id="bkMatrix">Tạo ma trận</button></div>
            <div class="muted small">Theo lớp, chương, bài, mức độ, nguồn đang lọc; ưu tiên câu ít dùng.</div>
            <div class="row" style="margin-top:8px"><button class="btn btn-sm" id="bkSource" ${f.nguon ? '' : 'disabled'}>Lấy đề gốc</button>
              <span class="muted small">${f.nguon ? 'Nạp các câu có đáp án của nguồn đang chọn.' : 'Chọn một Nguồn để lấy nguyên đề gốc.'}</span></div>
          </div>
          <div id="bkList"></div>
        </section>
      </div>
      <div class="cart-bar" id="bkCart"></div>`;

    const drawTree = () => {
      const lop = document.getElementById('bkLop').value;
      const byCh = {};
      m.cay.filter((x) => !lop || x.lop === lop).forEach((x) => { (byCh[x.chuong] = byCh[x.chuong] || []).push(x); });
      const sum = (d) => d.TN + d.DS + d.TL;
      document.getElementById('bkTree').innerHTML = Object.keys(byCh).length ? Object.keys(byCh).map((ch) => {
        const bais = byCh[ch];
        const n = bais.reduce((s, x) => s + sum(x.dem), 0);
        return `<details ${f.chuong.includes(ch) || bais.some((x) => f.bai.includes(x.bai)) ? 'open' : ''}><summary>${chk('chuong', ch, `${esc(ch)} <span class="muted">(${n})</span>`, f.chuong.includes(ch))}</summary>
          ${bais.map((x) => `<div class="bai">${chk('bai', x.bai, `${esc(x.bai)} <span class="muted">(${x.dem.TN}·${x.dem.DS}·${x.dem.TL})</span>`, f.bai.includes(x.bai))}</div>`).join('')}</details>`;
      }).join('') : '<div class="muted small">Không có câu.</div>';
    };
    drawTree();

    let page = 1;
    const readFilter = () => {
      const vals = (name) => [...document.querySelectorAll(`#bkFilter input[data-f="${name}"]:checked`)].map((x) => x.value);
      Object.assign(f, {
        lop: document.getElementById('bkLop').value, nguon: document.getElementById('bkNguon').value, q: document.getElementById('bkQ').value.trim(),
        loai: vals('loai'), mucDo: vals('mucDo'), chuong: vals('chuong'), bai: vals('bai')
      });
      sess.set(BF_KEY, f);
      const src = document.getElementById('bkSource');
      src.disabled = !f.nguon;
      src.nextElementSibling.textContent = f.nguon ? 'Nạp các câu có đáp án của nguồn đang chọn.' : 'Chọn một Nguồn để lấy nguyên đề gốc.';
    };
    let seq = 0;
    const loadList = async () => {
      const my = ++seq;
      const box = document.getElementById('bkList');
      box.innerHTML = loadingHtml();
      try {
        const r = await api('adminBankList', { filter: f, page, size: 20 });
        if (my !== seq || !here() || !document.getElementById('bkList')) return;
        const pages = Math.max(1, Math.ceil(r.tong / r.size));
        const inCart = new Set(cartGet().items.map((x) => x.maKho));
        box.innerHTML = `<div class="muted small" style="margin:4px 0 8px">${r.tong} câu phù hợp</div>
          ${r.items.length ? r.items.map((x) => `<div class="bank-item" data-ma="${esc(x.maKho)}">
            <div class="bank-item-head"><span class="badge badge-primary">${PART_SHORT[x.phan]} · ${App.TYPES[x.loai]}</span>
              ${x.mucDo ? `<span class="badge">${App.LEVELS[x.mucDo]}</span>` : ''}${x.coHinh ? '<span class="badge">có hình</span>' : ''}
              ${x.daDung ? `<span class="badge badge-warn">đã dùng ${x.daDung} lần</span>` : ''}
              <span class="spacer"></span>
              <button class="btn btn-sm" data-view="${esc(x.maKho)}">Xem đầy đủ</button>
              <button class="btn btn-sm ${inCart.has(x.maKho) ? 'in-cart' : 'btn-primary'}" data-cart="${esc(x.maKho)}" data-loai="${x.loai}" data-phan="${x.phan}">${inCart.has(x.maKho) ? '✓ Trong giỏ' : '+ Giỏ'}</button></div>
            <div class="bank-tom">${rich(x.tom)}${x.tom.length >= 160 ? ' …' : ''}</div>
            <div class="muted small">${esc(x.maKho)} · ${esc(x.bai)} · ${esc(x.nguon)} · ${esc(x.viTri)}</div></div>`).join('')
            : '<div class="card empty">Không có câu phù hợp bộ lọc.</div>'}
          ${pages > 1 ? `<div class="row pager" style="justify-content:center;margin:12px 0"><button class="btn btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Trước</button>
            <span class="small">Trang ${page}/${pages}</span><button class="btn btn-sm" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Sau →</button></div>` : ''}`;
        math(box);
      } catch (e) { if (my === seq && here() && document.getElementById('bkList')) box.innerHTML = errorBox(e); }
    };
    const refresh = () => { readFilter(); page = 1; loadList(); };
    const drawCart = () => {
      const c = cartGet();
      const n = { 1: 0, 2: 0, 3: 0 };
      c.items.forEach((x) => { n[x.phan] = (n[x.phan] || 0) + 1; });
      const el = document.getElementById('bkCart');
      if (!el || !here()) return;
      const over = c.items.length > LIMIT;
      el.innerHTML = `<div class="cart-in"><b>Giỏ câu:</b> <span id="cartCount">P1 ${n[1]} · P2 ${n[2]} · P3 ${n[3]}</span>
        ${over ? `<span class="badge badge-warn" id="cartOver">Quá ${LIMIT} câu — bớt ${c.items.length - LIMIT} câu để tạo đề</span>` : ''}
        <span class="spacer"></span><button class="btn btn-sm" id="cartClear" ${c.items.length ? '' : 'disabled'}>Xóa giỏ</button>
        ${App.has('practice') ? `<button class="btn btn-sm" id="cartPractice" ${c.items.length ? '' : 'disabled'}>Đưa vào luyện tập</button>` : ''}
        <button class="btn btn-primary btn-sm" id="cartMake" ${c.items.length && !over ? '' : 'disabled'}>Tạo đề (${c.items.length} câu) →</button></div>`;
      document.getElementById('cartClear').onclick = async () => {
        if (!(await confirmBox('Xóa giỏ câu?', 'Bỏ toàn bộ ' + c.items.length + ' câu đã chọn khỏi giỏ.', 'Xóa giỏ', true))) return;
        cartSet({ items: [], tieuDe: '' }); drawCart(); loadList();
      };
      document.getElementById('cartMake').onclick = (e) => withBusy(e.currentTarget, () => makeExamFromCart());
      const cp = document.getElementById('cartPractice');
      if (cp) cp.onclick = (e) => withBusy(e.currentTarget, () => practiceFromCart());
    };

    document.getElementById('bkLop').onchange = () => { readFilter(); f.chuong = []; f.bai = []; sess.set(BF_KEY, f); drawTree(); refresh(); };
    document.getElementById('bkNguon').onchange = refresh;
    let qTimer;
    document.getElementById('bkQ').oninput = () => { clearTimeout(qTimer); qTimer = setTimeout(refresh, 400); };
    document.getElementById('bkFilter').addEventListener('change', (e) => { if (e.target.matches('input[type=checkbox]')) refresh(); });
    document.getElementById('bkClear').onclick = () => { sess.set(BF_KEY, {}); renderBank(); };
    document.getElementById('bkReload').onclick = (e) => withBusy(e.currentTarget, async () => {
      try {
        bankMeta = await api('adminBankMeta', { refresh: true });
        if (!here()) return; // R-1: giáo viên đã sang màn khác
        toast('Đã đọc lại kho', 'ok'); renderBank();
      } catch (err) { if (here()) toast(err.message, 'err'); }
    });
    document.getElementById('bkMatrix').onclick = (e) => withBusy(e.currentTarget, async () => {
      readFilter();
      const want = { TN: +document.getElementById('soTN').value || 0, DS: +document.getElementById('soDS').value || 0, TL: +document.getElementById('soTL').value || 0 };
      sess.set('ld_bank_so', want);
      if (want.TN + want.DS + want.TL > LIMIT) { toast(`Ma trận tối đa ${LIMIT} câu (giới hạn của Tạo đề).`, 'err'); return; }
      try {
        const r = await api('adminBankMatrix', { lop: f.lop, chuong: f.chuong, bai: f.bai, mucDo: f.mucDo, nguon: f.nguon, so: want });
        if (!here()) return;
        const parts = [['TN', 'Phần I'], ['DS', 'Phần II'], ['TL', 'Phần III']];
        const short = parts.filter(([k]) => r.thieu[k] > 0);
        const cur = cartGet();
        const msg = (short.length ? `<div class="notice warn" id="mxShort"><b>Kho không đủ câu theo bộ lọc:</b><br>${short.map(([k, name]) => `${name}: cần ${r.so[k]}, chỉ có ${r.coSan[k]} (thiếu ${r.thieu[k]} câu)`).join('<br>')}</div>` : '')
          + `<p>Tìm được <b>${r.maKho.length}</b> câu (${parts.map(([k, name]) => `${name} ${Math.min(r.so[k], r.coSan[k])}`).join(' · ')}).</p>`
          + (cur.items.length ? '<p class="muted small">Giỏ hiện tại sẽ được thay bằng các câu này.</p>' : '');
        if (!r.maKho.length) { await modal(`<h2>Ma trận đề</h2>${msg}<div class="modal-actions"><button class="btn" data-close="">Đóng</button></div>`); return; }
        const go = await confirmBox('Ma trận đề', msg, short.length ? 'Vẫn thêm vào giỏ' : 'Thêm vào giỏ');
        if (!go || !here()) return;
        const loaiOf = {};
        // phần của từng câu: ma trận trả theo thứ tự TN, DS, TL
        let i = 0;
        parts.forEach(([k], j) => { for (let n = 0; n < Math.min(r.so[k], r.coSan[k]); n++) loaiOf[r.maKho[i++]] = { loai: k, phan: j + 1 }; });
        cartSet({ items: r.maKho.map((ma) => Object.assign({ maKho: ma }, loaiOf[ma])), tieuDe: '' });
        drawCart(); loadList();
        toast('Đã thêm ' + r.maKho.length + ' câu vào giỏ', 'ok');
      } catch (err) { if (here()) toast(err.message, 'err'); }
    });
    document.getElementById('bkSource').onclick = (e) => withBusy(e.currentTarget, async () => {
      readFilter();
      if (!f.nguon) return;
      try {
        const r = await api('adminBankSource', { nguon: f.nguon });
        if (!here()) return;
        const n = { 1: 0, 2: 0, 3: 0 };
        r.items.forEach((x) => { n[x.phan]++; });
        const html = `<p>Đề gốc <b>${esc(r.ten)}</b>: lấy được <b>${r.items.length}</b> câu có đáp án (P1 ${n[1]} · P2 ${n[2]} · P3 ${n[3]}).</p>
          ${r.thieu.length ? `<div class="notice warn" id="srcMissing" style="margin-bottom:8px"><b>Đề gốc trong kho không đủ câu:</b><br>${r.thieu.map((x) => esc(x.text)).join('<br>')}</div>` : ''}
          ${r.khongDapAn ? `<div class="notice warn" id="srcNoKey" style="margin-bottom:8px"><b>${r.khongDapAn} câu chưa có đáp án hợp lệ</b> nên không được lấy (bổ sung đáp án trong kho rồi bấm "Đọc lại kho"):<br><span class="small">${r.khongDapAnViTri.map(esc).join('; ')}${r.khongDapAn > r.khongDapAnViTri.length ? '; …' : ''}</span></div>` : ''}
          ${r.tuLuan ? `<p class="muted small">Bỏ qua ${r.tuLuan} câu tự luận (Phần IV).</p>` : ''}
          ${cartGet().items.length ? '<p class="muted small">Giỏ hiện tại sẽ được thay bằng các câu này.</p>' : ''}`;
        if (!r.items.length) { await modal(`<h2>Lấy đề gốc</h2>${html}<div class="modal-actions"><button class="btn" data-close="">Đóng</button></div>`); return; }
        if (!(await confirmBox('Lấy đề gốc', html, 'Nạp vào giỏ')) || !here()) return;
        cartSet({ items: r.items.map((x) => ({ maKho: x.maKho, loai: x.loai, phan: x.phan })), tieuDe: 'Đề gốc — ' + r.ten });
        drawCart(); loadList();
        toast('Đã nạp ' + r.items.length + ' câu của đề gốc vào giỏ', 'ok');
      } catch (err) { if (here()) toast(err.message, 'err'); }
    });
    $app.onclick = async (ev) => {
      const pg = ev.target.closest('[data-page]');
      if (pg && !pg.disabled) { page = +pg.dataset.page; loadList(); window.scrollTo(0, 0); return; }
      const add = ev.target.closest('[data-cart]');
      if (add) {
        const c = cartGet();
        const i = c.items.findIndex((x) => x.maKho === add.dataset.cart);
        if (i >= 0) c.items.splice(i, 1); else c.items.push({ maKho: add.dataset.cart, loai: add.dataset.loai, phan: +add.dataset.phan });
        cartSet(c);
        add.classList.toggle('in-cart', i < 0); add.classList.toggle('btn-primary', i >= 0);
        add.textContent = i < 0 ? '✓ Trong giỏ' : '+ Giỏ';
        drawCart();
        return;
      }
      const v = ev.target.closest('[data-view]');
      if (v) withBusy(v, async () => {
        try {
          const r = await api('adminBankToQuestions', { maKho: [v.dataset.view] });
          if (!here()) return;
          const q = r.questions[0];
          if (!q) { toast((r.canhBao || [])[0] || 'Không đọc được câu này.', 'err'); return; }
          modal(`<h2>${esc(q.maKho)}</h2><div class="muted small" style="margin-bottom:8px">${esc(q.chuong)} · ${esc(q.bai)} · ${App.LEVELS[q.mucDo] || ''}${q.mucDoY ? ' · ' + esc(q.mucDoY) : ''}</div>
            <div class="preview" id="bkPreview">${bankPreviewHtml(q)}</div>
            ${(r.canhBao || []).map((c) => `<div class="notice warn small">${esc(c)}</div>`).join('')}
            <div class="modal-actions"><button class="btn" data-close="">Đóng</button></div>`, { wide: true, onOpen(mm) { math(mm); } });
        } catch (err) { if (here()) toast(err.message, 'err'); }
      });
    };
    drawCart();
    readFilter();
    loadList();
  }

  /* ---------- Pool luyện tập (Pha 4) ---------- */
  const bankTabsHtml = (cur) => (App.has('practice') ? `<div class="seg no-print" id="bankTabs" role="tablist" style="margin-bottom:12px">
      <a class="btn btn-sm ${cur === 'kho' ? 'active' : ''}" href="#/ngan-hang" role="tab">Kho câu hỏi</a>
      <a class="btn btn-sm ${cur === 'pool' ? 'active' : ''}" href="#/ngan-hang/pool" role="tab" id="tabPool">Pool luyện tập</a></div>` : '');

  /** Chép các câu trong giỏ vào pool (thêm / thay), chép hình theo lô; cảnh báo câu đang nằm trong đề chưa công bố lời giải. */
  async function practiceFromCart() {
    const c = cartGet();
    if (!c.items.length) return;
    const view = App.currentView();
    const mode = await modal(`<h2>Đưa ${c.items.length} câu vào luyện tập</h2>
      <p>Học sinh sẽ luyện được các câu này (đúng khối lớp). Câu đang nằm trong đề thi chưa công bố lời giải sẽ <b>tạm ẩn</b> với học sinh cho tới khi đề công bố lời giải.</p>
      <div class="modal-actions"><button class="btn" data-close="">Hủy</button>
        <button class="btn" data-close="thay" id="ptReplace" title="Các câu khác trong pool được tắt (không xóa)">Thay pool bằng giỏ</button>
        <button class="btn btn-primary" data-close="them" id="ptAdd">Thêm vào pool</button></div>`);
    if (!mode || !App.viewIs(view)) return;
    let closeProg = null;
    modal(`<h2>Đang đưa câu vào luyện tập…</h2><p id="ptProg">Đang đọc ${c.items.length} câu…</p><div class="progress" style="margin-top:8px"><i id="ptProgBar" style="width:5%"></i></div>`,
      { sticky: true, onOpen(m, close) { closeProg = close; } });
    try {
      const codes = c.items.map((x) => x.maKho);
      let cursor, r, canhBao = [];
      for (let lot = 0; lot < 200; lot++) {
        r = await api('adminPracticeSync', { maKho: codes, mode, cursor });
        canhBao = canhBao.concat(r.canhBao || []);
        const t = r.tienDo || { xong: 0, tong: 0 };
        const el = document.getElementById('ptProg');
        if (el) el.textContent = t.tong ? `Đã chép ${t.xong}/${t.tong} hình…` : 'Đang ghi…';
        const bar = document.getElementById('ptProgBar');
        if (bar) bar.style.width = (t.tong ? Math.max(5, Math.round(t.xong / t.tong * 100)) : 100) + '%';
        if (r.tiepTuc == null) break;
        cursor = r.tiepTuc;
      }
      if (closeProg) closeProg();
      if (!App.viewIs(view)) return;
      const bq = r.boQua || {};
      await modal(`<h2>Đã cập nhật pool luyện tập</h2>
        <p id="ptResult">Thêm mới <b>${r.them}</b> · cập nhật ${r.capNhat} · tắt ${r.tat} câu.</p>
        ${bq.khongDapAn || bq.tuLuan || bq.khac || bq.khongCo ? `<p class="muted small">Bỏ qua: ${bq.khongDapAn || 0} câu chưa có đáp án hợp lệ, ${bq.tuLuan || 0} câu tự luận${bq.khac ? ', ' + bq.khac + ' câu lỗi định dạng' : ''}${bq.khongCo ? ', ' + bq.khongCo + ' mã không có trong kho' : ''}.</p>` : ''}
        ${(r.dangThi || []).length ? `<div class="notice warn" id="ptDangThi"><b>${r.dangThi.length} câu đang thi</b> (nằm trong đề chưa công bố lời giải): đã thêm nhưng học sinh chưa thấy cho tới khi đề công bố lời giải.<br><span class="small">${r.dangThi.slice(0, 30).map(esc).join(', ')}${r.dangThi.length > 30 ? ', …' : ''}</span></div>` : ''}
        ${[...new Set(canhBao)].slice(0, 20).map((x) => `<div class="notice warn small">${esc(x)}</div>`).join('')}
        <div class="modal-actions"><a class="btn" href="#/ngan-hang/pool" data-close="">Xem pool luyện tập</a><button class="btn btn-primary" data-close="">Đóng</button></div>`, { wide: true });
    } catch (err) {
      if (closeProg) closeProg();
      if (App.viewIs(view)) toast(err.message, 'err');
    }
  }

  async function viewPool() {
    $app.onclick = null;
    const view = App.currentView();
    const here = () => App.viewIs(view);
    if (!App.has('practice')) {
      const p = store.get('ld_pub', null);
      $app.innerHTML = `<h1>Pool luyện tập</h1><div class="notice warn" id="poolNeedUpdate">Luyện tập cần máy chủ mới. Máy chủ đang chạy phiên bản ${esc((p && p.version) || 'cũ')}. <b>Cần cập nhật máy chủ (bước phát hành).</b></div>`;
      return;
    }
    const f = Object.assign({ lop: '', chuong: [], bai: [], loai: [], bat: '', q: '' }, sess.get('ld_pool_filter', {}));
    let page = 1;
    $app.innerHTML = bankTabsHtml('pool') + '<h1>Pool luyện tập</h1><div id="poolBody">' + loadingHtml() + '</div>';
    const load = async () => {
      const box = document.getElementById('poolBody');
      if (!box) return;
      let r;
      try { r = await api('adminPracticeList', { filter: f, page, size: 20 }); } catch (e) {
        if (!here()) return;
        box.innerHTML = e.unsupported ? '<div class="notice warn">Cần cập nhật máy chủ (bước phát hành).</div>' : errorBox(e);
        return;
      }
      if (!here() || !document.getElementById('poolBody')) return;
      const pages = Math.max(1, Math.ceil(r.tong / r.size));
      const chs = [...new Set(r.cay.map((x) => x.chuong))];
      box.innerHTML = `${r.choLuyenTap ? '' : '<div class="notice warn" id="poolOff" style="margin-bottom:10px">Mục Luyện tập đang <b>tắt</b> với học sinh. Bật ở <a href="#/cai-dat">Cài đặt</a> → "Mục Luyện tập cho học sinh".</div>'}
        <div class="muted small" style="margin-bottom:10px">Pool có <b>${r.dem.tong}</b> câu · đang bật ${r.dem.bat} · <span class="badge badge-exam">đang thi</span> ${r.dem.dangThi} (học sinh chưa thấy cho tới khi đề công bố lời giải).
          Thêm câu: tab Kho câu hỏi → chọn câu vào giỏ → "Đưa vào luyện tập".</div>
        <div class="card"><div class="row pool-filters">
          <select id="plLop"><option value="">Mọi lớp</option>${r.lop.map((l) => `<option value="${l}" ${String(l) === String(f.lop) ? 'selected' : ''}>Lớp ${l}</option>`).join('')}</select>
          <select id="plCh"><option value="">Mọi chương</option>${chs.map((c) => `<option ${f.chuong[0] === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          <select id="plBat"><option value="">Bật và tắt</option><option value="CO" ${f.bat === 'CO' ? 'selected' : ''}>Đang bật</option><option value="KHONG" ${f.bat === 'KHONG' ? 'selected' : ''}>Đang tắt</option><option value="DANG_THI" ${f.bat === 'DANG_THI' ? 'selected' : ''}>Đang thi</option></select>
          <input id="plQ" placeholder="Mã câu…" value="${esc(f.q)}" style="max-width:200px">
          <span class="spacer"></span><label class="chk"><input type="checkbox" id="plAll"> Chọn cả trang</label>
          <button class="btn btn-sm" id="plOn">Bật</button><button class="btn btn-sm" id="plOff">Tắt</button></div>
          <div class="muted small" style="margin:8px 0">${r.tong} câu phù hợp</div>
          <div id="plList">${r.items.length ? r.items.map((x) => `<div class="pool-item ${x.bat ? '' : 'off'}" data-ma="${esc(x.maKho)}">
            <div class="row"><label class="chk"><input type="checkbox" class="pl-sel" value="${esc(x.maKho)}"></label>
              <span class="badge badge-primary">${PART_SHORT[x.phan] || ''} · ${App.TYPES[x.loai] || x.loai}</span>${x.mucDo ? `<span class="badge">${App.LEVELS[x.mucDo] || esc(x.mucDo)}</span>` : ''}
              ${x.dangThi ? '<span class="badge badge-exam" title="Câu nằm trong đề chưa công bố lời giải: học sinh chưa thấy">đang thi</span>' : ''}
              <span class="badge">${x.soLuot} lượt làm</span>${x.coHinh ? '<span class="badge">có hình</span>' : ''}
              <span class="spacer"></span><button class="btn btn-sm ${x.bat ? '' : 'btn-primary'}" data-toggle="${esc(x.maKho)}" data-to="${x.bat ? 'KHONG' : 'CO'}">${x.bat ? 'Tắt' : 'Bật'}</button></div>
            <div class="bank-tom">${rich(x.tom)}</div>
            <div class="muted small">${esc(x.maKho)} · Lớp ${x.lop || '?'} · ${esc(x.bai)}${x.bat ? '' : ' · <b>đang tắt</b>'}</div></div>`).join('') : '<div class="empty">Không có câu.</div>'}</div>
          ${pages > 1 ? `<div class="row pager" style="justify-content:center;margin:12px 0"><button class="btn btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Trước</button>
            <span class="small">Trang ${page}/${pages}</span><button class="btn btn-sm" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Sau →</button></div>` : ''}</div>`;
      math(box);
      const refilter = () => {
        f.lop = document.getElementById('plLop').value;
        f.chuong = document.getElementById('plCh').value ? [document.getElementById('plCh').value] : [];
        f.bat = document.getElementById('plBat').value;
        f.q = document.getElementById('plQ').value.trim();
        sess.set('ld_pool_filter', f);
        page = 1; load();
      };
      ['plLop', 'plCh', 'plBat'].forEach((id) => { document.getElementById(id).onchange = refilter; });
      let qt;
      document.getElementById('plQ').oninput = () => { clearTimeout(qt); qt = setTimeout(refilter, 400); };
      document.getElementById('plAll').onchange = (e) => box.querySelectorAll('.pl-sel').forEach((x) => { x.checked = e.target.checked; });
      const bulk = (on) => (e) => withBusy(e.currentTarget, async () => {
        const codes = [...box.querySelectorAll('.pl-sel:checked')].map((x) => x.value);
        if (!codes.length) return toast('Chọn câu trước (ô vuông đầu mỗi câu)', 'err');
        try { const t = await api('adminPracticeToggle', { maKho: codes, bat: on ? 'CO' : 'KHONG' }); toast(`Đã ${on ? 'bật' : 'tắt'} ${t.n} câu`, 'ok'); if (here()) load(); } catch (err) { toast(err.message, 'err'); }
      });
      document.getElementById('plOn').onclick = bulk(true);
      document.getElementById('plOff').onclick = bulk(false);
    };
    $app.onclick = async (ev) => {
      const pg = ev.target.closest('[data-page]');
      if (pg && !pg.disabled) { page = +pg.dataset.page; load(); window.scrollTo(0, 0); return; }
      const tg = ev.target.closest('[data-toggle]');
      if (tg) withBusy(tg, async () => {
        try { await api('adminPracticeToggle', { maKho: [tg.dataset.toggle], bat: tg.dataset.to }); if (here()) load(); } catch (err) { toast(err.message, 'err'); }
      });
    };
    load();
  }

  function bankPreviewHtml(q) {
    let h = `<div>${rich(q.noiDung)}</div>${q.hinhAnh ? `<img class="q-img" src="${esc(q.hinhAnh)}" alt="">` : ''}`;
    if (q.loai !== 'TL') h += ['A', 'B', 'C', 'D'].map((k, j) => `<div><b>${q.loai === 'DS' ? 'abcd'[j] + ')' : k + '.'}</b> ${rich(q[k])}</div>`).join('');
    h += `<div style="margin-top:8px"><b>Đáp án:</b> ${esc(q.dapAn)}</div>`;
    if (q.loiGiai) h += `<div class="solution">${rich(q.loiGiai)}</div>`;
    return h;
  }

  /** Lấy câu đầy đủ của giỏ (chép hình theo lô, tự gọi tiếp), rồi mở trình soạn đề với các câu đã nạp (chưa lưu). */
  async function makeExamFromCart() {
    const c = cartGet();
    if (!c.items.length) return;
    const view = App.currentView();
    let closeProg = null;
    modal(`<h2>Đang lấy câu từ kho…</h2><p id="bkProg">Đang đọc ${c.items.length} câu…</p><div class="progress" style="margin-top:8px"><i id="bkProgBar" style="width:5%"></i></div>`,
      { sticky: true, onOpen(m, close) { closeProg = close; } });
    try {
      const codes = c.items.map((x) => x.maKho);
      let cursor, r, canhBao = [], thieuHinh = [];
      for (let lot = 0; lot < 200; lot++) {
        r = await api('adminBankToQuestions', { maKho: codes, cursor });
        canhBao = canhBao.concat(r.canhBao || []);
        thieuHinh = thieuHinh.concat(r.thieuHinh || []);
        const t = r.tienDo || { xong: 0, tong: 0 };
        const el = document.getElementById('bkProg');
        if (el) el.textContent = t.tong ? `Đã chép ${t.xong}/${t.tong} hình…` : 'Xong.';
        const bar = document.getElementById('bkProgBar');
        if (bar) bar.style.width = (t.tong ? Math.max(5, Math.round(t.xong / t.tong * 100)) : 100) + '%';
        if (r.tiepTuc == null) break;
        cursor = r.tiepTuc;
      }
      const qs = r.questions.map((q, i) => ({ q, i })).sort((a, b) => (a.q.phan - b.q.phan) || (a.i - b.i)).map((x) => x.q);
      if (closeProg) closeProg();
      if (!App.viewIs(view)) return; // đã rời tab Ngân hàng (vd nút Quay lại): không tự mở trình soạn
      const miss = new Set(thieuHinh);
      qs.forEach((q) => { if (miss.has(q.maKho)) q.thieuHinh = true; });
      draftFromBank = { questions: qs, canhBao: [...new Set(canhBao)], tieuDe: c.tieuDe || '' };
      location.hash = '#/de-thi/moi';
    } catch (err) {
      if (closeProg) closeProg();
      if (App.viewIs(view)) toast(err.message, 'err');
    }
  }

  /* ================= HỌC SINH ================= */
  async function getStudents(force) {
    if (!studentsCache || force) studentsCache = await api('adminListStudents');
    return studentsCache;
  }

  async function viewStudents() {
    $app.onclick = null;
    $app.innerHTML = loadingHtml();
    try {
      const sts = await getStudents(true);
      const classes = [...new Set(sts.map((s) => s.lop))].sort((a, b) => a.localeCompare(b, 'vi'));
      const f = store.get('ld_st_filter', { lop: '', q: '' });
      $app.innerHTML = `<div class="card-title"><h1 style="margin:0">Học sinh <span class="muted">(${sts.length})</span></h1>
        <div class="row"><button class="btn btn-primary" id="btnAdd">+ Thêm học sinh</button><button class="btn" id="btnBulk">⇪ Nhập danh sách</button><button class="btn" id="btnPrint">🖨 In phiếu đăng nhập</button></div></div>
        <div class="row" style="margin-bottom:12px"><select id="fLop" style="width:auto"><option value="">Tất cả lớp</option>${classes.map((c) => `<option ${c === f.lop ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          <input id="fQ" placeholder="Tìm theo tên…" value="${esc(f.q)}" style="max-width:280px"></div>
        <div id="stTable"></div>`;
      const draw = () => {
        const lop = document.getElementById('fLop').value, q = document.getElementById('fQ').value.trim().toLowerCase();
        store.set('ld_st_filter', { lop, q });
        const rows = sts.filter((s) => (!lop || s.lop === lop) && (!q || s.hoTen.toLowerCase().includes(q)))
          .sort((a, b) => a.lop.localeCompare(b.lop, 'vi') || lastName(a.hoTen).localeCompare(lastName(b.hoTen), 'vi'));
        document.getElementById('stTable').innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Họ tên</th><th>Lớp</th><th>Ngày sinh</th><th>PIN</th><th>Google</th><th class="num">Số bài</th><th class="num">Điểm TB</th><th></th></tr></thead><tbody>
          ${rows.map((s) => `<tr${s.trangThai === 'KHOA' ? ' style="opacity:.55"' : ''}><td class="small">${esc(s.id)}</td><td><b>${esc(s.hoTen)}</b>${s.trangThai === 'KHOA' ? ' <span class="badge badge-bad">Đã khóa</span>' : ''}</td>
            <td>${esc(s.lop)}</td><td>${esc(s.ngaySinh)}</td><td><code>${esc(s.pin)}</code>${s.pinRieng ? ' <span class="badge">riêng</span>' : ''}</td>
            <td class="small">${esc(s.email || '')}</td><td class="num">${s.soBai}</td><td class="num">${s.diemTB == null ? '—' : fmtNum(s.diemTB)}</td>
            <td class="nowrap"><button class="btn btn-sm" data-edit="${esc(s.id)}">Sửa</button><a class="btn btn-sm" href="#/ket-qua" data-res="${esc(s.id)}">Bài làm</a></td></tr>`).join('')}
          </tbody></table></div>` : '<div class="card empty">Không có học sinh phù hợp.</div>';
      };
      draw();
      document.getElementById('fLop').onchange = draw;
      document.getElementById('fQ').oninput = draw;
      document.getElementById('btnAdd').onclick = () => studentDialog(null);
      document.getElementById('btnBulk').onclick = bulkDialog;
      document.getElementById('btnPrint').onclick = () => printCards(sts.filter((s) => s.trangThai !== 'KHOA' && (!document.getElementById('fLop').value || s.lop === document.getElementById('fLop').value)));
      $app.onclick = (e) => {
        const ed = e.target.closest('[data-edit]');
        if (ed) studentDialog(sts.find((s) => s.id === ed.dataset.edit));
        const rs = e.target.closest('[data-res]');
        if (rs) store.set('ld_res_filter', { examId: '', lop: '', studentId: rs.dataset.res });
      };
    } catch (e) { $app.innerHTML = errorBox(e); }
  }
  const lastName = (n) => { const p = String(n).trim().split(/\s+/); return p[p.length - 1] + ' ' + n; };

  function studentDialog(s) {
    const isNew = !s;
    s = s || { hoTen: '', lop: '', ngaySinh: '', email: '', trangThai: 'HOAT_DONG', pinRieng: false, pin: '' };
    modal(`<h2>${isNew ? 'Thêm học sinh' : 'Sửa thông tin học sinh'}</h2>
      <div class="form-grid"><div class="field" style="grid-column:1/-1"><label>Họ và tên *</label><input id="sName" value="${esc(s.hoTen)}"></div>
        <div class="field"><label>Lớp *</label><input id="sLop" value="${esc(s.lop)}" placeholder="12A1"></div>
        <div class="field"><label>Ngày sinh *</label><input id="sDob" value="${esc(s.ngaySinh)}" placeholder="dd/mm/yyyy"><span class="hint">PIN mặc định = ngày + tháng (05/03 → 0503)</span></div>
        <div class="field"><label>PIN riêng (tùy chọn)</label><input id="sPin" inputmode="numeric" maxlength="4" value="${s.pinRieng ? esc(s.pin) : ''}" placeholder="Để trống = theo ngày sinh"></div>
        <div class="field"><label>Email Google (tùy chọn)</label><input id="sEmail" type="email" value="${esc(s.email)}" placeholder="hocsinh@gmail.com"></div>
        <div class="field"><label>Trạng thái</label><select id="sStatus"><option value="HOAT_DONG">Hoạt động</option><option value="KHOA" ${s.trangThai === 'KHOA' ? 'selected' : ''}>Khóa (không đăng nhập được)</option></select></div></div>
      <div class="modal-actions">${isNew ? '' : '<button class="btn btn-danger" id="sDel" style="margin-right:auto">Xóa học sinh</button>'}
        <button class="btn" data-close="">Hủy</button><button class="btn btn-primary" id="sSave">Lưu</button></div>`, {
      onOpen(m, close) {
        m.querySelector('#sName').focus();
        m.querySelector('#sSave').onclick = (e) => withBusy(e.currentTarget, async () => {
          try {
            const r = await api('adminSaveStudent', { student: { id: s.id, hoTen: m.querySelector('#sName').value, lop: m.querySelector('#sLop').value, ngaySinh: m.querySelector('#sDob').value, pin: m.querySelector('#sPin').value, email: m.querySelector('#sEmail').value, trangThai: m.querySelector('#sStatus').value } });
            close('ok');
            toast((isNew ? 'Đã thêm ' : 'Đã lưu ') + r.hoTen + ' — mã ' + r.id, 'ok');
            viewStudents();
          } catch (err) { toast(err.message, 'err'); }
        });
        const del = m.querySelector('#sDel');
        if (del) del.onclick = async () => {
          close();
          if (!(await confirmBox('Xóa học sinh?', `Xóa <b>${esc(s.hoTen)}</b>? Kết quả đã nộp vẫn còn trong trang KetQua. Nếu chỉ muốn chặn đăng nhập, hãy chọn trạng thái "Khóa".`, 'Xóa', true))) return;
          try { await api('adminDeleteStudent', { id: s.id }); toast('Đã xóa', 'ok'); viewStudents(); } catch (err) { toast(err.message, 'err'); }
        };
      }
    });
  }

  function bulkDialog() {
    modal(`<h2>Nhập danh sách học sinh</h2>
      <p class="small">Bôi đen trong Excel/Google Sheets rồi dán. Mỗi dòng: <b>Họ tên | Lớp | Ngày sinh | Email (tùy chọn)</b>. Dòng tiêu đề sẽ tự bỏ qua. Học sinh trùng (cùng tên, lớp, ngày sinh) sẽ không thêm lại.</p>
      <textarea id="bText" rows="10" placeholder="Nguyễn Văn An	12A1	05/03/2008&#10;Trần Thị Bình	12A1	20/11/2008"></textarea>
      <div id="bInfo" class="small muted" style="margin-top:6px"></div>
      <div class="modal-actions"><button class="btn" data-close="">Hủy</button><button class="btn btn-primary" id="bGo">Thêm</button></div>`, {
      onOpen(m, close) {
        const parse = () => Importer.parseTsv(m.querySelector('#bText').value)
          .map((r) => (r.length === 1 ? r[0].split(/\s*[,;]\s*/) : r))
          .filter((r) => !/h[ọo]\s*t[êe]n/i.test(r[0] || ''))
          .map((r) => ({ hoTen: (r[0] || '').trim(), lop: (r[1] || '').trim(), ngaySinh: (r[2] || '').trim(), email: (r[3] || '').trim() }));
        m.querySelector('#bText').oninput = () => { m.querySelector('#bInfo').textContent = parse().length + ' dòng'; };
        m.querySelector('#bGo').onclick = (e) => withBusy(e.currentTarget, async () => {
          const rows = parse();
          if (!rows.length) return toast('Chưa có dữ liệu', 'err');
          try {
            const r = await api('adminImportStudents', { rows });
            close('ok');
            await modal(`<h2>Đã thêm ${r.added} học sinh</h2>${r.skipped.length ? `<p>Bỏ qua ${r.skipped.length} dòng:</p><div class="notice warn small">${r.skipped.map(esc).join('<br>')}</div>` : ''}<div class="modal-actions"><button class="btn btn-primary" data-close="ok">Đóng</button></div>`);
            viewStudents();
          } catch (err) { toast(err.message, 'err'); }
        });
      }
    });
  }

  function printCards(list) {
    if (!list.length) return toast('Không có học sinh để in', 'err');
    const url = location.href.replace(/admin\.html.*$/, '').replace(/#.*$/, '');
    const w = window.open('', '_blank');
    if (!w) return toast('Trình duyệt chặn cửa sổ in. Hãy cho phép cửa sổ bật lên.', 'err');
    w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu đăng nhập</title><style>
      body{font-family:Arial,sans-serif;margin:16px;color:#000;background:#fff}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .c{border:1px dashed #555;padding:10px;border-radius:6px;break-inside:avoid;font-size:13px}.c b{font-size:15px}.pin{font-size:22px;letter-spacing:4px;font-weight:bold}
      @media print{button{display:none}}</style></head><body><button onclick="print()">In</button><p>Trang làm bài: <b>${esc(url)}</b></p><div class="g">
      ${list.map((s) => `<div class="c"><b>${esc(s.hoTen)}</b><br>Lớp: ${esc(s.lop)}<br>Mã PIN: <span class="pin">${esc(s.pin)}</span><br><small>${esc(url)}</small></div>`).join('')}
      </div></body></html>`);
    w.document.close();
  }

  /* ================= KẾT QUẢ ================= */
  function viewResults() {
    $app.onclick = null;
    const f = store.get('ld_res_filter', { examId: '', lop: '', studentId: '' });
    // Bản lưu chỉ giữ mã/họ tên/lớp của học sinh (không có PIN)
    const load = async () => {
      const [exams, sts, rs] = await Promise.all([api('adminListExams'), getStudents(), api('adminResults', f)]);
      return { exams: exams.map((e) => ({ id: e.id, tieuDe: e.tieuDe })), sts: sts.map((s) => ({ id: s.id, hoTen: s.hoTen, lop: s.lop })), rs };
    };
    return cached('results_' + [f.examId, f.lop, f.studentId].join('_'), load, (d) => renderResults(d, f),
      { skeleton: () => { $app.innerHTML = App.skeletonHtml('table'); } }).catch((e) => { $app.innerHTML = errorBox(e); });
  }

  function renderResults(d, f) {
    const { exams, sts, rs } = d;
    {
      const classes = [...new Set(sts.map((s) => s.lop))].sort();
      const stName = f.studentId ? (sts.find((s) => s.id === f.studentId) || {}).hoTen : '';
      const avg = rs.length ? rs.reduce((a, r) => a + r.diem, 0) / rs.length : null;
      $app.innerHTML = `<div class="card-title"><h1 style="margin:0">Kết quả</h1><div class="row"><button class="btn" id="btnCsv">⬇ Xuất Excel (CSV)</button></div></div>
        <div class="row" style="margin-bottom:12px">
          <select id="rExam" style="width:auto;max-width:320px"><option value="">Tất cả đề</option>${exams.map((e) => `<option value="${esc(e.id)}" ${e.id === f.examId ? 'selected' : ''}>${esc(e.tieuDe)}</option>`).join('')}</select>
          <select id="rLop" style="width:auto"><option value="">Tất cả lớp</option>${classes.map((c) => `<option ${c === f.lop ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          ${stName ? `<span class="badge badge-primary">${esc(stName)} <a href="#" id="rClearSt" aria-label="Bỏ lọc học sinh">✕</a></span>` : ''}</div>
        <div class="stats"><div class="stat"><b>${rs.length}</b><span>Lượt nộp</span></div><div class="stat"><b>${avg == null ? '—' : fmtNum(avg)}</b><span>Điểm trung bình</span></div>
          <div class="stat"><b>${new Set(rs.map((r) => r.studentId)).size}</b><span>Học sinh</span></div></div>
        ${resultsTable(rs, true)}`;
      const upd = (patch) => { store.set('ld_res_filter', Object.assign(f, patch)); App.newView(); viewResults(); };
      document.getElementById('rExam').onchange = (e) => upd({ examId: e.target.value });
      document.getElementById('rLop').onchange = (e) => upd({ lop: e.target.value });
      const cl = document.getElementById('rClearSt');
      if (cl) cl.onclick = (e) => { e.preventDefault(); upd({ studentId: '' }); };
      document.getElementById('btnCsv').onclick = () => App.downloadCsv('ket-qua.csv', [['Nộp lúc', 'Họ tên', 'Lớp', 'Đề', 'Điểm (thang 10)', 'Mục tiêu', 'Đạt mục tiêu', 'Điểm gốc', 'Điểm tối đa', 'Số câu đúng', 'Tổng câu', 'Thời gian làm', 'Ghi chú', 'Nhận xét']]
        .concat(rs.map((r) => [r.nopLuc, r.hoTen, r.lop, r.tieuDe, fmtNum(r.diem), r.mucTieu == null ? '' : fmtNum(r.mucTieu), r.mucTieu == null ? '' : (r.diem >= r.mucTieu ? 'Đạt' : 'Chưa đạt'), fmtNum(r.diemGoc), fmtNum(r.diemToiDa), r.soCauDung, r.tongCau, r.thoiGianLam, r.ghiChu || '', String(r.nhanXet || '').replace(/^\[.\]\s*/gm, '- ')])));
      $app.onclick = async (e) => {
        const d = e.target.closest('[data-del-result]');
        if (!d) return;
        if (!(await confirmBox('Xóa bài làm?', 'Bài làm sẽ bị xóa khỏi trang KetQua và không khôi phục được. Học sinh sẽ được tính lại số lượt làm.', 'Xóa', true))) return;
        try { await api('adminDeleteResult', { resultId: d.dataset.delResult }); toast('Đã xóa', 'ok'); App.newView(); viewResults(); } catch (err) { toast(err.message, 'err'); }
      };
    }
  }

  async function viewResult(id) {
    $app.onclick = null;
    $app.innerHTML = loadingHtml();
    try {
      const v = await api('getResult', { resultId: id });
      $app.innerHTML = App.resultHtml(v, { showName: true, actions: `<div class="row no-print" style="margin-top:12px"><button class="btn" onclick="history.back()">← Quay lại</button><button class="btn" onclick="window.print()">In</button></div>` });
      math($app);
    } catch (e) { $app.innerHTML = errorBox(e); }
  }

  /* ================= BẢNG ĐIỂM ================= */
  async function viewGradebook() {
    $app.onclick = null;
    $app.innerHTML = loadingHtml();
    try {
      const sts = await getStudents();
      const classes = [...new Set(sts.map((s) => s.lop))].sort();
      const lop = store.get('ld_gb_lop', classes[0] || '');
      const d = await api('adminGradebook', { lop });
      $app.innerHTML = `<div class="card-title"><h1 style="margin:0">Bảng điểm</h1><button class="btn" id="btnCsv">⬇ Xuất Excel (CSV)</button></div>
        <div class="row" style="margin-bottom:12px"><label for="gLop">Lớp</label><select id="gLop" style="width:auto"><option value="">Tất cả</option>${classes.map((c) => `<option ${c === lop ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          <span class="muted small">Mỗi ô là điểm cao nhất của học sinh ở đề đó (số nhỏ = số lần làm).</span></div>
        ${d.exams.length ? `<div class="table-wrap"><table class="gb"><thead><tr><th>#</th><th>Họ tên</th><th>Lớp</th>${d.exams.map((e) => `<th class="num" title="${esc(e.tieuDe)}">${esc(e.tieuDe.length > 18 ? e.tieuDe.slice(0, 17) + '…' : e.tieuDe)}</th>`).join('')}<th class="num">TB</th></tr></thead><tbody>
          ${d.rows.map((r, i) => `<tr><td>${i + 1}</td><td class="nowrap">${esc(r.hoTen)}</td><td>${esc(r.lop)}</td>
            ${d.exams.map((e) => { const c = r.scores[e.id]; return `<td class="cell">${c ? `<span class="badge ${App.scoreClass(c.best)}">${fmtNum(c.best)}</span>${c.n > 1 ? `<sub class="muted"> ${c.n}</sub>` : ''}` : '<span class="muted">—</span>'}</td>`; }).join('')}
            <td class="num"><b>${r.tb == null ? '—' : fmtNum(r.tb)}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">Lớp này chưa có kết quả nào.</div>'}`;
      document.getElementById('gLop').onchange = (e) => { store.set('ld_gb_lop', e.target.value); viewGradebook(); };
      document.getElementById('btnCsv').onclick = () => App.downloadCsv(`bang-diem-${lop || 'tat-ca'}.csv`, [['STT', 'Họ tên', 'Lớp'].concat(d.exams.map((e) => e.tieuDe), ['Điểm TB', 'Số đề đã làm'])]
        .concat(d.rows.map((r, i) => [i + 1, r.hoTen, r.lop].concat(d.exams.map((e) => (r.scores[e.id] ? fmtNum(r.scores[e.id].best) : '')), [r.tb == null ? '' : fmtNum(r.tb), r.soDe]))));
    } catch (e) { $app.innerHTML = errorBox(e); }
  }

  /* ================= CÀI ĐẶT ================= */
  const SETTING_UI = {
    TEN_UNG_DUNG: { label: 'Tên trang web' },
    TEN_GIAO_VIEN: { label: 'Tên giáo viên' },
    HIEN_BANG_XEP_HANG: { label: 'Bảng xếp hạng cho học sinh', yesno: ['Hiện', 'Ẩn'] },
    BXH_AN_TEN: { label: 'Tên trên bảng xếp hạng', yesno: ['Viết tắt (Nguyễn V. An)', 'Đầy đủ'] },
    GUI_EMAIL_KHI_NOP: { label: 'Gửi email cho giáo viên mỗi khi có bài nộp', yesno: ['Có', 'Không'] },
    EMAIL_GIAO_VIEN: { label: 'Email Google của giáo viên', hint: 'Dùng để đăng nhập trang quản trị bằng Google và nhận email báo kết quả. Nhiều email cách nhau dấu phẩy.' },
    CHO_LIEN_KET_GOOGLE: { label: 'Học sinh tự liên kết Google (xác minh bằng PIN)', yesno: ['Cho phép', 'Không'] },
    GOOGLE_CLIENT_ID: { label: 'Google OAuth Client ID', hint: 'Để trống = tắt đăng nhập Google. Cách lấy: xem README, mục "Bật đăng nhập Google".' },
    KHO_CAU_HOI_ID: { label: 'Kho câu hỏi (id hoặc link file "KHO CÂU HỎI VẬT LÝ")', hint: 'Dán link Google Sheet của kho. Web chỉ đọc kho, không sửa.', wide: true, bank: true },
    THU_MUC_HINH_KHO_ID: { label: 'Thư mục hình của kho (id hoặc link thư mục "02. HÌNH VẼ")', hint: 'Để trống thì tìm hình theo tên file trên toàn Drive (chậm hơn).', wide: true, bank: true },
    CHO_LUYEN_TAP: { label: 'Mục Luyện tập cho học sinh', yesno: ['Bật', 'Tắt'], feat: 'practice', hint: 'Học sinh chỉ luyện các câu trong "Pool luyện tập" (tab Ngân hàng).' },
    LUYEN_NHANH: { label: 'Đề nhanh theo bài (P1, P2, P3, phút)', feat: 'practice', hint: 'Mặc định 7,1,2,10: 7 câu Phần I, 1 câu Phần II, 2 câu Phần III, 10 phút.' }
  };

  async function viewSettings() {
    $app.onclick = null;
    $app.innerHTML = loadingHtml();
    try {
      const rows = await api('adminGetSettings');
      const ov = await api('adminOverview');
      const val = {};
      rows.forEach((r) => { val[r.khoa] = r.giaTri; });
      const yes = (v) => ['CO', 'CÓ', 'TRUE', '1'].includes(String(v).toUpperCase());
      $app.innerHTML = `<h1>Cài đặt</h1>
        <div class="card"><h2>Chung</h2><div class="form-grid">
          ${Object.keys(SETTING_UI).filter((k) => (!SETTING_UI[k].bank || k in val || App.has('bank')) && (!SETTING_UI[k].feat || k in val || App.has(SETTING_UI[k].feat))).map((k) => {
            const u = SETTING_UI[k];
            const input = u.yesno ? `<select data-k="${k}"><option value="CO">${u.yesno[0]}</option><option value="KHONG" ${yes(val[k]) ? '' : 'selected'}>${u.yesno[1]}</option></select>`
              : `<input data-k="${k}" value="${esc(val[k] || '')}">`;
            return `<div class="field" ${k === 'GOOGLE_CLIENT_ID' || k === 'EMAIL_GIAO_VIEN' || u.wide ? 'style="grid-column:1/-1"' : ''}><label>${u.label}</label>${input}${u.hint ? `<span class="hint">${u.hint}</span>` : ''}</div>`;
          }).join('')}</div>
          <button class="btn btn-primary" id="btnSaveSet">Lưu cài đặt</button></div>
        <div class="card"><h2>Đổi mật khẩu quản trị</h2><div class="form-grid"><div class="field"><label>Mật khẩu mới</label><input id="newPw" type="password" autocomplete="new-password" minlength="6"></div>
          <div class="field"><label>Nhập lại</label><input id="newPw2" type="password" autocomplete="new-password"></div></div>
          <button class="btn" id="btnPw">Đổi mật khẩu</button></div>
        <div class="card"><h2>Dữ liệu</h2><p>Toàn bộ dữ liệu (học sinh, đề, câu hỏi, kết quả) nằm trong file Google Sheet của bạn. Có thể mở trực tiếp để xem, lọc, sắp xếp hoặc tải về Excel (Tệp → Tải xuống).</p>
          <a class="btn" href="${esc(ov.sheetUrl)}" target="_blank" rel="noopener">Mở Google Sheet ↗</a> <span class="muted small">Phiên bản máy chủ ${esc(ov.version)}</span></div>`;
      document.getElementById('btnSaveSet').onclick = (e) => withBusy(e.currentTarget, async () => {
        const settings = {};
        $app.querySelectorAll('[data-k]').forEach((el) => { settings[el.dataset.k] = el.value; });
        try { await api('adminSaveSettings', { settings }); bankMeta = null; store.del('ld_pub'); store.del('ld_pub_t'); toast('Đã lưu cài đặt', 'ok'); } catch (err) { toast(err.message, 'err'); }
      });
      document.getElementById('btnPw').onclick = (e) => withBusy(e.currentTarget, async () => {
        const a = document.getElementById('newPw').value, b = document.getElementById('newPw2').value;
        if (a.length < 6) return toast('Mật khẩu cần ít nhất 6 kí tự', 'err');
        if (a !== b) return toast('Hai lần nhập không khớp', 'err');
        try { await api('adminSaveSettings', { settings: { MAT_KHAU_QUAN_TRI: a } }); toast('Đã đổi mật khẩu', 'ok'); document.getElementById('newPw').value = document.getElementById('newPw2').value = ''; } catch (err) { toast(err.message, 'err'); }
      });
    } catch (e) { $app.innerHTML = errorBox(e); }
  }

  boot();
})();
