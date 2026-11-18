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
 *   CaiDat   — cài đặt (mật khẩu quản trị, email giáo viên, Google Client ID…)
 */

var APP_VERSION = '1.2.0';
/** Tính năng máy chủ này hỗ trợ. Giao diện bật/tắt nút theo danh sách này (không so số phiên bản). */
var FEATURES = ['changePin', 'goal', 'bootstrap', 'cache'];
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
    ['diem', 'Điểm'], ['saiSo', 'Sai số'], ['chuDe', 'Chủ đề'], ['mucDo', 'Mức độ'], ['loiGiai', 'Lời giải']
  ],
  KetQua: [
    ['nopLuc', 'Nộp lúc'], ['hoTen', 'Họ tên'], ['lop', 'Lớp'], ['tieuDe', 'Đề'],
    ['diem', 'Điểm (thang 10)'], ['mucTieu', 'Mục tiêu'], ['diemGoc', 'Điểm gốc'], ['diemToiDa', 'Điểm tối đa'],
    ['soCauDung', 'Số câu đúng'], ['tongCau', 'Tổng số câu'], ['thoiGianLam', 'Thời gian làm'],
    ['nhanXet', 'Nhận xét'], ['id', 'Mã bài'], ['studentId', 'Mã HS'], ['examId', 'Mã đề'],
    ['batDauLuc', 'Bắt đầu lúc'], ['thoiGianGiay', 'Số giây'], ['ghiChu', 'Ghi chú'], ['chiTiet', 'Chi tiết (JSON)']
  ],
  CaiDat: [['khoa', 'Khóa'], ['giaTri', 'Giá trị'], ['ghiChu', 'Ghi chú']]
};

var DEFAULT_SETTINGS = [
  ['TEN_UNG_DUNG', 'Luyện đề Vật lý', 'Tên hiển thị trên web'],
  ['TEN_GIAO_VIEN', '', 'Tên giáo viên (hiển thị ở chân trang)'],
  ['GOOGLE_CLIENT_ID', '', 'OAuth Client ID để đăng nhập bằng Google (xem README). Để trống = tắt đăng nhập Google'],
  ['EMAIL_GIAO_VIEN', '', 'Email Google được vào trang quản trị (nhiều email cách nhau dấu phẩy)'],
  ['MAT_KHAU_QUAN_TRI', function () { return randomPassword_(); }, 'Mật khẩu vào trang quản trị (luôn dùng được, kể cả khi chưa cài Google)'],
  ['HIEN_BANG_XEP_HANG', 'CO', 'CO = học sinh xem được bảng xếp hạng; KHONG = ẩn'],
  ['BXH_AN_TEN', 'KHONG', 'CO = bảng xếp hạng chỉ hiện tên viết tắt (VD: Nguyễn V. A)'],
  ['GUI_EMAIL_KHI_NOP', 'KHONG', 'CO = gửi email báo kết quả cho giáo viên mỗi khi có bài nộp'],
  ['CHO_LIEN_KET_GOOGLE', 'CO', 'CO = học sinh tự liên kết tài khoản Google (sau khi xác minh bằng PIN)']
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
    if (name === 'KetQua') {
      var header = sh.getRange(1, 1, 1, nCol).getValues()[0].map(String);
      [['diem', '0.00'], ['diemGoc', '0.00'], ['diemToiDa', '0.00'], ['soCauDung', '0'], ['tongCau', '0'], ['thoiGianGiay', '0']]
        .forEach(function (p) {
          var c = header.indexOf(labelOf_('KetQua', p[0])) + 1;
          if (c > 0 && maxRows > 1) sh.getRange(2, c, maxRows - 1, 1).setNumberFormat(p[1]);
        });
    }
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
  adminSaveSettings: apiAdminSaveSettings_
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
    features: FEATURES.slice()
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
  var p = PropertiesService.getScriptProperties();
  var s = p.getProperty('SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SECRET', s); }
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
  if (!a || a.sid !== st.id) throw new Error('Lượt làm bài không hợp lệ hoặc đã quá hạn.');
  var e = findExam_(a.eid);
  if (!e) throw new Error('Đề không còn tồn tại.');
  var cache = CacheService.getScriptCache();
  var doneKey = 'att_' + a.aid;
  var already = cache.get(doneKey);
  if (already) return apiGetResult_({ token: req.token, resultId: already });

  var qs = examQuestions_(e.id);
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
      return { s: g.stt, l: g.loai, a: g.answer, sc: g.score, m: g.max, c: g.correct ? 1 : 0, n: g.nCorrect, cd: g.chuDe, md: g.mucDo, p: g.phan };
    }))
  };
  withLock_(function () { appendRows_('KetQua', [result]); });
  cache.put(doneKey, result.id, 21600);
  notifyTeacher_(result);
  return buildResultView_(readTable_('KetQua').filter(function (r) { return r.id === result.id; })[0] || result, e, 'student');
}

function apiMyResults_(req) {
  var st = requireStudent_(req);
  return readTable_('KetQua').filter(function (r) { return r.studentId === st.id; }).map(resultSummary_).reverse();
}

function apiGetResult_(req) {
  var u = requireUser_(req);
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

var EDITABLE_SETTINGS = ['TEN_UNG_DUNG', 'TEN_GIAO_VIEN', 'GOOGLE_CLIENT_ID', 'EMAIL_GIAO_VIEN', 'HIEN_BANG_XEP_HANG', 'BXH_AN_TEN', 'GUI_EMAIL_KHI_NOP', 'CHO_LIEN_KET_GOOGLE'];

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
 *  TIỆN ÍCH DỮ LIỆU
 * ===================================================================== */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Thiếu trang tính "' + name + '". Hãy chạy hàm setup() trong Apps Script.');
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

function readCachedTable_(cache, name, gen) {
  try {
    var head = tableKey_(name, gen);
    var got = cache.getAll([head, head + '_0']);
    var n = parseInt(got[head], 10);
    if (!(n > 0) || got[head + '_0'] == null) return null;
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
    var obj = JSON.parse(parts.join(''));
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
    var parts = splitByBytes_(json, CACHE_CHUNK_BYTES, CACHE_MAX_BYTES);
    if (!parts) return false; // quá lớn: không đệm, vẫn trả dữ liệu đúng
    var head = tableKey_(name, gen);
    var put = {};
    parts.forEach(function (p, i) { put[head + '_' + i] = p; });
    put[head] = String(parts.length);
    cache.putAll(put, CACHE_SECONDS);
    return true;
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
    chuDe: str_(q.chuDe), mucDo: normalizeLevel_(q.mucDo), loiGiai: String(q.loiGiai == null ? '' : q.loiGiai)
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
  var n = 'Câu ' + (i + 1) + ': ';
  var loai = normalizeType_(q.loai);
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
