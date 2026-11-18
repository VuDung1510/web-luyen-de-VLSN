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
        if (attempt >= (opts.retries || 1)) throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
        await sleep(800 * (attempt + 1));
      }
    }
    if (!data.ok) {
      const msg = String(data.error || 'Lỗi không xác định');
      if (/^AUTH:/.test(msg)) {
        if (onAuthError) onAuthError(msg.replace(/^AUTH:\s*/, ''));
        throw new Error(msg.replace(/^AUTH:\s*/, ''));
      }
      throw new Error(msg);
    }
    return data.data;
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
  const PARTS = { 1: 'PHẦN I. Trắc nghiệm nhiều phương án lựa chọn', 2: 'PHẦN II. Trắc nghiệm đúng sai', 3: 'PHẦN III. Trắc nghiệm trả lời ngắn' };

  /** Nội dung câu hỏi: giữ xuống dòng, cho phép **đậm**, *nghiêng*, ảnh ![](url); công thức $...$ do KaTeX hiển thị */
  function rich(text) {
    // tách công thức ra trước để không bị định dạng nhầm
    const keep = [];
    let s = String(text == null ? '' : text).replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/g, (m) => { keep.push(m); return `\u0000${keep.length - 1}\u0000`; });
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (m, alt, url) => `<img src="${url}" alt="${alt}" loading="lazy">`);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/(^|[^*\\])\*([^*\n]+)\*/g, '$1<i>$2</i>');
    s = s.replace(/\n/g, '<br>');
    // dấu phẩy thập phân kiểu Việt Nam trong công thức: 2,67 → 2{,}67 để KaTeX không chèn khoảng trắng
    return s.replace(/\u0000(\d+)\u0000/g, (m, i) => esc(keep[+i].replace(/(\d),(?=\d)/g, '$1{,}')));
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
    if (it.loai === 'TN') {
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
    const fb = (v.feedback || []).filter((f) => !/^(Kết quả:|Phần (trắc nghiệm|Đúng\/Sai|trả lời ngắn)|Còn bỏ trống)/i.test(f.text));
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
        <div class="row" style="margin:6px 0"><span class="badge ${scoreClass(v.diem)}">${gradeName(v.diem)}</span>
          <span class="badge">Đúng ${v.soCauDung}/${v.tongCau} câu</span><span class="badge">${fmtNum(v.diemGoc)}/${fmtNum(v.diemToiDa)} điểm gốc</span></div>
        <div class="muted small">Thời gian làm: ${esc(v.thoiGianLam)} · Nộp lúc ${esc(v.nopLuc)}${v.ghiChu ? ' · <b>' + esc(v.ghiChu) + '</b>' : ''}</div>
        ${opts.actions || ''}
      </div></div></div>`;
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
    CFG, store, api, esc, fmtNum, fmtDateIso, fmtClock, sleep, rich, math, toast, modal, confirmBox, loadingHtml, withBusy,
    renderGoogleButton, resultHtml, feedbackHtml, barsHtml, questionReviewHtml, chart, cssVar, downloadCsv, scoreClass, gradeName,
    LEVELS, TYPES, PARTS, tokenKey: 'ld_token',
    setAuthErrorHandler(fn) { onAuthError = fn; }
  };
  window.App = App;
})();
