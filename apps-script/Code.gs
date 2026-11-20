/**
 * WEB LUYỆN ĐỀ VẬT LÝ — MÁY CHỦ (Google Apps Script + Google Sheets)
 *
 * Cách cài đặt: xem README.md, mục "Bước 1 — Cài máy chủ".
 * Tóm tắt: tạo 1 Google Sheet mới → Tiện ích mở rộng → Apps Script → dán toàn bộ file này
 * → chạy hàm setup() → Triển khai → Ứng dụng web (Execute as: Me, Who has access: Anyone).
 *
 * Mọi dữ liệu nằm trong file Google Sheet:
 *   HocSinh  — danh sách học sinh (mã, họ tên, lớp, ngày sinh → PIN, email Google)
 *   DeThi    — thông tin các đề
 *   CauHoi   — câu hỏi + đáp án + lời giải (KHÔNG bao giờ gửi đáp án cho học sinh trước khi nộp)
 *   KetQua   — mỗi lần nộp bài là 1 dòng: họ tên, lớp, đề, điểm, thời gian, nhận xét…
 *   CaiDat   — cài đặt (mật khẩu quản trị, email giáo viên, Google Client ID, id kho câu hỏi…)
 *   LuyenTap       — pool luyện tập (Pha 4): câu chép từ kho, cột "Bật" CO/KHONG; không bao giờ xóa hàng
 *   KetQuaLuyenTap — mỗi bài luyện tập nộp là 1 dòng (không vào bảng xếp hạng / bảng điểm)
 *
 * Ngân hàng câu hỏi (Pha 2) nằm ở file Google Sheet RIÊNG "KHO CÂU HỎI VẬT LÝ" (id trong CaiDat → KHO_CAU_HOI_ID).
 * Máy chủ chỉ ĐỌC kho và thư mục hình của kho; câu được chọn được chép sang CauHoi, hình được chép sang thư mục web.
 */

var APP_VERSION = '1.5.0';
/** Tính năng máy chủ này hỗ trợ. Giao diện bật/tắt nút theo danh sách này (không so số phiên bản). */
var FEATURES = ['changePin', 'goal', 'bootstrap', 'cache', 'bank', 'practice'];
var TZ = 'Asia/Ho_Chi_Minh';

var SCHEMA = {
  HocSinh: [
    ['id', 'Mã HS'], ['hoTen', 'Họ tên'], ['lop', 'Lớp'], ['ngaySinh', 'Ngày sinh'],
    ['pin', 'PIN riêng'], ['email', 'Email Google'], ['trangThai', 'Trạng thái'], ['ngayTao', 'Ngày tạo']
  ],
  DeThi: [
    ['id', 'Mã đề'], ['tieuDe', 'Tên đề'], ['lop', 'Dành cho lớp'], ['moTa', 'Mô tả'],
    ['thoiGian', 'Thời gian (phút)'], ['trangThai', 'Trạng thái'], ['batDau', 'Mở lúc'], ['ketThuc', 'Đóng lúc'],
    ['soLanLam', 'Số lần làm tối đa'], ['hienLoiGiai', 'Hiện lời giải'], ['tronCau', 'Trộn câu'],
    ['ngayTao', 'Ngày tạo'], ['capNhat', 'Cập nhật']
  ],
  CauHoi: [
    ['examId', 'Mã đề'], ['stt', 'STT'], ['phan', 'Phần'], ['loai', 'Loại'], ['noiDung', 'Nội dung'],
    ['hinhAnh', 'Hình ảnh'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D'], ['dapAn', 'Đáp án'],
    ['diem', 'Điểm'], ['saiSo', 'Sai số'], ['chuDe', 'Chủ đề'], ['mucDo', 'Mức độ'], ['loiGiai', 'Lời giải'],
    // Pha 2: thêm ở cuối (câu nhập tay để trống)
    ['maKho', 'Mã câu kho'], ['chuong', 'Chương'], ['bai', 'Bài'], ['mucDoY', 'Mức độ từng ý'], ['nguon', 'Nguồn']
  ],
  KetQua: [
    ['nopLuc', 'Nộp lúc'], ['hoTen', 'Họ tên'], ['lop', 'Lớp'], ['tieuDe', 'Đề'],
    ['diem', 'Điểm (thang 10)'], ['mucTieu', 'Mục tiêu'], ['diemGoc', 'Điểm gốc'], ['diemToiDa', 'Điểm tối đa'],
    ['soCauDung', 'Số câu đúng'], ['tongCau', 'Tổng số câu'], ['thoiGianLam', 'Thời gian làm'],
    ['nhanXet', 'Nhận xét'], ['id', 'Mã bài'], ['studentId', 'Mã HS'], ['examId', 'Mã đề'],
    ['batDauLuc', 'Bắt đầu lúc'], ['thoiGianGiay', 'Số giây'], ['ghiChu', 'Ghi chú'], ['chiTiet', 'Chi tiết (JSON)']
  ],
  CaiDat: [['khoa', 'Khóa'], ['giaTri', 'Giá trị'], ['ghiChu', 'Ghi chú']],
  // Pha 4: hai trang tính mới (setup() tạo; lần ghi đầu cũng tự tạo)
  LuyenTap: [
    ['maKho', 'Mã câu kho'], ['lop', 'Lớp'], ['chuong', 'Chương'], ['bai', 'Bài'], ['loai', 'Loại'], ['phan', 'Phần'],
    ['mucDo', 'Mức độ'], ['noiDung', 'Nội dung'], ['hinhAnh', 'Hình ảnh'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D'],
    ['dapAn', 'Đáp án'], ['saiSo', 'Sai số'], ['loiGiai', 'Lời giải'], ['bat', 'Bật'], ['capNhat', 'Cập nhật']
  ],
  KetQuaLuyenTap: [
    ['nopLuc', 'Nộp lúc'], ['hoTen', 'Họ tên'], ['lop', 'Lớp'], ['tieuDe', 'Đề'],
    ['diem', 'Điểm (thang 10)'], ['mucTieu', 'Mục tiêu'], ['diemGoc', 'Điểm gốc'], ['diemToiDa', 'Điểm tối đa'],
    ['soCauDung', 'Số câu đúng'], ['tongCau', 'Tổng số câu'], ['thoiGianLam', 'Thời gian làm'],
    ['nhanXet', 'Nhận xét'], ['id', 'Mã bài'], ['studentId', 'Mã HS'], ['examId', 'Mã đề'],
    ['batDauLuc', 'Bắt đầu lúc'], ['thoiGianGiay', 'Số giây'], ['ghiChu', 'Ghi chú'], ['chiTiet', 'Chi tiết (JSON)'],
    ['kieu', 'Kiểu']
  ]
};
/** Trang tính có thể chưa có trên Sheet cũ: đọc thì coi như rỗng, ghi lần đầu thì tự tạo (00-quy-trinh §6.3). */
var OPTIONAL_SHEETS = ['LuyenTap', 'KetQuaLuyenTap'];
/** Định dạng số của trang kết quả (setup và lần tạo tự động áp như nhau cho KetQua và KetQuaLuyenTap). */
var RESULT_NUMBER_FORMATS = [['diem', '0.00'], ['diemGoc', '0.00'], ['diemToiDa', '0.00'], ['soCauDung', '0'], ['tongCau', '0'], ['thoiGianGiay', '0']];

var DEFAULT_SETTINGS = [
  ['TEN_UNG_DUNG', 'Luyện đề Vật lý', 'Tên hiển thị trên web'],
  ['TEN_GIAO_VIEN', '', 'Tên giáo viên (chỉ dùng nội bộ, không hiển thị trên trang học sinh)'],
  ['GOOGLE_CLIENT_ID', '', 'OAuth Client ID để đăng nhập bằng Google (xem README). Để trống = tắt đăng nhập Google'],
  ['EMAIL_GIAO_VIEN', '', 'Email Google được vào trang quản trị (nhiều email cách nhau dấu phẩy)'],
  ['MAT_KHAU_QUAN_TRI', function () { return randomPassword_(); }, 'Mật khẩu vào trang quản trị (luôn dùng được, kể cả khi chưa cài Google)'],
  ['HIEN_BANG_XEP_HANG', 'CO', 'CO = học sinh xem được bảng xếp hạng; KHONG = ẩn'],
  ['BXH_AN_TEN', 'KHONG', 'CO = bảng xếp hạng chỉ hiện tên viết tắt (VD: Nguyễn V. A)'],
  ['GUI_EMAIL_KHI_NOP', 'KHONG', 'CO = gửi email báo kết quả cho giáo viên mỗi khi có bài nộp'],
  ['CHO_LIEN_KET_GOOGLE', 'CO', 'CO = học sinh tự liên kết tài khoản Google (sau khi xác minh bằng PIN)'],
  ['KHO_CAU_HOI_ID', '', 'Id (hoặc đường link) file Google Sheet "KHO CÂU HỎI VẬT LÝ". Để trống = tắt Ngân hàng câu hỏi'],
  ['THU_MUC_HINH_KHO_ID', '', 'Id (hoặc link) thư mục "02. HÌNH VẼ" của kho. Để trống = tìm hình theo tên file trên toàn Drive (chậm hơn)'],
  ['CHO_LUYEN_TAP', 'KHONG', 'CO = học sinh dùng được mục Luyện tập (câu trong trang tính LuyenTap); KHONG = tắt'],
  ['LUYEN_NHANH', '7,1,2,10', 'Đề nhanh theo bài: số câu Phần I, Phần II, Phần III, số phút']
];

var TEXT_SHEETS = ['HocSinh', 'DeThi', 'CauHoi', 'CaiDat'];
var MAX_FAIL = 5;            // số lần nhập sai PIN/mật khẩu trước khi bị khóa tạm
var LOCK_SECONDS = 600;      // khóa 10 phút
var GRACE_SECONDS = 120;     // cho phép nộp trễ tối đa 2 phút so với giờ làm bài
var CACHE_SECONDS = 60;      // máy chủ nhớ tạm dữ liệu trang tính 60 giây (QUYET-DINH §7)
var CACHE_CHUNK_BYTES = 90000;   // mỗi mảnh đệm ≤ 90 000 byte (CacheService giới hạn 100 KB/khóa)
var CACHE_MAX_BYTES = 900000;    // bảng lớn hơn ~900 KB thì không đệm
var GEN_SECONDS = 21600;         // khóa thế hệ tbgen_* sống tối đa 6 giờ

/* =====================================================================
 *  CÀI ĐẶT BAN ĐẦU
 * ===================================================================== */

/** Chạy hàm này MỘT LẦN sau khi dán code (nút ▶ Chạy). Chạy lại cũng không mất dữ liệu. */
function setup() {
  var ss = ss_();
  bumpAllGens_();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    var labels = SCHEMA[name].map(function (d) { return d[1]; });
    var lastCol = Math.max(sh.getLastColumn(), 1);
    var cur = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    if (cur.every(function (c) { return c === ''; })) {
      sh.getRange(1, 1, 1, labels.length).setValues([labels]);
    } else {
      var missing = labels.filter(function (l) { return cur.indexOf(l) < 0; });
      if (missing.length) sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
    }
    var nCol = sh.getLastColumn();
    var maxRows = sh.getMaxRows();
    sh.getRange(1, 1, 1, nCol).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, maxRows, nCol).setNumberFormat('@');
    if (name === 'KetQua' || name === 'KetQuaLuyenTap') applyResultFormats_(sh, name);
  });
  var have = readTable_('CaiDat').map(function (r) { return r.khoa; });
  var add = DEFAULT_SETTINGS.filter(function (s) { return have.indexOf(s[0]) < 0; }).map(function (s) {
    return { khoa: s[0], giaTri: typeof s[1] === 'function' ? s[1]() : s[1], ghiChu: s[2] };
  });
  appendRows_('CaiDat', add);
  secret_();
  if (!readTable_('HocSinh').length) seedStudents_();
  if (!readTable_('DeThi').length) seedExam_();
  ['Sheet1', 'Trang tính1', 'Trang tính 1'].forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  bumpAllGens_();
  var pw = getSetting_('MAT_KHAU_QUAN_TRI');
  Logger.log('✅ Cài đặt xong! Mật khẩu trang quản trị: ' + pw + '  (xem/đổi ở trang tính CaiDat)');
  return 'OK';
}

/**
 * Chạy tay trong trình soạn Apps Script SAU khi triển khai (chọn hàm này → ▶ Chạy → xem "Nhật ký thực thi").
 * Chỉ ĐỌC: không sửa trang tính, kho hay Drive. Việc ghi duy nhất là 1 khóa thử trong CacheService (xóa ngay sau đó).
 * Không in mật khẩu, PIN hay id file.
 */
function kiemTraSauTrienKhai() {
  var dong = [], soLoi = 0, soCanhBao = 0;
  var ok = function (m) { dong.push('✅ ' + m); };
  var canhBao = function (m) { soCanhBao++; dong.push('⚠️ ' + m); };
  var loi = function (m) { soLoi++; dong.push('❌ ' + m); };
  var msg = function (e) { return String(e && e.message || e); };
  MEMO_ = {};
  ok('Phiên bản máy chủ: ' + APP_VERSION + ' · tính năng: ' + FEATURES.join(', '));

  // 1. Trang tính và cột tiêu đề (đọc hàng tiêu đề, không thêm gì)
  var ss = ss_();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { loi('Thiếu trang tính "' + name + '". Hãy chạy hàm setup() một lần.'); return; }
    var lastCol = sh.getLastColumn();
    var header = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    var thieu = SCHEMA[name].map(function (d) { return d[1]; }).filter(function (l) { return header.indexOf(l) < 0; });
    var trung = header.filter(function (h, i) { return h && header.indexOf(h) !== i; });
    var soHang = Math.max(sh.getLastRow() - 1, 0);
    if (thieu.length) loi(name + ': thiếu cột ' + thieu.map(function (l) { return '"' + l + '"'; }).join(', ') + '. Hãy chạy hàm setup() một lần.');
    else if (trung.length) canhBao(name + ': có cột trùng tên ' + trung.map(function (l) { return '"' + l + '"'; }).join(', ') + '. Xóa bớt cột trùng (giữ cột có dữ liệu).');
    else ok(name + ': đủ ' + SCHEMA[name].length + ' cột, ' + soHang + ' hàng dữ liệu.');
    // R-10 (Pha 2): CauHoi sắp hết số hàng đã định dạng văn bản
    if (name === 'CauHoi' && sh.getLastRow() > sh.getMaxRows() - 100) {
      canhBao('CauHoi đã dùng ' + sh.getLastRow() + '/' + sh.getMaxRows() + ' hàng. Thêm hàng trống ở cuối trang tính rồi chạy setup() để định dạng.');
    }
  });

  // 2. CaiDat: đủ khóa, không trùng (đọc thẳng Sheet, không qua đệm)
  var caiDat = [];
  try { caiDat = readSheet_('CaiDat'); } catch (e) { loi('Không đọc được CaiDat: ' + msg(e)); }
  MEMO_.CaiDat = caiDat; // getSetting_ dùng bản vừa đọc, không ghi đệm
  var khoa = caiDat.map(function (r) { return r.khoa; });
  var thieuKhoa = DEFAULT_SETTINGS.map(function (d) { return d[0]; }).filter(function (k) { return khoa.indexOf(k) < 0; });
  var trungKhoa = khoa.filter(function (k, i) { return k && khoa.indexOf(k) !== i; });
  if (thieuKhoa.length) loi('CaiDat thiếu dòng: ' + thieuKhoa.join(', ') + '. Hãy chạy hàm setup() một lần.');
  else ok('CaiDat: đủ ' + DEFAULT_SETTINGS.length + ' dòng cài đặt.');
  if (trungKhoa.length) canhBao('CaiDat có dòng trùng khóa: ' + trungKhoa.join(', ') + '. Xóa dòng thừa (máy chủ chỉ đọc dòng đầu tiên).');
  if (!getSetting_('MAT_KHAU_QUAN_TRI')) loi('CaiDat: MAT_KHAU_QUAN_TRI đang trống. Đặt mật khẩu quản trị trong CaiDat.');

  // 3. Kho câu hỏi (chỉ đọc hàng tiêu đề và số hàng)
  if (!idFromSetting_(getSetting_('KHO_CAU_HOI_ID'))) {
    canhBao('Chưa có KHO_CAU_HOI_ID: tab Ngân hàng chưa dùng được. Dán link file "KHO CÂU HỎI VẬT LÝ" ở Cài đặt của trang quản trị.');
  } else {
    try {
      var kho = bankOpen_();
      ok('Mở được kho câu hỏi: trang "' + BANK_SHEET + '" có ' + Math.max(kho.lastRow - 1, 0) + ' hàng, đủ cột cần đọc.');
    } catch (e) { loi('Kho câu hỏi: ' + msg(e)); }
  }
  var thuMuc = idFromSetting_(getSetting_('THU_MUC_HINH_KHO_ID'));
  if (!thuMuc) canhBao('Chưa có THU_MUC_HINH_KHO_ID: hình của kho sẽ được tìm trên toàn Drive (chậm hơn). Nên dán link thư mục "02. HÌNH VẼ".');
  else {
    try { ok('Mở được thư mục hình của kho: "' + DriveApp.getFolderById(thuMuc).getName() + '".'); }
    catch (e) { loi('Không mở được thư mục hình của kho (' + msg(e) + '). Kiểm tra THU_MUC_HINH_KHO_ID.'); }
  }
  var luyen = getSetting_('CHO_LUYEN_TAP').toUpperCase() === 'CO';
  ok('Luyện tập cho học sinh: ' + (luyen ? 'đang BẬT' : 'đang TẮT (bật ở Cài đặt khi đã đưa câu vào luyện tập)') + '.');

  // 4. Bộ nhớ đệm: ghi thử 1 khóa, đọc lại, xóa
  try {
    var c = CacheService.getScriptCache();
    var k = 'kiemtra_' + Utilities.getUuid().slice(0, 8), v = String(Date.now());
    c.put(k, v, 60);
    var doc = c.get(k);
    c.remove(k);
    if (doc === v) ok('Bộ nhớ đệm (CacheService): ghi/đọc thử được.');
    else canhBao('Bộ nhớ đệm không đọc lại được khóa thử. Web vẫn chạy đúng nhưng chậm hơn.');
  } catch (e) { canhBao('Bộ nhớ đệm lỗi (' + msg(e) + '). Web vẫn chạy đúng nhưng chậm hơn.'); }

  var ketLuan = soLoi ? '❌ CÓ ' + soLoi + ' LỖI cần sửa' : soCanhBao ? '✅ CHẠY ĐƯỢC, có ' + soCanhBao + ' lưu ý' : '✅ TẤT CẢ ĐỀU ỔN';
  dong.push(ketLuan + '. Mở trang quản trị → Cài đặt: phải thấy "Phiên bản máy chủ ' + APP_VERSION + '".');
  Logger.log('KIỂM TRA SAU TRIỂN KHAI\n' + dong.join('\n'));
  return { loi: soLoi, canhBao: soCanhBao, dong: dong };
}

function applyResultFormats_(sh, name) {
  var nCol = sh.getLastColumn(), maxRows = sh.getMaxRows();
  if (!nCol) return;
  var header = sh.getRange(1, 1, 1, nCol).getValues()[0].map(String);
  RESULT_NUMBER_FORMATS.forEach(function (p) {
    var c = header.indexOf(labelOf_(name, p[0])) + 1;
    if (c > 0 && maxRows > 1) sh.getRange(2, c, maxRows - 1, 1).setNumberFormat(p[1]);
  });
}

function seedStudents_() {
  appendRows_('HocSinh', [{
    id: 'HS0001', hoTen: 'Học Sinh Mẫu', lop: '12A1', ngaySinh: '01/01/2008', pin: '', email: '',
    trangThai: 'HOAT_DONG', ngayTao: nowIso_()
  }]);
}

function seedExam_() {
  var id = 'DEMAU';
  appendRows_('DeThi', [{
    id: id, tieuDe: 'Đề mẫu — Vật lý 12 (6 câu)', lop: '', moTa: 'Đề mẫu để thử hệ thống. Có đủ 3 phần như đề thi tốt nghiệp THPT.',
    thoiGian: 15, trangThai: 'MO', batDau: '', ketThuc: '', soLanLam: 0, hienLoiGiai: 'NGAY', tronCau: 'KHONG',
    ngayTao: nowIso_(), capNhat: nowIso_()
  }]);
  var q = [
    { loai: 'TN', chuDe: 'Vật lí nhiệt', mucDo: 'NB', noiDung: 'Ở áp suất tiêu chuẩn, nhiệt độ sôi của nước theo thang Kelvin xấp xỉ bằng',
      A: '100 K', B: '273 K', C: '373 K', D: '212 K', dapAn: 'C', loiGiai: '$T = t + 273 = 100 + 273 = 373$ K.' },
    { loai: 'TN', chuDe: 'Khí lí tưởng', mucDo: 'TH', noiDung: 'Một lượng khí lí tưởng được nén đẳng nhiệt từ 6 lít xuống 2 lít. Áp suất của khối khí',
      A: 'giảm 3 lần.', B: 'tăng 3 lần.', C: 'tăng 9 lần.', D: 'không đổi.', dapAn: 'B', loiGiai: 'Đẳng nhiệt: $pV$ = hằng số, $V$ giảm 3 lần nên $p$ tăng 3 lần.' },
    { loai: 'TN', chuDe: 'Từ trường', mucDo: 'NB', noiDung: 'Đơn vị của cảm ứng từ là',
      A: 'tesla (T).', B: 'vêbe (Wb).', C: 'henry (H).', D: 'vôn (V).', dapAn: 'A', loiGiai: 'Cảm ứng từ $B$ có đơn vị tesla (T).' },
    { loai: 'DS', chuDe: 'Khí lí tưởng', mucDo: 'TH', noiDung: 'Một bình kín chứa khí lí tưởng ở 27 °C, áp suất $2.10^5$ Pa. Đun nóng khí (thể tích không đổi) đến 127 °C.',
      A: 'Nhiệt độ tuyệt đối ban đầu của khí là 300 K.', B: 'Áp suất của khí tỉ lệ thuận với nhiệt độ Celsius.',
      C: 'Áp suất của khí sau khi đun xấp xỉ $2,67.10^5$ Pa.', D: 'Khối lượng riêng của khí tăng khi đun nóng.',
      dapAn: 'DSDS', loiGiai: 'a) $T_1 = 300$ K — Đúng. b) Áp suất tỉ lệ với nhiệt độ tuyệt đối, không phải nhiệt độ Celsius — Sai. c) $p_2 = p_1\\frac{T_2}{T_1} = 2.10^5\\cdot\\frac{400}{300} \\approx 2,67.10^5$ Pa — Đúng. d) Khối lượng và thể tích không đổi nên khối lượng riêng không đổi — Sai.' },
    { loai: 'TL', chuDe: 'Vật lí nhiệt', mucDo: 'VD', noiDung: 'Cần cung cấp bao nhiêu kJ nhiệt lượng để làm nóng 2 kg nước từ 20 °C lên 70 °C? Biết nhiệt dung riêng của nước là 4200 J/(kg.K).',
      dapAn: '420', loiGiai: '$Q = mc\\Delta t = 2\\cdot 4200\\cdot 50 = 420\\,000$ J $= 420$ kJ.' },
    { loai: 'TL', chuDe: 'Vật lí hạt nhân', mucDo: 'VD', noiDung: 'Một chất phóng xạ có chu kì bán rã 8 ngày. Sau 24 ngày, số hạt nhân còn lại bằng bao nhiêu phần trăm số hạt nhân ban đầu? (làm tròn đến hàng phần mười)',
      dapAn: '12,5', loiGiai: '$\\frac{N}{N_0} = 2^{-t/T} = 2^{-3} = 0,125 = 12,5\\%$.' }
  ];
  appendRows_('CauHoi', q.map(function (x, i) {
    return normalizeQuestion_(Object.assign({ examId: id, stt: i + 1 }, x), i);
  }));
}

/* =====================================================================
 *  CỔNG API
 * ===================================================================== */

function doGet() {
  return json_({ ok: true, data: { app: 'web-luyen-de', version: APP_VERSION, message: 'Máy chủ đang hoạt động' } });
}

function doPost(e) {
  var out;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var fn = ROUTES[req.action];
    if (!fn) throw new Error('Không có chức năng: ' + req.action);
    out = { ok: true, data: fn(req) };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return json_(out);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

var ROUTES = {
  // Công khai
  publicConfig: apiPublicConfig_,
  listClasses: apiListClasses_,
  listStudentsInClass: apiListStudentsInClass_,
  loginPin: apiLoginPin_,
  loginGoogle: apiLoginGoogle_,
  linkGoogle: apiLinkGoogle_,
  loginAdminPassword: apiLoginAdminPassword_,
  // Học sinh
  me: apiMe_,
  bootstrap: apiBootstrap_,
  listExams: apiListExams_,
  startExam: apiStartExam_,
  submitExam: apiSubmitExam_,
  myResults: apiMyResults_,
  getResult: apiGetResult_,
  changePin: apiChangePin_,
  myStats: apiMyStats_,
  leaderboard: apiLeaderboard_,
  // Giáo viên
  adminBootstrap: apiAdminBootstrap_,
  adminOverview: apiAdminOverview_,
  adminListStudents: apiAdminListStudents_,
  adminSaveStudent: apiAdminSaveStudent_,
  adminImportStudents: apiAdminImportStudents_,
  adminDeleteStudent: apiAdminDeleteStudent_,
  adminListExams: apiAdminListExams_,
  adminGetExam: apiAdminGetExam_,
  adminSaveExam: apiAdminSaveExam_,
  adminDeleteExam: apiAdminDeleteExam_,
  adminResults: apiAdminResults_,
  adminDeleteResult: apiAdminDeleteResult_,
  adminExamStats: apiAdminExamStats_,
  adminGradebook: apiAdminGradebook_,
  adminUploadImage: apiAdminUploadImage_,
  adminGetSettings: apiAdminGetSettings_,
  adminSaveSettings: apiAdminSaveSettings_,
  // Ngân hàng câu hỏi (Pha 2)
  adminBankMeta: apiAdminBankMeta_,
  adminBankList: apiAdminBankList_,
  adminBankSource: apiAdminBankSource_,
  adminBankMatrix: apiAdminBankMatrix_,
  adminBankToQuestions: apiAdminBankToQuestions_,
  // Luyện tập (Pha 4)
  practiceMeta: apiPracticeMeta_,
  practiceStart: apiPracticeStart_,
  adminPracticeSync: apiAdminPracticeSync_,
  adminPracticeList: apiAdminPracticeList_,
  adminPracticeToggle: apiAdminPracticeToggle_
};

/* =====================================================================
 *  API CÔNG KHAI & ĐĂNG NHẬP
 * ===================================================================== */

function apiPublicConfig_() {
  return {
    appName: getSetting_('TEN_UNG_DUNG') || 'Luyện đề Vật lý',
    teacherName: getSetting_('TEN_GIAO_VIEN') || '',
    googleClientId: getSetting_('GOOGLE_CLIENT_ID') || '',
    showLeaderboard: yes_(getSetting_('HIEN_BANG_XEP_HANG')),
    version: APP_VERSION,
    features: FEATURES.slice(),
    practice: practiceOn_()
  };
}

function apiListClasses_() {
  var set = {};
  activeStudents_().forEach(function (s) { if (s.lop) set[s.lop] = 1; });
  return Object.keys(set).sort(sortVi_);
}

function apiListStudentsInClass_(req) {
  var lop = str_(req.lop);
  return activeStudents_().filter(function (s) { return s.lop === lop; })
    .map(function (s) { return { id: s.id, hoTen: s.hoTen }; })
    .sort(function (a, b) { return sortVi_(firstNameKey_(a.hoTen), firstNameKey_(b.hoTen)); });
}

function apiLoginPin_(req) {
  var st = checkPin_(req.studentId, req.pin);
  return { token: makeSession_({ role: 'student', sid: st.id }), user: publicStudent_(st) };
}

function apiLoginGoogle_(req) {
  var g = verifyGoogle_(req.credential);
  if (req.as === 'teacher') {
    if (!isTeacherEmail_(g.email)) throw new Error('Email ' + g.email + ' không có quyền quản trị. Thêm email này vào CaiDat → EMAIL_GIAO_VIEN.');
    return { token: makeSession_({ role: 'teacher', email: g.email }), user: { role: 'teacher', email: g.email, name: g.name } };
  }
  var st = activeStudents_().filter(function (s) { return low_(s.email) === g.email; })[0];
  if (st) return { token: makeSession_({ role: 'student', sid: st.id }), user: publicStudent_(st) };
  return { needLink: yes_(getSetting_('CHO_LIEN_KET_GOOGLE')), email: g.email };
}

function apiLinkGoogle_(req) {
  if (!yes_(getSetting_('CHO_LIEN_KET_GOOGLE'))) throw new Error('Giáo viên chưa cho phép tự liên kết Google. Hãy đăng nhập bằng PIN.');
  var g = verifyGoogle_(req.credential);
  var st = checkPin_(req.studentId, req.pin);
  withLock_(function () {
    var all = readTable_('HocSinh', { fresh: true });
    var other = all.filter(function (s) { return low_(s.email) === g.email && s.id !== st.id; })[0];
    if (other) throw new Error('Email này đã được liên kết với học sinh khác. Hãy báo giáo viên.');
    var cur = all.filter(function (s) { return s.id === st.id; })[0];
    if (!cur) throw new Error('Không tìm thấy học sinh hoặc tài khoản đã bị khóa.');
    updateRow_('HocSinh', cur._row, { email: g.email }, 'id', st.id);
  });
  return { token: makeSession_({ role: 'student', sid: st.id }), user: publicStudent_(Object.assign(st, { email: g.email })) };
}

function apiLoginAdminPassword_(req) {
  var key = 'fail_admin';
  guardFails_(key);
  var pw = String(getSetting_('MAT_KHAU_QUAN_TRI') || '');
  if (!pw || String(req.password || '') !== pw) {
    addFail_(key);
    throw new Error('Mật khẩu không đúng.');
  }
  clearFails_(key);
  return { token: makeSession_({ role: 'teacher', email: 'password' }), user: { role: 'teacher', name: 'Giáo viên' } };
}

function checkPin_(studentId, pin) {
  var st = findStudent_(str_(studentId));
  if (!st || st.trangThai === 'KHOA') throw new Error('Không tìm thấy học sinh hoặc tài khoản đã bị khóa.');
  var key = 'fail_' + st.id;
  guardFails_(key);
  if (String(pin || '').trim() !== pinOf_(st)) {
    var left = addFail_(key);
    throw new Error('Mã PIN không đúng.' + (left > 0 ? ' Còn ' + left + ' lần thử.' : ''));
  }
  clearFails_(key);
  return st;
}

function pinOf_(st) {
  var p = String(st.pin || '').replace(/\D/g, '');
  if (p) return p;
  var m = String(st.ngaySinh || '').match(/(\d{1,2})\D+(\d{1,2})/);
  if (!m) return '__khong_co_pin__';
  return pad2_(m[1]) + pad2_(m[2]);
}

function guardFails_(key) {
  var n = Number(CacheService.getScriptCache().get(key) || 0);
  if (n >= MAX_FAIL) throw new Error('Nhập sai quá ' + MAX_FAIL + ' lần. Vui lòng thử lại sau 10 phút.');
}
function addFail_(key) {
  var c = CacheService.getScriptCache();
  var n = Number(c.get(key) || 0) + 1;
  c.put(key, String(n), LOCK_SECONDS);
  return MAX_FAIL - n;
}
function clearFails_(key) { CacheService.getScriptCache().remove(key); }

function verifyGoogle_(credential) {
  var clientId = getSetting_('GOOGLE_CLIENT_ID');
  if (!clientId) throw new Error('Chưa cài đặt đăng nhập Google (thiếu GOOGLE_CLIENT_ID).');
  if (!credential) throw new Error('Thiếu thông tin đăng nhập Google.');
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Đăng nhập Google không hợp lệ hoặc đã hết hạn.');
  var info = JSON.parse(res.getContentText());
  if (info.aud !== clientId) throw new Error('Đăng nhập Google không hợp lệ (sai Client ID).');
  if (String(info.email_verified) !== 'true') throw new Error('Email Google chưa được xác minh.');
  return { email: low_(info.email), name: info.name || info.email };
}

function isTeacherEmail_(email) {
  return String(getSetting_('EMAIL_GIAO_VIEN') || '').split(/[,;\s]+/).map(low_).filter(String).indexOf(low_(email)) >= 0;
}

/* =====================================================================
 *  PHIÊN ĐĂNG NHẬP (token ký HMAC, không cần lưu trữ)
 * ===================================================================== */

function secret_() {
  if (MEMO_.__secret) return MEMO_.__secret; // một lần đọc Properties mỗi request
  var p = PropertiesService.getScriptProperties();
  var s = p.getProperty('SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SECRET', s); }
  MEMO_.__secret = s;
  return s;
}

function signToken_(payload) {
  var body = Utilities.base64EncodeWebSafe(Utilities.newBlob(JSON.stringify(payload)).getBytes());
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, secret_()));
  return body + '.' + sig;
}

function readToken_(tok, type) {
  if (!tok || typeof tok !== 'string') return null;
  var parts = tok.split('.');
  if (parts.length !== 2) return null;
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], secret_()));
  if (sig !== parts[1]) return null;
  var p;
  try { p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); } catch (e) { return null; }
  if (p.t !== type) return null;
  if (p.exp && Date.now() > p.exp) return null;
  return p;
}

function makeSession_(o) {
  var days = o.role === 'teacher' ? 1 : 30;
  return signToken_(Object.assign({ t: 's', exp: Date.now() + days * 86400000 }, o));
}

function requireUser_(req) {
  var p = readToken_(req.token, 's');
  if (!p) throw new Error('AUTH: Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  if (p.role === 'teacher') return { role: 'teacher', email: p.email };
  var st = findStudent_(p.sid);
  if (!st || st.trangThai === 'KHOA') throw new Error('AUTH: Tài khoản không còn hoạt động.');
  return { role: 'student', student: st };
}

function requireStudent_(req) {
  var u = requireUser_(req);
  if (u.role !== 'student') throw new Error('Chức năng này dành cho học sinh.');
  return u.student;
}

function requireTeacher_(req) {
  var u = requireUser_(req);
  if (u.role !== 'teacher') throw new Error('AUTH: Bạn không có quyền giáo viên.');
  return u;
}

/* =====================================================================
 *  HỌC SINH: ĐỀ THI, LÀM BÀI, KẾT QUẢ
 * ===================================================================== */

function apiMe_(req) {
  var u = requireUser_(req);
  return u.role === 'teacher' ? { role: 'teacher', email: u.email } : publicStudent_(u.student);
}

/** Gộp các lần gọi khi học sinh mở trang: thông tin của em, cấu hình, danh sách đề, kết quả (không có đáp án). */
function apiBootstrap_(req) {
  var st = requireStudent_(req);
  return { me: publicStudent_(st), pub: apiPublicConfig_(), exams: apiListExams_(req), results: apiMyResults_(req), v: APP_VERSION };
}

function apiListExams_(req) {
  var st = requireStudent_(req);
  var mine = readTable_('KetQua').filter(function (r) { return r.studentId === st.id; });
  var counts = countQuestions_();
  return readTable_('DeThi').filter(function (e) { return examVisibleTo_(e, st); }).map(function (e) {
    var rs = mine.filter(function (r) { return r.examId === e.id; });
    var best = rs.reduce(function (m, r) { return Math.max(m, num_(r.diem)); }, -1);
    var info = examStatus_(e);
    var max = num_(e.soLanLam);
    return {
      id: e.id, tieuDe: e.tieuDe, moTa: e.moTa, thoiGian: num_(e.thoiGian), soCau: counts[e.id] || 0,
      batDau: e.batDau, ketThuc: e.ketThuc, soLanLam: max, daLam: rs.length,
      diemCaoNhat: best >= 0 ? best : null, open: info.open, trangThaiText: info.text,
      canStart: info.open && (!max || rs.length < max) && (counts[e.id] || 0) > 0,
      lastResultId: rs.length ? rs[rs.length - 1].id : null,
      diemGanNhat: rs.length ? num_(rs[rs.length - 1].diem) : null,
      mucTieuGanNhat: rs.length && rs[rs.length - 1].mucTieu !== '' ? num_(rs[rs.length - 1].mucTieu) : null
    };
  }).sort(function (a, b) { return (b.open - a.open) || String(b.batDau || '').localeCompare(String(a.batDau || '')); });
}

function apiStartExam_(req) {
  var st = requireStudent_(req);
  var e = findExam_(req.examId);
  if (!e || !examVisibleTo_(e, st)) throw new Error('Không tìm thấy đề.');
  var info = examStatus_(e);
  if (!info.open) throw new Error('Đề ' + info.text.toLowerCase() + '.');
  var max = num_(e.soLanLam);
  if (max) {
    var done = readTable_('KetQua').filter(function (r) { return r.studentId === st.id && r.examId === e.id; }).length;
    if (done >= max) throw new Error('Bạn đã dùng hết ' + max + ' lượt làm đề này.');
  }
  var qs = examQuestions_(e.id);
  if (!qs.length) throw new Error('Đề chưa có câu hỏi.');
  if (yes_(e.tronCau)) qs = shuffleWithinParts_(qs);
  var dur = Math.max(1, num_(e.thoiGian) || 45) * 60;
  var now = Date.now();
  // Nếu đề có giờ đóng, không cho làm quá giờ đóng
  var end = parseDate_(e.ketThuc);
  if (end) dur = Math.min(dur, Math.max(60, Math.floor((end.getTime() - now) / 1000)));
  var goal = parseGoal_(req.mucTieu);
  var attempt = { t: 'a', aid: Utilities.getUuid(), sid: st.id, eid: e.id, st: now, dur: dur, exp: now + (dur + 6 * 3600) * 1000, goal: goal };
  return {
    attemptToken: signToken_(attempt), startedAt: now, durationSec: dur, serverNow: now, mucTieu: goal,
    exam: { id: e.id, tieuDe: e.tieuDe, moTa: e.moTa },
    questions: qs.map(function (q) {
      return { stt: q.stt, phan: q.phan, loai: q.loai, noiDung: q.noiDung, hinhAnh: q.hinhAnh, A: q.A, B: q.B, C: q.C, D: q.D, diem: q.diem };
    })
  };
}

function apiSubmitExam_(req) {
  var st = requireStudent_(req);
  var a = readToken_(req.attemptToken, 'a');
  if (!a) {
    var pt = readToken_(req.attemptToken, 'p'); // lượt luyện tập (Pha 4): loại token riêng, ký như token 'a'
    if (pt) return practiceSubmit_(st, pt, req);
  }
  if (!a || a.sid !== st.id) throw new Error('Lượt làm bài không hợp lệ hoặc đã quá hạn.');
  var e = findExam_(a.eid);
  if (!e) throw new Error('Đề không còn tồn tại.');
  var cache = CacheService.getScriptCache();
  var doneKey = 'att_' + a.aid;
  var already = cache.get(doneKey);
  if (already) return apiGetResult_({ token: req.token, resultId: already });

  var qs = examQuestions_(e.id);
  var qByStt = {};
  qs.forEach(function (q) { qByStt[q.stt] = q; });
  var answers = req.answers || {};
  var graded = gradeExam_(qs, answers);
  var now = Date.now();
  var usedSec = Math.max(0, Math.round((now - a.st) / 1000));
  var late = usedSec > a.dur + GRACE_SECONDS;
  var prev = readTable_('KetQua').filter(function (r) { return r.studentId === st.id; });
  var prevSame = prev.filter(function (r) { return r.examId === e.id; }).map(function (r) { return num_(r.diem); });
  var prevAll = prev.map(function (r) { return num_(r.diem); });
  var goal = a.goal == null ? null : num_(a.goal);
  var fb = buildFeedback_(qs, graded, { usedSec: usedSec, limitSec: a.dur, prevSame: prevSame, prevAll: prevAll, goal: goal });
  var diem10 = graded.max ? round2_(graded.score / graded.max * 10) : 0;
  var result = {
    id: 'KQ' + Utilities.formatDate(new Date(now), TZ, 'yyMMddHHmmss') + Math.floor(Math.random() * 900 + 100),
    nopLuc: fmtDateTime_(new Date(now)), hoTen: st.hoTen, lop: st.lop, tieuDe: e.tieuDe,
    diem: diem10, mucTieu: goal == null ? '' : goal, diemGoc: graded.score, diemToiDa: graded.max, soCauDung: graded.correctCount, tongCau: qs.length,
    thoiGianLam: fmtDuration_(usedSec), nhanXet: fb.text, studentId: st.id, examId: e.id,
    batDauLuc: fmtDateTime_(new Date(a.st)), thoiGianGiay: usedSec,
    ghiChu: late ? 'Nộp muộn ' + fmtDuration_(usedSec - a.dur) : '',
    chiTiet: JSON.stringify(graded.items.map(function (g) {
      // Pha 4: k = mã câu kho, h = mã băm nội dung lúc làm (để "Luyện câu đã sai" nhận ra câu đã bị sửa/đánh số lại)
      var q = qByStt[g.stt] || {};
      var it = { s: g.stt, l: g.loai, a: g.answer, sc: g.score, m: g.max, c: g.correct ? 1 : 0, n: g.nCorrect, cd: g.chuDe, md: g.mucDo, p: g.phan, h: contentHash_(q) };
      if (q.maKho) it.k = q.maKho;
      return it;
    }))
  };
  withLock_(function () { appendRows_('KetQua', [result]); });
  cache.put(doneKey, result.id, 21600);
  notifyTeacher_(result);
  return buildResultView_(readTable_('KetQua').filter(function (r) { return r.id === result.id; })[0] || result, e, 'student');
}

function apiMyResults_(req) {
  var st = requireStudent_(req);
  if (req.loai === 'luyen') {
    return rowsWhere_('KetQuaLuyenTap', 'studentId', st.id)
      .map(function (r) { return Object.assign(resultSummary_(r), { kieu: r.kieu, luyenTap: true }); }).reverse();
  }
  return readTable_('KetQua').filter(function (r) { return r.studentId === st.id; }).map(resultSummary_).reverse();
}

function apiGetResult_(req) {
  var u = requireUser_(req);
  if (/^LT/.test(str_(req.resultId))) {
    var lt = rowsWhere_('KetQuaLuyenTap', 'id', req.resultId)[0];
    if (!lt) throw new Error('Không tìm thấy bài làm.');
    if (u.role === 'student' && lt.studentId !== u.student.id) throw new Error('Bạn không xem được bài làm này.');
    return buildPracticeView_(lt, u.role);
  }
  var r = readTable_('KetQua').filter(function (x) { return x.id === str_(req.resultId); })[0];
  if (!r) throw new Error('Không tìm thấy bài làm.');
  if (u.role === 'student' && r.studentId !== u.student.id) throw new Error('Bạn không xem được bài làm này.');
  return buildResultView_(r, findExam_(r.examId), u.role);
}

/** Mục tiêu điểm hợp lệ: 0–10, làm tròn tới 0,25; bỏ trống → null */
function parseGoal_(v) {
  if (v == null || String(v).trim() === '') return null;
  var n = parseNum_(v);
  if (isNaN(n) || n <= 0 || n > 10) throw new Error('Mục tiêu điểm phải là số từ 0 đến 10.');
  return Math.round(n * 4) / 4;
}

/** Học sinh tự đổi PIN: cần PIN hiện tại */
function apiChangePin_(req) {
  var me = requireStudent_(req);
  withLock_(function () {
    readTable_('HocSinh', { fresh: true }); // đọc thẳng trang tính trong khóa; checkPin_ dùng lại bản này
    var st = checkPin_(me.id, req.oldPin);
    var np = String(req.newPin || '').trim();
    if (!/^\d{4}$/.test(np)) throw new Error('PIN mới phải gồm đúng 4 chữ số.');
    if (np === pinOf_(st)) throw new Error('PIN mới phải khác PIN hiện tại.');
    if (/^(\d)\1{3}$/.test(np) || np === '1234') throw new Error('PIN quá dễ đoán, hãy chọn PIN khác.');
    updateRow_('HocSinh', st._row, { pin: np }, 'id', st.id);
  });
  return true;
}

/**
 * Gợi ý đề luyện tập tương tự: ưu tiên đề có nhiều câu thuộc các chủ đề học sinh vừa mất điểm.
 */
function suggestExams_(st, r, details) {
  var lost = {};
  details.forEach(function (d) {
    var miss = num_(d.m) - num_(d.sc);
    if (miss > 1e-9 && d.cd) lost[d.cd] = (lost[d.cd] || 0) + miss;
  });
  var mine = readTable_('KetQua').filter(function (x) { return x.studentId === st.id; });
  var qByExam = {};
  readTable_('CauHoi').forEach(function (q) { (qByExam[q.examId] = qByExam[q.examId] || []).push(q); });
  var out = readTable_('DeThi').filter(function (e) {
    if (e.id === r.examId || !examVisibleTo_(e, st) || !examStatus_(e).open || !(qByExam[e.id] || []).length) return false;
    var max = num_(e.soLanLam);
    return !max || mine.filter(function (x) { return x.examId === e.id; }).length < max;
  }).map(function (e) {
    var topics = {};
    var score = 0;
    qByExam[e.id].forEach(function (q) {
      var t = str_(q.chuDe);
      if (lost[t]) { topics[t] = (topics[t] || 0) + 1; score += lost[t]; }
    });
    var done = mine.filter(function (x) { return x.examId === e.id; });
    var best = done.reduce(function (m, x) { return Math.max(m, num_(x.diem)); }, -1);
    var names = Object.keys(topics).sort(function (a, b) { return topics[b] - topics[a]; });
    return {
      id: e.id, tieuDe: e.tieuDe, thoiGian: num_(e.thoiGian), soCau: qByExam[e.id].length, score: score, daLam: done.length,
      diemCaoNhat: best >= 0 ? best : null,
      lyDo: names.length ? 'Có ' + names.map(function (t) { return topics[t] + ' câu ' + t; }).join(', ') : (done.length ? 'Luyện thêm' : 'Đề bạn chưa làm')
    };
  });
  var similar = out.filter(function (x) { return x.score > 0; });
  var pool = similar.length ? similar : out.filter(function (x) { return !x.daLam; });
  return pool.sort(function (a, b) { return (b.score - a.score) || (a.daLam - b.daLam); }).slice(0, 3)
    .map(function (x) { delete x.score; return x; });
}

function buildResultView_(r, e, role) {
  var details = parseJson_(r.chiTiet, []);
  var goal = null;
  if (r.mucTieu !== '' && r.mucTieu != null) {
    var g = num_(r.mucTieu), d = num_(r.diem);
    goal = { mucTieu: g, dat: d >= g - 1e-9, chenh: round2_(d - g) };
    if (role === 'student') {
      var st = findStudent_(r.studentId);
      var same = readTable_('KetQua').filter(function (x) { return x.studentId === r.studentId && x.examId === r.examId; });
      var idx = same.map(function (x) { return x.id; }).indexOf(r.id);
      goal.lanTruoc = idx > 0 ? num_(same[idx - 1].diem) : null;
      var max = e ? num_(e.soLanLam) : 0;
      goal.lamLai = !!(e && examStatus_(e).open && (!max || same.length < max));
      if (!goal.dat && st) goal.goiY = suggestExams_(st, r, details);
    }
  }
  var qs = e ? examQuestions_(e.id) : [];
  var reveal = role === 'teacher' || (e && canReveal_(e));
  var byStt = {};
  qs.forEach(function (q) { byStt[q.stt] = q; });
  var view = Object.assign(resultSummary_(r), {
    nhanXet: r.nhanXet, feedback: feedbackFromText_(r.nhanXet), ghiChu: r.ghiChu, reveal: !!reveal,
    revealNote: reveal ? '' : (e && e.hienLoiGiai === 'SAU_HAN' ? 'Đáp án và lời giải sẽ hiện sau khi đề đóng.' : 'Giáo viên không công bố đáp án cho đề này.'),
    breakdown: breakdown_(details), goal: goal,
    items: details.map(function (d) {
      var q = byStt[d.s] || {};
      var it = { stt: d.s, loai: d.l, phan: d.p, chuDe: d.cd, mucDo: d.md, answer: d.a, score: d.sc, max: d.m, nCorrect: d.n };
      if (reveal) {
        it.correct = !!d.c;
        it.noiDung = q.noiDung; it.hinhAnh = q.hinhAnh; it.A = q.A; it.B = q.B; it.C = q.C; it.D = q.D;
        it.dapAn = q.dapAn; it.loiGiai = q.loiGiai;
      }
      return it;
    })
  });
  return view;
}

function apiMyStats_(req) {
  var st = requireStudent_(req);
  var rs = readTable_('KetQua').filter(function (r) { return r.studentId === st.id; });
  var all = [];
  rs.forEach(function (r) { all = all.concat(parseJson_(r.chiTiet, [])); });
  var b = breakdown_(all);
  var scores = rs.map(function (r) { return num_(r.diem); });
  return {
    timeline: rs.map(function (r) { return { id: r.id, nopLuc: r.nopLuc, tieuDe: r.tieuDe, diem: num_(r.diem), mucTieu: r.mucTieu === '' ? null : num_(r.mucTieu) }; }),
    count: rs.length,
    avg: scores.length ? round2_(avg_(scores)) : null,
    best: scores.length ? Math.max.apply(null, scores) : null,
    byTopic: b.byTopic, byLevel: b.byLevel, byType: b.byType,
    advice: overallAdvice_(b, scores)
  };
}

function apiLeaderboard_(req) {
  var u = requireUser_(req);
  if (u.role === 'student' && !yes_(getSetting_('HIEN_BANG_XEP_HANG'))) throw new Error('Giáo viên đang tắt bảng xếp hạng.');
  var hide = u.role === 'student' && yes_(getSetting_('BXH_AN_TEN'));
  var me = u.role === 'student' ? u.student.id : null;
  var lopFilter = str_(req.lop);
  var rs = readTable_('KetQua');
  var exams = readTable_('DeThi').filter(function (e) { return e.trangThai !== 'NHAP' && (u.role === 'teacher' || examVisibleTo_(e, u.student)); });
  var examIds = exams.map(function (e) { return e.id; });
  rs = rs.filter(function (r) { return examIds.indexOf(r.examId) >= 0 && (!lopFilter || r.lop === lopFilter); });
  var rows;
  if (req.examId) {
    var best = {};
    rs.filter(function (r) { return r.examId === req.examId; }).forEach(function (r) {
      var cur = best[r.studentId];
      if (!cur || num_(r.diem) > num_(cur.diem) || (num_(r.diem) === num_(cur.diem) && num_(r.thoiGianGiay) < num_(cur.thoiGianGiay))) best[r.studentId] = r;
    });
    rows = Object.keys(best).map(function (k) {
      var r = best[k];
      return { studentId: r.studentId, hoTen: r.hoTen, lop: r.lop, diem: num_(r.diem), thoiGianGiay: num_(r.thoiGianGiay), thoiGianLam: r.thoiGianLam };
    }).sort(function (a, b) { return (b.diem - a.diem) || (a.thoiGianGiay - b.thoiGianGiay); });
  } else {
    var per = {};
    rs.forEach(function (r) {
      var k = r.studentId;
      per[k] = per[k] || { studentId: k, hoTen: r.hoTen, lop: r.lop, best: {} };
      per[k].best[r.examId] = Math.max(per[k].best[r.examId] || 0, num_(r.diem));
    });
    rows = Object.keys(per).map(function (k) {
      var p = per[k];
      var vals = Object.keys(p.best).map(function (x) { return p.best[x]; });
      return { studentId: k, hoTen: p.hoTen, lop: p.lop, soDe: vals.length, diem: round2_(avg_(vals)), tong: round2_(vals.reduce(function (s, v) { return s + v; }, 0)) };
    }).sort(function (a, b) { return (b.diem - a.diem) || (b.soDe - a.soDe); });
  }
  var rank = 0, prevKey = null;
  rows.forEach(function (r, i) {
    var key = r.diem + '|' + (r.thoiGianGiay || r.soDe);
    if (key !== prevKey) rank = i + 1;
    prevKey = key;
    r.hang = rank;
    r.laToi = r.studentId === me;
    if (hide && !r.laToi) r.hoTen = shortName_(r.hoTen);
    if (u.role === 'student') delete r.studentId;
  });
  var mine = rows.filter(function (r) { return r.laToi; })[0] || null;
  return {
    exams: exams.map(function (e) { return { id: e.id, tieuDe: e.tieuDe }; }),
    rows: rows.slice(0, 100), me: mine, total: rows.length
  };
}

/* =====================================================================
 *  CHẤM ĐIỂM (theo cấu trúc đề tốt nghiệp THPT từ 2025)
 *   TN — trắc nghiệm 4 lựa chọn: đúng được trọn điểm câu (mặc định 0,25)
 *   DS — đúng/sai 4 ý: đúng 1/2/3/4 ý được 10%/25%/50%/100% điểm câu (mặc định 1 điểm)
 *   TL — trả lời ngắn: so sánh số (chấp nhận dấu phẩy), có thể đặt sai số; nhiều đáp án cách nhau "|"
 * ===================================================================== */

var DS_SCALE = [0, 0.1, 0.25, 0.5, 1];

function gradeExam_(qs, answers) {
  var items = qs.map(function (q) { return gradeOne_(q, answers[q.stt]); });
  var score = round2_(items.reduce(function (s, g) { return s + g.score; }, 0));
  var max = round2_(items.reduce(function (s, g) { return s + g.max; }, 0));
  return { items: items, score: score, max: max, correctCount: items.filter(function (g) { return g.correct; }).length };
}

function gradeOne_(q, ans) {
  var max = num_(q.diem) || defaultPoint_(q.loai);
  var base = { stt: q.stt, loai: q.loai, phan: q.phan, chuDe: q.chuDe || 'Khác', mucDo: q.mucDo || '', max: max };
  if (q.loai === 'DS') {
    var key = normTF_(q.dapAn).split('');
    var arr = toArr4_(ans);
    var n = 0;
    for (var i = 0; i < 4; i++) if (arr[i] && arr[i] === key[i]) n++;
    return Object.assign(base, {
      answer: arr.map(function (x) { return x || '_'; }).join(''), answered: arr.some(Boolean),
      nCorrect: n, correct: n === 4, score: round2_(max * DS_SCALE[n])
    });
  }
  if (q.loai === 'TL') {
    var a = String(ans == null ? '' : ans).trim();
    var tol = Math.abs(num_(String(q.saiSo || '').replace(',', '.')));
    var ok = a !== '' && String(q.dapAn).split('|').some(function (k) {
      k = k.trim();
      var kn = parseNum_(k), an = parseNum_(a);
      if (!isNaN(kn) && !isNaN(an)) return Math.abs(kn - an) <= tol + 1e-9;
      return k.toLowerCase().replace(/\s+/g, '') === a.toLowerCase().replace(/\s+/g, '');
    });
    return Object.assign(base, { answer: a, answered: a !== '', correct: ok, score: ok ? max : 0 });
  }
  var x = String(ans == null ? '' : ans).toUpperCase().trim();
  var c = String(q.dapAn).toUpperCase().trim();
  var right = x !== '' && x === c;
  return Object.assign(base, { answer: x, answered: x !== '', correct: right, score: right ? max : 0 });
}

function defaultPoint_(loai) { return loai === 'DS' ? 1 : 0.25; }

function normTF_(s) {
  return String(s == null ? '' : s).toUpperCase().replace(/Đ/g, 'D').replace(/[^DS_\-]/g, '');
}

function toArr4_(ans) {
  var arr = [];
  if (Array.isArray(ans)) arr = ans.map(function (x) { return normTF_(x).charAt(0); });
  else if (ans != null) arr = normTF_(ans).split('');
  var out = [];
  for (var i = 0; i < 4; i++) out.push(arr[i] === 'D' || arr[i] === 'S' ? arr[i] : '');
  return out;
}

function parseNum_(s) {
  var t = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
  return parseFloat(t);
}

/* =====================================================================
 *  TỰ NHẬN XÉT BÀI LÀM
 * ===================================================================== */

var LEVEL_NAMES = { NB: 'Nhận biết', TH: 'Thông hiểu', VD: 'Vận dụng', VDC: 'Vận dụng cao' };
var TYPE_NAMES = { TN: 'Trắc nghiệm nhiều lựa chọn', DS: 'Đúng/Sai', TL: 'Trả lời ngắn' };

function breakdown_(details) {
  function group(keyFn, nameFn) {
    var m = {};
    details.forEach(function (d) {
      var k = keyFn(d);
      if (!k) return;
      m[k] = m[k] || { key: k, name: nameFn(k), score: 0, max: 0, count: 0, correct: 0 };
      m[k].score += num_(d.sc); m[k].max += num_(d.m); m[k].count++; m[k].correct += d.c ? 1 : 0;
    });
    return Object.keys(m).map(function (k) {
      var g = m[k];
      g.score = round2_(g.score); g.max = round2_(g.max);
      g.pct = g.max ? Math.round(g.score / g.max * 100) : 0;
      return g;
    });
  }
  var order = ['NB', 'TH', 'VD', 'VDC'];
  return {
    byTopic: group(function (d) { return d.cd || 'Khác'; }, function (k) { return k; }).sort(function (a, b) { return a.pct - b.pct; }),
    byLevel: group(function (d) { return d.md; }, function (k) { return LEVEL_NAMES[k] || k; })
      .sort(function (a, b) { return order.indexOf(a.key) - order.indexOf(b.key); }),
    byType: group(function (d) { return d.l; }, function (k) { return TYPE_NAMES[k] || k; })
      .sort(function (a, b) { return ['TN', 'DS', 'TL'].indexOf(a.key) - ['TN', 'DS', 'TL'].indexOf(b.key); })
  };
}

/**
 * Sinh nhận xét tự động. Mỗi dòng có tiền tố [+] điểm mạnh, [!] cần khắc phục, [i] thông tin, [>] lời khuyên.
 */
function buildFeedback_(qs, graded, ctx) {
  var lines = [];
  var pct = graded.max ? graded.score / graded.max * 100 : 0;
  var d10 = round2_(pct / 10);
  var level = pct >= 90 ? 'Xuất sắc' : pct >= 80 ? 'Giỏi' : pct >= 65 ? 'Khá' : pct >= 50 ? 'Trung bình' : 'Cần cố gắng nhiều hơn';
  lines.push('[i] Kết quả: ' + fmtNum_(d10) + '/10 điểm — xếp loại ' + level + '. Đúng hoàn toàn ' + graded.correctCount + '/' + qs.length + ' câu.');

  var details = graded.items.map(function (g) { return { sc: g.score, m: g.max, c: g.correct, cd: g.chuDe, md: g.mucDo, l: g.loai }; });
  var b = breakdown_(details);

  // Theo dạng câu
  b.byType.forEach(function (t) {
    var items = graded.items.filter(function (g) { return g.loai === t.key; });
    if (t.key === 'TN') lines.push((t.pct >= 70 ? '[+] ' : t.pct < 50 ? '[!] ' : '[i] ') + 'Phần trắc nghiệm nhiều lựa chọn: đúng ' + t.correct + '/' + t.count + ' câu.');
    if (t.key === 'DS') {
      var ideas = items.reduce(function (s, g) { return s + (g.nCorrect || 0); }, 0);
      var almost = items.filter(function (g) { return g.nCorrect === 3; }).length;
      lines.push((t.pct >= 70 ? '[+] ' : t.pct < 50 ? '[!] ' : '[i] ') + 'Phần Đúng/Sai: đúng ' + ideas + '/' + (items.length * 4) + ' ý, được ' + fmtNum_(t.score) + '/' + fmtNum_(t.max) + ' điểm.');
      if (almost) lines.push('[>] Có ' + almost + ' câu Đúng/Sai chỉ sai đúng 1 ý (mất một nửa số điểm của câu). Đọc kĩ từng mệnh đề, chú ý các từ "luôn", "chỉ", "tỉ lệ thuận", đơn vị và dấu.');
    }
    if (t.key === 'TL') lines.push((t.pct >= 70 ? '[+] ' : t.pct < 50 ? '[!] ' : '[i] ') + 'Phần trả lời ngắn: đúng ' + t.correct + '/' + t.count + ' câu.');
  });

  // Theo mức độ
  b.byLevel.forEach(function (l) {
    if (l.key === 'NB' && l.pct < 75) lines.push('[!] Còn mất điểm ở câu Nhận biết (' + l.pct + '%). Nên ôn lại định nghĩa, công thức, đơn vị cơ bản — đây là phần điểm dễ lấy nhất.');
    if (l.key === 'TH' && l.pct < 60) lines.push('[!] Câu Thông hiểu mới đạt ' + l.pct + '%. Cần hiểu bản chất hiện tượng thay vì chỉ thuộc công thức.');
    if ((l.key === 'VD' || l.key === 'VDC') && l.pct >= 75) lines.push('[+] Làm tốt câu ' + l.name + ' (' + l.pct + '%) — kĩ năng tính toán và vận dụng tốt.');
    if ((l.key === 'VD' || l.key === 'VDC') && l.pct < 40 && l.count >= 1) lines.push('[>] Câu ' + l.name + ' đạt ' + l.pct + '%. Luyện thêm bài tập tính toán nhiều bước, chú ý đổi đơn vị và làm tròn theo yêu cầu.');
  });

  // Theo chủ đề
  var weak = b.byTopic.filter(function (t) { return t.pct < 50 && t.key !== 'Khác'; });
  var strong = b.byTopic.filter(function (t) { return t.pct >= 80 && t.key !== 'Khác'; }).reverse();
  if (strong.length) lines.push('[+] Nắm vững: ' + strong.map(function (t) { return t.name + ' (' + t.pct + '%)'; }).join(', ') + '.');
  if (weak.length) lines.push('[!] Cần ôn lại: ' + weak.map(function (t) { return t.name + ' (' + t.pct + '%)'; }).join(', ') + '.');

  // Bỏ trống
  var blank = graded.items.filter(function (g) { return !g.answered; });
  var blankTN = blank.filter(function (g) { return g.loai === 'TN'; }).length;
  if (blank.length) {
    lines.push('[!] Còn bỏ trống ' + blank.length + ' câu (câu ' + blank.map(function (g) { return g.stt; }).join(', ') + ').');
    if (blankTN) lines.push('[>] Trắc nghiệm không bị trừ điểm khi sai — luôn chọn đáp án cho mọi câu, kể cả khi chưa chắc chắn.');
  }

  // Thời gian
  if (ctx && ctx.limitSec) {
    var r = ctx.usedSec / ctx.limitSec;
    if (r < 0.4 && pct < 70) lines.push('[>] Bạn nộp bài khá sớm (dùng ' + Math.round(r * 100) + '% thời gian) nhưng điểm chưa cao — hãy dành thời gian còn lại để kiểm tra lại bài.');
    else if (r >= 0.97 && blank.length) lines.push('[>] Bạn dùng gần hết thời gian mà vẫn còn câu bỏ trống — làm câu dễ trước, đánh dấu câu khó để quay lại sau.');
    else if (r < 0.6 && pct >= 85) lines.push('[+] Làm bài nhanh và chính xác (dùng ' + Math.round(r * 100) + '% thời gian).');
  }

  // Tiến bộ
  if (ctx && ctx.prevSame && ctx.prevSame.length) {
    var last = ctx.prevSame[ctx.prevSame.length - 1];
    var diff = round2_(d10 - last);
    if (diff > 0) lines.push('[+] Tiến bộ ' + fmtNum_(diff) + ' điểm so với lần làm đề này trước đó (' + fmtNum_(last) + ').');
    else if (diff < 0) lines.push('[i] Giảm ' + fmtNum_(-diff) + ' điểm so với lần làm trước (' + fmtNum_(last) + '). Xem lại lời giải các câu sai trước khi làm lại.');
    else lines.push('[i] Bằng điểm lần làm trước (' + fmtNum_(last) + ').');
  } else if (ctx && ctx.prevAll && ctx.prevAll.length >= 2) {
    var a = round2_(avg_(ctx.prevAll));
    lines.push(d10 >= a ? '[+] Cao hơn điểm trung bình các bài trước của bạn (' + fmtNum_(a) + ').' : '[i] Thấp hơn điểm trung bình các bài trước của bạn (' + fmtNum_(a) + ').');
  }

  if (ctx && ctx.goal != null) {
    var gap = round2_(ctx.goal - d10);
    lines.push(gap <= 0 ? '[+] Mục tiêu ' + fmtNum_(ctx.goal) + ' điểm: ĐẠT' + (gap < 0 ? ' (vượt ' + fmtNum_(-gap) + ' điểm)' : '') + '.'
      : '[!] Mục tiêu ' + fmtNum_(ctx.goal) + ' điểm: chưa đạt, còn thiếu ' + fmtNum_(gap) + ' điểm.');
  }
  if (pct >= 90) lines.push('[>] Rất tốt! Thử sức với đề khó hơn hoặc giới hạn thời gian ngắn hơn để rèn tốc độ.');
  else if (weak.length) lines.push('[>] Gợi ý: xem lời giải các câu sai, ôn lại lí thuyết chủ đề "' + weak[0].name + '" rồi làm lại đề để củng cố.');
  return { text: lines.join('\n'), lines: lines };
}

function feedbackFromText_(text) {
  var map = { '+': 'good', '!': 'warn', 'i': 'info', '>': 'tip' };
  return String(text || '').split('\n').filter(String).map(function (l) {
    var m = l.match(/^\[(.)\]\s*(.*)$/);
    return m ? { type: map[m[1]] || 'info', text: m[2] } : { type: 'info', text: l };
  });
}

function overallAdvice_(b, scores) {
  var out = [];
  if (!scores.length) return ['Bạn chưa làm bài nào. Hãy bắt đầu với một đề đang mở!'];
  var weak = b.byTopic.filter(function (t) { return t.pct < 60 && t.key !== 'Khác' && t.count >= 2; }).slice(0, 3);
  var strong = b.byTopic.filter(function (t) { return t.pct >= 80 && t.key !== 'Khác' && t.count >= 2; }).reverse().slice(0, 3);
  if (strong.length) out.push('Điểm mạnh: ' + strong.map(function (t) { return t.name; }).join(', ') + '.');
  if (weak.length) out.push('Nên ưu tiên ôn: ' + weak.map(function (t) { return t.name + ' (' + t.pct + '%)'; }).join(', ') + '.');
  if (scores.length >= 3) {
    var n = Math.min(3, Math.floor(scores.length / 2));
    var early = avg_(scores.slice(0, n)), late = avg_(scores.slice(-n));
    var d = round2_(late - early);
    if (d > 0.2) out.push('Xu hướng tiến bộ: trung bình ' + n + ' bài gần nhất cao hơn ' + fmtNum_(d) + ' điểm so với ' + n + ' bài đầu tiên.');
    else if (d < -0.2) out.push('Điểm gần đây giảm ' + fmtNum_(-d) + ' so với giai đoạn đầu — hãy xem lại các câu sai thường gặp.');
    else out.push('Điểm số ổn định qua các bài.');
  }
  var nb = b.byLevel.filter(function (l) { return l.key === 'NB'; })[0];
  if (nb && nb.pct < 80) out.push('Câu Nhận biết mới đạt ' + nb.pct + '% — ôn chắc lí thuyết cơ bản để không mất điểm dễ.');
  return out;
}

/* =====================================================================
 *  GIÁO VIÊN
 * ===================================================================== */

/** Gộp các lần gọi khi giáo viên mở trang quản trị. Không gồm học sinh (có PIN) và kết quả (lớn). */
function apiAdminBootstrap_(req) {
  var u = requireTeacher_(req);
  return { me: { role: 'teacher', email: u.email }, overview: apiAdminOverview_(req), exams: apiAdminListExams_(req), v: APP_VERSION };
}

function apiAdminOverview_(req) {
  requireTeacher_(req);
  var rs = readTable_('KetQua');
  var sts = readTable_('HocSinh');
  var exams = readTable_('DeThi');
  var today = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy');
  return {
    sheetUrl: ss_().getUrl(),
    version: APP_VERSION,
    counts: {
      students: sts.filter(function (s) { return s.trangThai !== 'KHOA'; }).length,
      exams: exams.length,
      openExams: exams.filter(function (e) { return examStatus_(e).open; }).length,
      results: rs.length,
      today: rs.filter(function (r) { return String(r.nopLuc).indexOf(today) === 0; }).length
    },
    avg: rs.length ? round2_(avg_(rs.map(function (r) { return num_(r.diem); }))) : null,
    recent: rs.slice(-15).reverse().map(resultSummary_),
    passwordIsDefault: false,
    googleReady: !!getSetting_('GOOGLE_CLIENT_ID')
  };
}

function apiAdminListStudents_(req) {
  requireTeacher_(req);
  var rs = readTable_('KetQua');
  var stat = {};
  rs.forEach(function (r) {
    stat[r.studentId] = stat[r.studentId] || { n: 0, sum: 0 };
    stat[r.studentId].n++; stat[r.studentId].sum += num_(r.diem);
  });
  return readTable_('HocSinh').map(function (s) {
    var t = stat[s.id];
    return {
      id: s.id, hoTen: s.hoTen, lop: s.lop, ngaySinh: s.ngaySinh, pin: pinOf_(s), pinRieng: !!String(s.pin || '').trim(),
      email: s.email, trangThai: s.trangThai || 'HOAT_DONG', ngayTao: s.ngayTao,
      soBai: t ? t.n : 0, diemTB: t ? round2_(t.sum / t.n) : null
    };
  });
}

function apiAdminSaveStudent_(req) {
  requireTeacher_(req);
  var s = req.student || {};
  var hoTen = str_(s.hoTen), lop = str_(s.lop).toUpperCase();
  if (!hoTen || !lop) throw new Error('Cần nhập họ tên và lớp.');
  var ngaySinh = normalizeDob_(s.ngaySinh);
  var pin = String(s.pin || '').replace(/\D/g, '');
  if (pin && pin.length !== 4) throw new Error('PIN riêng phải gồm đúng 4 chữ số.');
  if (!ngaySinh && !pin) throw new Error('Cần ngày sinh (để tạo PIN) hoặc PIN riêng.');
  var email = low_(s.email);
  return withLock_(function () {
    var all = readTable_('HocSinh', { fresh: true });
    if (email && all.some(function (x) { return low_(x.email) === email && x.id !== s.id; })) throw new Error('Email đã được dùng cho học sinh khác.');
    var obj = { hoTen: hoTen, lop: lop, ngaySinh: ngaySinh, pin: pin, email: email, trangThai: s.trangThai === 'KHOA' ? 'KHOA' : 'HOAT_DONG' };
    var cur = s.id ? all.filter(function (x) { return x.id === s.id; })[0] : null;
    if (cur) { updateRow_('HocSinh', cur._row, obj, 'id', cur.id); obj.id = cur.id; }
    else { obj.id = nextStudentId_(all, 0); obj.ngayTao = nowIso_(); appendRows_('HocSinh', [obj]); }
    return obj;
  });
}

/** Thêm nhiều học sinh: rows = [{hoTen, lop, ngaySinh, email}] */
function apiAdminImportStudents_(req) {
  requireTeacher_(req);
  var rows = req.rows || [];
  return withLock_(function () {
    var all = readTable_('HocSinh', { fresh: true });
    var added = [], skipped = [];
    rows.forEach(function (r, i) {
      var hoTen = str_(r.hoTen), lop = str_(r.lop).toUpperCase(), ngaySinh = normalizeDob_(r.ngaySinh), email = low_(r.email);
      if (!hoTen || !lop || !ngaySinh) { skipped.push('Dòng ' + (i + 1) + ': thiếu họ tên/lớp/ngày sinh hợp lệ'); return; }
      var dup = all.concat(added).some(function (x) { return low_(x.hoTen) === low_(hoTen) && x.lop === lop && normalizeDob_(x.ngaySinh) === ngaySinh; });
      if (dup) { skipped.push('Dòng ' + (i + 1) + ': ' + hoTen + ' (' + lop + ') đã có'); return; }
      added.push({ id: nextStudentId_(all, added.length), hoTen: hoTen, lop: lop, ngaySinh: ngaySinh, pin: '', email: email, trangThai: 'HOAT_DONG', ngayTao: nowIso_() });
    });
    appendRows_('HocSinh', added);
    return { added: added.length, skipped: skipped };
  });
}

function apiAdminDeleteStudent_(req) {
  requireTeacher_(req);
  return withLock_(function () {
    var st = readTable_('HocSinh', { fresh: true }).filter(function (x) { return x.id === req.id; })[0];
    if (!st) throw new Error('Không tìm thấy học sinh.');
    deleteRows_('HocSinh', [st._row], 'id', [st.id]);
    return true;
  });
}

function apiAdminListExams_(req) {
  requireTeacher_(req);
  var counts = countQuestions_();
  var rs = readTable_('KetQua');
  return readTable_('DeThi').map(function (e) {
    var mine = rs.filter(function (r) { return r.examId === e.id; });
    return Object.assign(examOut_(e), {
      soCau: counts[e.id] || 0, soBai: mine.length,
      diemTB: mine.length ? round2_(avg_(mine.map(function (r) { return num_(r.diem); }))) : null,
      trangThaiText: examStatus_(e).text
    });
  }).reverse();
}

function apiAdminGetExam_(req) {
  requireTeacher_(req);
  var e = findExam_(req.examId);
  if (!e) throw new Error('Không tìm thấy đề.');
  return { exam: examOut_(e), questions: examQuestions_(e.id) };
}

function apiAdminSaveExam_(req) {
  requireTeacher_(req);
  var ex = req.exam || {};
  var qs = req.questions || [];
  if (!str_(ex.tieuDe)) throw new Error('Cần nhập tên đề.');
  qs.forEach(function (q, i) { validateQuestion_(q, i); });
  return withLock_(function () {
    var exams = readTable_('DeThi', { fresh: true });
    var cur = ex.id ? exams.filter(function (x) { return x.id === ex.id; })[0] : null;
    var obj = {
      tieuDe: str_(ex.tieuDe), lop: String(ex.lop || '').split(/[,;]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(String).join(', '),
      moTa: str_(ex.moTa), thoiGian: Math.max(1, num_(ex.thoiGian) || 45),
      trangThai: ['NHAP', 'MO', 'DONG'].indexOf(ex.trangThai) >= 0 ? ex.trangThai : 'NHAP',
      batDau: str_(ex.batDau), ketThuc: str_(ex.ketThuc), soLanLam: Math.max(0, num_(ex.soLanLam)),
      hienLoiGiai: ['NGAY', 'SAU_HAN', 'KHONG'].indexOf(ex.hienLoiGiai) >= 0 ? ex.hienLoiGiai : 'NGAY',
      tronCau: yes_(ex.tronCau) ? 'CO' : 'KHONG', capNhat: nowIso_()
    };
    var id;
    if (cur) { id = cur.id; updateRow_('DeThi', cur._row, obj, 'id', cur.id); }
    else {
      id = 'DE' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + Math.floor(Math.random() * 9000 + 1000);
      obj.id = id; obj.ngayTao = nowIso_();
      appendRows_('DeThi', [obj]);
    }
    replaceQuestions_(id, qs.map(function (q, i) { return normalizeQuestion_(Object.assign({}, q, { examId: id, stt: i + 1 }), i); }));
    return { id: id };
  });
}

function apiAdminDeleteExam_(req) {
  requireTeacher_(req);
  return withLock_(function () {
    var e = readTable_('DeThi', { fresh: true }).filter(function (x) { return x.id === req.examId; })[0];
    if (!e) throw new Error('Không tìm thấy đề.');
    replaceQuestions_(e.id, []);
    deleteRows_('DeThi', [e._row], 'id', [e.id]);
    return true;
  });
}

function apiAdminResults_(req) {
  requireTeacher_(req);
  return readTable_('KetQua').filter(function (r) {
    return (!req.examId || r.examId === req.examId) && (!req.lop || r.lop === req.lop) && (!req.studentId || r.studentId === req.studentId);
  }).map(function (r) { return Object.assign(resultSummary_(r), { nhanXet: r.nhanXet, ghiChu: r.ghiChu }); }).reverse();
}

function apiAdminDeleteResult_(req) {
  requireTeacher_(req);
  return withLock_(function () {
    var r = readTable_('KetQua', { fresh: true }).filter(function (x) { return x.id === req.resultId; })[0];
    if (!r) throw new Error('Không tìm thấy bài làm.');
    deleteRows_('KetQua', [r._row], 'id', [r.id]);
    return true;
  });
}

function apiAdminExamStats_(req) {
  requireTeacher_(req);
  var e = findExam_(req.examId);
  if (!e) throw new Error('Không tìm thấy đề.');
  var qs = examQuestions_(e.id);
  var rs = readTable_('KetQua').filter(function (r) { return r.examId === e.id && (!req.lop || r.lop === req.lop); });
  var firstOnly = req.mode === 'first';
  if (firstOnly) {
    var seen = {};
    rs = rs.filter(function (r) { if (seen[r.studentId]) return false; seen[r.studentId] = 1; return true; });
  }
  var scores = rs.map(function (r) { return num_(r.diem); });
  var bins = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  scores.forEach(function (s) { bins[Math.min(9, Math.floor(s))]++; });
  var perQ = {};
  qs.forEach(function (q) { perQ[q.stt] = { stt: q.stt, loai: q.loai, chuDe: q.chuDe, mucDo: q.mucDo, dapAn: q.dapAn, noiDung: q.noiDung, n: 0, correct: 0, score: 0, max: 0, blank: 0, choices: {} }; });
  var all = [];
  rs.forEach(function (r) {
    var det = parseJson_(r.chiTiet, []);
    all = all.concat(det);
    det.forEach(function (d) {
      var p = perQ[d.s];
      if (!p) return;
      p.n++; p.correct += d.c ? 1 : 0; p.score += num_(d.sc); p.max += num_(d.m);
      if (d.a === '' || d.a === '____' || d.a == null) p.blank++;
      else if (d.l === 'TN') p.choices[d.a] = (p.choices[d.a] || 0) + 1;
    });
  });
  var classes = {};
  rs.forEach(function (r) { classes[r.lop] = classes[r.lop] || []; classes[r.lop].push(num_(r.diem)); });
  var sorted = scores.slice().sort(function (a, b) { return a - b; });
  return {
    exam: examOut_(e),
    count: rs.length,
    students: Object.keys(rs.reduce(function (m, r) { m[r.studentId] = 1; return m; }, {})).length,
    avg: scores.length ? round2_(avg_(scores)) : null,
    max: scores.length ? sorted[sorted.length - 1] : null,
    min: scores.length ? sorted[0] : null,
    median: scores.length ? round2_(sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null,
    passRate: scores.length ? Math.round(scores.filter(function (s) { return s >= 5; }).length / scores.length * 100) : null,
    goalRate: (function () {
      var w = rs.filter(function (r) { return r.mucTieu !== '' && r.mucTieu != null; });
      return w.length ? Math.round(w.filter(function (r) { return num_(r.diem) >= num_(r.mucTieu) - 1e-9; }).length / w.length * 100) : null;
    })(),
    bins: bins,
    byClass: Object.keys(classes).sort(sortVi_).map(function (k) { return { lop: k, n: classes[k].length, avg: round2_(avg_(classes[k])) }; }),
    questions: Object.keys(perQ).map(function (k) {
      var p = perQ[k];
      p.pct = p.max ? Math.round(p.score / p.max * 100) : 0;
      p.score = round2_(p.score); p.max = round2_(p.max);
      return p;
    }).sort(function (a, b) { return a.stt - b.stt; }),
    byTopic: breakdown_(all).byTopic,
    byLevel: breakdown_(all).byLevel,
    results: rs.map(resultSummary_).sort(function (a, b) { return b.diem - a.diem; })
  };
}

/** Bảng điểm: học sinh × đề (điểm cao nhất mỗi đề) */
function apiAdminGradebook_(req) {
  requireTeacher_(req);
  var lop = str_(req.lop);
  var sts = readTable_('HocSinh').filter(function (s) { return !lop || s.lop === lop; })
    .sort(function (a, b) { return sortVi_(a.lop, b.lop) || sortVi_(firstNameKey_(a.hoTen), firstNameKey_(b.hoTen)); });
  var ids = {};
  sts.forEach(function (s) { ids[s.id] = 1; });
  var rs = readTable_('KetQua').filter(function (r) { return ids[r.studentId]; });
  var examIds = {};
  rs.forEach(function (r) { examIds[r.examId] = 1; });
  var exams = readTable_('DeThi').filter(function (e) { return examIds[e.id]; }).map(function (e) { return { id: e.id, tieuDe: e.tieuDe }; });
  var cell = {};
  rs.forEach(function (r) {
    var k = r.studentId + '|' + r.examId;
    var c = cell[k] || { best: -1, n: 0, last: null };
    c.best = Math.max(c.best, num_(r.diem)); c.n++; c.last = num_(r.diem);
    cell[k] = c;
  });
  return {
    exams: exams,
    rows: sts.map(function (s) {
      var scores = {};
      var vals = [];
      exams.forEach(function (e) {
        var c = cell[s.id + '|' + e.id];
        if (c) { scores[e.id] = { best: c.best, n: c.n, last: c.last }; vals.push(c.best); }
      });
      return { id: s.id, hoTen: s.hoTen, lop: s.lop, scores: scores, soDe: vals.length, tb: vals.length ? round2_(avg_(vals)) : null };
    })
  };
}

function apiAdminUploadImage_(req) {
  requireTeacher_(req);
  var data = String(req.base64 || '').replace(/^data:[^,]+,/, '');
  if (!data) throw new Error('Không có dữ liệu ảnh.');
  if (data.length > 6 * 1024 * 1024) throw new Error('Ảnh quá lớn (tối đa ~4MB).');
  var mime = /^image\/(png|jpeg|gif|webp|svg\+xml)$/.test(req.mime) ? req.mime : 'image/png';
  var blob = Utilities.newBlob(Utilities.base64Decode(data), mime, str_(req.name) || 'hinh.png');
  var file = imageFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { url: 'https://lh3.googleusercontent.com/d/' + file.getId(), id: file.getId() };
}

function imageFolder_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty('IMAGE_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* tạo lại */ } }
  var f = DriveApp.createFolder('Luyện đề Vật lý — Hình ảnh');
  p.setProperty('IMAGE_FOLDER', f.getId());
  return f;
}

var EDITABLE_SETTINGS = ['TEN_UNG_DUNG', 'TEN_GIAO_VIEN', 'GOOGLE_CLIENT_ID', 'EMAIL_GIAO_VIEN', 'HIEN_BANG_XEP_HANG', 'BXH_AN_TEN', 'GUI_EMAIL_KHI_NOP', 'CHO_LIEN_KET_GOOGLE',
  'KHO_CAU_HOI_ID', 'THU_MUC_HINH_KHO_ID', 'CHO_LUYEN_TAP', 'LUYEN_NHANH'];

function apiAdminGetSettings_(req) {
  requireTeacher_(req);
  return readTable_('CaiDat').filter(function (r) { return EDITABLE_SETTINGS.indexOf(r.khoa) >= 0; })
    .map(function (r) { return { khoa: r.khoa, giaTri: r.giaTri, ghiChu: r.ghiChu }; });
}

function apiAdminSaveSettings_(req) {
  requireTeacher_(req);
  var s = req.settings || {};
  return withLock_(function () {
    var rows = readTable_('CaiDat', { fresh: true });
    Object.keys(s).forEach(function (k) {
      if (EDITABLE_SETTINGS.indexOf(k) < 0 && k !== 'MAT_KHAU_QUAN_TRI') return;
      var v = str_(s[k]);
      if (k === 'MAT_KHAU_QUAN_TRI') { if (!v) return; if (v.length < 6) throw new Error('Mật khẩu cần ít nhất 6 kí tự.'); }
      var r = rows.filter(function (x) { return x.khoa === k; })[0];
      if (r) updateRow_('CaiDat', r._row, { giaTri: v }, 'khoa', k);
      else appendRows_('CaiDat', [{ khoa: k, giaTri: v, ghiChu: '' }]);
    });
    return true;
  });
}

function notifyTeacher_(r) {
  try {
    if (!yes_(getSetting_('GUI_EMAIL_KHI_NOP'))) return;
    var to = String(getSetting_('EMAIL_GIAO_VIEN') || '').split(/[,;\s]+/).filter(String).join(',');
    if (!to) return;
    MailApp.sendEmail({
      to: to,
      subject: '[Luyện đề] ' + r.hoTen + ' (' + r.lop + ') — ' + fmtNum_(r.diem) + ' điểm — ' + r.tieuDe,
      body: 'Họ tên: ' + r.hoTen + '\nLớp: ' + r.lop + '\nĐề: ' + r.tieuDe + '\nĐiểm: ' + fmtNum_(r.diem) + '/10 (' + fmtNum_(r.diemGoc) + '/' + fmtNum_(r.diemToiDa) + ')' +
        '\nSố câu đúng: ' + r.soCauDung + '/' + r.tongCau + '\nThời gian làm: ' + r.thoiGianLam + '\nNộp lúc: ' + r.nopLuc +
        (r.ghiChu ? '\nGhi chú: ' + r.ghiChu : '') + '\n\nNhận xét tự động:\n' + String(r.nhanXet).replace(/^\[.\]\s*/gm, '• ') +
        '\n\nXem toàn bộ kết quả: ' + ss_().getUrl()
    });
  } catch (e) { /* không làm hỏng việc nộp bài nếu gửi mail lỗi */ }
}

/* =====================================================================
 *  NGÂN HÀNG CÂU HỎI (Pha 2) — chỉ ĐỌC file "KHO CÂU HỎI VẬT LÝ"
 *   - Đọc kho theo TÊN cột tiêu đề, dựng chỉ mục gọn, đệm 10 phút (chia mảnh, ngưỡng 2 MB).
 *   - Câu đầy đủ đọc theo số hàng, chỉ các hàng được chọn.
 *   - Hình: tìm theo tên file trong thư mục hình của kho, CHÉP sang thư mục web (không đổi quyền file gốc).
 *   - Chỉ câu có đáp án hợp lệ mới dùng được (QUYET-DINH §5); Phần IV bỏ qua.
 * ===================================================================== */

var BANK_SHEET = 'Kho câu hỏi';
/** khóa nội bộ → [tên cột trong kho, bắt buộc?] */
var BANK_COLS = {
  maKho: ['Mã câu', 1], lop: ['Lớp', 1], chuong: ['Chương', 1], bai: ['Bài', 1], dang: ['Dạng câu hỏi', 1],
  mucDo: ['Mức độ', 1], mucDoY: ['Mức độ từng ý (Phần II)', 0], noiDung: ['Nội dung câu hỏi', 1],
  A: ['A / a)', 1], B: ['B / b)', 1], C: ['C / c)', 1], D: ['D / d)', 1], dapAn: ['Đáp án', 1],
  loiGiai: ['Lời giải', 0], hinhVe: ['Hình vẽ', 0], nguon: ['Nguồn', 1], viTri: ['Vị trí trong đề gốc', 1]
};
/** Cột cần để dựng chỉ mục (không đọc Lời giải, Mức độ từng ý… cho nhẹ). */
var BANK_INDEX_KEYS = ['maKho', 'lop', 'chuong', 'bai', 'dang', 'mucDo', 'noiDung', 'A', 'B', 'C', 'D', 'dapAn', 'hinhVe', 'nguon', 'viTri'];
var BANK_CACHE_SECONDS = 600;        // chỉ mục và bản đồ hình: 10 phút
var BANK_INDEX_MAX_BYTES = 2000000;  // chỉ mục lớn hơn 2 MB thì không đệm (vẫn đúng, chậm hơn)
var BANK_WARN_ROWS = 3000;
var BANK_TOM_CHARS = 160;
var BANK_IMG_PER_CALL = 40;          // mỗi lần gọi chép tối đa 40 hình
var BANK_TIME_LIMIT_MS = 270000;     // dừng ở mốc 4,5 phút (Apps Script giới hạn 6 phút)
var BANK_TIME_MARGIN_MS = 15000;     // chừa thời gian cho một lần chép hình
var BANK_MAX_PICK = 500;
var BANK_LEVELS = { BIET: 'NB', NHANBIET: 'NB', NB: 'NB', HIEU: 'TH', THONGHIEU: 'TH', TH: 'TH', VANDUNG: 'VD', VD: 'VD', VANDUNGCAO: 'VDC', VDC: 'VDC' };
var BANK_LOI = {
  tuLuan: 'Phần IV (tự luận) — chưa hỗ trợ chấm',
  khongRoDang: 'không rõ dạng câu (Phần I/II/III)',
  khongDapAn: 'chưa có đáp án',
  dapAnSai: 'đáp án không đúng định dạng',
  thieuPhuongAn: 'thiếu phương án / ý a–d',
  thieuNoiDung: 'thiếu nội dung'
};

function nowMs_() { return Date.now(); } // kiểm thử thay bằng đồng hồ giả

/* ---------- ánh xạ một hàng kho → câu hỏi web (hàm thuần) ---------- */

/** Phần của câu: "Phần I/II/III/IV – …"; không rõ thì xem mã câu "…-P2-…". */
function bankPart_(dang, maKho) {
  var m = /Ph[aầ]n\s*(IV|III|II|I)(?![IVX])/i.exec(String(dang || ''));
  if (m) return { I: 1, II: 2, III: 3, IV: 4 }[m[1].toUpperCase()];
  m = /-P([1-4])-/i.exec(String(maKho || ''));
  return m ? +m[1] : 0;
}

/** Mức độ: ánh xạ tường minh Biết→NB, Hiểu→TH, Vận dụng→VD, Vận dụng cao→VDC. */
function bankLevel_(m) { return BANK_LEVELS[plain_(m)] || ''; }

/** Đáp án Phần II: "a) Đúng b) Sai…", "a) S b) Đ…", "a) đúng; b) Sai, c) S. d) Đ" → "ĐSSĐ"; thiếu ý → ''. */
function bankTF_(s) {
  var re = /([a-d])\)\s*(Đúng|Sai|Đ|S)(?=[\s,;.]|$)/gi;
  var got = {}, m;
  while ((m = re.exec(String(s || '')))) {
    var k = m[1].toLowerCase();
    if (!got[k]) got[k] = /^s/i.test(m[2]) ? 'S' : 'Đ';
  }
  return got.a && got.b && got.c && got.d ? got.a + got.b + got.c + got.d : '';
}

/** Đáp án Phần III: giữ nguyên chuỗi số (vd "3,0", "-120"); không phải số → ''. */
function bankShort_(s) {
  var t = str_(s).replace(/^'/, '').trim();
  if (!t) return '';
  // nhận cả "1e-7", ".5", ",5", "-0,5" (ô kiểu số rất nhỏ/lớn được Sheet trả về dạng số mũ)
  var ok = t.split('|').every(function (x) { return /^[-+−]?\s*(\d+([.,]\d*)?|[.,]\d+)(e[-+]?\d+)?$/i.test(x.trim()); });
  return ok ? t.replace(/−/g, '-') : '';
}

/** Tên file hình đầu tiên trong ô "Có – L12C2B11-P1-00001.png (02. HÌNH VẼ/Lớp 12)"; không có hình → ''. */
function bankImageName_(s) { return bankImageNames_(s)[0] || ''; }

/**
 * Mọi tên file hình trong ô "Hình vẽ" (R-12, Pha 4): "Có – A.png, B.png (02. HÌNH VẼ/…)" → ["A.png", "B.png"].
 * Tên file có thể chứa dấu cách; các tên cách nhau bằng "," ";" "+" hoặc " và ".
 */
function bankImageNames_(s) {
  var t = str_(s);
  if (!t || /^kh[oô]ng/i.test(t)) return [];
  var IMG = /\.(?:png|jpe?g|gif|webp|svg)$/i;
  var u = t.replace(/^c[oó](?=\s|[–—\-:]|$)\s*[–—\-:]?\s*/i, '').replace(/\s*\([^()]*\)\s*$/, '').trim();
  var parts = u.split(/\s*[,;+]\s*|\s+và\s+/i).map(function (x) { return x.trim(); }).filter(String);
  if (parts.length && parts.every(function (x) { return IMG.test(x) && /^[^\/\\()]+$/.test(x); })) {
    return parts.filter(function (x, i) { return parts.indexOf(x) === i; });
  }
  var out = [], re = /([^\s\/\\()–—,;+]+\.(?:png|jpe?g|gif|webp|svg))/gi, m;
  while ((m = re.exec(t))) if (out.indexOf(m[1]) < 0) out.push(m[1]);
  return out;
}

/** Ô "Hình vẽ" ghi là CÓ hình (dù có đọc được tên file hay không). */
function bankSaysImage_(s) { return /^\s*c[oó](?=\s|[–—\-:]|$)/i.test(str_(s)); }

/** Vị trí trong đề gốc: "P1 – Câu 3", "Mã 101 – P1 Câu 12", "P2 – Câu 1 (trang 3) – file: …". */
function bankPosition_(s) {
  var t = String(s || '');
  var m = /P\s*([1-4])\s*[–—\-:.]?\s*C[aâ]u\s*(\d+)/i.exec(t);
  var f = /file:\s*(.+?)\s*$/i.exec(t);
  return { phan: m ? +m[1] : 0, cau: m ? +m[2] : 0, file: f ? f[1] : '' };
}

/** Chủ đề theo Bài (bỏ tiền tố "Bài N. "); không có Bài thì theo Chương. */
function bankTopic_(bai, chuong) {
  return str_(bai).replace(/^B[aà]i\s*\d+\s*[.:\-–]?\s*/i, '') || str_(chuong).replace(/^Ch[uư][oơ]ng\s*[IVXLC\d]+\s*[.:\-–]?\s*/i, '');
}

/**
 * Hàng kho (object theo khóa BANK_COLS) → { q, loi, coDapAn, hinh }.
 * q = câu hỏi web (null nếu không dùng được); loi = mã lý do bị loại (xem BANK_LOI); hinh = tên file hình.
 * Câu Phần II: dapAn dạng "ĐSSĐ". Hình: hinhAnh để trống, adminBankToQuestions điền URL bản chép.
 */
function bankToQuestion_(row) {
  var r = row || {};
  var phan = bankPart_(r.dang, r.maKho);
  var hinhs = bankImageNames_(r.hinhVe);
  var hinh = hinhs[0] || '';
  var raw = str_(r.dapAn).replace(/^'/, '');
  // hinhThem: hình thứ hai trở đi (R-12) — chép như hình chính, gắn vào cuối nội dung dạng ![](url)
  var out = { q: null, loi: '', coDapAn: false, hinh: hinh, hinhThem: hinhs.slice(1), hinhKhongTen: !hinh && bankSaysImage_(r.hinhVe) };
  if (phan === 4) { out.loi = 'tuLuan'; out.coDapAn = !!raw; return out; }
  if (!phan) { out.loi = 'khongRoDang'; return out; }
  var loai = ['', 'TN', 'DS', 'TL'][phan];
  var dapAn = '';
  if (loai === 'TN') { var c = raw.toUpperCase().replace(/[\s.)]/g, ''); dapAn = /^[ABCD]$/.test(c) ? c : ''; }
  else if (loai === 'DS') dapAn = bankTF_(raw);
  else dapAn = bankShort_(raw);
  out.coDapAn = !!dapAn;
  if (!raw) { out.loi = 'khongDapAn'; return out; }
  if (!dapAn) { out.loi = 'dapAnSai'; return out; }
  var opt = function (k) { return loai === 'TL' ? '' : String(r[k] == null ? '' : r[k]); };
  if (loai !== 'TL' && !['A', 'B', 'C', 'D'].every(function (k) { return str_(r[k]); })) { out.loi = 'thieuPhuongAn'; return out; }
  if (!str_(r.noiDung) && !hinh) { out.loi = 'thieuNoiDung'; return out; }
  out.q = {
    loai: loai, phan: phan, noiDung: String(r.noiDung == null ? '' : r.noiDung), hinhAnh: '',
    A: opt('A'), B: opt('B'), C: opt('C'), D: opt('D'), dapAn: dapAn, diem: '', saiSo: '',
    chuDe: bankTopic_(r.bai, r.chuong), mucDo: bankLevel_(r.mucDo), loiGiai: String(r.loiGiai == null ? '' : r.loiGiai),
    maKho: str_(r.maKho), chuong: str_(r.chuong), bai: str_(r.bai), mucDoY: str_(r.mucDoY), nguon: str_(r.nguon)
  };
  return out;
}

/* ---------- mở kho, đọc theo cột tiêu đề ---------- */

function idFromSetting_(v) {
  var s = str_(v);
  var m = /\/(?:d|folders)\/([\w-]{10,})/.exec(s) || /[?&]id=([\w-]{10,})/.exec(s);
  return m ? m[1] : s;
}

function bankId_() {
  var id = idFromSetting_(getSetting_('KHO_CAU_HOI_ID'));
  if (!id) throw new Error('Chưa cấu hình kho câu hỏi: dán id (hoặc link) file "KHO CÂU HỎI VẬT LÝ" vào CaiDat → KHO_CAU_HOI_ID (hoặc mục Cài đặt).');
  return id;
}

/** Mở kho một lần mỗi request: { sh, col: {khóa: số cột}, lastRow, lastCol }. */
function bankOpen_() {
  if (MEMO_.__kho) return MEMO_.__kho;
  var id = bankId_();
  var ss;
  try { ss = SpreadsheetApp.openById(id); } catch (e) {
    throw new Error('Không mở được kho câu hỏi (' + (e && e.message || e) + '). Kiểm tra KHO_CAU_HOI_ID trong CaiDat; nếu là lần đầu, mở Apps Script và chạy hàm setup() một lần để cấp quyền đọc Drive.');
  }
  var sh = ss.getSheetByName(BANK_SHEET);
  if (!sh) throw new Error('File kho không có trang tính "' + BANK_SHEET + '".');
  var lastCol = sh.getLastColumn(), lastRow = sh.getLastRow();
  var header = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(str_) : [];
  var plainHeader = header.map(plain_);
  var col = {}, missing = [];
  Object.keys(BANK_COLS).forEach(function (k) {
    var name = BANK_COLS[k][0];
    var i = header.indexOf(name);
    if (i < 0) i = plainHeader.indexOf(plain_(name));
    if (i >= 0) col[k] = i + 1;
    else if (BANK_COLS[k][1]) missing.push('"' + name + '"');
  });
  if (missing.length) throw new Error('Trang "' + BANK_SHEET + '" của kho thiếu cột: ' + missing.join(', ') + '. Không đổi tên cột tiêu đề của kho.');
  MEMO_.__kho = { id: id, sh: sh, col: col, lastRow: lastRow, lastCol: lastCol };
  return MEMO_.__kho;
}

/** Đọc các cột `keys` của những hàng liền nhau [start, start+n) — mỗi khối cột liền nhau 1 lần getRange. */
function bankReadBlock_(kho, keys, start, n) {
  var cols = keys.filter(function (k) { return kho.col[k]; }).map(function (k) { return kho.col[k]; })
    .filter(function (c, i, a) { return a.indexOf(c) === i; }).sort(function (a, b) { return a - b; });
  var rows = [];
  for (var i = 0; i < n; i++) rows.push({ _row: start + i });
  var g = 0;
  while (g < cols.length) {
    var e = g;
    while (e + 1 < cols.length && cols[e + 1] === cols[e] + 1) e++;
    var vals = kho.sh.getRange(start, cols[g], n, cols[e] - cols[g] + 1).getValues();
    keys.forEach(function (k) {
      var c = kho.col[k];
      if (c >= cols[g] && c <= cols[e]) for (var r = 0; r < n; r++) rows[r][k] = cell_(vals[r][c - cols[g]]);
    });
    g = e + 1;
  }
  keys.forEach(function (k) { if (!kho.col[k]) rows.forEach(function (o) { o[k] = ''; }); });
  return rows;
}

/** Đọc đầy đủ các hàng cho trước (chỉ những hàng đó), gom thành từng khối hàng liền nhau. */
function bankReadRows_(kho, rowNums) {
  var nums = rowNums.filter(function (r, i, a) { return r >= 2 && r <= kho.lastRow && a.indexOf(r) === i; }).sort(function (a, b) { return a - b; });
  var keys = Object.keys(BANK_COLS).filter(function (k) { return kho.col[k]; });
  var cols = keys.map(function (k) { return kho.col[k]; });
  var c0 = Math.min.apply(null, cols), c1 = Math.max.apply(null, cols);
  var out = {};
  var i = 0;
  while (i < nums.length) {
    var j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    // mỗi khối hàng liền nhau: MỘT lần getRange phủ mọi cột cần
    var vals = kho.sh.getRange(nums[i], c0, j - i + 1, c1 - c0 + 1).getValues();
    vals.forEach(function (row, r) {
      var o = { _row: nums[i] + r };
      Object.keys(BANK_COLS).forEach(function (k) { o[k] = kho.col[k] ? cell_(row[kho.col[k] - c0]) : ''; });
      out[o._row] = o;
    });
    i = j + 1;
  }
  return out;
}

/* ---------- chỉ mục gọn + đệm ---------- */

/**
 * Chỉ mục kho: { id, docLuc, rows:[{maKho,hang,lop,chuong,bai,loai,phan,cau,mucDo,nguon,viTri,coDapAn,coHinh,loi,tom}], ten:{nguồn→tên}, khongDem }.
 * Đọc từ đệm (10 phút) nếu có; opts.refresh = đọc lại kho.
 */
function bankIndex_(opts) {
  var refresh = !!(opts && opts.refresh);
  if (!refresh && MEMO_.__bank) return MEMO_.__bank;
  var id = bankId_();
  var cache = scriptCache_();
  var head = null;
  if (cache) {
    try {
      var gen = refresh ? null : cache.get('bankgen');
      if (!gen) { gen = newGen_(); cache.put('bankgen', gen, GEN_SECONDS); }
      head = 'bk_' + gen;
      if (!refresh) {
        var json = cacheGetChunked_(cache, head);
        var packed = json ? parseJson_(json, null) : null;
        if (packed && packed.id === id && packed.v === 1) { MEMO_.__bank = bankUnpack_(packed); return MEMO_.__bank; }
      }
    } catch (e) { head = null; }
  }
  var packed2 = bankBuildIndex_();
  var stored = false;
  if (cache && head) { try { stored = cachePutChunked_(cache, head, JSON.stringify(packed2), BANK_CACHE_SECONDS, BANK_INDEX_MAX_BYTES); } catch (e) { stored = false; } }
  MEMO_.__bank = bankUnpack_(packed2);
  MEMO_.__bank.khongDem = !stored;
  return MEMO_.__bank;
}

function bankBuildIndex_() {
  var kho = bankOpen_();
  var n = Math.max(0, kho.lastRow - 1);
  var raw = n ? bankReadBlock_(kho, BANK_INDEX_KEYS, 2, n) : [];
  var dict = { lop: [], chuong: [], bai: [], nguon: [] }, pos = { lop: {}, chuong: {}, bai: {}, nguon: {} };
  var put = function (d, v) { if (!(v in pos[d])) { pos[d][v] = dict[d].length; dict[d].push(v); } return pos[d][v]; };
  var rows = [];
  raw.forEach(function (o) {
    if (!str_(o.maKho) && !str_(o.noiDung) && !str_(o.dang)) return; // hàng trống
    var c = bankToQuestion_(o);
    var p = bankPosition_(o.viTri);
    var phan = bankPart_(o.dang, o.maKho);
    var src = str_(o.nguon) + (p.file ? ' | ' + p.file : '');
    var viTri = p.phan ? 'P' + p.phan + ' – Câu ' + p.cau : str_(o.viTri).slice(0, 40);
    var tom = c.loi ? '' : String(o.noiDung || '').replace(/\s+/g, ' ').trim().slice(0, BANK_TOM_CHARS);
    rows.push([str_(o.maKho), o._row, put('lop', str_(o.lop)), put('chuong', str_(o.chuong)), put('bai', str_(o.bai)),
      phan, p.cau, bankLevel_(o.mucDo), put('nguon', src), viTri, c.coDapAn ? 1 : 0, c.hinh || c.hinhKhongTen ? 1 : 0, c.loi, tom]);
  });
  return { v: 1, id: bankOpen_().id, docLuc: fmtDateTime_(new Date(nowMs_())), d: dict, r: rows };
}

function bankUnpack_(p) {
  var files = {}; // nguồn → số file đề gốc khác nhau (để đặt tên hiển thị)
  p.d.nguon.forEach(function (k) { var b = k.split(' | ')[0]; files[b] = (files[b] || 0) + 1; });
  var ten = {};
  p.d.nguon.forEach(function (k) {
    var parts = k.split(' | ');
    var f = parts[1] ? parts[1].split('/').pop().replace(/\.[a-z0-9]+$/i, '') : '';
    ten[k] = parts[0] + (f && files[parts[0]] > 1 ? ' — ' + f : '');
  });
  var rows = p.r.map(function (a) {
    return {
      maKho: a[0], hang: a[1], lop: p.d.lop[a[2]], chuong: p.d.chuong[a[3]], bai: p.d.bai[a[4]], phan: a[5],
      loai: ['', 'TN', 'DS', 'TL', 'TU'][a[5]] || '', cau: a[6], mucDo: a[7], nguon: p.d.nguon[a[8]], viTri: a[9],
      coDapAn: !!a[10], coHinh: !!a[11], loi: a[12], tom: a[13]
    };
  });
  return { id: p.id, docLuc: p.docLuc, rows: rows, ten: ten };
}

/** Số đề web đang dùng mỗi mã câu kho (đếm đề, không đếm câu). */
function bankUsage_() {
  var m = {};
  readTable_('CauHoi').forEach(function (q) {
    var k = str_(q.maKho);
    if (!k) return;
    m[k] = m[k] || {};
    m[k][q.examId] = 1;
  });
  var out = {};
  Object.keys(m).forEach(function (k) { out[k] = Object.keys(m[k]).length; });
  return out;
}

function fold_(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function arr_(v) { return (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]).map(str_).filter(String); }

/** Lọc câu DÙNG ĐƯỢC theo {lop, chuong[], bai[], loai[], mucDo[], nguon, q}; withBad = giữ cả câu không dùng được (để đếm lý do bỏ qua). */
function bankFilter_(rows, f, withBad) {
  f = f || {};
  var lop = str_(f.lop), chuong = arr_(f.chuong), bai = arr_(f.bai), loai = arr_(f.loai), muc = arr_(f.mucDo), nguon = str_(f.nguon);
  var q = fold_(str_(f.q));
  return rows.filter(function (x) {
    if (x.loi && !withBad) return false;
    if (lop && x.lop !== lop) return false;
    if (chuong.length && chuong.indexOf(x.chuong) < 0) return false;
    if (bai.length && bai.indexOf(x.bai) < 0) return false;
    if (loai.length && loai.indexOf(x.loai) < 0) return false;
    if (muc.length && muc.indexOf(x.mucDo) < 0) return false;
    if (nguon && x.nguon !== nguon) return false;
    if (q && fold_(x.tom + ' ' + x.maKho).indexOf(q) < 0) return false;
    return true;
  });
}

function bankItem_(x, b, used) {
  return {
    maKho: x.maKho, loai: x.loai, phan: x.phan, mucDo: x.mucDo, lop: x.lop, chuong: x.chuong, bai: x.bai, tom: x.tom,
    coHinh: x.coHinh, nguon: b.ten[x.nguon] || x.nguon, maNguon: x.nguon, viTri: x.viTri, daDung: used[x.maKho] || 0
  };
}

/* ---------- API ---------- */

function apiAdminBankMeta_(req) {
  requireTeacher_(req);
  if (req.refresh) bankForgetImageMap_();
  var b = bankIndex_({ refresh: !!req.refresh });
  var ok = b.rows.filter(function (x) { return !x.loi; });
  var theoDang = { TN: 0, DS: 0, TL: 0 }, theoMucDo = { NB: 0, TH: 0, VD: 0, VDC: 0 }, boQua = {};
  ok.forEach(function (x) { theoDang[x.loai]++; if (x.mucDo) theoMucDo[x.mucDo] = (theoMucDo[x.mucDo] || 0) + 1; });
  b.rows.forEach(function (x) { if (x.loi) boQua[x.loi] = (boQua[x.loi] || 0) + 1; });
  var tree = {}, order = [];
  ok.forEach(function (x) {
    var k = x.lop + '\u0001' + x.chuong + '\u0001' + x.bai;
    if (!tree[k]) { tree[k] = { lop: x.lop, chuong: x.chuong, bai: x.bai, dem: { TN: 0, DS: 0, TL: 0 } }; order.push(k); }
    tree[k].dem[x.loai]++;
  });
  var src = {}, srcOrder = [];
  b.rows.forEach(function (x) {
    if (!src[x.nguon]) { src[x.nguon] = { ma: x.nguon, ten: b.ten[x.nguon] || x.nguon, soCau: 0, coDapAn: 0, dungDuoc: 0 }; srcOrder.push(x.nguon); }
    src[x.nguon].soCau++;
    if (x.coDapAn) src[x.nguon].coDapAn++;
    if (!x.loi) src[x.nguon].dungDuoc++;
  });
  var canhBao = [];
  if (b.rows.length > BANK_WARN_ROWS) canhBao.push('Kho có ' + b.rows.length + ' câu (nhiều hơn ' + BANK_WARN_ROWS + ')' + (b.khongDem ? ': chỉ mục quá lớn để nhớ tạm nên mỗi lần lọc sẽ đọc lại kho (chậm hơn).' : '.'));
  return {
    tong: b.rows.length, coDapAn: b.rows.filter(function (x) { return x.coDapAn; }).length, dungDuoc: ok.length,
    theoDang: theoDang, theoMucDo: theoMucDo, boQua: boQua,
    lop: Object.keys(ok.reduce(function (m, x) { m[x.lop] = 1; return m; }, {})).sort(sortVi_),
    cay: order.map(function (k) { return tree[k]; }),
    nguon: srcOrder.map(function (k) { return src[k]; }),
    docLuc: b.docLuc, canhBao: canhBao, gioiHan: BANK_MAX_PICK
  };
}

function apiAdminBankList_(req) {
  requireTeacher_(req);
  var b = bankIndex_();
  var rows = bankFilter_(b.rows, req.filter);
  var size = Math.max(1, Math.min(100, Math.floor(num_(req.size)) || 20));
  var page = Math.max(1, Math.floor(num_(req.page)) || 1);
  var used = bankUsage_();
  return {
    tong: rows.length, page: page, size: size,
    items: rows.slice((page - 1) * size, page * size).map(function (x) { return bankItem_(x, b, used); })
  };
}

function apiAdminBankSource_(req) {
  requireTeacher_(req);
  var b = bankIndex_();
  var key = str_(req.nguon);
  var all = b.rows.filter(function (x) { return x.nguon === key; });
  if (!all.length) throw new Error('Không tìm thấy nguồn đề này trong kho.');
  var used = bankUsage_();
  var items = all.filter(function (x) { return !x.loi; })
    .sort(function (a, c) { return (a.phan - c.phan) || (a.cau - c.cau) || (a.hang - c.hang); })
    .map(function (x) { return bankItem_(x, b, used); });
  var PART = ['', 'Phần I', 'Phần II', 'Phần III'];
  var thieu = [];
  [1, 2, 3].forEach(function (p) {
    var have = {}, max = 0;
    all.forEach(function (x) { if (x.phan === p && x.cau) { have[x.cau] = 1; max = Math.max(max, x.cau); } });
    var miss = [];
    for (var i = 1; i <= max; i++) if (!have[i]) miss.push(i);
    if (miss.length) thieu.push({ phan: p, cau: miss, text: PART[p] + ': kho không có câu ' + ranges_(miss) });
  });
  var bad = all.filter(function (x) { return x.loi && x.loi !== 'tuLuan'; });
  return {
    ma: key, ten: b.ten[key] || key, items: items, thieu: thieu,
    khongDapAn: bad.length,
    khongDapAnViTri: bad.slice(0, 60).map(function (x) { return x.viTri + ' (' + (BANK_LOI[x.loi] || x.loi) + ')'; }),
    tuLuan: all.filter(function (x) { return x.loi === 'tuLuan'; }).length
  };
}

/** [1,2,3,5,7,8] → "1–3, 5, 7–8" */
function ranges_(a) {
  var out = [], i = 0;
  while (i < a.length) {
    var j = i;
    while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
    out.push(j > i ? a[i] + '–' + a[j] : String(a[i]));
    i = j + 1;
  }
  return out.join(', ');
}

/** Số ngẫu nhiên có hạt giống (mulberry32) — để ma trận lặp lại được khi truyền seed. */
function rng_(seed) {
  if (seed == null || seed === '') return Math.random;
  var h = 1779033703;
  String(seed).split('').forEach(function (ch) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); });
  var a = h >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function apiAdminBankMatrix_(req) {
  requireTeacher_(req);
  var b = bankIndex_();
  var so = req.so || {};
  var want = {};
  [['TN', 18], ['DS', 4], ['TL', 6]].forEach(function (p) {
    var v = so[p[0]] === undefined || so[p[0]] === '' ? p[1] : Math.floor(num_(so[p[0]]));
    want[p[0]] = Math.max(0, Math.min(500, v));
  });
  if (want.TN + want.DS + want.TL > BANK_MAX_PICK) throw new Error('Ma trận tối đa ' + BANK_MAX_PICK + ' câu (cùng giới hạn với Tạo đề).');
  var pool = bankFilter_(b.rows, { lop: req.lop, chuong: req.chuong, bai: req.bai, mucDo: req.mucDo, nguon: req.nguon });
  var used = bankUsage_();
  var rnd = rng_(req.seed);
  var out = [], thieu = { TN: 0, DS: 0, TL: 0 }, coSan = { TN: 0, DS: 0, TL: 0 };
  ['TN', 'DS', 'TL'].forEach(function (t) {
    var c = pool.filter(function (x) { return x.loai === t; })
      .map(function (x) { return { x: x, u: used[x.maKho] || 0, r: rnd() }; })
      .sort(function (a, z) { return (a.u - z.u) || (a.r - z.r); });
    coSan[t] = c.length;
    thieu[t] = Math.max(0, want[t] - c.length);
    c.slice(0, want[t]).forEach(function (o) { out.push(o.x.maKho); });
  });
  return { maKho: out, thieu: thieu, coSan: coSan, so: want };
}

/**
 * Câu đầy đủ (đã ánh xạ) cho các mã câu kho, kèm chép hình theo lô.
 * Mỗi lần gọi chép tối đa BANK_IMG_PER_CALL hình hoặc tới mốc 4,5 phút, rồi trả tiepTuc (gọi lại với cursor = tiepTuc).
 */
function apiAdminBankToQuestions_(req) {
  requireTeacher_(req);
  var t0 = nowMs_();
  var codes = arr_(req.maKho).filter(function (k, i, a) { return a.indexOf(k) === i; });
  if (!codes.length) throw new Error('Chưa chọn câu nào.');
  if (codes.length > BANK_MAX_PICK) throw new Error('Mỗi lần chỉ lấy tối đa ' + BANK_MAX_PICK + ' câu.');
  var r = bankFetch_(codes, req.cursor, t0);
  var out = { questions: r.picked.map(function (p) { return p.q; }), canhBao: r.canhBao, tienDo: r.tienDo };
  if (r.tiepTuc != null) out.tiepTuc = r.tiepTuc;
  else out.thieuHinh = r.thieuHinh;
  return out;
}

/**
 * Đọc đầy đủ các câu kho `codes` và chép hình theo lô (dùng chung cho Tạo đề và Đưa vào luyện tập).
 * Trả { picked:[{q, hinh, hinhThem, hinhKhongTen}], canhBao, tienDo, tiepTuc?, thieuHinh? (chỉ lượt cuối) }.
 */
function bankFetch_(codes, cursorIn, t0) {
  var canhBao = [];
  var picked = bankPick_(codes, canhBao);
  // Hình: danh sách tên theo thứ tự câu (hình chính rồi hình thêm — R-12)
  var names = [];
  picked.forEach(function (p) {
    [p.hinh].concat(p.hinhThem || []).forEach(function (n) { if (n && names.indexOf(n) < 0) names.push(n); });
  });
  var props = PropertiesService.getScriptProperties();
  var known = props.getProperties() || {}; // đọc Script Properties MỘT lần mỗi lượt
  var folder = null;
  var cursor = Math.max(0, Math.floor(num_(cursorIn)) || 0);
  var copied = 0, i = cursor, tiepTuc = null;
  for (; i < names.length; i++) {
    var name = names[i];
    if (known['IMG_' + name]) continue;
    if (copied >= BANK_IMG_PER_CALL || nowMs_() - t0 > BANK_TIME_LIMIT_MS - BANK_TIME_MARGIN_MS) { tiepTuc = i; break; }
    try {
      var file = bankImageFile_(name);
      if (!file) continue; // cảnh báo ở lượt cuối (theo mã câu)
      if (!folder) folder = imageFolder_();
      var copy = file.makeCopy(bankCopyName_(name), folder); // tên trung tính: không lộ mã câu kho
      copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      props.setProperty('IMG_' + name, copy.getId());
      known['IMG_' + name] = copy.getId();
      copied++;
    } catch (e) {
      canhBao.push('Không chép được hình "' + name + '": ' + (e && e.message || e));
    }
  }
  var url = function (n) { return n && known['IMG_' + n] ? 'https://lh3.googleusercontent.com/d/' + known['IMG_' + n] : ''; };
  picked.forEach(function (p) {
    var u = url(p.hinh);
    if (u) p.q.hinhAnh = u;
    // hình thứ hai trở đi: gắn vào cuối nội dung (giao diện hiện ![](url) thành ảnh)
    (p.hinhThem || []).forEach(function (n) { var x = url(n); if (x) p.q.noiDung += (p.q.noiDung ? '\n' : '') + '![](' + x + ')'; });
  });
  var out = { picked: picked, canhBao: canhBao, tienDo: { xong: tiepTuc == null ? names.length : tiepTuc, tong: names.length } };
  if (tiepTuc != null) { out.tiepTuc = tiepTuc; return out; }
  // Lượt cuối: mọi câu kho ghi "Có" hình mà chưa có hình → cảnh báo theo mã câu (không bỏ sót dù con trỏ nhảy)
  out.thieuHinh = [];
  picked.forEach(function (p) {
    if (p.hinhKhongTen) {
      out.thieuHinh.push(p.q.maKho);
      canhBao.push('Câu ' + p.q.maKho + ': ô "Hình vẽ" ghi Có nhưng không đọc được tên file hình — câu chưa có hình.');
      return;
    }
    var miss = [p.hinh].concat(p.hinhThem || []).filter(function (n) { return n && !url(n); });
    if (miss.length) {
      out.thieuHinh.push(p.q.maKho);
      canhBao.push('Câu ' + p.q.maKho + ': chưa có hình "' + miss.join('", "') + '" (không tìm thấy trên Drive hoặc chưa chép được) — câu chưa đủ hình.');
    }
  });
  return out;
}

/** Tên bản chép công khai: "hinh-<12 ký tự băm có khóa>.<đuôi>" — không lộ mã câu; máy chủ tính lại được từ tên gốc. */
function bankCopyName_(name) {
  var ext = (/\.[a-z0-9]+$/i.exec(name) || ['.png'])[0].toLowerCase();
  var sig = Utilities.computeHmacSha256Signature('img:' + name, secret_());
  var hex = sig.slice(0, 6).map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  return 'hinh-' + hex + ext;
}

/** "Đọc lại kho" cũng bỏ bản đồ tên hình đã nhớ (hình mới thêm vào Drive được tìm thấy ngay). */
function bankForgetImageMap_() {
  try {
    var folderId = idFromSetting_(getSetting_('THU_MUC_HINH_KHO_ID'));
    var cache = scriptCache_();
    if (folderId && cache) cache.remove('bkimg_' + folderId);
    if (MEMO_.__img) delete MEMO_.__img[folderId];
  } catch (e) { /* bỏ qua */ }
}

/** Đọc đầy đủ các câu được chọn (chỉ những hàng đó). Ô mã câu không khớp chỉ mục (kho vừa đổi) → đọc lại chỉ mục một lần. */
function bankPick_(codes, canhBao) {
  var tryOnce = function (b) {
    var byCode = {};
    b.rows.forEach(function (x) { if (!byCode[x.maKho]) byCode[x.maKho] = x; });
    var rowsWanted = codes.map(function (k) { return byCode[k]; }).filter(function (x) { return x && !x.loi; }).map(function (x) { return x.hang; });
    var got = bankReadRows_(bankOpen_(), rowsWanted);
    var res = [], stale = false;
    codes.forEach(function (k) {
      var x = byCode[k];
      if (!x) { res.push({ k: k, miss: 'không có trong kho' }); return; }
      if (x.loi) { res.push({ k: k, miss: BANK_LOI[x.loi] || x.loi }); return; }
      var row = got[x.hang];
      if (!row || str_(row.maKho) !== k) { stale = true; res.push({ k: k, stale: true }); return; }
      var c = bankToQuestion_(row);
      if (!c.q) { res.push({ k: k, miss: BANK_LOI[c.loi] || c.loi }); return; }
      res.push({ k: k, q: c.q, hinh: c.hinh, hinhThem: c.hinhThem, hinhKhongTen: c.hinhKhongTen });
    });
    return { res: res, stale: stale };
  };
  var r = tryOnce(bankIndex_());
  if (r.stale) { delete MEMO_.__kho; r = tryOnce(bankIndex_({ refresh: true })); }
  var out = [];
  r.res.forEach(function (o) {
    if (o.q) out.push(o);
    else canhBao.push('Bỏ qua câu ' + o.k + ': ' + (o.stale ? 'kho vừa thay đổi, không tìm thấy câu' : o.miss) + '.');
  });
  return out;
}

/** Tìm file hình gốc theo tên: trong thư mục THU_MUC_HINH_KHO_ID (đệ quy, có đệm) hoặc trên toàn Drive. */
function bankImageFile_(name) {
  var folderId = idFromSetting_(getSetting_('THU_MUC_HINH_KHO_ID'));
  if (folderId) {
    var id = bankImageMap_(folderId)[name];
    return id ? DriveApp.getFileById(id) : null;
  }
  var it = DriveApp.getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

/** Bản đồ tên file → id, dựng một lần bằng cách duyệt đệ quy thư mục hình của kho; đệm 10 phút. */
function bankImageMap_(folderId) {
  MEMO_.__img = MEMO_.__img || {};
  if (MEMO_.__img[folderId]) return MEMO_.__img[folderId];
  var cache = scriptCache_();
  var head = 'bkimg_' + folderId;
  if (cache) {
    try { var j = cacheGetChunked_(cache, head); if (j) return (MEMO_.__img[folderId] = JSON.parse(j)); } catch (e) { /* đọc lại */ }
  }
  var map = {};
  var root;
  try { root = DriveApp.getFolderById(folderId); } catch (e) {
    throw new Error('Không mở được thư mục hình của kho (THU_MUC_HINH_KHO_ID): ' + (e && e.message || e));
  }
  var stack = [root];
  while (stack.length) {
    var f = stack.pop();
    var files = f.getFiles();
    while (files.hasNext()) { var file = files.next(); var n = file.getName(); if (!(n in map)) map[n] = file.getId(); }
    var subs = f.getFolders();
    while (subs.hasNext()) stack.push(subs.next());
  }
  if (cache) { try { cachePutChunked_(cache, head, JSON.stringify(map), BANK_CACHE_SECONDS, BANK_INDEX_MAX_BYTES); } catch (e) { /* bỏ qua */ } }
  MEMO_.__img[folderId] = map;
  return map;
}

/* =====================================================================
 *  LUYỆN TẬP (Pha 4)
 *   - Pool: trang tính LuyenTap (câu chép từ kho bằng bankToQuestion_). Không bao giờ xóa hàng; "thay" = đặt Bật=KHONG.
 *   - Đệm máy chủ chỉ giữ CHỈ MỤC pool (mã, hàng, lớp, chương, bài, loại, mức độ, bật); câu đầy đủ đọc theo hàng.
 *   - Câu thuộc đề chưa công bố lời giải (NHAP, chưa mở, canReveal_ = false) không xuất hiện ở bất kỳ kiểu luyện tập nào.
 *   - Kết quả ghi KetQuaLuyenTap (không vào bảng xếp hạng / bảng điểm / thống kê đề).
 *   - Học sinh không bao giờ nhận dapAn, loiGiai, maKho trước khi nộp; token 'p' ký HMAC như token 'a'.
 * ===================================================================== */

var POOL_MAX = 3000;              // pool tối đa khoảng 3 000 câu
var PRACTICE_MIN_Q = 5, PRACTICE_MAX_Q = 40;
var PRACTICE_MIN_MIN = 5, PRACTICE_MAX_MIN = 90;
var PRACTICE_WRONG_MAX = 20;
var ROW_RUNS_MAX = 10;          // rowsWhere_: tối đa 10 lần đọc hàng (gộp các khối gần nhau)
var POOL_INDEX_KEYS = ['maKho', 'lop', 'chuong', 'bai', 'loai', 'mucDo', 'bat'];
var PRACTICE_KIEU = { TU_TAO: 'Tự tạo đề', CAU_SAI: 'Luyện câu đã sai', NHANH: 'Đề nhanh' };
var PRACTICE_OFF = 'Giáo viên đang tắt luyện tập.';
var PART_NAME_ = { TN: 'Phần I', DS: 'Phần II', TL: 'Phần III' };

function practiceOn_() { return yes_(getSetting_('CHO_LUYEN_TAP')); }
function requirePracticeOn_() { if (!practiceOn_()) throw new Error(PRACTICE_OFF); }

/** Khối lớp của học sinh: cụm số ĐẦU của lớp ("12A1"→12); không có số (vd "CLB") → 0 = xem toàn pool. */
function studentGrade_(lop) { var m = /^\s*(\d+)/.exec(str_(lop)); return m ? +m[1] : 0; }
/** Khối lớp của câu trong pool: số trong cột Lớp ("Lớp 12"→12). */
function poolGrade_(lop) { var m = /(\d+)/.exec(str_(lop)); return m ? +m[1] : 0; }

/** Cấu hình đề nhanh từ CaiDat LUYEN_NHANH = "P1,P2,P3,phút" (mặc định 7,1,2,10). */
function quickConf_() {
  var a = String(getSetting_('LUYEN_NHANH') || '').split(/[,;\s]+/).map(function (x) { return Math.floor(num_(x)); });
  var ok = a.length >= 4 && a.slice(0, 3).every(function (x) { return x >= 0 && x <= PRACTICE_MAX_Q; }) && a[0] + a[1] + a[2] > 0 && a[3] > 0;
  return ok ? { TN: a[0], DS: a[1], TL: a[2], phut: Math.min(PRACTICE_MAX_MIN, a[3]) } : { TN: 7, DS: 1, TL: 2, phut: 10 };
}

/** Mã băm ngắn của nội dung câu (FNV-1a 32 bit) — nhận ra câu nhập tay bị sửa / đánh số lại. */
function contentHash_(q) {
  var s = [q.noiDung, q.hinhAnh, q.A, q.B, q.C, q.D, q.dapAn].map(function (x) { return String(x == null ? '' : x); }).join('\u0001');
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8);
}

/** Số thứ tự của "Chương IV. …" / "Bài 12. …" (số La Mã hoặc số thường) để xếp cây chương → bài; không có số → rất lớn. */
function topicNo_(s) {
  var m = /^\s*(?:ch[uư][oơ]ng|b[aà]i|ph[aầ]n)?\s*([IVXLC]+|\d+)\b/i.exec(str_(s));
  if (!m) return 1e9;
  if (/^\d+$/.test(m[1])) return +m[1];
  var R = { I: 1, V: 5, X: 10, L: 50, C: 100 }, t = m[1].toUpperCase(), n = 0;
  for (var i = 0; i < t.length; i++) { var v = R[t[i]], w = R[t[i + 1]] || 0; n += v < w ? -v : v; }
  return n;
}

function timeOf_(v) { var d = parseDate_(v); return d ? d.getTime() : 0; }

/* ---------- chặn câu đang thi ---------- */

/** Đề mà câu của nó chưa được công khai: mọi đề chưa đóng (nháp, chưa mở, đang mở) hoặc không công bố lời giải. */
function examLocked_(e, now) {
  if (!e || !e.id) return false;
  // Vòng 2 (R-1): câu chỉ vào luyện tập khi đề ĐÃ ĐÓNG (giáo viên đóng / hết hạn) VÀ canReveal_ = true.
  // Đề NHAP, chưa tới giờ mở, đang mở (mọi chế độ hiện lời giải, kể cả NGAY), đề KHONG: chặn.
  if (!canReveal_(e)) return true;
  if (e.trangThai === 'DONG') return false;
  var t = parseDate_(e.ketThuc);
  if (e.trangThai === 'MO' && t && (now || Date.now()) > t.getTime()) return false;
  return true;
}

/**
 * Tập maKho bị chặn khỏi luyện tập: có trong CauHoi của đề examLocked_. Đệm theo thế hệ DeThi + CauHoi
 * (đổi đề / đổi câu → khóa đệm mới), sống tới mốc giờ mở/đóng gần nhất của một đề (tối đa CACHE_SECONDS).
 */
function blockedBankIds_() {
  if (MEMO_.__blk) return MEMO_.__blk;
  var now = Date.now();
  var cache = scriptCache_(), key = null;
  if (cache) {
    var g1 = readGen_(cache, 'DeThi'), g2 = readGen_(cache, 'CauHoi');
    if (g1 && g2) key = 'blk_' + g1 + '_' + g2;
  }
  if (key) {
    try {
      var o = parseJson_(cache.get(key), null);
      if (o && Array.isArray(o.ids) && now < o.until) return (MEMO_.__blk = toSet_(o.ids));
    } catch (e) { /* tính lại */ }
  }
  var locked = {}, until = now + CACHE_SECONDS * 1000;
  readTable_('DeThi').forEach(function (e) {
    if (examLocked_(e, now)) locked[e.id] = 1;
    [e.batDau, e.ketThuc].forEach(function (v) { var d = parseDate_(v); if (d && d.getTime() > now) until = Math.min(until, d.getTime()); });
  });
  var ids = [];
  var seen = {};
  readTable_('CauHoi').forEach(function (q) {
    var k = str_(q.maKho);
    if (k && locked[q.examId] && !seen[k]) { seen[k] = 1; ids.push(k); }
  });
  if (key) { try { var j = JSON.stringify({ ids: ids, until: until }); if (j.length < CACHE_CHUNK_BYTES) cache.put(key, j, CACHE_SECONDS); } catch (e) { /* bỏ qua */ } }
  return (MEMO_.__blk = seen);
}

function toSet_(a) { var m = {}; a.forEach(function (k) { m[k] = 1; }); return m; }

/* ---------- pool: chỉ mục + đọc theo hàng ---------- */

/** { sh, col:{khóa: số cột}, lastRow, lastCol } của một trang trong SCHEMA; chưa có trang → null. Chỉ ĐỌC (nhớ trong 1 request). */
function sheetInfo_(name) {
  var k = '__si_' + name;
  if (MEMO_[k] !== undefined) return MEMO_[k];
  var sh = ss_().getSheetByName(name);
  if (!sh) return (MEMO_[k] = null);
  var lastCol = sh.getLastColumn(), lastRow = sh.getLastRow();
  var header = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(str_) : [];
  var col = {};
  SCHEMA[name].forEach(function (d) { var i = header.indexOf(d[1]); if (i >= 0) col[d[0]] = i + 1; });
  return (MEMO_[k] = { sh: sh, col: col, lastRow: lastRow, lastCol: lastCol });
}

function poolSheetInfo_() { return sheetInfo_('LuyenTap'); }

/**
 * Các hàng của trang `name` có ô `key` = value (vd mọi bài của MỘT học sinh): đọc riêng cột khóa,
 * rồi chỉ đọc những hàng khớp (R-3: không đọc cả trang KetQua / KetQuaLuyenTap). Nhớ trong 1 request.
 */
function rowsWhere_(name, key, value) {
  value = str_(value);
  var mk = '__rw_' + name + '\u0001' + key + '\u0001' + value;
  if (MEMO_[mk]) return copyRows_(MEMO_[mk]);
  var rows;
  if (MEMO_[name]) rows = readTable_(name).filter(function (r) { return str_(r[key]) === value; }); // bảng đã có trong bộ nhớ
  else {
    var info = sheetInfo_(name);
    rows = [];
    if (info && info.col[key] && info.lastRow >= 2 && value) {
      var vals = info.sh.getRange(2, info.col[key], info.lastRow - 1, 1).getValues();
      var nums = [];
      vals.forEach(function (r, i) { if (str_(cell_(r[0])) === value) nums.push(i + 2); });
      var got = readRowRuns_(info, nums, true);
      rows = nums.map(function (n) {
        var o = got[n] || { _row: n };
        SCHEMA[name].forEach(function (d) { if (!(d[0] in o)) o[d[0]] = ''; });
        return o;
      });
    }
  }
  MEMO_[mk] = rows;
  return copyRows_(rows);
}

/** Chỉ mục pool { rows:[{maKho,hang,lop,chuong,bai,loai,mucDo,bat}], byMa }. Đệm theo thế hệ LuyenTap. */
function poolIndex_(opts) {
  var refresh = !!(opts && opts.refresh);
  if (!refresh && MEMO_.__pool) return MEMO_.__pool;
  if (refresh) delete MEMO_.__si_LuyenTap;
  var cache = scriptCache_(), key = null;
  if (cache) { var gen = readGen_(cache, 'LuyenTap'); if (gen) key = 'pl_' + gen; }
  if (key && !refresh) {
    try {
      var j = cacheGetChunked_(cache, key);
      var p = j ? parseJson_(j, null) : null;
      if (p && p.v === 1) return (MEMO_.__pool = poolUnpack_(p));
    } catch (e) { /* đọc lại */ }
  }
  var packed = poolBuildIndex_();
  if (key) { try { cachePutChunked_(cache, key, JSON.stringify(packed), CACHE_SECONDS, BANK_INDEX_MAX_BYTES); } catch (e) { /* không đệm */ } }
  return (MEMO_.__pool = poolUnpack_(packed));
}

function poolBuildIndex_() {
  var info = poolSheetInfo_();
  var dict = { chuong: [], bai: [] }, pos = { chuong: {}, bai: {} };
  var put = function (d, v) { if (!(v in pos[d])) { pos[d][v] = dict[d].length; dict[d].push(v); } return pos[d][v]; };
  var rows = [];
  if (info && info.col.maKho && info.lastRow >= 2) {
    // chỉ các cột của chỉ mục (không đọc nội dung, đáp án, lời giải)
    bankReadBlock_(info, POOL_INDEX_KEYS, 2, info.lastRow - 1).forEach(function (o) {
      var ma = str_(o.maKho);
      if (!ma) return;
      rows.push([ma, o._row, poolGrade_(o.lop), put('chuong', str_(o.chuong)), put('bai', str_(o.bai)),
        normalizeType_(o.loai), normalizeLevel_(o.mucDo), yes_(o.bat) ? 1 : 0]);
    });
  }
  return { v: 1, d: dict, r: rows };
}

function poolUnpack_(p) {
  var byMa = {};
  var rows = p.r.map(function (a) {
    var x = { maKho: a[0], hang: a[1], lop: a[2], chuong: p.d.chuong[a[3]], bai: p.d.bai[a[4]], loai: a[5], mucDo: a[6], bat: !!a[7] };
    if (!byMa[x.maKho]) byMa[x.maKho] = x;
    return x;
  });
  return { rows: rows, byMa: byMa };
}

/** Đọc đầy đủ các hàng cho trước của trang (info từ poolSheetInfo_), mỗi khối hàng liền nhau 1 lần getRange. */
function readRowRuns_(info, rowNums, merge) {
  var nums = rowNums.filter(function (r, i, a) { return r >= 2 && r <= info.lastRow && a.indexOf(r) === i; }).sort(function (a, b) { return a - b; });
  var keys = Object.keys(info.col);
  var out = {};
  if (!keys.length) return out;
  var cols = keys.map(function (k) { return info.col[k]; });
  var c0 = Math.min.apply(null, cols), c1 = Math.max.apply(null, cols);
  var put = function (row, rowNum) {
    var o = { _row: rowNum };
    keys.forEach(function (k) { o[k] = cell_(row[info.col[k] - c0]); });
    out[rowNum] = o;
  };
  // gom các hàng liền nhau thành khối
  var runs = [], i = 0;
  while (i < nums.length) {
    var j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    runs.push([nums[i], nums[j]]);
    i = j + 1;
  }
  if (merge && runs.length > ROW_RUNS_MAX) {
    // V2-1: quá nhiều khối rời nhau (vd các bài của một học sinh nằm rải rác) → gộp hai khối gần nhau nhất
    // cho tới khi còn ≤ ROW_RUNS_MAX khối; đọc cả vùng gộp rồi chỉ giữ các hàng cần trong bộ nhớ
    var want = toSet_(nums.map(String));
    while (runs.length > ROW_RUNS_MAX) {
      var best = 0;
      for (var g = 1; g < runs.length - 1; g++) if (runs[g + 1][0] - runs[g][1] < runs[best + 1][0] - runs[best][1]) best = g;
      runs.splice(best, 2, [runs[best][0], runs[best + 1][1]]);
    }
    runs.forEach(function (rg) {
      info.sh.getRange(rg[0], c0, rg[1] - rg[0] + 1, c1 - c0 + 1).getValues().forEach(function (row, r) { if (want[rg[0] + r]) put(row, rg[0] + r); });
    });
    return out;
  }
  runs.forEach(function (rg) {
    info.sh.getRange(rg[0], c0, rg[1] - rg[0] + 1, c1 - c0 + 1).getValues().forEach(function (row, r) { put(row, rg[0] + r); });
  });
  return out;
}

/** Hàng LuyenTap → câu hỏi web đã chuẩn hóa (giữ maKho, bat). */
function poolQuestion_(r) {
  var q = normalizeQuestion_({
    loai: r.loai, phan: r.phan, noiDung: r.noiDung, hinhAnh: r.hinhAnh, A: r.A, B: r.B, C: r.C, D: r.D,
    dapAn: r.dapAn, saiSo: r.saiSo, loiGiai: r.loiGiai, mucDo: r.mucDo, chuDe: bankTopic_(r.bai, r.chuong),
    maKho: r.maKho, chuong: r.chuong, bai: r.bai
  }, 0);
  q.bat = yes_(r.bat);
  return q;
}

/** Câu đầy đủ trong pool theo mã: chỉ đọc các hàng đó; ô mã lệch (sửa tay) → đọc lại chỉ mục một lần. */
function poolGet_(codes) {
  var tryOnce = function (idx) {
    var info = poolSheetInfo_();
    var out = {}, stale = false;
    if (!info) return { out: out, stale: false };
    var want = codes.map(function (c) { return idx.byMa[c]; }).filter(Boolean).map(function (x) { return x.hang; });
    var got = readRowRuns_(info, want);
    codes.forEach(function (c) {
      var x = idx.byMa[c];
      if (!x) return;
      var r = got[x.hang];
      if (!r || str_(r.maKho) !== c) { stale = true; return; }
      out[c] = poolQuestion_(r);
    });
    return { out: out, stale: stale };
  };
  var r = tryOnce(poolIndex_());
  if (r.stale) r = tryOnce(poolIndex_({ refresh: true }));
  return r.out;
}

/** Câu của đề theo stt (đã chuẩn hóa). */
function examQuestionAt_(eid, stt) {
  return examQuestions_(eid).filter(function (q) { return q.stt === stt; })[0] || null;
}

/** Câu theo mã câu luyện tập: "maKho" (pool) hoặc "examId#stt" (đề thi). → { qid: câu } (thiếu thì không có khóa). */
function practiceQuestions_(qids) {
  var pool = [], out = {};
  qids.forEach(function (id) {
    var i = id.lastIndexOf('#');
    if (i > 0) {
      var q = examQuestionAt_(id.slice(0, i), Math.floor(num_(id.slice(i + 1))));
      if (q) out[id] = q;
    } else pool.push(id);
  });
  if (pool.length) {
    var got = poolGet_(pool);
    Object.keys(got).forEach(function (k) { out[k] = got[k]; });
  }
  return out;
}

/** Câu học sinh này được luyện: pool đang bật, đúng khối lớp, không bị chặn. */
function practiceCandidates_(st) {
  var g = studentGrade_(st.lop);
  var blocked = blockedBankIds_();
  return poolIndex_().rows.filter(function (x) {
    return x.bat && !blocked[x.maKho] && (!g || !x.lop || x.lop === g) && (x.loai === 'TN' || x.loai === 'DS' || x.loai === 'TL');
  });
}

/** Mã câu (khóa maKho hoặc qid) học sinh đã làm trong các bài luyện. */
function practiceDone_(rows) {
  var m = {};
  rows.forEach(function (r) { parseJson_(r.chiTiet, []).forEach(function (d) { if (d.q) { m[d.q] = 1; if (d.k) m[d.k] = 1; } }); });
  return m;
}

/* ---------- luyện câu đã sai ---------- */

/**
 * Tập câu đã làm chưa trọn điểm (≤ 20, sai gần nhất trước): (a) bài luyện, theo maKho; (b) đề thi chính, theo examId#stt —
 * chỉ đề còn tồn tại và đã công bố lời giải. Câu nhập tay đã bị sửa/đánh số lại (mã băm khác) thì bỏ.
 * Làm đúng ở lần sau (luyện hoặc thi lại) thì rút khỏi tập. → [{ qid, key }]
 */
function wrongList_(st) {
  var events = [];
  rowsWhere_('KetQua', 'studentId', st.id).forEach(function (r) {
    var t = timeOf_(r.nopLuc);
    parseJson_(r.chiTiet, []).forEach(function (d) {
      events.push({ t: t, key: d.k || (r.examId + '#' + d.s), wrong: num_(d.sc) < num_(d.m) - 1e-9, ex: r.examId, s: num_(d.s), k: d.k || '', h: d.h || '' });
    });
  });
  rowsWhere_('KetQuaLuyenTap', 'studentId', st.id).forEach(function (r) {
    var t = timeOf_(r.nopLuc);
    parseJson_(r.chiTiet, []).forEach(function (d) {
      if (!d.q || d.gone) return;
      events.push({ t: t, key: d.k || d.q, wrong: num_(d.sc) < num_(d.m) - 1e-9, q: d.q, k: d.k || '', h: d.h || '' });
    });
  });
  events.forEach(function (ev, i) { ev.i = i; });
  events.sort(function (a, b) { return (a.t - b.t) || (a.i - b.i); });
  var latest = {};
  events.forEach(function (ev) { latest[ev.key] = ev; });
  var cands = Object.keys(latest).map(function (k) { return latest[k]; }).filter(function (ev) { return ev.wrong; })
    .sort(function (a, b) { return (b.t - a.t) || (b.i - a.i); });
  if (!cands.length) return [];
  var exams = {};
  readTable_('DeThi').forEach(function (e) { exams[e.id] = e; });
  var now = Date.now();
  var blocked = blockedBankIds_();
  var pool = poolIndex_();
  var qsOf = {};
  var examQs = function (eid) { return qsOf[eid] || (qsOf[eid] = examQuestions_(eid)); };
  var open = function (eid) { var e = exams[eid]; return !!(e && !examLocked_(e, now)); };
  var resolve = function (ev) {
    if (ev.k) {
      if (blocked[ev.k]) return null;
      var px = pool.byMa[ev.k];
      if (px && px.bat) return ev.k;
      // không còn trong pool: tìm lại trong đề theo mã câu kho (đề sửa, đánh số lại vẫn đúng câu)
      var eid = ev.ex || (ev.q && ev.q.indexOf('#') > 0 ? ev.q.slice(0, ev.q.lastIndexOf('#')) : '');
      if (!eid || !open(eid)) return null;
      var hit = examQs(eid).filter(function (q) { return q.maKho === ev.k; })[0];
      return hit ? eid + '#' + hit.stt : null;
    }
    var qid = ev.ex ? ev.ex + '#' + ev.s : ev.q;
    var cut = qid ? qid.lastIndexOf('#') : -1;
    if (cut <= 0) return null;
    var e2 = qid.slice(0, cut);
    if (!open(e2)) return null;
    var q = examQs(e2).filter(function (x) { return x.stt === Math.floor(num_(qid.slice(cut + 1))); })[0];
    if (!q || q.maKho) return null; // lúc làm là câu nhập tay; nay ô này là câu kho → đề đã đổi
    if (ev.h) return contentHash_(q) === ev.h ? qid : null;
    // dữ liệu trước Pha 4 không có mã băm: chỉ nhận khi đề chưa được sửa sau lần làm
    var cap = timeOf_(exams[e2].capNhat);
    return cap && cap > ev.t ? null : qid;
  };
  var out = [], seen = {};
  for (var i = 0; i < cands.length && out.length < PRACTICE_WRONG_MAX; i++) {
    var qid = resolve(cands[i]);
    if (qid && !seen[qid]) { seen[qid] = 1; out.push({ qid: qid, key: cands[i].key }); }
  }
  return out;
}

/* ---------- API học sinh ---------- */

function apiPracticeMeta_(req) {
  var st = requireStudent_(req);
  requirePracticeOn_();
  var cand = practiceCandidates_(st);
  var tree = {}, order = [];
  cand.forEach(function (x) {
    var k = x.chuong + '\u0001' + x.bai;
    if (!tree[k]) { tree[k] = { chuong: x.chuong, bai: x.bai, dem: { TN: 0, DS: 0, TL: 0 } }; order.push(k); }
    tree[k].dem[x.loai]++;
  });
  var mine = rowsWhere_('KetQuaLuyenTap', 'studentId', st.id);
  var scores = mine.map(function (r) { return num_(r.diem); });
  var cay = order.map(function (k) { return tree[k]; }).sort(function (a, b) {
    return (topicNo_(a.chuong) - topicNo_(b.chuong)) || sortVi_(a.chuong, b.chuong) || (topicNo_(a.bai) - topicNo_(b.bai)) || sortVi_(a.bai, b.bai);
  });
  return {
    cay: cay,
    soCauSai: wrongList_(st).length,
    nhanh: quickConf_(),
    soBai: mine.length,
    diemTB: scores.length ? round2_(avg_(scores)) : null,
    gioiHan: { min: PRACTICE_MIN_Q, max: PRACTICE_MAX_Q, phutMin: PRACTICE_MIN_MIN, phutMax: PRACTICE_MAX_MIN }
  };
}

function shuffle_(a) {
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

/** Chọn ngẫu nhiên want câu mỗi loại, ưu tiên câu chưa làm. */
function pickPractice_(rows, want, done, taken) {
  var out = { TN: [], DS: [], TL: [] };
  ['TN', 'DS', 'TL'].forEach(function (t) {
    var c = shuffle_(rows.filter(function (x) { return x.loai === t && !taken[x.maKho]; }))
      .map(function (x, i) { return { x: x, d: done[x.maKho] ? 1 : 0, i: i }; })
      .sort(function (a, b) { return (a.d - b.d) || (a.i - b.i); });
    c.slice(0, Math.max(0, want[t] || 0)).forEach(function (o) { out[t].push(o.x.maKho); taken[o.x.maKho] = 1; });
  });
  return out;
}

function apiPracticeStart_(req) {
  var st = requireStudent_(req);
  requirePracticeOn_();
  var kieu = str_(req.kieu).toUpperCase();
  if (!PRACTICE_KIEU[kieu]) throw new Error('Kiểu luyện tập không hợp lệ.');
  var goal = parseGoal_(req.mucTieu);
  var notes = [], qids = [], tieuDe = '', phut;
  if (kieu === 'CAU_SAI') {
    qids = wrongList_(st).map(function (x) { return x.qid; });
    if (!qids.length) throw new Error('Bạn chưa có câu sai nào để luyện lại.');
    tieuDe = 'Luyện câu đã sai';
    phut = req.phut ? Math.floor(num_(req.phut)) : Math.max(10, qids.length * 2);
  } else {
    var cand = practiceCandidates_(st);
    var chuong = arr_(req.chuong), bai = arr_(req.bai), want = {};
    if (kieu === 'NHANH') {
      if (bai.length !== 1) throw new Error('Hãy chọn một bài để làm đề nhanh.');
      var conf = quickConf_();
      want = { TN: conf.TN, DS: conf.DS, TL: conf.TL };
      phut = conf.phut;
      chuong = [];
    } else {
      var so = req.so || {};
      ['TN', 'DS', 'TL'].forEach(function (t) { want[t] = Math.max(0, Math.min(PRACTICE_MAX_Q, Math.floor(num_(so[t])))); });
      var tong = want.TN + want.DS + want.TL;
      if (tong < PRACTICE_MIN_Q || tong > PRACTICE_MAX_Q) throw new Error('Tổng số câu phải từ ' + PRACTICE_MIN_Q + ' đến ' + PRACTICE_MAX_Q + '.');
      phut = Math.floor(num_(req.phut)) || 45;
    }
    // N-1: gửi cả chương và bài thì lấy giao (bài thuộc chương đó)
    var scope = cand.filter(function (x) {
      return (!chuong.length || chuong.indexOf(x.chuong) >= 0) && (!bai.length || bai.indexOf(x.bai) >= 0);
    });
    var done = practiceDone_(rowsWhere_('KetQuaLuyenTap', 'studentId', st.id));
    var taken = {};
    var got = pickPractice_(scope, want, done, taken);
    if (kieu === 'NHANH') {
      // bài thiếu câu: lấy thêm cùng chương và báo cho học sinh
      var ch = (cand.filter(function (x) { return x.bai === bai[0]; })[0] || {}).chuong;
      var lack = {};
      ['TN', 'DS', 'TL'].forEach(function (t) { lack[t] = Math.max(0, want[t] - got[t].length); });
      var more = ch != null && (lack.TN || lack.DS || lack.TL) ? pickPractice_(cand.filter(function (x) { return x.chuong === ch; }), lack, done, taken) : { TN: [], DS: [], TL: [] };
      ['TN', 'DS', 'TL'].forEach(function (t) {
        if (!lack[t]) return;
        var n0 = got[t].length;
        got[t] = got[t].concat(more[t]);
        var msg = 'Bài này mới có ' + n0 + ' câu ' + PART_NAME_[t];
        if (more[t].length) msg += '; lấy thêm ' + more[t].length + ' câu cùng chương';
        if (got[t].length < want[t]) msg += (more[t].length ? '; cả chương' : ', cả chương cũng') + ' chỉ có ' + got[t].length + ' câu (cần ' + want[t] + ')';
        notes.push(msg + '.');
      });
      tieuDe = 'Đề nhanh — ' + bai[0];
    } else {
      ['TN', 'DS', 'TL'].forEach(function (t) {
        if (got[t].length < want[t]) notes.push('Phần đã chọn mới có ' + got[t].length + ' câu ' + PART_NAME_[t] + ' (cần ' + want[t] + ').');
      });
      tieuDe = 'Tự tạo đề — ' + (bai.length === 1 ? bai[0] : chuong.length === 1 && !bai.length ? chuong[0] : 'nhiều bài');
    }
    qids = got.TN.concat(got.DS, got.TL);
    if (!qids.length) throw new Error('Chưa có câu nào phù hợp trong pool luyện tập. Hãy chọn bài khác.');
  }
  phut = Math.max(PRACTICE_MIN_MIN, Math.min(PRACTICE_MAX_MIN, phut || 10));
  var map = practiceQuestions_(qids);
  var blocked = blockedBankIds_();
  var list = qids.filter(function (id) { var q = map[id]; return q && !(q.maKho && blocked[q.maKho]) && (id.indexOf('#') > 0 || q.bat); })
    .map(function (id, i) { return { id: id, q: map[id], i: i }; })
    .sort(function (a, b) { return (a.q.phan - b.q.phan) || (a.i - b.i); });
  if (!list.length) throw new Error('Chưa có câu nào phù hợp trong pool luyện tập. Hãy chọn bài khác.');
  if (list.length < qids.length) notes.push('Có ' + (qids.length - list.length) + ' câu vừa bị gỡ khỏi pool nên đề ít câu hơn.');
  var dur = phut * 60, now = Date.now();
  var tok = {
    t: 'p', pid: Utilities.getUuid(), sid: st.id, kieu: kieu, qids: list.map(function (x) { return x.id; }),
    st: now, dur: dur, exp: now + (dur + 6 * 3600) * 1000, goal: goal, td: tieuDe
  };
  return {
    attemptToken: signToken_(tok), startedAt: now, durationSec: dur, serverNow: now, mucTieu: goal, kieu: kieu, thongBao: notes,
    exam: { id: '__luyen', tieuDe: tieuDe },
    questions: list.map(function (x, i) {
      var q = x.q;
      return { stt: i + 1, phan: q.phan, loai: q.loai, noiDung: q.noiDung, hinhAnh: q.hinhAnh, A: q.A, B: q.B, C: q.C, D: q.D, diem: q.diem };
    })
  };
}

/** Mã bài luyện tập: cố định theo lượt (token) → nộp lại cùng token không ghi thêm hàng. */
function practiceResultId_(p) {
  return 'LT' + Utilities.formatDate(new Date(p.st), TZ, 'yyMMddHHmmss') + String(p.pid).replace(/[^0-9a-f]/gi, '').slice(0, 12).toUpperCase();
}

/** Mã bài đã có trong KetQuaLuyenTap? Đọc thẳng cột "Mã bài" của Sheet (không qua đệm, gọi trong khóa). */
function practiceResultExists_(id) {
  delete MEMO_.__si_KetQuaLuyenTap;
  var info = sheetInfo_('KetQuaLuyenTap');
  if (!info || !info.col.id || info.lastRow < 2) return false;
  return info.sh.getRange(2, info.col.id, info.lastRow - 1, 1).getValues().some(function (r) { return str_(r[0]) === id; });
}

function practiceSubmit_(st, p, req) {
  requirePracticeOn_();
  if (p.sid !== st.id || !p.pid || !Array.isArray(p.qids) || !p.qids.length) throw new Error('Lượt làm bài không hợp lệ hoặc đã quá hạn.');
  var id = practiceResultId_(p);
  var cache = CacheService.getScriptCache();
  var doneKey = 'patt_' + p.pid;
  var view = function () {
    // R-5: tìm theo mã bài VÀ mã học sinh
    Object.keys(MEMO_).forEach(function (k) { if (k.indexOf('__rw_KetQuaLuyenTap') === 0 || k === '__si_KetQuaLuyenTap') delete MEMO_[k]; });
    var r = rowsWhere_('KetQuaLuyenTap', 'id', id).filter(function (x) { return x.studentId === st.id; })[0];
    if (!r) throw new Error('Lượt làm bài không hợp lệ hoặc đã quá hạn.');
    return buildPracticeView_(r, 'student');
  };
  if (cache.get(doneKey)) return view();
  var map = practiceQuestions_(p.qids);
  var qs = [];
  p.qids.forEach(function (qid, i) { if (map[qid]) qs.push(Object.assign({}, map[qid], { stt: i + 1, _qid: qid })); });
  if (!qs.length) throw new Error('Các câu của bài luyện này không còn trong ngân hàng.');
  var graded = gradeExam_(qs, req.answers || {});
  var now = Date.now();
  var usedSec = Math.max(0, Math.round((now - p.st) / 1000));
  var late = usedSec > p.dur + GRACE_SECONDS;
  var mine = rowsWhere_('KetQuaLuyenTap', 'studentId', st.id);
  if (mine.some(function (r) { return r.id === id; })) return buildPracticeView_(mine.filter(function (r) { return r.id === id; })[0], 'student');
  var prevAll = mine.map(function (r) { return num_(r.diem); });
  var goal = p.goal == null ? null : num_(p.goal);
  var fb = buildFeedback_(qs, graded, { usedSec: usedSec, limitSec: p.dur, prevAll: prevAll, goal: goal });
  var result = {
    id: id, nopLuc: fmtDateTime_(new Date(now)), hoTen: st.hoTen, lop: st.lop, tieuDe: p.td || PRACTICE_KIEU[p.kieu] || 'Luyện tập',
    diem: graded.max ? round2_(graded.score / graded.max * 10) : 0, mucTieu: goal == null ? '' : goal,
    diemGoc: graded.score, diemToiDa: graded.max, soCauDung: graded.correctCount, tongCau: qs.length,
    thoiGianLam: fmtDuration_(usedSec), nhanXet: fb.text, studentId: st.id, examId: 'LUYEN_TAP',
    batDauLuc: fmtDateTime_(new Date(p.st)), thoiGianGiay: usedSec, ghiChu: late ? 'Nộp muộn ' + fmtDuration_(usedSec - p.dur) : '',
    kieu: p.kieu,
    chiTiet: JSON.stringify(graded.items.map(function (g, i) {
      var q = qs[i];
      var it = { s: g.stt, l: g.loai, a: g.answer, sc: g.score, m: g.max, c: g.correct ? 1 : 0, n: g.nCorrect, cd: g.chuDe, md: g.mucDo, p: g.phan, q: q._qid, h: contentHash_(q) };
      if (q.maKho) it.k = q.maKho;
      return it;
    }))
  };
  var wrote = withLock_(function () {
    if (practiceResultExists_(id)) return false; // nộp hai lần cùng lúc: chỉ một hàng
    appendRows_('KetQuaLuyenTap', [result]);
    return true;
  });
  cache.put(doneKey, id, 21600);
  if (!wrote) return view();
  return buildPracticeView_(result, 'student'); // không đọc lại trang (R-3)
}

/**
 * Kết quả bài luyện kèm lời giải; lấy câu theo q, câu không còn thì "Câu đã bị gỡ khỏi ngân hàng".
 * R-2: câu đang bị chặn TẠI THỜI ĐIỂM XEM (nằm trong đề chưa đóng / chưa công bố lời giải) thì học sinh chỉ thấy
 * đề bài và câu trả lời của mình, không có đáp án + lời giải. Điểm vẫn chấm bình thường.
 */
var PRACTICE_HIDDEN_NOTE = 'Câu này đang nằm trong một đề thi chưa kết thúc. Đáp án và lời giải sẽ hiện khi đề thi đó kết thúc.';
function buildPracticeView_(r, role) {
  var details = parseJson_(r.chiTiet, []);
  var map = practiceQuestions_(details.map(function (d) { return d.q; }).filter(Boolean));
  var exams = {};
  var now = Date.now();
  var blocked = role === 'teacher' ? {} : blockedBankIds_();
  var goal = null;
  if (r.mucTieu !== '' && r.mucTieu != null) {
    var g = num_(r.mucTieu), d10 = num_(r.diem);
    goal = { mucTieu: g, dat: d10 >= g - 1e-9, chenh: round2_(d10 - g), lanTruoc: null, lamLai: false, goiY: [] };
  }
  var view = Object.assign(resultSummary_(r), {
    nhanXet: r.nhanXet, feedback: feedbackFromText_(r.nhanXet), ghiChu: r.ghiChu, reveal: true, revealNote: '',
    breakdown: breakdown_(details), goal: goal, luyenTap: true, kieu: r.kieu,
    items: details.map(function (d) {
      var it = { stt: d.s, loai: d.l, phan: d.p, chuDe: d.cd, mucDo: d.md, answer: d.a, score: d.sc, max: d.m, nCorrect: d.n, correct: !!d.c };
      var q = d.q ? map[d.q] : null;
      var hide = false;
      if (q && d.q.indexOf('#') > 0) {
        // câu lấy từ đề thi: câu đã bị sửa → coi như gỡ; đề chưa đóng / không công bố lời giải → ẩn lời giải
        var eid = d.q.slice(0, d.q.lastIndexOf('#'));
        var e = exams[eid] !== undefined ? exams[eid] : (exams[eid] = findExam_(eid));
        if (!e || (d.h && contentHash_(q) !== d.h)) q = null;
        else if (role !== 'teacher' && examLocked_(e, now)) hide = true;
      }
      var k = (q && q.maKho) || d.k;
      if (q && k && blocked[k]) hide = true;
      if (q) {
        it.noiDung = q.noiDung; it.hinhAnh = q.hinhAnh; it.A = q.A; it.B = q.B; it.C = q.C; it.D = q.D;
        if (hide) { it.an = true; it.anNote = PRACTICE_HIDDEN_NOTE; }
        else { it.dapAn = q.dapAn; it.loiGiai = q.loiGiai; }
      } else {
        it.go = true;
        it.noiDung = 'Câu đã bị gỡ khỏi ngân hàng.';
      }
      return it;
    })
  });
  return view;
}

/* ---------- API giáo viên ---------- */

/**
 * Đưa câu kho vào pool: {maKho[]} hoặc {filter} (như adminBankList), mode "them" | "thay", cursor (chép hình theo lô).
 * Chỉ câu có đáp án, không Phần IV. Chạy lại không nhân đôi; "thay" chỉ đặt Bật=KHONG cho câu không còn chọn (không xóa hàng).
 */
function apiAdminPracticeSync_(req) {
  requireTeacher_(req);
  var t0 = nowMs_();
  var mode = req.mode === 'thay' ? 'thay' : 'them';
  var b = bankIndex_();
  var byCode = {};
  b.rows.forEach(function (x) { if (!byCode[x.maKho]) byCode[x.maKho] = x; });
  var rows, khongCo = 0;
  if (req.maKho != null) {
    var codes = arr_(req.maKho).filter(function (k, i, a) { return a.indexOf(k) === i; });
    rows = codes.map(function (c) { if (!byCode[c]) khongCo++; return byCode[c]; }).filter(Boolean);
  } else {
    rows = bankFilter_(b.rows, req.filter, true);
  }
  var boQua = { khongDapAn: 0, tuLuan: 0, khac: 0, khongCo: khongCo };
  var usable = [], lopOf = {};
  rows.forEach(function (x) {
    if (!x.loi) { usable.push(x.maKho); lopOf[x.maKho] = x.lop; }
    else if (x.loi === 'tuLuan') boQua.tuLuan++;
    else if (x.loi === 'khongDapAn' || x.loi === 'dapAnSai') boQua.khongDapAn++;
    else boQua.khac++;
  });
  if (!usable.length) throw new Error('Không có câu dùng được (cần có đáp án hợp lệ, không phải Phần IV).');
  if (usable.length > POOL_MAX) throw new Error('Mỗi lần đưa tối đa ' + POOL_MAX + ' câu vào pool luyện tập.');
  var f = bankFetch_(usable, req.cursor, t0);
  if (f.tiepTuc != null) return { tiepTuc: f.tiepTuc, tienDo: f.tienDo, canhBao: f.canhBao };
  var qs = f.picked.map(function (p) { return Object.assign({}, p.q, { lop: lopOf[p.q.maKho] || '' }); });
  if (!qs.length) throw new Error('Không đọc được câu nào từ kho.');
  var res = withLock_(function () { return poolWrite_(qs, mode); });
  var blocked = blockedBankIds_();
  res.dangThi = qs.map(function (q) { return q.maKho; }).filter(function (k) { return blocked[k]; });
  res.boQua = boQua;
  res.canhBao = f.canhBao;
  res.thieuHinh = f.thieuHinh;
  res.tienDo = f.tienDo;
  return res;
}

/** Ghi pool trong khóa: đọc thẳng Sheet, sửa hàng có sẵn theo mã, thêm hàng mới ở cuối; không xóa hàng. */
function poolWrite_(qs, mode) {
  var sh = sheet_('LuyenTap'); // tự tạo nếu Sheet cũ chưa có
  var header = headerOf_(sh);
  var n = header.length;
  var lastRow = sh.getLastRow();
  var values = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, n).getValues() : [];
  var ci = function (k) { return header.indexOf(labelOf_('LuyenTap', k)); };
  var cMa = ci('maKho'), cBat = ci('bat'), cCap = ci('capNhat');
  var at = {};
  values.forEach(function (row, i) { var m = str_(cell_(row[cMa])); if (m && !(m in at)) at[m] = i; });
  var now = nowIso_();
  var changed = {}, add = [], want = {};
  var them = 0, capNhat = 0, tat = 0;
  var same = function (a, b) { return String(cell_(a) == null ? '' : cell_(a)) === String(b == null ? '' : b).replace(/^'/, ''); };
  qs.forEach(function (q) {
    if (want[q.maKho]) return;
    want[q.maKho] = 1;
    var obj = {
      maKho: q.maKho, lop: q.lop, chuong: q.chuong, bai: q.bai, loai: q.loai, phan: q.phan, mucDo: q.mucDo,
      noiDung: q.noiDung, hinhAnh: q.hinhAnh, A: q.A, B: q.B, C: q.C, D: q.D, dapAn: q.dapAn, saiSo: q.saiSo,
      loiGiai: q.loiGiai, bat: 'CO', capNhat: now
    };
    if (q.maKho in at) {
      var i = at[q.maKho];
      var next = rowFromObj_('LuyenTap', header, obj, values[i]);
      var diff = next.some(function (v, j) { return j !== cCap && !same(values[i][j], v); });
      if (diff) { values[i] = next; changed[i] = 1; capNhat++; }
    } else {
      add.push(rowFromObj_('LuyenTap', header, obj));
      them++;
    }
  });
  if (mode === 'thay') {
    values.forEach(function (row, i) {
      var m = str_(cell_(row[cMa]));
      if (m && !want[m] && yes_(row[cBat])) { row[cBat] = 'KHONG'; row[cCap] = now; changed[i] = 1; tat++; }
    });
  }
  // R-6: giới hạn cho TỔNG pool đang bật sau lần ghi này
  var active = add.length + values.filter(function (row) { return yes_(row[cBat]); }).length;
  if (active > POOL_MAX) throw new Error('Pool luyện tập tối đa ' + POOL_MAX + ' câu đang bật; sau lần này sẽ có ' + active + ' câu. Hãy tắt bớt câu ở tab Pool luyện tập hoặc dùng "Thay pool bằng giỏ". Chưa ghi gì.');
  writeRowRuns_(sh, values, Object.keys(changed).map(Number), n);
  if (add.length) sh.getRange(Math.max(sh.getLastRow(), 1) + 1, 1, add.length, n).setValues(add);
  if (them || capNhat || tat) afterWrite_('LuyenTap');
  return { them: them, capNhat: capNhat, tat: tat, tong: values.length + add.length };
}

/** Ghi lại các hàng đã đổi (chỉ số trong values, hàng Sheet = chỉ số + 2), mỗi khối liền nhau 1 lần setValues. */
function writeRowRuns_(sh, values, idx, n) {
  idx.sort(function (a, b) { return a - b; });
  var i = 0;
  while (i < idx.length) {
    var j = i;
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
    sh.getRange(idx[i] + 2, 1, j - i + 1, n).setValues(values.slice(idx[i], idx[j] + 1).map(function (r) {
      var row = r.slice(0, n);
      while (row.length < n) row.push('');
      return row.map(safe_);
    }));
    i = j + 1;
  }
}

/** Số lượt làm mỗi câu (theo q) trong mọi bài luyện. */
function practiceUsage_() {
  var m = {};
  var info = sheetInfo_('KetQuaLuyenTap');
  if (!info || !info.col.chiTiet || info.lastRow < 2) return m;
  // chỉ đọc cột "Chi tiết (JSON)" (R-3)
  info.sh.getRange(2, info.col.chiTiet, info.lastRow - 1, 1).getValues().forEach(function (r) {
    parseJson_(r[0], []).forEach(function (d) { if (d.q) m[d.q] = (m[d.q] || 0) + 1; });
  });
  return m;
}

function apiAdminPracticeList_(req) {
  requireTeacher_(req);
  var idx = poolIndex_();
  var blocked = blockedBankIds_();
  var f = req.filter || {};
  var lop = Math.floor(num_(f.lop)), chuong = arr_(f.chuong), bai = arr_(f.bai), loai = arr_(f.loai);
  var bat = str_(f.bat).toUpperCase(), q = fold_(str_(f.q));
  var all = idx.rows;
  var rows = all.filter(function (x) {
    if (lop && x.lop !== lop) return false;
    if (chuong.length && chuong.indexOf(x.chuong) < 0) return false;
    if (bai.length && bai.indexOf(x.bai) < 0) return false;
    if (loai.length && loai.indexOf(x.loai) < 0) return false;
    if (bat === 'CO' && !x.bat) return false;
    if (bat === 'KHONG' && x.bat) return false;
    if (bat === 'DANG_THI' && !blocked[x.maKho]) return false;
    if (q && fold_(x.maKho).indexOf(q) < 0) return false;
    return true;
  });
  var size = Math.max(1, Math.min(100, Math.floor(num_(req.size)) || 20));
  var page = Math.max(1, Math.floor(num_(req.page)) || 1);
  var slice = rows.slice((page - 1) * size, page * size);
  var full = poolGet_(slice.map(function (x) { return x.maKho; }));
  var used = practiceUsage_();
  var tree = {}, order = [], lops = {};
  all.forEach(function (x) {
    if (x.lop) lops[x.lop] = 1;
    var k = x.chuong + '\u0001' + x.bai;
    if (!tree[k]) { tree[k] = { chuong: x.chuong, bai: x.bai, n: 0 }; order.push(k); }
    tree[k].n++;
  });
  return {
    tong: rows.length, page: page, size: size, choLuyenTap: practiceOn_(),
    dem: {
      tong: all.length, bat: all.filter(function (x) { return x.bat; }).length,
      dangThi: all.filter(function (x) { return blocked[x.maKho]; }).length
    },
    lop: Object.keys(lops).map(Number).sort(function (a, b) { return a - b; }),
    cay: order.map(function (k) { return tree[k]; }),
    items: slice.map(function (x) {
      var fq = full[x.maKho] || {};
      return {
        maKho: x.maKho, lop: x.lop, chuong: x.chuong, bai: x.bai, loai: x.loai, phan: fq.phan || ({ TN: 1, DS: 2, TL: 3 })[x.loai],
        mucDo: x.mucDo, bat: x.bat, dangThi: !!blocked[x.maKho], soLuot: used[x.maKho] || 0, coHinh: !!fq.hinhAnh,
        tom: String(fq.noiDung || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().slice(0, BANK_TOM_CHARS)
      };
    })
  };
}

/** Bật/tắt câu trong pool: {maKho[], bat}. Chỉ sửa ô "Bật" (và "Cập nhật") của hàng có mã khớp, đọc thẳng Sheet trong khóa. */
function apiAdminPracticeToggle_(req) {
  requireTeacher_(req);
  var codes = toSet_(arr_(req.maKho));
  var on = yes_(req.bat);
  if (!Object.keys(codes).length) throw new Error('Chưa chọn câu nào.');
  return withLock_(function () {
    var sh = ss_().getSheetByName('LuyenTap');
    if (!sh || sh.getLastRow() < 2) return { n: 0 };
    var header = headerOf_(sh);
    var n = header.length;
    var values = sh.getRange(2, 1, sh.getLastRow() - 1, n).getValues();
    var cMa = header.indexOf(labelOf_('LuyenTap', 'maKho')), cBat = header.indexOf(labelOf_('LuyenTap', 'bat')), cCap = header.indexOf(labelOf_('LuyenTap', 'capNhat'));
    var now = nowIso_(), changed = [];
    values.forEach(function (row, i) {
      if (codes[str_(cell_(row[cMa]))] && yes_(row[cBat]) !== on) { row[cBat] = on ? 'CO' : 'KHONG'; row[cCap] = now; changed.push(i); }
    });
    // chỉ ghi ô "Bật" và "Cập nhật" (không ghi lại nội dung), mỗi khối hàng liền nhau 1 lần
    var k = 0;
    while (k < changed.length) {
      var e = k;
      while (e + 1 < changed.length && changed[e + 1] === changed[e] + 1) e++;
      var len = e - k + 1;
      sh.getRange(changed[k] + 2, cBat + 1, len, 1).setValues(changed.slice(k, e + 1).map(function (i) { return [values[i][cBat]]; }));
      if (cCap >= 0) sh.getRange(changed[k] + 2, cCap + 1, len, 1).setValues(changed.slice(k, e + 1).map(function () { return [now]; }));
      k = e + 1;
    }
    if (changed.length) afterWrite_('LuyenTap');
    return { n: changed.length };
  });
}

/* =====================================================================
 *  TIỆN ÍCH DỮ LIỆU
 * ===================================================================== */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh && OPTIONAL_SHEETS.indexOf(name) >= 0) sh = createOptionalSheet_(name); // chỉ gọi từ đường GHI (appendRows_…)
  if (!sh) throw new Error('Thiếu trang tính "' + name + '". Hãy chạy hàm setup() trong Apps Script.');
  return sh;
}

/** Tạo trang tính mới (Pha 4) với hàng tiêu đề và định dạng như setup(). Gọi trong withLock_. */
function createOptionalSheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  var labels = SCHEMA[name].map(function (d) { return d[1]; });
  sh.getRange(1, 1, 1, labels.length).setValues([labels]).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.getRange(1, 1, sh.getMaxRows(), labels.length).setNumberFormat('@');
  if (name === 'KetQuaLuyenTap') applyResultFormats_(sh, name);
  return sh;
}

function labelOf_(name, key) { return SCHEMA[name].filter(function (d) { return d[0] === key; })[0][1]; }

/* ---------- đọc trang tính: MEMO_ (trong 1 request) → đệm CacheService (60 s) → Sheet ----------
 * Quy tắc an toàn (đặc tả Pha 1):
 *  - Đọc: (1) đọc thế hệ gen = tbgen_<tên> TRƯỚC; (2) đọc các mảnh tb_<tên>_<gen>_*; trượt thì (3) đọc Sheet
 *    và (4) cất dưới CHÍNH gen đã đọc ở bước 1 → dữ liệu cũ không thể nằm dưới thế hệ mới.
 *  - Ghi: luôn trong withLock_, đọc lại bằng readTable_(…, {fresh:true}), kiểm ô khóa của hàng trước khi ghi,
 *    ghi xong flush() rồi đặt thế hệ mới (afterWrite_).
 */
var MEMO_ = {};

function readTable_(name, opts) {
  var fresh = !!(opts && opts.fresh);
  if (!fresh && MEMO_[name]) return copyRows_(MEMO_[name]);
  var cache = fresh ? null : scriptCache_();
  var gen = null;
  if (cache) {
    gen = readGen_(cache, name);
    var hit = gen ? readCachedTable_(cache, name, gen) : null;
    if (hit) { MEMO_[name] = hit; return copyRows_(hit); }
  }
  var rows = readSheet_(name);
  if (cache && gen) writeCachedTable_(cache, name, gen, rows);
  MEMO_[name] = rows;
  return copyRows_(rows);
}

function copyRows_(rows) { return rows.map(function (o) { return Object.assign({}, o); }); }

function readSheet_(name) {
  if (OPTIONAL_SHEETS.indexOf(name) >= 0 && !ss_().getSheetByName(name)) return []; // Sheet cũ chưa có trang này: đọc = rỗng
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  if (!values.length) return [];
  var header = values[0].map(String);
  var defs = SCHEMA[name];
  var idx = defs.map(function (d) { return header.indexOf(d[1]); });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.every(function (v) { return v === '' || v === null; })) continue;
    var o = { _row: r + 1 };
    defs.forEach(function (d, i) { o[d[0]] = idx[i] >= 0 ? cell_(row[idx[i]]) : ''; });
    rows.push(o);
  }
  return rows;
}

function scriptCache_() {
  try { return CacheService.getScriptCache(); } catch (e) { return null; }
}

/** Thế hệ mới: thời điểm + số ngẫu nhiên (không đếm từ 0, nên không trùng thế hệ cũ khi khóa bị xóa sớm). */
function newGen_() {
  return Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
}

function readGen_(cache, name) {
  try {
    var g = cache.get('tbgen_' + name);
    if (!g) { g = newGen_(); cache.put('tbgen_' + name, g, GEN_SECONDS); }
    return g;
  } catch (e) { return null; }
}

function bumpGen_(name) {
  var cache = scriptCache_();
  if (!cache) return;
  try { cache.put('tbgen_' + name, newGen_(), GEN_SECONDS); } catch (e) { /* bỏ qua: đệm hết hạn sau CACHE_SECONDS */ }
}

function bumpAllGens_() { Object.keys(SCHEMA).forEach(bumpGen_); }

function tableKey_(name, gen) { return 'tb_' + name + '_' + gen; }

/**
 * Đọc một giá trị lớn đã cất thành nhiều mảnh (khóa đầu = "số mảnh:độ dài chuỗi").
 * Thiếu mảnh hoặc độ dài ghép không khớp (hai lần cất xen nhau) → null (trượt đệm).
 */
function cacheGetChunked_(cache, head) {
  var got = cache.getAll([head, head + '_0']);
  var meta = String(got[head] || '').split(':');
  var n = parseInt(meta[0], 10), len = parseInt(meta[1], 10);
  if (!(n > 0) || !(len >= 0) || got[head + '_0'] == null) return null;
  var parts = [got[head + '_0']];
  if (n > 1) {
    var keys = [];
    for (var i = 1; i < n; i++) keys.push(head + '_' + i);
    var more = cache.getAll(keys);
    for (var j = 0; j < keys.length; j++) {
      if (more[keys[j]] == null) return null; // thiếu một mảnh → coi như trượt đệm
      parts.push(more[keys[j]]);
    }
  }
  var json = parts.join('');
  return json.length === len ? json : null;
}

/** Cất chuỗi lớn thành các mảnh ≤ CACHE_CHUNK_BYTES; tổng vượt maxTotal byte thì không cất (trả false). */
function cachePutChunked_(cache, head, json, seconds, maxTotal) {
  var parts = splitByBytes_(json, CACHE_CHUNK_BYTES, maxTotal);
  if (!parts) return false;
  var put = {};
  parts.forEach(function (p, i) { put[head + '_' + i] = p; });
  put[head] = parts.length + ':' + json.length;
  cache.putAll(put, seconds);
  return true;
}

function readCachedTable_(cache, name, gen) {
  try {
    var json = cacheGetChunked_(cache, tableKey_(name, gen));
    if (json == null) return null;
    var obj = JSON.parse(json);
    var defs = SCHEMA[name];
    if (!obj || !obj.k || obj.k.join(',') !== defs.map(function (d) { return d[0]; }).join(',')) return null;
    return obj.r.map(function (arr) {
      var o = { _row: arr[0] };
      for (var c = 0; c < obj.k.length; c++) o[obj.k[c]] = arr[c + 1];
      return o;
    });
  } catch (e) { return null; }
}

function writeCachedTable_(cache, name, gen, rows) {
  try {
    var keys = SCHEMA[name].map(function (d) { return d[0]; });
    var json = JSON.stringify({ k: keys, r: rows.map(function (o) { return [o._row].concat(keys.map(function (k) { return o[k]; })); }) });
    return cachePutChunked_(cache, tableKey_(name, gen), json, CACHE_SECONDS, CACHE_MAX_BYTES); // quá lớn: không đệm, vẫn trả dữ liệu đúng
  } catch (e) { return false; }
}

/** Cắt chuỗi thành các mảnh có số byte UTF-8 ≤ max; tổng vượt total thì trả null. */
function splitByBytes_(s, max, total) {
  var out = [], start = 0, bytes = 0, all = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    var b = c < 0x80 ? 1 : c < 0x800 ? 2 : (c >= 0xD800 && c <= 0xDBFF) ? 4 : (c >= 0xDC00 && c <= 0xDFFF) ? 0 : 3;
    all += b;
    if (all > total) return null;
    if (bytes + b > max) { out.push(s.slice(start, i)); start = i; bytes = 0; }
    bytes += b;
  }
  out.push(s.slice(start));
  return out;
}

/** Sửa tay trên Google Sheet → đặt thế hệ mới cho trang tính đó (chèn/xóa/sắp xếp hàng không gọi onEdit: trễ ≤ CACHE_SECONDS). */
function onEdit(e) {
  try {
    var name = e && e.range && e.range.getSheet().getName();
    if (name && SCHEMA[name]) bumpGen_(name);
  } catch (err) { /* không làm phiền người đang sửa Sheet */ }
}

function cell_(v) {
  if (v instanceof Date) {
    if (Utilities.formatDate(v, TZ, 'HH:mm:ss') === '00:00:00') return Utilities.formatDate(v, TZ, 'dd/MM/yyyy');
    return v.toISOString();
  }
  if (typeof v === 'string') return v.trim();
  return v;
}

function headerOf_(sh) {
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var defs = SCHEMA[sh.getName()];
  if (defs) {
    var missing = defs.map(function (d) { return d[1]; }).filter(function (l) { return header.indexOf(l) < 0; });
    if (missing.length) {
      sh.getRange(1, header.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
      header = header.concat(missing);
    }
  }
  return header;
}

function safe_(v) {
  if (typeof v === 'string' && /^[=+]/.test(v)) return "'" + v;
  return v === undefined || v === null ? '' : v;
}

function rowFromObj_(name, header, obj, cur) {
  var defs = SCHEMA[name];
  return header.map(function (label, i) {
    var d = defs.filter(function (x) { return x[1] === label; })[0];
    if (d && obj[d[0]] !== undefined) return safe_(obj[d[0]]);
    return cur ? cur[i] : '';
  });
}

function appendRows_(name, objs) {
  if (!objs || !objs.length) return;
  var sh = sheet_(name);
  var header = headerOf_(sh);
  var rows = objs.map(function (o) { return rowFromObj_(name, header, o); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, header.length).setValues(rows);
  afterWrite_(name);
}

/**
 * Sửa một hàng. keyField/keyValue: ô khóa mong đợi ở hàng đó (Mã HS / Mã đề / Mã bài / Khóa).
 * Ô khóa không khớp (có người chèn/xóa hàng) thì đọc lại cả bảng để tìm đúng hàng; vẫn không thấy thì báo lỗi, không ghi.
 */
function updateRow_(name, rowNum, obj, keyField, keyValue) {
  var sh = sheet_(name);
  var header = headerOf_(sh);
  rowNum = verifyRow_(sh, name, header, rowNum, keyField, keyValue);
  var cur = sh.getRange(rowNum, 1, 1, header.length).getValues()[0];
  sh.getRange(rowNum, 1, 1, header.length).setValues([rowFromObj_(name, header, obj, cur)]);
  afterWrite_(name);
}

function deleteRows_(name, rowNums, keyField, keyValues) {
  var sh = sheet_(name);
  var header = headerOf_(sh);
  var rows = rowNums.map(function (r, i) { return verifyRow_(sh, name, header, r, keyField, keyValues[i]); });
  rows.sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
  afterWrite_(name);
}

function verifyRow_(sh, name, header, rowNum, keyField, keyValue) {
  if (!keyField) throw new Error('Thiếu ô khóa khi ghi trang tính "' + name + '".');
  var col = header.indexOf(labelOf_(name, keyField)) + 1;
  if (col < 1) throw new Error('Trang tính "' + name + '" thiếu cột "' + labelOf_(name, keyField) + '".');
  var want = str_(keyValue);
  if (want && rowNum >= 2 && rowNum <= sh.getLastRow() && str_(cell_(sh.getRange(rowNum, col).getValues()[0][0])) === want) return rowNum;
  var hit = readTable_(name, { fresh: true }).filter(function (r) { return str_(r[keyField]) === want; });
  if (!want || hit.length !== 1) throw new Error('Dữ liệu trang tính "' + name + '" vừa thay đổi, không xác định được dòng cần ghi. Hãy tải lại trang rồi thử lại.');
  return hit[0]._row;
}

/** Sau mỗi lần ghi (trong khóa): đẩy dữ liệu xuống Sheet rồi đặt thế hệ đệm mới. */
function afterWrite_(name) {
  try { SpreadsheetApp.flush(); } catch (e) { /* bỏ qua */ }
  delete MEMO_[name];
  Object.keys(MEMO_).forEach(function (k) { if (k === '__si_' + name || k.indexOf('__rw_' + name + '\u0001') === 0) delete MEMO_[k]; });
  bumpGen_(name);
}

function replaceQuestions_(examId, newRows) {
  var sh = sheet_('CauHoi');
  var header = headerOf_(sh);
  var col = header.indexOf(labelOf_('CauHoi', 'examId'));
  var values = sh.getDataRange().getValues();
  var keep = values.slice(1).filter(function (r) { return String(r[col]).trim() !== examId && r.some(function (v) { return v !== ''; }); });
  var add = newRows.map(function (o) { return rowFromObj_('CauHoi', header, o); });
  var all = keep.concat(add);
  var oldCount = values.length - 1;
  if (oldCount > 0) sh.getRange(2, 1, oldCount, header.length).clearContent();
  if (all.length) sh.getRange(2, 1, all.length, header.length).setValues(all);
  afterWrite_('CauHoi');
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function getSetting_(k) {
  var r = readTable_('CaiDat').filter(function (x) { return x.khoa === k; })[0];
  return r ? String(r.giaTri) : '';
}

function activeStudents_() { return readTable_('HocSinh').filter(function (s) { return s.trangThai !== 'KHOA' && s.id; }); }

function findStudent_(id) { return readTable_('HocSinh').filter(function (s) { return s.id === id; })[0] || null; }

function findExam_(id) { return readTable_('DeThi').filter(function (e) { return e.id === id; })[0] || null; }

function publicStudent_(s) { return { role: 'student', id: s.id, hoTen: s.hoTen, lop: s.lop, email: s.email || '' }; }

function nextStudentId_(all, offset) {
  var max = all.reduce(function (m, s) { var n = parseInt(String(s.id).replace(/\D/g, ''), 10); return isNaN(n) ? m : Math.max(m, n); }, 0);
  return 'HS' + ('000' + (max + 1 + offset)).slice(-4);
}

function examQuestions_(examId) {
  return readTable_('CauHoi').filter(function (q) { return q.examId === examId; })
    .map(function (q, i) { return normalizeQuestion_(q, i); })
    .sort(function (a, b) { return a.stt - b.stt; });
}

function countQuestions_() {
  var m = {};
  readTable_('CauHoi').forEach(function (q) { m[q.examId] = (m[q.examId] || 0) + 1; });
  return m;
}

function normalizeType_(t) {
  var s = plain_(t);
  if (s === 'DS' || s === 'DUNGSAI' || s === 'TF') return 'DS';
  if (s === 'TL' || s === 'TLN' || s === 'TRALOINGAN' || s === 'SHORT') return 'TL';
  return 'TN';
}

function normalizeQuestion_(q, i) {
  var loai = normalizeType_(q.loai);
  var out = {
    examId: str_(q.examId), stt: num_(q.stt) || i + 1, phan: num_(q.phan) || (loai === 'TN' ? 1 : loai === 'DS' ? 2 : 3), loai: loai,
    noiDung: String(q.noiDung == null ? '' : q.noiDung), hinhAnh: str_(q.hinhAnh),
    A: String(q.A == null ? '' : q.A), B: String(q.B == null ? '' : q.B), C: String(q.C == null ? '' : q.C), D: String(q.D == null ? '' : q.D),
    dapAn: str_(q.dapAn), diem: num_(String(q.diem || '').replace(',', '.')) || defaultPoint_(loai), saiSo: str_(q.saiSo),
    chuDe: str_(q.chuDe), mucDo: normalizeLevel_(q.mucDo), loiGiai: String(q.loiGiai == null ? '' : q.loiGiai),
    maKho: str_(q.maKho), chuong: str_(q.chuong), bai: str_(q.bai), mucDoY: str_(q.mucDoY), nguon: str_(q.nguon)
  };
  if (loai === 'DS') out.dapAn = normTF_(out.dapAn).replace(/[_\-]/g, '');
  if (loai === 'TN') out.dapAn = out.dapAn.toUpperCase();
  return out;
}

function normalizeLevel_(m) {
  var s = plain_(m);
  if (s === 'NB' || s === 'NHANBIET') return 'NB';
  if (s === 'TH' || s === 'THONGHIEU') return 'TH';
  if (s === 'VD' || s === 'VANDUNG') return 'VD';
  if (s === 'VDC' || s === 'VANDUNGCAO') return 'VDC';
  return s;
}

function validateQuestion_(q, i) {
  var n = 'Câu ' + (i + 1) + (str_(q.maKho) ? ' (' + str_(q.maKho) + ')' : '') + ': ';
  var loai = normalizeType_(q.loai);
  if (num_(q.phan) > 3 || /^(TU|TULUAN)$/.test(plain_(q.loai))) throw new Error(n + 'câu tự luận (Phần IV) chưa hỗ trợ chấm, hãy bỏ câu này khỏi đề.');
  if (!String(q.noiDung || '').trim() && !String(q.hinhAnh || '').trim()) throw new Error(n + 'chưa có nội dung.');
  if (loai === 'TN') {
    if (['A', 'B', 'C', 'D'].indexOf(String(q.dapAn || '').toUpperCase().trim()) < 0) throw new Error(n + 'đáp án phải là A, B, C hoặc D.');
    if (!['A', 'B', 'C', 'D'].every(function (k) { return String(q[k] || '').trim(); })) throw new Error(n + 'cần đủ 4 phương án A, B, C, D.');
  }
  if (loai === 'DS') {
    if (normTF_(q.dapAn).replace(/[_\-]/g, '').length !== 4) throw new Error(n + 'đáp án Đúng/Sai phải gồm 4 kí tự Đ/S, ví dụ ĐSĐS.');
    if (!['A', 'B', 'C', 'D'].every(function (k) { return String(q[k] || '').trim(); })) throw new Error(n + 'cần đủ 4 ý a, b, c, d.');
  }
  if (loai === 'TL' && !String(q.dapAn || '').trim()) throw new Error(n + 'chưa có đáp án.');
}

function examOut_(e) {
  return {
    id: e.id, tieuDe: e.tieuDe, lop: e.lop, moTa: e.moTa, thoiGian: num_(e.thoiGian), trangThai: e.trangThai || 'NHAP',
    batDau: e.batDau, ketThuc: e.ketThuc, soLanLam: num_(e.soLanLam), hienLoiGiai: e.hienLoiGiai || 'NGAY',
    tronCau: yes_(e.tronCau), ngayTao: e.ngayTao, capNhat: e.capNhat
  };
}

function examVisibleTo_(e, st) {
  if (!e.id || e.trangThai === 'NHAP' || !e.trangThai) return false;
  var lops = String(e.lop || '').split(/[,;]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(String);
  return !lops.length || lops.indexOf(String(st.lop).toUpperCase()) >= 0;
}

function examStatus_(e) {
  if (e.trangThai === 'NHAP') return { open: false, text: 'Bản nháp' };
  if (e.trangThai === 'DONG') return { open: false, text: 'Đã đóng' };
  var now = Date.now();
  var s = parseDate_(e.batDau), t = parseDate_(e.ketThuc);
  if (s && now < s.getTime()) return { open: false, text: 'Chưa mở' };
  if (t && now > t.getTime()) return { open: false, text: 'Đã hết hạn' };
  return { open: true, text: 'Đang mở' };
}

function canReveal_(e) {
  if (e.hienLoiGiai === 'KHONG') return false;
  if (e.hienLoiGiai === 'SAU_HAN') return !examStatus_(e).open;
  return true;
}

function shuffleWithinParts_(qs) {
  var parts = {};
  qs.forEach(function (q) { (parts[q.phan] = parts[q.phan] || []).push(q); });
  var out = [];
  Object.keys(parts).sort().forEach(function (p) {
    var a = parts[p].slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    out = out.concat(a);
  });
  return out;
}

function resultSummary_(r) {
  return {
    id: r.id, nopLuc: r.nopLuc, hoTen: r.hoTen, lop: r.lop, studentId: r.studentId, examId: r.examId, tieuDe: r.tieuDe,
    diem: num_(r.diem), mucTieu: r.mucTieu === '' || r.mucTieu == null ? null : num_(r.mucTieu), diemGoc: num_(r.diemGoc), diemToiDa: num_(r.diemToiDa), soCauDung: num_(r.soCauDung), tongCau: num_(r.tongCau),
    thoiGianLam: r.thoiGianLam, thoiGianGiay: num_(r.thoiGianGiay), ghiChu: r.ghiChu
  };
}

/* ---------- định dạng ---------- */

/** Bỏ dấu tiếng Việt, viết hoa, chỉ giữ chữ cái A–Z */
function plain_(v) {
  return String(v == null ? '' : v).replace(/[đĐ]/g, 'D').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
}
function str_(v) { return v == null ? '' : String(v).trim(); }
function low_(v) { return str_(v).toLowerCase(); }
function num_(v) { var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; }
function yes_(v) { return ['CO', 'CÓ', 'TRUE', 'YES', '1', 'X'].indexOf(String(v).trim().toUpperCase()) >= 0 || v === true; }
function round2_(n) { return Math.round(n * 100) / 100; }
function avg_(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : 0; }
function pad2_(n) { return ('0' + String(n)).slice(-2); }
function nowIso_() { return new Date().toISOString(); }
function fmtNum_(n) { return String(round2_(num_(n))).replace('.', ','); }
function fmtDateTime_(d) { return Utilities.formatDate(d, TZ, 'dd/MM/yyyy HH:mm:ss'); }
function fmtDuration_(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ' phút ' + pad2_(sec % 60) + ' giây'; }
function parseJson_(s, d) { try { return JSON.parse(s); } catch (e) { return d; } }
function sortVi_(a, b) { return String(a).localeCompare(String(b), 'vi'); }
function firstNameKey_(name) { var p = String(name).trim().split(/\s+/); return p[p.length - 1] + ' ' + name; }
function shortName_(name) {
  var p = String(name).trim().split(/\s+/);
  if (p.length < 2) return name;
  return p[0] + ' ' + p.slice(1, -1).map(function (x) { return x.charAt(0) + '.'; }).join(' ') + (p.length > 2 ? ' ' : '') + p[p.length - 1];
}
function randomPassword_() {
  var c = 'abcdefghjkmnpqrstuvwxyz23456789';
  var s = '';
  for (var i = 0; i < 10; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}

function normalizeDob_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'dd/MM/yyyy');
  var s = str_(v);
  if (!s) return '';
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return pad2_(m[3]) + '/' + pad2_(m[2]) + '/' + m[1];
  m = s.match(/^(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})$/);
  if (m) {
    var d = +m[1], mo = +m[2];
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return '';
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return pad2_(d) + '/' + pad2_(mo) + '/' + y;
  }
  m = s.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m) return m[1] + '/' + m[2] + '/' + m[3];
  return '';
}

function parseDate_(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  var s = String(v).trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    // giờ Việt Nam (UTC+7)
    return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], (+m[4] || 0) - 7, +m[5] || 0, +m[6] || 0));
  }
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
