/* Trang quản trị giáo viên */
(function () {
  'use strict';
  const { api, esc, fmtNum, rich, math, toast, modal, confirmBox, loadingHtml, withBusy, store } = App;
  App.tokenKey = 'ld_admin_token';
  const $app = document.getElementById('app');
  let me = store.get('ld_admin_user', null);
  let pub = store.get('ld_pub', {});
  let studentsCache = null;

  App.setAuthErrorHandler((msg) => { logout(true); toast(msg, 'err'); });

  const STATUS = { NHAP: 'Bản nháp', MO: 'Đang mở', DONG: 'Đã đóng' };
  const REVEAL = { NGAY: 'Ngay sau khi nộp', SAU_HAN: 'Sau khi đề đóng / hết hạn', KHONG: 'Không hiện' };

  function boot() {
    if (!App.CFG.API_URL) {
      $app.innerHTML = `<div class="card narrow"><h1>Chưa kết nối máy chủ</h1><p>Mở file <code>assets/js/config.js</code> và dán URL ứng dụng web Apps Script vào <code>API_URL</code>. Xem README để biết cách cài.</p></div>`;
      return;
    }
    api('publicConfig', {}, { tokenKey: false }).then((p) => { pub = p; store.set('ld_pub', p); }).catch(() => {});
    window.addEventListener('hashchange', route);
    window.addEventListener('beforeunload', (e) => { if (editorDirty) { e.preventDefault(); e.returnValue = ''; } });
    route();
  }

  function logout(silent) {
    store.del('ld_admin_token'); store.del('ld_admin_user');
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
    if (pub.googleClientId) showG(pub);
    else api('publicConfig', {}, { tokenKey: false }).then((p) => { pub = p; showG(p); }).catch(() => {});
    function done(r) {
      store.set('ld_admin_token', r.token);
      store.set('ld_admin_user', r.user);
      me = r.user;
      route();
    }
  }

  /* ================= TỔNG QUAN ================= */
  async function viewHome() {
    $app.innerHTML = loadingHtml();
    try {
      const d = await api('adminOverview');
      $app.innerHTML = `<div class="card-title"><h1 style="margin:0">Tổng quan</h1>
          <div class="row"><a class="btn btn-primary" href="#/de-thi/moi">+ Tạo đề mới</a><a class="btn" href="${esc(d.sheetUrl)}" target="_blank" rel="noopener">Mở Google Sheet ↗</a></div></div>
        ${d.googleReady ? '' : '<div class="notice" style="margin-bottom:16px">Đăng nhập Google chưa bật — học sinh đang dùng mã PIN. Muốn bật, xem mục <a href="#/cai-dat">Cài đặt</a>.</div>'}
        <div class="stats">
          <div class="stat"><b>${d.counts.students}</b><span>Học sinh</span></div>
          <div class="stat"><b>${d.counts.openExams}/${d.counts.exams}</b><span>Đề đang mở / tổng</span></div>
          <div class="stat"><b>${d.counts.results}</b><span>Lượt nộp bài</span></div>
          <div class="stat"><b>${d.counts.today}</b><span>Bài nộp hôm nay</span></div>
          <div class="stat"><b>${d.avg == null ? '—' : fmtNum(d.avg)}</b><span>Điểm TB toàn bộ</span></div></div>
        <div class="card-title"><h2 style="margin:0">Bài nộp mới nhất</h2><a href="#/ket-qua">Xem tất cả →</a></div>
        ${resultsTable(d.recent, false)}`;
    } catch (e) { $app.innerHTML = errorBox(e); }
  }

  function resultsTable(rs, withDelete) {
    if (!rs.length) return '<div class="card empty">Chưa có bài nộp nào.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>Nộp lúc</th><th>Họ tên</th><th>Lớp</th><th>Đề</th><th class="num">Điểm</th><th class="num">Đúng</th><th>Thời gian</th><th></th></tr></thead><tbody>
      ${rs.map((r) => `<tr><td class="nowrap">${esc(r.nopLuc)}</td><td>${esc(r.hoTen)}</td><td>${esc(r.lop)}</td><td>${esc(r.tieuDe)}</td>
        <td class="num"><span class="badge ${App.scoreClass(r.diem)}">${fmtNum(r.diem)}</span></td><td class="num">${r.soCauDung}/${r.tongCau}</td>
        <td class="nowrap">${esc(r.thoiGianLam)}${r.ghiChu ? `<br><span class="badge badge-bad">${esc(r.ghiChu)}</span>` : ''}</td>
        <td class="nowrap"><a class="btn btn-sm" href="#/ket-qua/xem/${encodeURIComponent(r.id)}">Xem</a>
        ${withDelete ? `<button class="btn btn-sm btn-danger" data-del-result="${esc(r.id)}">Xóa</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`;
  }

  /* ================= ĐỀ THI ================= */
  async function viewExams() {
    $app.innerHTML = loadingHtml();
    try {
      const list = await api('adminListExams');
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
    } catch (e) { $app.innerHTML = errorBox(e); }
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
    if (!qs.length) qs = [blankQ('TN')];

    $app.innerHTML = `<div class="card-title"><h1 style="margin:0">${examId ? 'Sửa đề' : 'Tạo đề mới'}</h1><a href="#/de-thi">← Danh sách đề</a></div>
      ${hasResults ? '<div class="notice warn" style="margin-bottom:12px">Đề này đã có học sinh nộp bài. Sửa đáp án sẽ <b>không</b> chấm lại các bài cũ.</div>' : ''}
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
      const opt = (k, label) => `<div class="field"><label>${label}</label><textarea rows="1" data-f="${k}" data-i="${i}">${esc(q[k])}</textarea></div>`;
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
      return `<div class="qedit" data-q="${i}">
        <div class="qedit-head"><span class="q-num">Câu ${i + 1}</span>
          <select data-f="loai" data-i="${i}" aria-label="Loại câu">${Object.keys(App.TYPES).map((k) => `<option value="${k}" ${q.loai === k ? 'selected' : ''}>${App.TYPES[k]}</option>`).join('')}</select>
          <select data-f="phan" data-i="${i}" aria-label="Phần"><option value="1" ${q.phan == 1 ? 'selected' : ''}>Phần I</option><option value="2" ${q.phan == 2 ? 'selected' : ''}>Phần II</option><option value="3" ${q.phan == 3 ? 'selected' : ''}>Phần III</option></select>
          <span class="spacer"></span>
          <button class="btn btn-sm" data-move="-1" data-i="${i}" title="Lên">↑</button><button class="btn btn-sm" data-move="1" data-i="${i}" title="Xuống">↓</button>
          <button class="btn btn-sm" data-dup="${i}" title="Nhân bản">⧉</button><button class="btn btn-sm btn-danger" data-rm="${i}" title="Xóa câu">✕</button></div>
        <div class="field"><label>Nội dung câu hỏi</label><textarea data-f="noiDung" data-i="${i}" rows="3">${esc(q.noiDung)}</textarea></div>
        <div class="row" style="margin-bottom:10px"><input data-f="hinhAnh" data-i="${i}" value="${esc(q.hinhAnh)}" placeholder="Hình ảnh: dán link ảnh hoặc bấm Tải ảnh" style="flex:1;min-width:200px">
          <label class="btn btn-sm">📷 Tải ảnh<input type="file" accept="image/*" data-upload="${i}" class="hidden"></label></div>
        ${optsHtml}${ans}
        <div class="form-grid"><div class="field"><label>Chủ đề</label><input data-f="chuDe" data-i="${i}" value="${esc(q.chuDe)}" list="topicList" placeholder="VD: Khí lí tưởng"></div>
          <div class="field"><label>Mức độ</label><select data-f="mucDo" data-i="${i}"><option value="">—</option>${Object.keys(App.LEVELS).map((k) => `<option value="${k}" ${q.mucDo === k ? 'selected' : ''}>${App.LEVELS[k]}</option>`).join('')}</select></div>
          <div class="field"><label>Điểm</label><input data-f="diem" data-i="${i}" value="${esc(q.diem)}" placeholder="${q.loai === 'DS' ? '1' : '0,25'}"></div></div>
        <div class="field"><label>Lời giải</label><textarea data-f="loiGiai" data-i="${i}" rows="2">${esc(q.loiGiai)}</textarea></div>
        <details><summary class="small muted">Xem trước</summary><div class="preview" id="pv-${i}">${previewHtml(q)}</div></details></div>`;
    }

    function previewHtml(q) {
      let h = `<div>${rich(q.noiDung)}</div>${q.hinhAnh ? `<img class="q-img" src="${esc(q.hinhAnh)}" alt="">` : ''}`;
      if (q.loai !== 'TL') h += ['A', 'B', 'C', 'D'].map((k, j) => `<div><b>${q.loai === 'DS' ? 'abcd'[j] + ')' : k + '.'}</b> ${rich(q[k])}</div>`).join('');
      if (q.loiGiai) h += `<div class="solution">${rich(q.loiGiai)}</div>`;
      return h;
    }

    let pvTimer;
    qList.addEventListener('input', (e) => {
      const el = e.target.closest('[data-f]');
      if (!el) return;
      const i = +el.dataset.i, f = el.dataset.f;
      qs[i][f] = f === 'phan' ? +el.value : el.value;
      markDirty();
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
        if (!examId) history.replaceState(null, '', '#/de-thi/sua/' + encodeURIComponent(r.id));
      } catch (err) {
        toast(err.message, 'err');
        const m = err.message.match(/^Câu (\d+)/);
        if (m) { const el = qList.querySelectorAll('.qedit')[+m[1] - 1]; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }
    });

    renderQs();
    const tl = document.createElement('datalist');
    tl.id = 'topicList';
    tl.innerHTML = ['Vật lí nhiệt', 'Khí lí tưởng', 'Từ trường', 'Vật lí hạt nhân', 'Dao động', 'Sóng', 'Điện trường', 'Dòng điện', 'Cảm ứng điện từ', 'Động học', 'Động lực học', 'Năng lượng']
      .concat([...new Set(qs.map((q) => q.chuDe).filter(Boolean))]).map((t) => `<option value="${esc(t)}">`).join('');
    $app.appendChild(tl);
  }

  function shrinkImage(file) {
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
          if (scale === 1 && file.size < 900 * 1024) return resolve({ base64: url, mime: file.type });
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

  function importDialog(onDone) {
    modal(`<h2>Nhập nhanh câu hỏi</h2>
      <div class="tabs" id="impTabs"><button class="active" data-t="text">Dán văn bản (Word)</button><button data-t="tsv">Dán từ Excel / Sheets</button></div>
      <div id="impHelp" class="notice small"></div>
      <div class="field" style="margin-top:10px"><textarea id="impText" rows="12" placeholder="Dán nội dung vào đây…"></textarea></div>
      <div id="impResult" class="small"></div>
      <div class="modal-actions"><button class="btn" data-close="">Hủy</button><button class="btn" id="impCheck">Kiểm tra</button>
        <button class="btn" id="impReplace" disabled>Thay toàn bộ câu hiện có</button><button class="btn btn-primary" id="impAdd" disabled>Thêm vào đề</button></div>`, {
      wide: true,
      onOpen(m, close) {
        let mode = 'text', parsed = null;
        const help = {
          text: `Mỗi câu bắt đầu bằng <b>Câu 1.</b>, <b>Câu 2:</b>… Các dòng <b>PHẦN I / II / III</b> tự xác định dạng câu.
            Phương án <b>A. B. C. D.</b> (cùng dòng hoặc mỗi dòng một phương án; viết <b>*B.</b> để đánh dấu đáp án đúng).
            Đúng/Sai dùng <b>a) b) c) d)</b>, ghi <b>(Đ)</b>/<b>(S)</b> cuối mỗi ý. Có thể thêm dòng <b>Đáp án: …</b>, <b>Lời giải: …</b>,
            hoặc <b>BẢNG ĐÁP ÁN</b> ở cuối (1.B 2.C …). Công thức Word nên đổi sang dạng $…$ (LaTeX) trước khi dán.`,
          tsv: `Bôi đen các ô trong Excel/Google Sheets rồi dán. Thứ tự cột: <b>Loại | Nội dung | A | B | C | D | Đáp án | Chủ đề | Mức độ | Lời giải | Điểm | Sai số | Hình ảnh</b>.
            Loại: TN / DS / TL (để trống sẽ tự đoán). Đáp án Đúng/Sai dạng ĐSĐS. Nếu có dòng tiêu đề, hệ thống tự nhận cột theo tên.`
        };
        const setMode = (t) => {
          mode = t; parsed = null;
          m.querySelectorAll('#impTabs button').forEach((b) => b.classList.toggle('active', b.dataset.t === t));
          m.querySelector('#impHelp').innerHTML = help[t];
          m.querySelector('#impResult').innerHTML = '';
          m.querySelector('#impAdd').disabled = m.querySelector('#impReplace').disabled = true;
        };
        setMode('text');
        m.querySelector('#impTabs').onclick = (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.t); };
        m.querySelector('#impText').oninput = () => { parsed = null; m.querySelector('#impAdd').disabled = m.querySelector('#impReplace').disabled = true; };
        m.querySelector('#impCheck').onclick = () => {
          const txt = m.querySelector('#impText').value;
          parsed = mode === 'text' ? Importer.fromText(txt) : Importer.fromTsv(txt);
          const cnt = { TN: 0, DS: 0, TL: 0 };
          parsed.questions.forEach((q) => { cnt[q.loai] = (cnt[q.loai] || 0) + 1; });
          m.querySelector('#impResult').innerHTML = `<p>Tìm thấy <b>${parsed.questions.length}</b> câu: ${cnt.TN} trắc nghiệm, ${cnt.DS} đúng/sai, ${cnt.TL} trả lời ngắn.</p>
            ${parsed.warnings.length ? `<div class="notice warn">${parsed.warnings.map(esc).join('<br>')}</div>` : ''}
            ${parsed.questions.length ? `<div class="table-wrap" style="max-height:220px;overflow:auto;margin-top:8px"><table><thead><tr><th>#</th><th>Loại</th><th>Nội dung</th><th>Đáp án</th></tr></thead><tbody>
            ${parsed.questions.map((q, i) => `<tr><td>${i + 1}</td><td>${App.TYPES[q.loai]}</td><td>${esc(String(q.noiDung).slice(0, 90))}</td><td>${esc(q.dapAn || '—')}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
          m.querySelector('#impAdd').disabled = m.querySelector('#impReplace').disabled = !parsed.questions.length;
        };
        m.querySelector('#impAdd').onclick = () => { onDone(parsed.questions, false); close('ok'); };
        m.querySelector('#impReplace').onclick = () => { onDone(parsed.questions, true); close('ok'); };
      }
    });
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
          <div class="stat"><b>${s.passRate}%</b><span>Đạt từ 5 điểm</span></div></div>
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
      document.getElementById('btnCsv').onclick = () => App.downloadCsv(`ket-qua-${examId}.csv`, [['STT', 'Họ tên', 'Lớp', 'Điểm (thang 10)', 'Điểm gốc', 'Số câu đúng', 'Tổng câu', 'Thời gian làm', 'Nộp lúc', 'Ghi chú']]
        .concat(s.results.map((r, i) => [i + 1, r.hoTen, r.lop, fmtNum(r.diem), fmtNum(r.diemGoc), r.soCauDung, r.tongCau, r.thoiGianLam, r.nopLuc, r.ghiChu || ''])));
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
  async function viewResults() {
    $app.onclick = null;
    $app.innerHTML = loadingHtml();
    try {
      const f = store.get('ld_res_filter', { examId: '', lop: '', studentId: '' });
      const [exams, sts, rs] = await Promise.all([api('adminListExams'), getStudents(), api('adminResults', f)]);
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
      const upd = (patch) => { store.set('ld_res_filter', Object.assign(f, patch)); viewResults(); };
      document.getElementById('rExam').onchange = (e) => upd({ examId: e.target.value });
      document.getElementById('rLop').onchange = (e) => upd({ lop: e.target.value });
      const cl = document.getElementById('rClearSt');
      if (cl) cl.onclick = (e) => { e.preventDefault(); upd({ studentId: '' }); };
      document.getElementById('btnCsv').onclick = () => App.downloadCsv('ket-qua.csv', [['Nộp lúc', 'Họ tên', 'Lớp', 'Đề', 'Điểm (thang 10)', 'Điểm gốc', 'Điểm tối đa', 'Số câu đúng', 'Tổng câu', 'Thời gian làm', 'Ghi chú', 'Nhận xét']]
        .concat(rs.map((r) => [r.nopLuc, r.hoTen, r.lop, r.tieuDe, fmtNum(r.diem), fmtNum(r.diemGoc), fmtNum(r.diemToiDa), r.soCauDung, r.tongCau, r.thoiGianLam, r.ghiChu || '', String(r.nhanXet || '').replace(/^\[.\]\s*/gm, '- ')])));
      $app.onclick = async (e) => {
        const d = e.target.closest('[data-del-result]');
        if (!d) return;
        if (!(await confirmBox('Xóa bài làm?', 'Bài làm sẽ bị xóa khỏi trang KetQua và không khôi phục được. Học sinh sẽ được tính lại số lượt làm.', 'Xóa', true))) return;
        try { await api('adminDeleteResult', { resultId: d.dataset.delResult }); toast('Đã xóa', 'ok'); viewResults(); } catch (err) { toast(err.message, 'err'); }
      };
    } catch (e) { $app.innerHTML = errorBox(e); }
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
    GOOGLE_CLIENT_ID: { label: 'Google OAuth Client ID', hint: 'Để trống = tắt đăng nhập Google. Cách lấy: xem README, mục "Bật đăng nhập Google".' }
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
          ${Object.keys(SETTING_UI).map((k) => {
            const u = SETTING_UI[k];
            const input = u.yesno ? `<select data-k="${k}"><option value="CO">${u.yesno[0]}</option><option value="KHONG" ${yes(val[k]) ? '' : 'selected'}>${u.yesno[1]}</option></select>`
              : `<input data-k="${k}" value="${esc(val[k] || '')}">`;
            return `<div class="field" ${k === 'GOOGLE_CLIENT_ID' || k === 'EMAIL_GIAO_VIEN' ? 'style="grid-column:1/-1"' : ''}><label>${u.label}</label>${input}${u.hint ? `<span class="hint">${u.hint}</span>` : ''}</div>`;
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
        try { await api('adminSaveSettings', { settings }); store.del('ld_pub'); toast('Đã lưu cài đặt', 'ok'); } catch (err) { toast(err.message, 'err'); }
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
