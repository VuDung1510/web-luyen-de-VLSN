// Pha 6 (TC-6.5): quét repo tìm dữ liệu không được công khai.
//   node tests/scan-secrets.js                 — quét mọi file git đang theo dõi (và file mới chưa bị .gitignore)
//   KHO_TEXT=<file .txt> node tests/scan-secrets.js
//        — thêm bước so nguyên văn với kho: file văn bản (để NGOÀI repo) mỗi dòng là nội dung một câu của kho thật.
//          Đoạn ≥ 60 ký tự của một câu kho xuất hiện nguyên văn trong repo thì báo.
// Tìm: mật khẩu, PIN, email, id file Google Drive (25–44 ký tự [A-Za-z0-9_-], bắt đầu bằng "1"), nội dung kho.
// Ngoại lệ duy nhất: id Google Doc "Quyết định đã chốt" trong CLAUDE.md, docs/QUYET-DINH.md, docs/BAN-GIAO.md
// (giáo viên dùng cho quy trình). Giới hạn: không nhận ra một hàng dữ liệu học sinh thật dạng bảng (họ tên, ngày sinh)
// nếu không kèm email/PIN — người soát vẫn phải đọc diff. Kết quả: in từng phát hiện "file:dòng  loại  đoạn"; có phát hiện thì thoát mã 1.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOC_ID = '160yRH-KzpC_4YMsKrkrZiuZjpyrHsJduDwt5QScImHc';
const DOC_ID_FILES = ['CLAUDE.md', 'docs/QUYET-DINH.md', 'docs/BAN-GIAO.md'];
const BINARY = /\.(png|jpe?g|gif|webp|ico|docx|xlsx|xls|pdf|zip|woff2?|ttf)$/i;
const SELF = 'tests/scan-secrets.js';

// Email được phép: tên miền dành cho ví dụ (RFC 2606) và dòng ký tên commit
const EMAIL_OK = /@(example\.(com|org|net)|[\w-]+\.(test|example|invalid))$|^noreply@anthropic\.com$/i;

const files = execSync('git ls-files --cached --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter((f) => f && !BINARY.test(f) && f !== SELF && fs.existsSync(path.join(ROOT, f)));

const found = [];
const add = (file, line, kind, text) => found.push({ file, line, kind, text: String(text).slice(0, 90) });

/**
 * File được phép chứa PIN: chỉ những file kiểm thử tự gieo học sinh GIẢ vào gas-shim / dev-server (liệt kê đích danh).
 * Thêm file mới vào đây phải có lý do; PIN ở mọi file khác đều bị báo.
 */
const PIN_FILES = [
  'tests/backend.test.js', 'tests/bank.test.js', 'tests/cache.test.js', 'tests/measure-pha1.js',
  'tests/pha1-kiem-thu.test.js', 'tests/pha2-kiem-thu.test.js', 'tests/pha4-kiem-thu.e2e.js',
  'tests/pha4-kiem-thu.test.js', 'tests/pha4.test.js', 'tests/pha6-kiem-thu.test.js', 'tests/pha6.test.js'
];
/** PIN mẫu được nhắc trong tài liệu: 0101 = "Học Sinh Mẫu" do setup() gieo (01/01/2008); 0503 = ví dụ ngày sinh 05/03 trong README. */
const DOC_PINS = ['0101', '0503'];
/**
 * Ngoại lệ đích danh (file, loại, đoạn khớp): chuỗi VÍ DỤ trong báo cáo soát mô tả chính các mẫu mà bài quét phải bắt.
 * Không phải dữ liệu thật.
 */
const ALLOW = [
  { file: 'docs/bao-cao/pha-6-soat.md', kind: 'PIN', text: 'PIN của em là 1503' },
  { file: 'docs/bao-cao/pha-6-soat.md', kind: 'PIN', text: 'pin riêng: 2807' }
];
const allowed = (file, kind, m) => ALLOW.some((a) => a.file === file && a.kind === kind && a.text === m);
const pinValue = (m) => (m.match(/\d{4,8}/) || [''])[0];

const RULES = [
  { kind: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, ok: (m) => EMAIL_OK.test(m) },
  {
    kind: 'id file Drive',
    re: /(?<![A-Za-z0-9_-])1[A-Za-z0-9_-]{24,43}(?![A-Za-z0-9_-])/g,
    // id thật trộn chữ hoa, chữ thường và số; bỏ qua chuỗi kiểu tên file "10-dua-vao-luyen-tap"
    ok: (m, file) => !(/[A-Z]/.test(m) && /[a-z]/.test(m) && /\d/.test(m.slice(1))) || (m === DOC_ID && DOC_ID_FILES.includes(file))
  },
  {
    // id kiểu cũ của Drive: "0B" + 26 ký tự trở lên
    kind: 'id file Drive (kiểu cũ)',
    re: /(?<![A-Za-z0-9_-])0B[A-Za-z0-9_-]{26,42}(?![A-Za-z0-9_-])/g,
    ok: (m) => !(/[A-Z]/.test(m.slice(2)) && /[a-z]/.test(m))
  },
  {
    // giá trị mật khẩu thật: ≥ 6 ký tự chữ/số ngay sau dấu = hoặc dấu nháy; "<mật khẩu>", "`", "$VAR", "(?!…" không tính
    kind: 'mật khẩu',
    re: /(MAT_KHAU_QUAN_TRI['"]?\s*[,:=]\s*['"][^'"\s]{4,}|ADMIN_PW\s*[=:]\s*['"]?[A-Za-z0-9_-]{6,}(?![A-Za-z0-9_(\\])|ADMIN_PW\s*\|\|\s*['"][^'"]{4,}['"]|password['"]?\s*[:=]\s*['"][^'"]{6,}['"]|m[ậa]t\s*kh[ẩa]u(\s+qu[ảa]n\s+tr[ịi])?\s*(l[àa]|:|=)\s*[`'"*]*[A-Za-z0-9]{6,})/gi,
    ok: () => false
  },
  {
    // "pin: 1234", "pin: '1234'", "PIN là 1234", "PIN của em là 1234", "pin riêng: 1234"
    kind: 'PIN',
    re: /\bpin\b['"]?\s*[:=]\s*['"]?\d{4,8}\b|\bPIN\b[^\n\d.;]{0,20}?(?:l[àa]|:|=)\s*[`'"*]*\d{4,8}\b/gi,
    ok: (m, file) => PIN_FILES.includes(file) || DOC_PINS.includes(pinValue(m))
  }
];

const texts = {};
for (const file of files) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  texts[file] = src;
  const lines = src.split('\n');
  lines.forEach((ln, i) => {
    for (const r of RULES) {
      r.re.lastIndex = 0;
      let m;
      while ((m = r.re.exec(ln))) if (!r.ok(m[0], file, src) && !allowed(file, r.kind, m[0])) add(file, i + 1, r.kind, m[0]);
    }
  });
  // id tài liệu quyết định chỉ được nằm ở 3 file quy trình
  if (src.includes(DOC_ID) && !DOC_ID_FILES.includes(file)) add(file, 0, 'id file Drive', DOC_ID);
}

// So nguyên văn với kho (khi có bản xuất ở ngoài repo)
let khoNote = 'bỏ qua (không có KHO_TEXT)';
if (process.env.KHO_TEXT) {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const kho = fs.readFileSync(process.env.KHO_TEXT, 'utf8').split('\n').map(norm).filter((s) => s.length >= 60);
  const all = Object.keys(texts).map((f) => [f, norm(texts[f])]);
  let checked = 0;
  for (const q of kho) {
    // 3 đoạn 60 ký tự: đầu, giữa, cuối câu
    const parts = [q.slice(0, 60), q.slice(Math.floor(q.length / 2) - 30, Math.floor(q.length / 2) + 30), q.slice(-60)];
    for (const [f, t] of all) if (parts.some((p) => t.includes(p))) add(f, 0, 'nội dung kho', q);
    checked++;
  }
  khoNote = 'đã so ' + checked + ' câu kho';
}

if (found.length) {
  found.forEach((x) => console.log(`✗ ${x.file}:${x.line}  ${x.kind}  ${x.text}`));
  console.log(`scan-secrets: ${found.length} phát hiện trong ${files.length} file (nội dung kho: ${khoNote}).`);
  process.exit(1);
}
console.log(`scan-secrets: sạch — ${files.length} file, 0 phát hiện (nội dung kho: ${khoNote}).`);
