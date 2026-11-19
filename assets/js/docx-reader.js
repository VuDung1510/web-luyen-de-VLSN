/* Đọc file đề Word (.docx), Excel (.xlsx) và .csv ngay trên trình duyệt (Pha 3).
 * Hàm thuần: chạy được cả trên Node (để test) lẫn trình duyệt. Không dùng DOMParser:
 * tự đọc XML (bộ đọc nhỏ bên dưới) để Node và trình duyệt cho cùng một kết quả.
 *
 *   DocxReader.read(data, { JSZip, validate, onProgress }) → Promise<{ text, images[], warnings[], stats }>
 *       text: văn bản theo quy ước của Importer.fromText(); hình là mốc {{HINH:n}}; công thức Word là $…$.
 *   DocxReader.toQuestions(readResult, Importer) → { questions, warnings, stats, images }
 *   DocxReader.attachImages(questions, urls) — thay mốc {{HINH:n}} bằng hình đã tải lên (urls[n] = url | null)
 *   DocxReader.omml2latex(node, opts) → { latex, ok, plain }
 *   DocxReader.readFile(name, data, { JSZip, XLSX, Importer, validate, onProgress }) → Promise<kết quả chung>
 */
(function (root) {
  'use strict';

  const MAX_BYTES = 10 * 1024 * 1024;
  const IMG_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml', tif: 'image/tiff', tiff: 'image/tiff' };
  const BROWSER_OK = { png: 1, jpg: 1, jpeg: 1, gif: 1, bmp: 1, webp: 1 };
  const MARK_FAIL = 'công thức chưa đổi được';
  const MARK_OLE = 'công thức MathType chưa đổi được';
  const MARK_OBJ = 'đối tượng nhúng chưa đọc được';

  /* ===================== Bộ đọc XML nhỏ ===================== */
  // Nút: { n: tên (đã chuẩn hóa tiền tố), a: {thuộc tính}, c: [con] } ; nút chữ: { t: '...' }
  const NS = {
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main': 'w',
    'http://schemas.openxmlformats.org/officeDocument/2006/math': 'm',
    'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing': 'wp',
    'http://schemas.openxmlformats.org/drawingml/2006/main': 'a',
    'http://schemas.openxmlformats.org/drawingml/2006/picture': 'pic',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships': 'r',
    'urn:schemas-microsoft-com:vml': 'v',
    'urn:schemas-microsoft-com:office:office': 'o',
    'http://schemas.openxmlformats.org/markup-compatibility/2006': 'mc',
    'http://schemas.openxmlformats.org/package/2006/relationships': 'rel'
  };
  const ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
  function decodeEnt(s) {
    if (s.indexOf('&') < 0) return s;
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
      if (e[0] === '#') { const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(cp); } catch (x) { return ''; } }
      return ENT[e] != null ? ENT[e] : m;
    });
  }
  const KEEP_SPACE = { 'w:t': 1, 'm:t': 1, 'w:delText': 1, 'w:instrText': 1 };
  function parseXml(xml) {
    const s = String(xml);
    const top = { n: '#doc', a: {}, c: [] };
    const stack = [top];
    let prefixMap = null; // tiền tố trong file → tiền tố chuẩn
    const re = /<(\/?)([^\s>\/!?]+)((?:\s+[^\s=>\/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<![^>]*>|([^<]+)/g;
    const attrRe = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    const norm = (name) => {
      if (!prefixMap) return name;
      const i = name.indexOf(':');
      if (i < 0) return name;
      const p = prefixMap[name.slice(0, i)];
      return p ? p + name.slice(i) : name;
    };
    let m;
    while ((m = re.exec(s))) {
      if (m[6] != null) {
        const cur = stack[stack.length - 1];
        if (KEEP_SPACE[cur.n] || /\S/.test(m[6])) cur.c.push({ t: decodeEnt(m[6]) });
        continue;
      }
      if (m[5] != null) { stack[stack.length - 1].c.push({ t: m[5] }); continue; }
      if (!m[2]) continue; // chú thích, khai báo
      if (m[1]) { // thẻ đóng
        if (stack.length > 1) stack.pop();
        continue;
      }
      const attrs = {};
      if (m[3]) {
        let am;
        attrRe.lastIndex = 0;
        while ((am = attrRe.exec(m[3]))) attrs[am[1]] = decodeEnt(am[2] != null ? am[2] : am[3]);
      }
      if (stack.length === 1) {
        // phần tử gốc: dựng bảng tiền tố theo khai báo xmlns (file do công cụ khác tạo có thể dùng tiền tố lạ)
        const map = {};
        let odd = false;
        Object.keys(attrs).forEach((k) => {
          if (k.indexOf('xmlns:') !== 0) return;
          const p = k.slice(6), canon = NS[attrs[k]];
          if (canon) { map[p] = canon; if (p !== canon) odd = true; }
        });
        if (odd) prefixMap = map;
      }
      const a = {};
      Object.keys(attrs).forEach((k) => { a[norm(k)] = attrs[k]; });
      const node = { n: norm(m[2]), a, c: [] };
      stack[stack.length - 1].c.push(node);
      if (!m[4]) stack.push(node);
    }
    return top;
  }
  const kids = (n, name) => (n && n.c ? n.c.filter((x) => x.n === name) : []);
  const kid = (n, name) => (n && n.c ? n.c.find((x) => x.n === name) : null);
  function find(n, name) { // con cháu đầu tiên
    if (!n || !n.c) return null;
    for (const x of n.c) { if (x.n === name) return x; const f = find(x, name); if (f) return f; }
    return null;
  }
  function findAll(n, name, out) {
    out = out || [];
    if (n && n.c) for (const x of n.c) { if (x.n === name) out.push(x); findAll(x, name, out); }
    return out;
  }
  function textOf(n) { // toàn bộ chữ bên trong
    if (!n) return '';
    if (n.t != null) return n.t;
    return (n.c || []).map(textOf).join('');
  }
  const val = (n) => (n ? (n.a['m:val'] != null ? n.a['m:val'] : n.a['w:val']) : undefined);
  const on = (n) => !!n && !/^(0|false|off)$/i.test(String(val(n) == null ? '1' : val(n)));

  /* ===================== OMML → LaTeX ===================== */
  const GREEK = {
    'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\varepsilon', 'ϵ': '\\epsilon', 'ζ': '\\zeta', 'η': '\\eta',
    'θ': '\\theta', 'ϑ': '\\vartheta', 'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu', 'µ': '\\mu', 'ν': '\\nu', 'ξ': '\\xi',
    'ο': 'o', 'π': '\\pi', 'ϖ': '\\varpi', 'ρ': '\\rho', 'ϱ': '\\varrho', 'σ': '\\sigma', 'ς': '\\varsigma', 'τ': '\\tau', 'υ': '\\upsilon',
    'φ': '\\varphi', 'ϕ': '\\varphi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
    'Γ': '\\Gamma', 'Δ': '\\Delta', '∆': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda', 'Ξ': '\\Xi', 'Π': '\\Pi', 'Σ': '\\Sigma', 'Υ': '\\Upsilon',
    'Φ': '\\Phi', 'Ψ': '\\Psi', 'Ω': '\\Omega', 'Ω': '\\Omega',
    'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Χ': 'X'
  };
  // ký hiệu → [lệnh, kiểu]: 'rel' quan hệ, 'bin' phép toán hai ngôi (có khoảng trắng hai bên), 'ord' thường
  const SYM = {
    '=': ['=', 'rel'], '<': ['<', 'rel'], '>': ['>', 'rel'], '≤': ['\\le', 'rel'], '⩽': ['\\le', 'rel'], '≥': ['\\ge', 'rel'], '⩾': ['\\ge', 'rel'],
    '≠': ['\\neq', 'rel'], '≈': ['\\approx', 'rel'], '≃': ['\\simeq', 'rel'], '≅': ['\\cong', 'rel'], '∼': ['\\sim', 'rel'], '~': ['\\sim', 'rel'],
    '≡': ['\\equiv', 'rel'], '∝': ['\\propto', 'rel'], '→': ['\\rightarrow', 'rel'], '←': ['\\leftarrow', 'rel'], '↔': ['\\leftrightarrow', 'rel'],
    '⇒': ['\\Rightarrow', 'rel'], '⇐': ['\\Leftarrow', 'rel'], '⇔': ['\\Leftrightarrow', 'rel'], '⟶': ['\\longrightarrow', 'rel'], '⟹': ['\\Longrightarrow', 'rel'],
    '↑': ['\\uparrow', 'rel'], '↓': ['\\downarrow', 'rel'], '⇌': ['\\rightleftharpoons', 'rel'], '∈': ['\\in', 'rel'], '∉': ['\\notin', 'rel'],
    '⊂': ['\\subset', 'rel'], '⊥': ['\\perp', 'rel'], '∥': ['\\parallel', 'rel'], '≪': ['\\ll', 'rel'], '≫': ['\\gg', 'rel'],
    '+': ['+', 'bin'], '±': ['\\pm', 'bin'], '∓': ['\\mp', 'bin'], '×': ['\\times', 'bin'], '·': ['\\cdot', 'bin'], '⋅': ['\\cdot', 'bin'],
    '∙': ['\\cdot', 'bin'], '•': ['\\cdot', 'bin'], '÷': ['\\div', 'bin'], '∪': ['\\cup', 'bin'], '∩': ['\\cap', 'bin'],
    '∞': ['\\infty', 'ord'], '∂': ['\\partial', 'ord'], '∇': ['\\nabla', 'ord'], '∘': ['\\circ', 'ord'], '′': ["'", 'ord'], '″': ["''", 'ord'],
    '…': ['\\ldots', 'ord'], '⋯': ['\\cdots', 'ord'], '∠': ['\\angle', 'ord'], 'ℏ': ['\\hbar', 'ord'], 'ℓ': ['\\ell', 'ord'], '∀': ['\\forall', 'ord'],
    '∃': ['\\exists', 'ord'], '∅': ['\\emptyset', 'ord'], '%': ['\\%', 'ord'], '{': ['\\{', 'ord'], '}': ['\\}', 'ord'], '#': ['\\#', 'ord'],
    '_': ['\\_', 'ord'], '$': ['\\$', 'ord'], '\\': ['\\backslash', 'ord'], '^': ['\\wedge', 'ord'], '‖': ['\\|', 'ord'], '⟨': ['\\langle', 'ord'],
    '⟩': ['\\rangle', 'ord'], '&': ['', 'ord'], '​': ['', 'ord'], '⁡': ['', 'ord'], '⁢': ['', 'ord'], '⁣': ['', 'ord'],
    ' ': ['\\,', 'ord'], ' ': ['\\ ', 'ord'], ' ': ['\\quad', 'ord'], ' ': ['\\ ', 'ord'], ' ': ['\\ ', 'ord'], ' ': ['\\ ', 'ord'], ' ': ['\\,', 'ord'],
    '−': ['-', 'minus'], '-': ['-', 'minus'], '–': ['-', 'minus']
  };
  const FUNCS = ['arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'ln', 'log', 'lg', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'deg', 'arg', 'dim'];
  const OPNAME = ['tg', 'cotg', 'arctg', 'arccotg', 'sign', 'sgn'];
  const NARY = { '∑': '\\sum', '∏': '\\prod', '∐': '\\coprod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint', '⋃': '\\bigcup', '⋂': '\\bigcap' };
  const ACC = {
    '⃗': 'vec', '⃑': 'vec', '→': 'vec', '̂': 'hat', '^': 'hat', 'ˆ': 'hat', '̅': 'overline', '¯': 'overline', '‾': 'overline', '̄': 'bar',
    '̃': 'tilde', '~': 'tilde', '˜': 'tilde', '̇': 'dot', '˙': 'dot', '̈': 'ddot', '¨': 'ddot', '̆': 'breve', '̌': 'check', '⃖': 'overleftarrow', '⃡': 'overleftrightarrow'
  };
  const DELIM = { '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '|': '|', '‖': '\\|', '⟨': '\\langle', '⟩': '\\rangle', '〈': '\\langle', '〉': '\\rangle', '⌊': '\\lfloor', '⌋': '\\rfloor', '⌈': '\\lceil', '⌉': '\\rceil', '': '.' };
  const REL_CMD = /(=|<|>|\\(le|ge|neq|approx|simeq|cong|sim|equiv|propto|rightarrow|leftarrow|leftrightarrow|Rightarrow|Leftarrow|Leftrightarrow|longrightarrow|Longrightarrow|uparrow|downarrow|rightleftharpoons|in|notin|subset|perp|parallel|ll|gg|pm|mp|times|cdot|div|cup|cap|left[([{|.]|left\\\{|left\\langle))$/;

  // Chữ toán học kiểu Unicode (𝑥, 𝐀, 𝟏…) → chữ thường
  function plainMathAlnum(ch) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x1d400 && cp <= 0x1d6a3) { const k = (cp - 0x1d400) % 52; return String.fromCharCode(k < 26 ? 65 + k : 97 + k - 26); }
    if (cp >= 0x1d7ce && cp <= 0x1d7ff) return String.fromCharCode(48 + (cp - 0x1d7ce) % 10);
    if (cp === 0x210e) return 'h';
    return ch;
  }
  const isLetter = (ch) => /\p{L}/u.test(ch);
  const isAscii = (ch) => ch.charCodeAt(0) < 128;
  const escText = (s) => s.replace(/[\\{}$%#&_^~]/g, (c) => ({ '\\': '\\backslash ', '~': '\\sim ' }[c] || '\\' + c));

  /** Bộ ghép LaTeX: tự chèn khoảng trắng quanh dấu quan hệ / phép toán, phân biệt dấu trừ một ngôi */
  function Out(inScript) { this.s = ''; this.inScript = inScript; }
  Out.prototype.raw = function (x) {
    if (!x) return;
    if (/\\[a-zA-Z]+$/.test(this.s) && /^[a-zA-Z]/.test(x)) this.s += ' ';
    this.s += x;
  };
  Out.prototype.space = function () {
    const t = this.s;
    if (!t || / $/.test(t) || /\\ $/.test(t) || /[{(\[]$/.test(t)) return;
    this.s += '\\ ';
  };
  Out.prototype.op = function (cmd) {
    this.s = this.s.replace(/(\\ |\s)+$/, '');
    this.s += (this.s ? ' ' : '') + cmd + ' ';
  };
  Out.prototype.minus = function () {
    const t = this.s.replace(/(\\ |\s)+$/, '');
    if (!t || /[([{,;^_]$/.test(t) || REL_CMD.test(t) || /[+\-]$/.test(t)) { this.s = t + (t && /[=<>]$|\\[a-zA-Z]+$/.test(t) ? ' ' : '') + '-'; return; }
    this.op('-');
  };
  Out.prototype.degree = function () {
    if (this.inScript) { this.raw('\\circ'); return; }
    this.s = this.s.replace(/(\\ |\s)+$/, '');
    this.s += this.s ? '^\\circ' : '{}^\\circ';
  };
  Out.prototype.done = function () {
    return this.s.replace(/\s+/g, ' ').replace(/(\\ )+/g, '\\ ').replace(/^(\s|\\ )+/, '').replace(/(\s|\\ )+$/, '')
      .replace(/\{\s+/g, '{').replace(/\s+\}/g, '}')
      .replace(/(\d),(?=\{\d)/g, '$1{,}'); // "1,{2.10}^{5}": dấu phẩy thập phân trước nhóm → không chèn khoảng trắng
  };

  function Fail(msg) { this.message = msg; }

  /** Chữ trong m:r. plain = chữ đứng (m:nor hoặc m:sty="p"): từ → \text{}, tên hàm → \sin … */
  function emitText(o, text, plain) {
    const chars = Array.from(text).map(plainMathAlnum);
    let i = 0;
    while (i < chars.length) {
      const ch = chars[i];
      if (ch === ' ' || ch === ' ') { o.space(); i++; continue; }
      if (ch === '°' || ch === '˚') { o.degree(); i++; continue; }
      if (GREEK[ch]) { o.raw(GREEK[ch]); i++; continue; }
      if (SYM[ch]) {
        const [cmd, kind] = SYM[ch];
        if (kind === 'rel' || kind === 'bin') o.op(cmd); else if (kind === 'minus') o.minus(); else o.raw(cmd);
        i++; continue;
      }
      if (isLetter(ch)) {
        // cụm chữ liền nhau
        let j = i;
        while (j < chars.length && isLetter(chars[j]) && !GREEK[chars[j]]) j++;
        let word = chars.slice(i, j).join('');
        const nonAscii = /[^\x00-\x7f]/.test(word);
        if (plain || nonAscii) {
          if (plain && FUNCS.indexOf(word) >= 0) { o.raw('\\' + word); i = j; continue; }
          if (plain && OPNAME.indexOf(word) >= 0) { o.raw('\\operatorname{' + word + '}'); i = j; continue; }
          if (plain) {
            // chữ đứng: gom cả dấu / . ( ) và chữ số liền sau (đơn vị "J/(mol.K)", "cal/g")
            while (j < chars.length && /[\p{L}\d/.()\-·]/u.test(chars[j]) && !GREEK[chars[j]] && !(chars[j] === '-' && !/\p{L}/u.test(chars[j + 1] || ''))) j++;
            word = chars.slice(i, j).join('');
            if (/[()]/.test(word) && (word.split('(').length !== word.split(')').length)) { // ngoặc lẻ: chỉ lấy phần chữ
              j = i; while (j < chars.length && isLetter(chars[j]) && !GREEK[chars[j]]) j++;
              word = chars.slice(i, j).join('');
            }
          }
          o.raw('\\text{' + escText(word) + '}');
          i = j; continue;
        }
        o.raw(word); i = j; continue;
      }
      if (/[0-9.,;:!?()\[\]|/'*@]/.test(ch)) { o.raw(ch === '*' ? '\\ast' : ch); i++; continue; }
      if (/[̀-ͯ]/.test(ch)) { i++; continue; } // dấu kết hợp lẻ
      if (isAscii(ch)) { o.raw(ch); i++; continue; }
      throw new Fail('ký tự lạ ' + ch);
    }
  }

  function needBrace(b) {
    if (!b) return true;
    if (/^([A-Za-z0-9]|\\[a-zA-Z]+|\\text\{[^{}]*\}|\{[^{}]*\})$/.test(b)) return false;
    if (/^\\left[\s\S]*\\right(\\?[^a-zA-Z\s]|\\[a-zA-Z]+)$/.test(b) && b.split('\\left').length === 2) return false;
    return true;
  }
  const base = (b) => (needBrace(b) ? '{' + b + '}' : b);

  function conv(node, st, inScript) { // node chứa dãy phần tử OMML → chuỗi LaTeX
    const o = new Out(inScript);
    seq(node ? node.c || [] : [], o, st, inScript);
    return o.done();
  }
  function seq(list, o, st, inScript) {
    for (const x of list) {
      if (x.t != null) continue;
      el(x, o, st, inScript);
    }
  }
  const part = (n, name, st, sc) => conv(kid(n, name), st, sc);

  function el(x, o, st, inScript) {
    const n = x.n;
    if (/Pr$/.test(n) || n === 'm:ctrlPr' || n === 'w:rPr' || n === 'w:bookmarkStart' || n === 'w:bookmarkEnd' || n === 'w:proofErr' || n === 'w:del') return;
    switch (n) {
      case 'm:r': {
        const rPr = kid(x, 'm:rPr');
        const sty = val(kid(rPr, 'm:sty'));
        const plain = !!kid(rPr, 'm:nor') || sty === 'p';
        const t = kids(x, 'm:t').concat(findAll(x, 'w:t')).map(textOf).join('');
        if (t) emitText(o, t, plain);
        return;
      }
      case 'w:r': { const t = findAll(x, 'w:t').map(textOf).join(''); if (t) emitText(o, t, true); return; }
      case 'm:f': {
        const type = val(kid(kid(x, 'm:fPr'), 'm:type'));
        const nu = part(x, 'm:num', st, inScript), de = part(x, 'm:den', st, inScript);
        if (type === 'lin') o.raw(base(nu) + '/' + base(de));
        else if (type === 'noBar') o.raw('\\genfrac{}{}{0pt}{}{' + nu + '}{' + de + '}');
        else o.raw('\\frac{' + nu + '}{' + de + '}');
        return;
      }
      case 'm:sSup': o.raw(base(part(x, 'm:e', st, inScript)) + '^{' + part(x, 'm:sup', st, true) + '}'); return;
      case 'm:sSub': o.raw(base(part(x, 'm:e', st, inScript)) + '_{' + part(x, 'm:sub', st, true) + '}'); return;
      case 'm:sSubSup': o.raw(base(part(x, 'm:e', st, inScript)) + '_{' + part(x, 'm:sub', st, true) + '}^{' + part(x, 'm:sup', st, true) + '}'); return;
      case 'm:sPre': o.raw('{}_{' + part(x, 'm:sub', st, true) + '}^{' + part(x, 'm:sup', st, true) + '}' + part(x, 'm:e', st, inScript)); return;
      case 'm:rad': {
        const hide = on(kid(kid(x, 'm:radPr'), 'm:degHide'));
        const deg = hide ? '' : part(x, 'm:deg', st, true);
        o.raw('\\sqrt' + (deg ? '[' + deg + ']' : '') + '{' + part(x, 'm:e', st, inScript) + '}');
        return;
      }
      case 'm:d': {
        const pr = kid(x, 'm:dPr');
        const chr = (name, def) => { const c = kid(pr, name); return c ? (val(c) == null ? '' : val(c)) : def; };
        const b = chr('m:begChr', '('), e = chr('m:endChr', ')'), sep = chr('m:sepChr', '|');
        if (DELIM[b] == null || DELIM[e] == null) throw new Fail('ngoặc ' + b + e);
        const parts = kids(x, 'm:e').map((k) => conv(k, st, inScript));
        const sepTex = sep === ',' || sep === ';' ? sep + ' ' : ' ' + (DELIM[sep] || sep) + ' ';
        o.raw('\\left' + DELIM[b] + ' ' + parts.join(sepTex) + ' \\right' + DELIM[e]);
        return;
      }
      case 'm:nary': {
        const pr = kid(x, 'm:naryPr');
        const c = kid(pr, 'm:chr');
        const ch = c ? val(c) : '∫';
        const cmd = NARY[ch];
        if (!cmd) throw new Fail('toán tử ' + ch);
        const sub = on(kid(pr, 'm:subHide')) ? '' : part(x, 'm:sub', st, true);
        const sup = on(kid(pr, 'm:supHide')) ? '' : part(x, 'm:sup', st, true);
        o.raw(cmd + (sub ? '_{' + sub + '}' : '') + (sup ? '^{' + sup + '}' : '') + ' ' + part(x, 'm:e', st, inScript));
        return;
      }
      case 'm:func': {
        const fn = part(x, 'm:fName', st, inScript);
        const arg = part(x, 'm:e', st, inScript);
        o.raw(fn + (/^\\left/.test(arg) ? ' ' + arg : '{' + arg + '}'));
        return;
      }
      case 'm:acc': {
        const c = kid(kid(x, 'm:accPr'), 'm:chr');
        const ch = c ? (val(c) || '̂') : '̂';
        let cmd = ACC[ch];
        if (!cmd) throw new Fail('dấu ' + ch);
        const e = part(x, 'm:e', st, inScript);
        if (cmd === 'vec' && /^[A-Za-z]{2,}$/.test(e)) cmd = 'overrightarrow';
        if (cmd === 'hat' && e.length > 1 && !/^\\[a-zA-Z]+$/.test(e)) cmd = 'widehat';
        if (cmd === 'tilde' && e.length > 1 && !/^\\[a-zA-Z]+$/.test(e)) cmd = 'widetilde';
        o.raw('\\' + cmd + '{' + e + '}');
        return;
      }
      case 'm:bar': {
        const pos = val(kid(kid(x, 'm:barPr'), 'm:pos'));
        o.raw((pos === 'top' ? '\\overline{' : '\\underline{') + part(x, 'm:e', st, inScript) + '}');
        return;
      }
      case 'm:groupChr': {
        const pr = kid(x, 'm:groupChrPr');
        const c = kid(pr, 'm:chr');
        const ch = c ? val(c) : '⏟';
        const e = part(x, 'm:e', st, inScript);
        if (ch === '⏟' || ch === '⎵') o.raw('\\underbrace{' + e + '}');
        else if (ch === '⏞' || ch === '⎴') o.raw('\\overbrace{' + e + '}');
        else if (ch === '→' || ch === '⟶') o.raw('\\xrightarrow{' + e + '}');
        else if (ch === '←') o.raw('\\xleftarrow{' + e + '}');
        else throw new Fail('nhóm ' + ch);
        return;
      }
      case 'm:limLow': case 'm:limUpp': {
        const e = part(x, 'm:e', st, inScript), lim = part(x, 'm:lim', st, true);
        if (n === 'm:limLow') o.raw(/^\\(lim|max|min|sup|inf)$/.test(e) ? e + '_{' + lim + '}' : '\\underset{' + lim + '}{' + e + '}');
        else o.raw('\\overset{' + lim + '}{' + e + '}');
        return;
      }
      case 'm:box': o.raw(part(x, 'm:e', st, inScript)); return;
      case 'm:borderBox': o.raw('\\boxed{' + part(x, 'm:e', st, inScript) + '}'); return;
      case 'm:phant': {
        const show = kid(kid(x, 'm:phantPr'), 'm:show');
        const e = part(x, 'm:e', st, inScript);
        o.raw(show && !on(show) ? '\\phantom{' + e + '}' : e);
        return;
      }
      case 'm:eqArr': o.raw('\\begin{array}{l}' + kids(x, 'm:e').map((k) => conv(k, st, inScript)).join(' \\\\ ') + '\\end{array}'); return;
      case 'm:e': case 'm:oMath': case 'w:ins': case 'w:smartTag': seq(x.c, o, st, inScript); return;
      case 'm:m': throw new Fail('ma trận');
      default: throw new Fail('phần tử ' + n);
    }
  }

  /** node = m:oMath. opts.validate(latex) → true/false (vd KaTeX). Trả { latex, ok, plain, reason } */
  function omml2latex(node, opts) {
    opts = opts || {};
    const plain = findAll(node, 'm:t').map(textOf).join('').replace(/\s+/g, ' ').trim();
    try {
      const latex = conv(node, {}, false);
      if (latex && opts.validate && !opts.validate(latex)) return { latex: '', ok: false, plain, reason: 'KaTeX không hiển thị được' };
      return { latex, ok: true, plain };
    } catch (e) {
      if (!(e instanceof Fail)) throw e;
      return { latex: '', ok: false, plain, reason: e.message };
    }
  }
  const failMark = (plain) => '⟦' + MARK_FAIL + (plain ? ': ' + (plain.length > 60 ? plain.slice(0, 57) + '…' : plain).replace(/[⟦⟧]/g, '') : '') + '⟧';

  /* ===================== Đánh số tự động (numbering.xml) ===================== */
  const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  const roman = (n) => { let s = ''; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s; };
  const letters = (n) => { let s = ''; while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; };
  function fmtNum(n, fmt) {
    switch (fmt) {
      case 'decimal': return String(n);
      case 'decimalZero': return (n < 10 ? '0' : '') + n;
      case 'upperLetter': return letters(n);
      case 'lowerLetter': return letters(n).toLowerCase();
      case 'upperRoman': return roman(n);
      case 'lowerRoman': return roman(n).toLowerCase();
      default: return null;
    }
  }
  function Numbering(numXml, stylesXml) {
    this.abs = {}; this.nums = {}; this.styles = {}; this.counters = {}; this.badFmt = {};
    if (numXml) {
      const r = parseXml(numXml);
      findAll(r, 'w:abstractNum').forEach((a) => {
        const lv = {};
        kids(a, 'w:lvl').forEach((l) => {
          lv[+l.a['w:ilvl'] || 0] = { fmt: val(kid(l, 'w:numFmt')) || 'decimal', text: val(kid(l, 'w:lvlText')) || '', start: +(val(kid(l, 'w:start')) || 1) };
        });
        const link = val(kid(a, 'w:numStyleLink')) || val(kid(a, 'w:styleLink'));
        this.abs[a.a['w:abstractNumId']] = { lv, link };
      });
      findAll(r, 'w:num').forEach((nm) => {
        const ov = {};
        kids(nm, 'w:lvlOverride').forEach((o) => { const so = kid(o, 'w:startOverride'); if (so) ov[+o.a['w:ilvl'] || 0] = +val(so); });
        this.nums[nm.a['w:numId']] = { abs: val(kid(nm, 'w:abstractNumId')), ov };
      });
    }
    if (stylesXml) {
      const r = parseXml(stylesXml);
      findAll(r, 'w:style').forEach((s) => {
        const np = find(kid(s, 'w:pPr'), 'w:numPr');
        this.styles[s.a['w:styleId']] = { numId: np ? val(kid(np, 'w:numId')) : undefined, ilvl: np ? val(kid(np, 'w:ilvl')) : undefined, basedOn: val(kid(s, 'w:basedOn')) };
      });
    }
  }
  /** Tiền tố dựng lại cho đoạn văn: "Câu 3.", "B.", "c)" … hoặc '' */
  Numbering.prototype.prefix = function (pPr) {
    const np = kid(pPr, 'w:numPr');
    let numId = np ? val(kid(np, 'w:numId')) : undefined;
    let ilvl = np ? val(kid(np, 'w:ilvl')) : undefined;
    let sid = val(kid(pPr, 'w:pStyle')), guard = 0;
    while ((numId == null || ilvl == null) && sid && this.styles[sid] && guard++ < 10) {
      const s = this.styles[sid];
      if (numId == null && s.numId != null) numId = s.numId;
      if (ilvl == null && s.ilvl != null) ilvl = s.ilvl;
      sid = s.basedOn;
    }
    if (numId == null || numId === '0') return { text: '' };
    ilvl = +ilvl || 0;
    const num = this.nums[numId];
    if (!num) return { text: '', bad: 'mã danh sách ' + numId };
    let ab = this.abs[num.abs];
    if (ab && ab.link && !Object.keys(ab.lv).length) { // danh sách theo kiểu (numStyleLink)
      const st = this.styles[ab.link];
      const n2 = st && this.nums[st.numId];
      if (n2) ab = this.abs[n2.abs];
    }
    if (!ab || !ab.lv[ilvl]) return { text: '', bad: 'mức ' + ilvl };
    const hasOv = Object.keys(num.ov).length > 0;
    const key = hasOv ? 'n' + numId : 'a' + num.abs;
    let c = this.counters[key];
    if (!c) { c = this.counters[key] = []; }
    for (let l = 0; l <= ilvl; l++) if (c[l] == null) c[l] = ((num.ov[l] != null ? num.ov[l] : (ab.lv[l] ? ab.lv[l].start : 1))) - (l === ilvl ? 1 : 0);
    c[ilvl]++;
    c.length = ilvl + 1;
    const lv = ab.lv[ilvl];
    if (lv.fmt === 'bullet' || lv.fmt === 'none') return { text: '' };
    let bad = null;
    const text = lv.text.replace(/%(\d)/g, (m, d) => {
      const l = +d - 1;
      const f = ab.lv[l] ? ab.lv[l].fmt : 'decimal';
      const s = fmtNum(c[l] || 1, f);
      if (s == null) { bad = 'kiểu đánh số ' + f; return String(c[l] || 1); }
      return s;
    }).trim();
    const n = c[ilvl];
    if (lv.fmt === 'decimal' || lv.fmt === 'decimalZero') {
      if (/\p{L}/u.test(lv.text.replace(/%\d/g, ''))) return { text, bad }; // "Câu %1." → giữ nguyên
      return { text: 'Câu ' + n + '.', bad, cau: true };
    }
    if (lv.fmt === 'upperLetter') return { text: letters(n) + '.', bad };
    if (lv.fmt === 'lowerLetter') return { text: letters(n).toLowerCase() + ')', bad };
    return { text, bad: bad || (fmtNum(1, lv.fmt) == null ? 'kiểu đánh số ' + lv.fmt : null) };
  };

  /* ===================== Đọc document.xml ===================== */
  const SYMBOL_FONT = { 0x61: 'α', 0x62: 'β', 0x63: 'χ', 0x64: 'δ', 0x65: 'ε', 0x66: 'φ', 0x67: 'γ', 0x68: 'η', 0x69: 'ι', 0x6a: 'ϕ', 0x6b: 'κ', 0x6c: 'λ', 0x6d: 'μ', 0x6e: 'ν', 0x6f: 'ο', 0x70: 'π', 0x71: 'θ', 0x72: 'ρ', 0x73: 'σ', 0x74: 'τ', 0x75: 'υ', 0x77: 'ω', 0x78: 'ξ', 0x79: 'ψ', 0x7a: 'ζ', 0x44: 'Δ', 0x46: 'Φ', 0x47: 'Γ', 0x4c: 'Λ', 0x50: 'Π', 0x51: 'Θ', 0x53: 'Σ', 0x57: 'Ω', 0x59: 'Ψ', 0xb0: '°', 0xb1: '±', 0xb4: '×', 0xb9: '≠', 0xbb: '≈', 0xa3: '≤', 0xb3: '≥', 0xae: '→', 0xde: '⇒', 0xd7: '·', 0xa5: '∞', 0x2d: '−' };

  async function read(data, opts) {
    opts = opts || {};
    const JSZip = opts.JSZip || (root && root.JSZip);
    if (!JSZip) throw new Error('Không tải được thư viện đọc file, hãy dán văn bản.');
    const prog = opts.onProgress || (() => {});
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (bytes.length > MAX_BYTES) throw new Error('File lớn hơn 10 MB. Hãy giảm kích thước hình trong Word (Nén ảnh) hoặc tách đề.');
    if (bytes[0] === 0xd0 && bytes[1] === 0xcf) throw new Error('Đây là file Word 97–2003 (.doc). Hãy mở bằng Word, chọn Lưu thành → "Word Document (.docx)" rồi tải lại.');
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('File bị hỏng hoặc không phải file Word .docx.');
    prog('Đọc file…');
    let zip;
    try { zip = await JSZip.loadAsync(bytes); } catch (e) { throw new Error('File Word bị hỏng, không mở được (' + (e && e.message ? e.message : 'lỗi giải nén') + ').'); }
    const get = async (p) => { const f = zip.file(p); return f ? f.async('string') : null; };
    const docXml = await get('word/document.xml');
    if (!docXml) throw new Error('File không có nội dung Word (thiếu word/document.xml). Hãy lưu lại bằng Word dạng .docx.');
    const relsXml = await get('word/_rels/document.xml.rels');
    const numXml = await get('word/numbering.xml');
    const stylesXml = await get('word/styles.xml');

    const rels = {};
    if (relsXml) findAll(parseXml(relsXml), 'Relationship').forEach((r) => { rels[r.a.Id] = { target: r.a.Target || '', external: r.a.TargetMode === 'External', type: r.a.Type || '' }; });
    const numbering = new Numbering(numXml, stylesXml);
    const docRoot = parseXml(docXml);
    const body = find(docRoot, 'w:body');
    if (!body) throw new Error('File Word không có phần thân văn bản.');
    prog('Đổi công thức…');

    const images = [];
    const warnings = [];
    const stats = { math: 0, mathOk: 0, mathFail: 0, ole: 0, images: 0, numbered: 0, tables: 0, headerTables: 0, textboxes: 0, anchors: 0, vml: 0 };
    const badNum = {};
    const failReasons = {};
    let started = false; // đã gặp "PHẦN …" hoặc "Câu n" (trước đó là khung đầu đề)

    const addImage = (info) => { info.n = images.length + 1; images.push(info); stats.images++; return '{{HINH:' + info.n + '}}'; };
    const imageFromRid = (rid, extra) => {
      const rel = rels[rid];
      if (!rel) return addImage(Object.assign({ kind: 'missing' }, extra));
      if (rel.external) return addImage(Object.assign({ kind: 'link', target: rel.target }, extra));
      let p = rel.target.replace(/^\.\//, '');
      p = p[0] === '/' ? p.slice(1) : 'word/' + p;
      p = p.replace(/[^/]+\/\.\.\//g, '');
      const ext = (p.split('.').pop() || '').toLowerCase();
      return addImage(Object.assign({ kind: BROWSER_OK[ext] ? 'img' : (ext === 'wmf' || ext === 'emf' ? 'wmf' : 'other'), path: p, ext, mime: IMG_MIME[ext] || 'application/octet-stream' }, extra));
    };

    function drawing(d) {
      const anchor = !!find(d, 'wp:anchor');
      if (anchor) stats.anchors++;
      const blips = findAll(d, 'a:blip');
      const tb = findAll(d, 'w:txbxContent').length;
      if (tb) stats.textboxes += tb;
      if (blips.length) {
        return blips.map((b) => b.a['r:embed'] ? imageFromRid(b.a['r:embed'], { anchor }) : b.a['r:link'] ? addImage({ kind: 'link', anchor }) : '').join('');
      }
      if (tb) return '';
      return addImage({ kind: 'shape', anchor }); // hình vẽ bằng công cụ Word, biểu đồ, SmartArt
    }
    function vml(p) {
      const imgs = findAll(p, 'v:imagedata');
      const tb = findAll(p, 'w:txbxContent').length;
      if (tb) stats.textboxes += tb;
      if (imgs.length) { stats.vml += imgs.length; return imgs.map((im) => imageFromRid(im.a['r:id'] || im.a['r:pict'], { vml: true })).join(''); }
      if (tb) return '';
      return addImage({ kind: 'shape', vml: true });
    }
    function oleObject(obj) {
      stats.ole++;
      const ole = find(obj, 'o:OLEObject');
      const prog = ole ? (ole.a.ProgID || '') : '';
      return /equation|mathtype|dsmt/i.test(prog) || !ole ? '⟦' + MARK_OLE + '⟧' : '⟦' + MARK_OBJ + (prog ? ' (' + prog + ')' : '') + '⟧';
    }
    function math(m) {
      stats.math++;
      const r = omml2latex(m, { validate: opts.validate });
      if (r.ok) { stats.mathOk++; return r.latex ? '$' + r.latex + '$' : ''; }
      stats.mathFail++;
      failReasons[r.reason] = (failReasons[r.reason] || 0) + 1;
      return failMark(r.plain);
    }

    // chữ trong một đoạn (đệ quy qua các phần tử chứa)
    function inline(n, out) {
      for (const x of n.c || []) {
        if (x.t != null) continue;
        switch (x.n) {
          case 'w:r': run(x, out); break;
          case 'm:oMath': out.push(math(x)); break;
          case 'm:oMathPara': findAll(x, 'm:oMath').forEach((mm) => out.push(math(mm), ' ')); break;
          case 'w:hyperlink': case 'w:smartTag': case 'w:ins': case 'w:customXml': case 'w:fldSimple': case 'w:bdo': case 'w:dir': case 'w:moveTo':
            inline(x, out); break;
          case 'w:sdt': inline(kid(x, 'w:sdtContent') || { c: [] }, out); break;
          case 'mc:AlternateContent': alt(x, out, inline); break;
          default: break; // w:pPr, w:del, w:bookmark…, w:proofErr
        }
      }
    }
    function alt(x, out, fn) {
      const ch = kid(x, 'mc:Choice');
      const fb = kid(x, 'mc:Fallback');
      fn(ch && (find(ch, 'w:drawing') || find(ch, 'w:r') || find(ch, 'w:t') || find(ch, 'm:oMath')) ? ch : (fb || ch || { c: [] }), out);
    }
    function run(r, out) {
      for (const x of r.c || []) {
        if (x.t != null) continue;
        switch (x.n) {
          case 'w:t': out.push(textOf(x)); break;
          case 'w:tab': case 'w:ptab': out.push('\t'); break;
          case 'w:br': case 'w:cr': out.push('\n'); break;
          case 'w:noBreakHyphen': out.push('-'); break;
          case 'w:sym': {
            const code = parseInt(x.a['w:char'] || '0', 16);
            const c = code >= 0xf000 ? code - 0xf000 : code;
            out.push(/symbol/i.test(x.a['w:font'] || '') && SYMBOL_FONT[c] ? SYMBOL_FONT[c] : (c >= 32 && c < 127 ? String.fromCharCode(c) : ''));
            break;
          }
          case 'w:drawing': out.push(drawing(x)); break;
          case 'w:pict': out.push(vml(x)); break;
          case 'w:object': out.push(oleObject(x)); break;
          case 'mc:AlternateContent': alt(x, out, run); break;
          case 'mc:Choice': case 'mc:Fallback': run(x, out); break;
          case 'm:oMath': out.push(math(x)); break;
          default: break; // w:rPr, w:instrText, w:fldChar, w:delText, w:footnoteReference…
        }
      }
    }
    function joinParts(parts) {
      let s = '';
      for (const p of parts) {
        if (!p) continue;
        if (p[0] === '$' && /\$$/.test(s)) s += ' '; // hai công thức liền nhau: tách ra để $…$ không thành $$
        s += p;
      }
      return s;
    }
    function paraText(p) {
      const out = [];
      inline(p, out);
      let s = joinParts(out).replace(/ /g, ' ');
      const pf = numbering.prefix(kid(p, 'w:pPr'));
      if (pf.bad) badNum[pf.bad] = 1;
      if (pf.text) {
        stats.numbered++;
        const already = pf.cau ? /^\s*C[âa]u\s*\d/i.test(s) : false;
        if (!already) s = pf.text + ' ' + s.replace(/^\s+/, '');
      }
      return s.replace(/[ \t]+$/g, '');
    }
    function cellText(tc) {
      const parts = [];
      for (const x of tc.c || []) {
        if (x.n === 'w:p') parts.push(paraText(x));
        else if (x.n === 'w:tbl') parts.push(tableLines(x, true).join(' '));
        else if (x.n === 'w:sdt') (kid(x, 'w:sdtContent') || { c: [] }).c.forEach((y) => { if (y.n === 'w:p') parts.push(paraText(y)); });
      }
      return parts;
    }
    const KEY_Q = /^c[âa]u(\s*s[ốo])?$/i, KEY_A = /^(đ[áa]p\s*[áa]n|đa|đ\/a|kết quả)$/i;
    function keyValue(v) {
      const s = v.replace(/\s+/g, '').replace(/[ạ]/g, 'a');
      if (/^[A-Da-d]$/.test(s)) return s.toUpperCase();
      const ds = v.replace(/[a-d]\s*[).]/gi, '').replace(/Đúng/gi, 'Đ').replace(/Sai/gi, 'S').replace(/[^ĐđSsDd]/g, '');
      if (ds.length === 4 && /^[ĐđSsDd]{4}$/.test(ds)) return ds.toUpperCase().replace(/D/g, 'Đ');
      const num = v.replace(/\s+/g, '').match(/^[-+−]?\d+(?:[.,]\d+)?$/);
      if (num) return num[0].replace('−', '-');
      return '';
    }
    function tableLines(tbl, flat) {
      const rows = kids(tbl, 'w:tr').map((tr) => kids(tr, 'w:tc').concat(findAll(tr, 'w:sdtContent').flatMap((s) => kids(s, 'w:tc'))).map((tc) => {
        const vm = find(kid(tc, 'w:tcPr'), 'w:vMerge');
        const merged = vm && (vm.a['w:val'] == null || vm.a['w:val'] === 'continue');
        return merged ? [] : cellText(tc);
      }));
      const flatRows = rows.map((r) => r.map((ps) => ps.join(' ').replace(/\s+/g, ' ').trim()));
      if (flat) return flatRows.map((r) => r.join(' '));
      stats.tables++;
      // bảng đáp án: hàng "Câu | 1 | 2 …" + hàng "Đáp án | B | C …" (hoặc theo cột)
      const keys = [];
      for (let i = 0; i + 1 < flatRows.length; i++) {
        if (KEY_Q.test(flatRows[i][0] || '') && KEY_A.test(flatRows[i + 1][0] || '')) {
          for (let j = 1; j < flatRows[i].length; j++) {
            const num = (flatRows[i][j] || '').match(/\d+/), v = keyValue(flatRows[i + 1][j] || '');
            if (num && v) keys.push(num[0] + '.' + v);
          }
        }
      }
      if (!keys.length && flatRows.length > 1) {
        const h = flatRows[0];
        for (let j = 0; j + 1 < h.length; j++) {
          if (KEY_Q.test(h[j] || '') && KEY_A.test(h[j + 1] || '')) {
            flatRows.slice(1).forEach((r) => { const num = (r[j] || '').match(/\d+/), v = keyValue(r[j + 1] || ''); if (num && v) keys.push(num[0] + '.' + v); });
          }
        }
      }
      if (keys.length) return ['\u0001KEY', keys.join(' ')];
      const cells = flatRows.flat().filter((x) => x);
      // một ô, hoặc một cột, hoặc một hàng (bảng dàn trang: chữ một bên, hình một bên) → các đoạn văn thường
      const ncol = Math.max(0, ...rows.map((r) => r.length));
      // phương án đặt trong bảng: "A. … | B. …" / "C. … | D. …"
      if (cells.length >= 2 && cells.every((c) => /^\*?[A-D]\s*[.)]\s/.test(c))) {
        const ks = cells.map((c) => c.replace(/^\*/, '')[0]).join('');
        if ('ABCD'.indexOf(ks) === 0) return [cells.join('\t')];
      }
      if (ncol <= 1 || rows.length === 1 || cells.length <= 1) {
        stats.tables--;
        const out = [];
        rows.forEach((r) => r.forEach((ps) => ps.forEach((p) => out.push(p))));
        return out;
      }
      const clean = (c) => c.replace(/\|/g, '/').replace(/\n/g, ' ');
      const lines = flatRows.filter((r) => r.some((c) => c)).map((r) => {
        const cs = r.map(clean);
        while (cs.length < ncol) cs.push('');
        return cs.join(' | ');
      });
      return lines.length ? ['[BẢNG] ' + lines[0]].concat(lines.slice(1)) : [];
    }

    const lines = [];
    let keyMode = false;
    const START = /^\s*(PH[ẦÀA]N\s+(IV|III|II|I|\d)\b|C[âa]u\s*\d+)/i;
    const KEYHEAD = /^\s*(B[ẢA]NG\s+)?Đ[ÁA]P\s+[ÁA]N\s*:?\s*$|^\s*B[ẢA]NG\s+Đ[ÁA]P\s+[ÁA]N/i;
    function pushLine(s) {
      String(s).split('\n').forEach((l) => {
        if (START.test(l)) started = true;
        if (KEYHEAD.test(l)) keyMode = true;
        lines.push(l);
      });
    }
    function block(list) {
      for (const x of list) {
        if (x.t != null) continue;
        if (x.n === 'w:p') pushLine(paraText(x));
        else if (x.n === 'w:tbl') {
          if (!started) {
            // khung đầu đề (bảng trước "PHẦN …"/"Câu 1"): bỏ, kể cả logo trong đó
            stats.headerTables++;
            continue;
          }
          const tl = tableLines(x);
          if (tl[0] === '\u0001KEY') {
            if (!keyMode) pushLine('BẢNG ĐÁP ÁN');
            pushLine(tl[1]);
          } else tl.forEach(pushLine);
        } else if (x.n === 'w:sdt') block((kid(x, 'w:sdtContent') || { c: [] }).c);
        else if (x.n === 'w:customXml' || x.n === 'w:ins') block(x.c);
        else if (x.n === 'mc:AlternateContent') { const ch = kid(x, 'mc:Choice') || kid(x, 'mc:Fallback'); if (ch) block(ch.c); }
        else if (x.n === 'm:oMathPara') pushLine(findAll(x, 'm:oMath').map(math).join(' '));
      }
    }
    block(body.c);

    // dữ liệu hình (chỉ đọc những file có thật; tải lên làm sau khi giáo viên bấm thêm)
    for (const im of images) {
      if (!im.path) continue;
      const f = zip.file(im.path);
      if (!f) { im.kind = 'missing'; continue; }
      im.name = im.path.split('/').pop();
      if (im.kind === 'img') im.data = await f.async('uint8array');
    }
    if (stats.textboxes) warnings.push('File có ' + stats.textboxes + ' khung văn bản (Text Box): chữ trong khung chưa được đọc, hãy kiểm tra lại.');
    Object.keys(badNum).forEach((k) => warnings.push('Có đoạn đánh số tự động không dựng lại được (' + k + '): kiểm tra số câu / phương án.'));
    if (stats.mathFail) {
      const why = Object.keys(failReasons).map((k) => k + ' ×' + failReasons[k]).join(', ');
      stats.mathFailReasons = why;
    }
    prog('Xong');
    return { text: lines.join('\n'), images, warnings, stats };
  }

  /* ===================== Từ văn bản → câu hỏi ===================== */
  const FIELDS = ['noiDung', 'A', 'B', 'C', 'D', 'loiGiai'];
  const HINH_RE = /\{\{HINH:(\d+)\}\}/g;
  const KIND_MSG = {
    wmf: 'hình dạng WMF/EMF trình duyệt không vẽ được',
    other: 'hình định dạng lạ',
    shape: 'hình vẽ bằng công cụ của Word (khung, mũi tên, biểu đồ)',
    link: 'hình liên kết ngoài file',
    missing: 'hình bị thiếu trong file'
  };

  function toQuestions(res, Importer) {
    const parsed = Importer.fromText(res.text);
    const imgBy = {};
    res.images.forEach((im) => { imgBy[im.n] = im; });
    const warnings = res.warnings.slice();
    const used = {};
    const qwarn = [];
    const stats = Object.assign({}, res.stats, { cau: { 1: 0, 2: 0, 3: 0 }, imagesUsed: 0, imagesBad: 0, mathFailInQ: 0, oleInQ: 0 });
    parsed.questions.forEach((q, i) => {
      stats.cau[q.phan] = (stats.cau[q.phan] || 0) + 1;
      const label = 'Câu ' + (i + 1) + (q.num != null && q.num !== i + 1 ? ' (câu ' + q.num + ' Phần ' + ['', 'I', 'II', 'III'][q.phan] + ' trong file)' : '');
      let fails = 0, oles = 0, objs = 0;
      const bad = {};
      FIELDS.forEach((f) => {
        let s = String(q[f] || '');
        fails += (s.match(new RegExp('⟦' + MARK_FAIL, 'g')) || []).length;
        oles += (s.match(new RegExp('⟦' + MARK_OLE, 'g')) || []).length;
        objs += (s.match(new RegExp('⟦' + MARK_OBJ, 'g')) || []).length;
        s = s.replace(HINH_RE, (m, n) => {
          const im = imgBy[n];
          if (im && im.kind === 'img' && im.data) { used[n] = im; return m; }
          const k = im ? im.kind : 'missing';
          bad[k] = (bad[k] || 0) + 1;
          return '';
        });
        q[f] = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      });
      if (fails) { stats.mathFailInQ += fails; qwarn.push(label + ': ' + fails + ' công thức cần gõ lại (đánh dấu ⟦…⟧).'); }
      if (oles) { stats.oleInQ += oles; qwarn.push(label + ': ' + oles + ' công thức MathType chưa đổi được. Trong Word: MathType → "Convert Equations" sang Word Equation (OMML), rồi tải lại.'); }
      if (objs) qwarn.push(label + ': ' + objs + ' đối tượng nhúng (OLE) chưa đọc được.');
      const nb = Object.keys(bad).reduce((s, k) => s + bad[k], 0);
      if (nb) {
        stats.imagesBad += nb;
        q.hinhLoi = nb;
        qwarn.push(label + ': ' + (nb > 1 ? nb + ' hình' : 'hình') + ' cần chụp lại hoặc lưu lại dạng PNG (' + Object.keys(bad).map((k) => KIND_MSG[k] || k).join('; ') + ').');
      }
    });
    stats.imagesUsed = Object.keys(used).length;
    stats.paths = {};
    Object.keys(used).forEach((n) => { stats.paths[used[n].path] = 1; });
    // đề không kèm đáp án (thường gặp): gộp các dòng "chưa tìm thấy đáp án" thành một dòng
    const noKey = parsed.warnings.filter((w) => /chưa tìm thấy đáp án/.test(w));
    let pw = parsed.warnings;
    if (noKey.length > 3) {
      const nums = noKey.map((w) => +(w.match(/^Câu (\d+)/) || [])[1]).filter(Boolean);
      pw = pw.filter((w) => noKey.indexOf(w) < 0).concat(['Chưa có đáp án ở ' + noKey.length + ' câu (' + ranges(nums) + '). Thêm vào đề rồi chọn đáp án trong trình soạn.']);
    }
    stats.noKey = noKey.length;
    return { questions: parsed.questions, warnings: warnings.concat(qwarn, pw), stats, images: Object.keys(used).map((n) => used[n]) };
  }

  function ranges(nums) { // [1,2,3,5] → "câu 1–3, 5"
    const out = [];
    for (let i = 0; i < nums.length; i++) {
      let j = i;
      while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
      out.push(j > i ? nums[i] + '–' + nums[j] : String(nums[i]));
      i = j;
    }
    return 'câu ' + out.join(', ');
  }

  /** urls: { n: url | null }. Hình đầu tiên trong nội dung → cột hinhAnh; các hình khác → ![](url) tại chỗ. Trả số hình hỏng. */
  function attachImages(questions, urls) {
    const failed = [];
    questions.forEach((q, i) => {
      FIELDS.forEach((f) => {
        q[f] = String(q[f] || '').replace(HINH_RE, (m, n) => {
          const url = urls[n];
          if (!url) { failed.push(i + 1); return ''; }
          if (f === 'noiDung' && !q.hinhAnh) { q.hinhAnh = url; return '\u0002'; }
          return '![](' + url + ')';
        });
        q[f] = q[f].replace(/^[ \t]*\u0002[ \t]*\n?/gm, '').replace(/\u0002/g, '').replace(/\n{3,}/g, '\n\n').trim();
      });
    });
    return failed;
  }

  /* ===================== Excel / CSV ===================== */
  function readSheet(data, XLSX) {
    if (!XLSX) throw new Error('Không tải được thư viện đọc file, hãy dán văn bản.');
    let wb;
    try { wb = XLSX.read(data instanceof Uint8Array ? data : new Uint8Array(data), { type: 'array' }); } catch (e) { throw new Error('File Excel bị hỏng hoặc không đúng định dạng.'); }
    const warnings = [];
    let name = null, rows = [];
    for (const sn of wb.SheetNames) {
      const r = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: '', blankrows: false });
      if (r.some((x) => x.some((c) => String(c).trim()))) { if (name == null) { name = sn; rows = r; } else { warnings.push('File có nhiều trang tính: chỉ đọc trang đầu tiên có dữ liệu ("' + name + '").'); break; } }
    }
    return { rows, sheet: name, warnings };
  }
  function decodeText(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(u8), warn: null }; } catch (e) { /* không phải UTF-8 */ }
    try { return { text: new TextDecoder('windows-1258').decode(u8), warn: 'File CSV không ở dạng UTF-8: đã đọc theo bảng mã Windows-1258. Nếu chữ bị lỗi, trong Excel hãy lưu lại dạng "CSV UTF-8".' }; } catch (e) {
      return { text: new TextDecoder('utf-8').decode(u8), warn: 'File CSV không ở dạng UTF-8; chữ có dấu có thể bị lỗi. Trong Excel hãy lưu lại dạng "CSV UTF-8".' };
    }
  }

  /** Kiểm tra tên/kích thước. Trả loại 'docx' | 'xlsx' | 'csv' hoặc ném lỗi tiếng Việt */
  function kindOf(name, size) {
    const ext = String(name || '').toLowerCase().split('.').pop();
    if (size > MAX_BYTES) throw new Error('File lớn hơn 10 MB (' + (size / 1048576).toFixed(1).replace('.', ',') + ' MB). Hãy nén ảnh trong Word hoặc tách đề thành nhiều file.');
    if (ext === 'docx' || ext === 'docm') return 'docx';
    if (ext === 'xlsx' || ext === 'xlsm' || ext === 'xls') return 'xlsx';
    if (ext === 'csv' || ext === 'tsv' || ext === 'txt') return 'csv';
    if (ext === 'doc') throw new Error('File .doc (Word 97–2003) chưa đọc được. Hãy mở bằng Word, chọn Lưu thành → "Word Document (.docx)" rồi tải lại.');
    if (ext === 'pdf') throw new Error('Chưa đọc được file PDF. Hãy dùng file Word (.docx) gốc của đề.');
    throw new Error('Chỉ nhận file Word (.docx), Excel (.xlsx) hoặc .csv.');
  }

  async function readFile(name, data, libs) {
    libs = libs || {};
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const kind = kindOf(name, bytes.length);
    const I = libs.Importer || (root && root.Importer);
    if (kind === 'docx') {
      const res = await read(bytes, libs);
      const out = toQuestions(res, I);
      out.kind = 'docx';
      return out;
    }
    if (kind === 'xlsx') {
      if (bytes[0] !== 0x50 && bytes[0] !== 0xd0) throw new Error('File Excel bị hỏng hoặc không đúng định dạng.');
      const sh = readSheet(bytes, libs.XLSX);
      const r = I.fromRows(sh.rows);
      return { kind: 'xlsx', questions: r.questions, warnings: sh.warnings.concat(r.warnings), stats: { sheet: sh.sheet, rows: sh.rows.length }, images: [] };
    }
    const d = decodeText(bytes);
    if (/\.tsv$/i.test(name)) { const r = I.fromTsv(d.text); return { kind: 'csv', questions: r.questions, warnings: (d.warn ? [d.warn] : []).concat(r.warnings), stats: {}, images: [] }; }
    const r = I.fromCsv(d.text);
    return { kind: 'csv', questions: r.questions, warnings: (d.warn ? [d.warn] : []).concat(r.warnings), stats: {}, images: [] };
  }

  const api = { read, toQuestions, attachImages, omml2latex, parseXml, readSheet, readFile, kindOf, decodeText, MAX_BYTES, _find: find, _findAll: findAll };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DocxReader = api;
})(typeof window !== 'undefined' ? window : this);
