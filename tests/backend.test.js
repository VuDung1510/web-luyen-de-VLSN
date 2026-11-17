// Kiểm thử máy chủ: node tests/backend.test.js
const assert = require('assert');
const { createContext } = require('./gas-shim');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e)); process.exitCode = 1; }
}
function ok(r) { if (!r.ok) throw new Error('API lỗi: ' + r.error); return r.data; }

const g = createContext({ quiet: true });
g.setup();
const pw = g.call('adminGetSettings', {}); // chưa đăng nhập → lỗi
const adminPw = g._sheets.CaiDat._data().find(r => r[0] === 'MAT_KHAU_QUAN_TRI')[1];

console.log('Máy chủ:');
t('setup tạo đủ trang tính và dữ liệu mẫu', () => {
  ['HocSinh', 'DeThi', 'CauHoi', 'KetQua', 'CaiDat'].forEach(n => assert(g._sheets[n], n));
  assert.strictEqual(g._sheets.CauHoi.getLastRow(), 7);
  assert(!pw.ok && /AUTH/.test(pw.error));
  g.setup(); // chạy lại không nhân đôi
  assert.strictEqual(g._sheets.CauHoi.getLastRow(), 7);
  assert.strictEqual(g._sheets.HocSinh.getLastRow(), 2);
});

t('chấm Đúng/Sai theo thang 0,1 / 0,25 / 0,5 / 1', () => {
  const q = { stt: 1, loai: 'DS', dapAn: 'DSDS', diem: 1 };
  assert.strictEqual(g.gradeOne_(q, ['D', 'S', 'D', 'S']).score, 1);
  assert.strictEqual(g.gradeOne_(q, 'ĐSĐĐ').score, 0.5);
  assert.strictEqual(g.gradeOne_(q, ['D', 'S', '', '']).score, 0.25);
  assert.strictEqual(g.gradeOne_(q, ['D', '', '', '']).score, 0.1);
  assert.strictEqual(g.gradeOne_(q, ['S', 'D', 'S', 'D']).score, 0);
});

t('chấm trả lời ngắn: dấu phẩy, sai số, nhiều đáp án', () => {
  const q = { stt: 1, loai: 'TL', dapAn: '12,5', diem: 0.25 };
  assert(g.gradeOne_(q, '12.5').correct);
  assert(g.gradeOne_(q, ' 12,50 ').correct);
  assert(!g.gradeOne_(q, '12,6').correct);
  assert(g.gradeOne_(Object.assign({}, q, { saiSo: '0,1' }), '12,6').correct);
  assert(g.gradeOne_(Object.assign({}, q, { dapAn: '0,13|0,125' }), '0.13').correct);
  assert(!g.gradeOne_(q, '').correct);
});

const cls = ok(g.call('listClasses'));
const list = ok(g.call('listStudentsInClass', { lop: '12A1' }));
let stTok;
t('đăng nhập PIN (ngày sinh 01/01 → 0101), khóa sau 5 lần sai', () => {
  assert.deepStrictEqual(cls, ['12A1']);
  assert.strictEqual(list[0].id, 'HS0001');
  const bad = g.call('loginPin', { studentId: 'HS0001', pin: '1111' });
  assert(!bad.ok && /Còn 4/.test(bad.error));
  const r = ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' }));
  assert.strictEqual(r.user.hoTen, 'Học Sinh Mẫu');
  stTok = r.token;
  for (let i = 0; i < 5; i++) g.call('loginPin', { studentId: 'HS0001', pin: '9999' });
  assert(/10 phút/.test(g.call('loginPin', { studentId: 'HS0001', pin: '0101' }).error));
  Object.keys(g._cache).forEach(k => delete g._cache[k]);
});

t('token giả mạo bị từ chối', () => {
  const r = g.call('me', { token: stTok.slice(0, -3) + 'abc' });
  assert(!r.ok && /AUTH/.test(r.error));
});

let resultId;
t('làm bài: đề không lộ đáp án, nộp bài được chấm và ghi KetQua', () => {
  const exams = ok(g.call('listExams', { token: stTok }));
  assert.strictEqual(exams.length, 1);
  assert(exams[0].canStart);
  const s = ok(g.call('startExam', { token: stTok, examId: 'DEMAU' }));
  assert.strictEqual(s.questions.length, 6);
  s.questions.forEach(q => { assert(!('dapAn' in q)); assert(!('loiGiai' in q)); });
  const answers = { 1: 'C', 2: 'A', 3: 'A', 4: ['D', 'S', 'D', 'D'], 5: '420', 6: '' };
  const r = ok(g.call('submitExam', { token: stTok, attemptToken: s.attemptToken, answers }));
  // 0,25 + 0 + 0,25 + 0,5 + 0,25 + 0 = 1,25 / 2,25 → 5,56
  assert.strictEqual(r.diemGoc, 1.25);
  assert.strictEqual(r.diemToiDa, 2.25);
  assert.strictEqual(r.diem, 5.56);
  assert.strictEqual(r.soCauDung, 3);
  assert(r.reveal);
  assert.strictEqual(r.items[3].nCorrect, 3);
  assert(r.feedback.some(f => /bỏ trống 1 câu/.test(f.text)), 'nhận xét bỏ trống');
  assert(r.feedback.some(f => /chỉ sai đúng 1 ý/.test(f.text)), 'nhận xét Đúng/Sai');
  resultId = r.id;
  const row = g._sheets.KetQua._data()[1];
  assert.strictEqual(row[1], 'Học Sinh Mẫu');
  assert.strictEqual(row[2], '12A1');
  assert.strictEqual(row[4], 5.56);
  // nộp lại cùng lượt không tạo thêm dòng
  const again = ok(g.call('submitExam', { token: stTok, attemptToken: s.attemptToken, answers }));
  assert.strictEqual(again.id, resultId);
  assert.strictEqual(g._sheets.KetQua.getLastRow(), 2);
});

let tTok;
t('giáo viên: đăng nhập mật khẩu, tạo đề, thêm học sinh', () => {
  assert(!g.call('loginAdminPassword', { password: 'sai' }).ok);
  tTok = ok(g.call('loginAdminPassword', { password: adminPw })).token;
  const st = ok(g.call('adminSaveStudent', { token: tTok, student: { hoTen: 'Nguyễn Văn An', lop: '12a2', ngaySinh: '5/3/2008' } }));
  assert.strictEqual(st.id, 'HS0002');
  assert.strictEqual(st.lop, '12A2');
  const imp = ok(g.call('adminImportStudents', { token: tTok, rows: [
    { hoTen: 'Trần Thị Bình', lop: '12A2', ngaySinh: '2008-11-20' },
    { hoTen: 'Nguyễn Văn An', lop: '12A2', ngaySinh: '05/03/2008' },
    { hoTen: 'Thiếu', lop: '12A2', ngaySinh: '' }
  ] }));
  assert.strictEqual(imp.added, 1);
  assert.strictEqual(imp.skipped.length, 2);
  const sts = ok(g.call('adminListStudents', { token: tTok }));
  assert.strictEqual(sts.find(s => s.hoTen === 'Nguyễn Văn An').pin, '0503');
  assert.strictEqual(sts.find(s => s.hoTen === 'Trần Thị Bình').pin, '2011');
  // Học sinh không gọi được API giáo viên
  assert(/AUTH/.test(g.call('adminListStudents', { token: stTok }).error));

  const bad = g.call('adminSaveExam', { token: tTok, exam: { tieuDe: 'X' }, questions: [{ loai: 'TN', noiDung: 'abc', A: '1', B: '2', C: '3', D: '4', dapAn: 'E' }] });
  assert(/đáp án phải là A, B, C hoặc D/.test(bad.error));
  const saved = ok(g.call('adminSaveExam', { token: tTok, exam: { tieuDe: 'Kiểm tra 15 phút', lop: '12a2', thoiGian: 15, trangThai: 'MO', hienLoiGiai: 'SAU_HAN' }, questions: [
    { loai: 'TN', noiDung: '=1+1 bằng?', A: '1', B: '2', C: '3', D: '4', dapAn: 'b', chuDe: 'Cơ học', mucDo: 'NB' },
    { loai: 'Đúng/Sai', noiDung: 'Mệnh đề', A: 'a', B: 'b', C: 'c', D: 'd', dapAn: 'Đ Đ S S', chuDe: 'Cơ học' },
    { loai: 'TL', noiDung: 'g = ?', dapAn: '9,8', saiSo: '0,05', chuDe: 'Cơ học', mucDo: 'VD' }
  ] }));
  const ex = ok(g.call('adminGetExam', { token: tTok, examId: saved.id }));
  assert.strictEqual(ex.questions.length, 3);
  assert.strictEqual(ex.questions[0].noiDung, '=1+1 bằng?');
  assert.strictEqual(ex.questions[0].dapAn, 'B');
  assert.strictEqual(ex.questions[1].loai, 'DS');
  assert.strictEqual(ex.questions[1].dapAn, 'DDSS');
  // Đề mẫu vẫn còn nguyên câu hỏi
  assert.strictEqual(ok(g.call('adminGetExam', { token: tTok, examId: 'DEMAU' })).questions.length, 6);
  // Học sinh lớp 12A1 không thấy đề của 12A2
  assert.strictEqual(ok(g.call('listExams', { token: stTok })).length, 1);

  // HS lớp 12A2 làm đề; lời giải ẩn đến khi đóng đề
  const an = ok(g.call('loginPin', { studentId: 'HS0002', pin: '0503' })).token;
  const s = ok(g.call('startExam', { token: an, examId: saved.id }));
  const r = ok(g.call('submitExam', { token: an, attemptToken: s.attemptToken, answers: { 1: 'B', 2: ['D', 'D', 'S', 'S'], 3: '9.82' } }));
  assert.strictEqual(r.diem, 10);
  assert(!r.reveal);
  assert(!('dapAn' in r.items[0]));
  ok(g.call('adminSaveExam', { token: tTok, exam: Object.assign({}, ex.exam, { trangThai: 'DONG' }), questions: ex.questions }));
  const r2 = ok(g.call('getResult', { token: an, resultId: r.id }));
  assert(r2.reveal && r2.items[0].dapAn === 'B');
  // HS khác không xem được bài
  assert(!g.call('getResult', { token: stTok, resultId: r.id }).ok);
});

t('thống kê, bảng điểm, bảng xếp hạng', () => {
  const s = ok(g.call('adminExamStats', { token: tTok, examId: 'DEMAU' }));
  assert.strictEqual(s.count, 1);
  assert.strictEqual(s.questions[1].pct, 0);
  assert.strictEqual(s.questions[0].pct, 100);
  const gb = ok(g.call('adminGradebook', { token: tTok }));
  assert.strictEqual(gb.rows.length, 3);
  assert.strictEqual(gb.exams.length, 2);
  const lb = ok(g.call('leaderboard', { token: stTok, examId: 'DEMAU' }));
  assert.strictEqual(lb.rows[0].hang, 1);
  assert(lb.me && lb.me.laToi);
  assert(!('studentId' in lb.rows[0]));
  const all = ok(g.call('leaderboard', { token: tTok }));
  assert.strictEqual(all.rows[0].hoTen, 'Nguyễn Văn An');
  const ms = ok(g.call('myStats', { token: stTok }));
  assert.strictEqual(ms.count, 1);
  assert(ms.byTopic.length >= 3);
  const ov = ok(g.call('adminOverview', { token: tTok }));
  assert.strictEqual(ov.counts.results, 2);
});

t('đăng nhập Google: liên kết tài khoản HS bằng PIN, giáo viên theo email', () => {
  ok(g.call('adminSaveSettings', { token: tTok, settings: { GOOGLE_CLIENT_ID: 'cid', EMAIL_GIAO_VIEN: 'thay@gmail.com' } }));
  const r1 = ok(g.call('loginGoogle', { credential: 'fake:hs@gmail.com:cid', as: 'student' }));
  assert(r1.needLink);
  assert(!g.call('loginGoogle', { credential: 'fake:hs@gmail.com:sai', as: 'student' }).ok);
  const r2 = ok(g.call('linkGoogle', { credential: 'fake:hs@gmail.com:cid', studentId: 'HS0001', pin: '0101' }));
  assert.strictEqual(r2.user.email, 'hs@gmail.com');
  const r3 = ok(g.call('loginGoogle', { credential: 'fake:HS@gmail.com:cid', as: 'student' }));
  assert.strictEqual(r3.user.id, 'HS0001');
  const t1 = ok(g.call('loginGoogle', { credential: 'fake:thay@gmail.com:cid', as: 'teacher' }));
  assert.strictEqual(t1.user.role, 'teacher');
  assert(!g.call('loginGoogle', { credential: 'fake:hs@gmail.com:cid', as: 'teacher' }).ok);
});

t('gửi email cho giáo viên khi bật cài đặt', () => {
  ok(g.call('adminSaveSettings', { token: tTok, settings: { GUI_EMAIL_KHI_NOP: 'CO' } }));
  const s = ok(g.call('startExam', { token: stTok, examId: 'DEMAU' }));
  ok(g.call('submitExam', { token: stTok, attemptToken: s.attemptToken, answers: { 1: 'C' } }));
  assert.strictEqual(g._mails.length, 1);
  assert(/Học Sinh Mẫu \(12A1\)/.test(g._mails[0].subject));
});

console.log(`\n${passed} kiểm thử đạt${process.exitCode ? ', CÓ LỖI' : ''}.`);
