/* ============ 数据源：清单驱动，md 单一数据源 ============ */
/* 新增博主：建专册 md + 在 bloggers.json 加一行，无需改代码 */
const MANIFEST_FILE = 'bloggers.json';
const RULES_FILE = '../00-总览与跨博主规律.md';
let SOURCES = [];

/* 博主色板：按清单顺序自动分配，前三色兼容旧版 */
const PALETTE = [
  ['var(--accent-soft)', 'var(--accent)'],
  ['#e8f0fb', '#2f6bc4'],
  ['#f3eafb', '#7a3fb8'],
  ['var(--green-soft)', 'var(--green)'],
  ['var(--amber-soft)', 'var(--amber)'],
  ['#e0f2f1', '#1f7a72'],
  ['#fbe8f0', '#c2417f'],
  ['#efece6', '#6b665c'],
];
const _colorIdx = {};
function colorOf(name) {
  if (!(name in _colorIdx)) _colorIdx[name] = Object.keys(_colorIdx).length % PALETTE.length;
  return PALETTE[_colorIdx[name]];
}

/* ============ 工具函数 ============ */
function parseNum(s) {
  if (!s) return null;
  s = s.trim();
  if (/万/.test(s)) return Math.round(parseFloat(s.replace('万', '')) * 10000);
  const n = parseInt(s.replace(/[,，]/g, ''), 10);
  return isNaN(n) ? null : n;
}
function fmt(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 10000) {
    const v = n / 10000;
    return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + '万';
  }
  return String(n);
}

/* ============ 解析专册条目 ============ */
function parseEntries(md, source) {
  const out = [];
  // 只取「## 选题列表」到「## 索引」之间的明细
  const body = md.split(/^## 选题列表/m)[1] || md;
  const blocks = body.split(/^### (\d+) \| (.+)$/m);
  // split 结果: [前导, id1, title1, content1, id2, title2, content2, ...]
  for (let i = 1; i < blocks.length; i += 3) {
    const id = blocks[i], title = blocks[i + 1].trim();
    let content = blocks[i + 2] || '';
    const cut = content.indexOf('\n## ');
    if (cut > -1) content = content.slice(0, cut);
    const get = re => { const m = content.match(re); return m ? m[1].trim() : ''; };

    const interact = get(/^- 互动数据：(.+)$/m);
    const like = parseNum((interact.match(/点赞\s*([\d.]+万?)/) || [])[1]);
    const fav = parseNum((interact.match(/收藏\s*([\d.]+万?)/) || [])[1]);
    const com = parseNum((interact.match(/评论\s*([\d.]+万?)/) || [])[1]);
    const share = parseNum((interact.match(/分享\s*([\d.]+万?)/) || [])[1]);

    const formLine = get(/^- 形式：(.+)$/m);
    // 链接归一化：App 深链 /user/profile/UID/NID 与旧路由 /discovery/item/ 在网页端会触发 300031，统一转 /explore/NID
    const link = get(/^- 链接：(\S+)/m)
      .replace(/xiaohongshu\.com\/user\/profile\/[0-9a-fA-F]+\/([0-9a-fA-F]+)/i, 'xiaohongshu.com/explore/$1')
      .replace('/discovery/item/', '/explore/');
    const date = get(/发布：(\d{4}-\d{2}-\d{2})/);
    const blogger = get(/｜\s*博主：([^｜]+?)(?=\s*｜|$)/m);
    const tags = (get(/｜\s*标签：([^｜]+?)(?=\s*｜|$)/m) || '').split(/\s+/).map(t => t.replace(/^#/, '')).filter(Boolean);
    const type = get(/^- 内容类型：(.+)$/m);

    // 可选多行字段：内容结构/内容分析（缩进 bullet）与逐字稿（> 引用，原文照录）
    const sectionLines = header => {
      const lines = content.split('\n');
      const out = []; let on = false;
      for (const l of lines) {
        if (!on) { if (l.startsWith(`- ${header}：`)) on = true; continue; }
        if (/^- \S/.test(l)) break;
        out.push(l);
      }
      return out;
    };
    const structure = sectionLines('内容结构')
      .map(l => l.trim()).filter(l => l.startsWith('- ')).map(l => l.slice(2));
    const script = sectionLines('逐字稿')
      .map(l => l.trim()).filter(l => l.startsWith('>')).map(l => l.replace(/^>\s?/, ''));
    const analysis = sectionLines('内容分析')
      .map(l => l.trim()).filter(l => l.startsWith('- ')).map(l => l.slice(2));
    const storyboard = sectionLines('分镜拆解')
      .map(l => l.trim()).filter(l => l.startsWith('|'))
      .map(r => r.split('|').slice(1, -1).map(c => c.trim()))
      .filter(r => r.length > 1 && !r.every(c => /^:?-+:?$/.test(c)));
    const modules = sectionLines('模块说明')
      .map(l => l.trim()).filter(l => l.startsWith('|'))
      .map(r => r.split('|').slice(1, -1).map(c => c.trim()))
      .filter(r => r.length > 1 && !r.every(c => /^:?-+:?$/.test(c)));
    const advice = sectionLines('剪辑建议')
      .map(l => l.trim()).filter(l => l.startsWith('- ')).map(l => l.slice(2));

    out.push({
      id, title, link, date, blogger,
      short: source.short,
      book: ((source.file || '').match(/(\d{2})-/) || [])[1] || '',
      coverNote: get(/^- 封面分析：(.+)$/m),
      form: formLine,
      isVideo: /^视频/.test(formLine),
      tags, type,
      like, fav, com, share,
      favRatio: like ? (fav !== null ? fav / like : null) : null,
      comRatio: like && com !== null ? com / like : null,
      shareRatio: like && share !== null ? share / like : null,
      reason: get(/^- 爆款原因：(.+)$/m),
      tips: get(/^- 可借鉴点：(.+)$/m),
      structure, script, analysis, storyboard, modules, advice,
      _text: '',
    });
  }
  return out;
}

/* ============ 规律页可视化渲染 ============ */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inline(s) {
  s = escapeHtml(s);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  return s;
}
function extractTags(text) {
  const tags = [];
  const clean = text.replace(/【([^】]+)】/g, (m, t) => { if (!tags.includes(t)) tags.push(t); return ''; });
  return { tags, clean };
}
function tagChip(t) {
  let cls = 'x-other';
  if (t === '姜') cls = 'x-jiang';
  else if (t === '黄') cls = 'x-huang';
  else if (t === 'KiK') cls = 'x-kik';
  else if (t.indexOf('跨博主') === 0) cls = 'x-cross';
  const label = t.indexOf('跨博主') === 0 ? '跨博主' : t;
  return `<span class="tagx ${cls}" title="${escapeHtml(t)}">${escapeHtml(label)}</span>`;
}
function tagsHtml(tags) { return tags.length ? `<span class="rtags">${tags.map(tagChip).join('')}</span>` : ''; }

function ruleItemHtml(num, raw) {
  const { tags, clean } = extractTags(raw);
  let text = clean.trim();
  let title = '';
  const bm = text.match(/^\*\*(.+?)\*\*\s*[:：]?\s*([\s\S]*)$/);
  if (bm) { title = bm[1]; text = bm[2]; }
  else if (/^「/.test(text)) {
    const q = text.match(/^「([^」]*)」\s*([^→：；—]{0,14})/);
    if (q) { title = '「' + q[1] + '」' + (q[2] || '').trim(); text = text.slice(q[0].length); }
  }
  if (!title) {
    const c = text.match(/^([^：:→（；]{2,24})[：:→（；]/);
    if (c) { title = c[1]; text = text.slice(c[0].length); }
  }
  if (!title) { title = text.slice(0, 24); text = text.slice(24); }
  text = text.replace(/^\s*[：:]\s*/, '').trim();
  const si = text.indexOf('；', 60);
  const cut = text.length > 110 ? (si > -1 ? si + 1 : 110) : -1;
  const preview = cut > -1 ? text.slice(0, cut) + '…' : text;
  const rest = cut > -1 ? text.slice(cut) : '';
  return `
  <div class="rcard">
    <div class="rcard-head">
      <span class="rnum">${escapeHtml(num)}</span>
      <span class="rtitle">${escapeHtml(title)}</span>
      ${tagsHtml(tags)}
    </div>
    ${preview ? `<p class="rpreview">${escapeHtml(preview)}</p>` : ''}
    ${rest ? `<details class="rmore"><summary>展开完整验证细节</summary><p>${escapeHtml(rest)}</p></details>` : ''}
  </div>`;
}

function groupHeadHtml(raw) {
  const { tags, clean } = extractTags(raw);
  const m = clean.match(/^\*\*([A-D])\.\s*(.+?)\*\*$/);
  if (!m) return `<h3>${inline(clean)}</h3>`;
  const nm = m[2].match(/^(.+?)（(.+)）$/);
  return `
  <div class="rgroup">
    <span class="rletter">${m[1]}</span>
    <div style="flex:1">
      <div class="gtitle">${escapeHtml(nm ? nm[1] : m[2])}</div>
      ${nm ? `<div class="gsub">${escapeHtml(nm[2])}</div>` : ''}
    </div>
    ${tagsHtml(tags)}
  </div>`;
}

function boardLineHtml(raw) {
  const { clean } = extractTags(raw);
  const m = clean.match(/^\*\*(.+?)\*\*\s*[:：]\s*([\s\S]*)$/);
  if (!m || m[2].indexOf('>') === -1) return null;
  let rest = m[2];
  let note = '';
  const nm = rest.match(/（[^（）]*）$/);
  if (nm) { note = nm[0]; rest = rest.slice(0, rest.length - note.length); }
  let rank = 0;
  const pills = rest.split('>').map(s => s.trim()).filter(Boolean)
    .map(ch => ch.split('=').map(p => {
      rank += 1;
      const pm = p.trim().match(/^(.+?)（(.+)）$/);
      const who = pm ? pm[1] : p.trim();
      const val = pm ? pm[2] : '';
      return `<span class="bpill"><i>${rank}</i>${escapeHtml(who)}${val ? `<b>${escapeHtml(val)}</b>` : ''}</span>`;
    }).join('<span class="tie">=</span>')).join('');
  return `
  <div class="rboard">
    <h4>${escapeHtml(m[1])}</h4>
    <div class="bpills">${pills}</div>
    ${note ? `<div class="rnote">${escapeHtml(note.slice(1, -1))}</div>` : ''}
  </div>`;
}

function renderTable(rows) {
  const cellsOf = r => r.split('|').slice(1, -1).map(c => c.trim());
  const head = cellsOf(rows[0]);
  const body = rows.slice(2).map(cellsOf);
  return `<div class="rtable-wrap"><table class="rtable"><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderRulesVisual(md) {
  const lines = md.split('\n');
  const html = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trimEnd().trim();
    if (t === '') { i++; continue; }
    if (/^---+$/.test(t)) { html.push('<hr>'); i++; continue; }
    if (/^# /.test(t)) { html.push(`<h1 class="r-h1">${escapeHtml(t.slice(2))}</h1>`); i++; continue; }
    if (/^## /.test(t)) { html.push(`<h2 class="r-h2">${escapeHtml(t.slice(3))}</h2>`); i++; continue; }
    if (/^> /.test(t)) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) { buf.push(inline(lines[i].trim().slice(2))); i++; }
      html.push(`<div class="rcallout">${buf.map(x => `<p>${x}</p>`).join('')}</div>`);
      continue;
    }
    if (/^\|/.test(t)) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i++; }
      html.push(renderTable(rows));
      continue;
    }
    if (/^\*\*[A-D]\./.test(t)) { html.push(groupHeadHtml(t)); i++; continue; }
    const bl = boardLineHtml(t);
    if (bl) { html.push(bl); i++; continue; }
    const nm = t.match(/^(\d+)\.\s+(.*)$/);
    if (nm) { html.push(ruleItemHtml(nm[1], nm[2])); i++; continue; }
    if (/^- /.test(t)) {
      const body = t.slice(2);
      if (body.length > 120) { html.push(ruleItemHtml('•', body)); i++; continue; }
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith('- ') && lines[i].trim().slice(2).length <= 120) { buf.push(inline(lines[i].trim().slice(2))); i++; }
      html.push(`<ul class="rlist">${buf.map(x => `<li>${x}</li>`).join('')}</ul>`);
      continue;
    }
    html.push(`<p class="rpara">${inline(t)}</p>`);
    i++;
  }
  return html.join('\n');
}

/* ============ 卡片渲染 ============ */
// 爆款原因可视化：按 ；拆段后分三类渲染——钩子公式（×成分chips）/数据诊断/对比结论
function hlNum(h) {
  // 已 escape 的文本上：条目编号（0XX）→引用标签，其余数字→高亮
  return h
    .replace(/倒挂/g, '<span class="r-warn">倒挂</span>')
    .replace(/(0\d{2})|(\d+(?:\.\d+)?(?:万|%|倍|秒|分钟|分)?)/g,
      (m, ref, num) => ref ? `<span class="r-ref">${ref}</span>` : `<b class="r-num">${num}</b>`);
}
// 爆款原因可视化：统一「图标瓦片+圆点行」——钩子段按×拆多行，数据/对照/备注同款行式
function reasonHtml(reason) {
  const segs = reason.split(/；/).map(s => s.trim()).filter(Boolean);
  const rows = segs.map(s => {
    if (s.includes('×')) {
      const items = s.split(/×/).map(f => f.trim()).filter(Boolean)
        .map(f => `<div class="r-item">${hlNum(escapeHtml(f))}</div>`).join('');
      return `<li class="r-hook"><span class="r-ico">🎯</span><div class="r-body">${items}</div></li>`;
    }
    const isCmp = /0\d{2}|对照|验证|再确认|印证|假设|定律|定律再|首条|系列/.test(s);
    const isData = /收藏|点赞|评论|分享|比值|梯队|全库/.test(s) && /\d/.test(s);
    const kind = isCmp ? 'cmp' : (isData ? 'data' : 'note');
    return `<li class="r-${kind}"><span class="r-ico">🎯</span><div class="r-body"><div class="r-item">${hlNum(escapeHtml(s))}</div></div></li>`;
  });
  return `<ul class="reason-list">${rows.join('')}</ul>`;
}
// 可借鉴点可视化：按 ①②③④⑤⑥ 拆成编号列表，公式名（首个「：」前）加粗
function tipsHtml(tips) {
  const items = tips.split(/(?=[①②③④⑤⑥⑦⑧⑨])/).map(s => s.trim()).filter(Boolean);
  const rows = items.map(s => {
    const m = s.match(/^[①②③④⑤⑥⑦⑧⑨]\s*/);
    const num = m ? m[0].trim() : '';
    const body = m ? s.slice(m[0].length) : s;
    const i = body.indexOf('：');
    const inner = (i > 0 && i <= 28)
      ? `<strong>${escapeHtml(body.slice(0, i))}：</strong>${escapeHtml(body.slice(i + 1))}`
      : escapeHtml(body);
    return `<li>${num ? `<span class="num">${num}</span>` : ''}${inner}</li>`;
  });
  return `<ol class="tips-list">${rows.join('')}</ol>`;
}

function ratioChip(label, v, kind) {
  if (v === null) return '';
  let cls = 'mid', txt;
  if (kind === 'fav') { cls = v >= 1 ? 'up' : (v < 0.7 ? 'down' : 'mid'); txt = label + ' ' + v.toFixed(2) + (v >= 1 ? ' ↑' : ' ↓'); }
  else txt = label + ' ' + (v * 100).toFixed(1) + '%';
  return `<span class="ratio ${cls}">${txt}</span>`;
}

// 封面图：covers/{专册前缀}-{编号}.jpg 命名约定，加载失败整块移除
function coverHtml(e) {
  if (!e.book) return '';
  const key = e.book + '-' + e.id;
  return `
    <div class="card-cover">
      <a href="${e.link}" target="_blank" rel="noopener" title="点击打开原笔记">
        <img src="../covers/${key}.webp" alt="${escapeHtml(e.title)} 封面" loading="lazy" decoding="async"
             onerror="this.closest('.card-cover').remove();layoutGrid()">
      </a>
      ${e.coverNote ? `<div class="cover-note"><span class="cn-ico">🔍</span>${escapeHtml(e.coverNote)}</div>` : ''}
    </div>`;
}

function trunc(s, n) { s = s || ''; return s.length > n ? s.slice(0, n) + '…' : s; }

function cardHtml(e) {
  const [bcBg, bcFg] = colorOf(e.blogger);
  const typeShort = trunc(e.type.split(/（|\(/)[0], 12);
  return `
  <article class="card">
    <div class="card-head">
      <div class="badges">
        <span class="badge" style="background:${bcBg};color:${bcFg}">${e.blogger} · ${e.id}</span>
        <span class="badge type" title="${escapeHtml(e.type)}">${escapeHtml(typeShort)}</span>
        ${e.form ? `<span class="badge form">${e.form.split('｜')[0]}</span>` : ''}
      </div>
    </div>
    <div class="card-title">
      <a href="${e.link}" target="_blank" rel="noopener" title="点击直接打开原笔记">${escapeHtml(e.title)}</a>
      <div class="card-meta">${e.date || '日期未知'}</div>
    </div>
    ${coverHtml(e)}
    <div class="metrics">
      <div class="metric"><div class="v">${fmt(e.like)}</div><div class="k">赞</div></div>
      <div class="metric"><div class="v">${fmt(e.fav)}</div><div class="k">藏</div></div>
      <div class="metric"><div class="v">${fmt(e.com)}</div><div class="k">评</div></div>
      <div class="metric"><div class="v">${fmt(e.share)}</div><div class="k">享</div></div>
    </div>
    <div class="ratios">
      ${ratioChip('收藏比', e.favRatio, 'fav')}
      ${ratioChip('评论比', e.comRatio, 'pct')}
      ${ratioChip('分享比', e.shareRatio, 'pct')}
    </div>
    <div class="tags">${e.tags.map(t => `<span class="tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join('')}</div>
    ${(e.structure.length || e.script.length || e.storyboard.length) ? `<button class="bd-btn" type="button" data-b="${escapeHtml(e.blogger)}" data-id="${escapeHtml(e.id)}">📖 内容拆解</button>` : ''}
    <details class="analysis">
      <summary>爆款原因 · 可借鉴点</summary>
      <div class="body">
        ${e.reason ? `<div class="blk"><div class="blk-t">爆款原因</div>${reasonHtml(e.reason)}</div>` : ''}
        ${e.tips ? `<div class="blk"><div class="blk-t">可借鉴点</div>${tipsHtml(e.tips)}</div>` : ''}
      </div>
    </details>
  </article>`;
}

function tableHtml(rows) {
  if (!rows.length) return '';
  return `<div class="m-table-wrap"><table class="m-table">
    <thead><tr>${rows[0].map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.slice(1).map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

/* ============ 内容拆解弹窗 ============ */
function openBreakdown(e) {
  const modal = document.getElementById('modal');
  const [bcBg, bcFg] = colorOf(e.blogger);
  const interact = [e.like !== null && `赞 ${fmt(e.like)}`, e.fav !== null && `藏 ${fmt(e.fav)}`, e.com !== null && `评 ${fmt(e.com)}`, e.share !== null && `享 ${fmt(e.share)}`].filter(Boolean).join(' · ');
  const scriptRaw = e.script.join('\n');
  document.getElementById('modalBody').innerHTML = `
    <div class="m-head">
      <div class="badges">
        <span class="badge" style="background:${bcBg};color:${bcFg}">${escapeHtml(e.blogger)} · ${escapeHtml(e.id)}</span>
        ${e.form ? `<span class="badge form">${escapeHtml(e.form.split('｜')[0])}</span>` : ''}
        <span class="badge type" title="${escapeHtml(e.type)}">${escapeHtml(trunc(e.type.split(/（|\(/)[0], 20))}</span>
      </div>
      <h2>${escapeHtml(e.title)}</h2>
      <div class="m-meta">${escapeHtml(e.date || '日期未知')}｜${escapeHtml(interact)}</div>
      <div class="m-ctype">内容类型：${escapeHtml(e.type)}</div>
      <a class="m-link" href="${e.link}" target="_blank" rel="noopener">打开原笔记 ↗</a>
    </div>
    ${e.structure.length ? `
    <div class="m-sec">
      <h3>内容结构</h3>
      <ul class="m-structure">${e.structure.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
    </div>` : ''}
    ${e.analysis.length ? `
    <div class="m-sec">
      <h3>内容分析</h3>
      <ul class="m-structure">${e.analysis.map(s => {
        const i = s.indexOf('：');
        return i > 0
          ? `<li><strong>${escapeHtml(s.slice(0, i))}：</strong>${escapeHtml(s.slice(i + 1))}</li>`
          : `<li>${escapeHtml(s)}</li>`;
      }).join('')}</ul>
    </div>` : ''}
    ${e.modules.length ? `
    <div class="m-sec">
      <h3>内容结构模块</h3>
      ${tableHtml(e.modules)}
    </div>` : ''}
    ${e.storyboard.length ? `
    <div class="m-sec">
      <h3>分镜拆解（${e.storyboard.length - 1} 镜）</h3>
      ${tableHtml(e.storyboard)}
    </div>` : ''}
    ${e.advice.length ? `
    <div class="m-sec">
      <h3>剪辑与拍摄建议</h3>
      <ul class="m-structure">${e.advice.map(s => {
        const i = s.indexOf('：');
        return i > 0
          ? `<li><strong>${escapeHtml(s.slice(0, i))}：</strong>${escapeHtml(s.slice(i + 1))}</li>`
          : `<li>${escapeHtml(s)}</li>`;
      }).join('')}</ul>
    </div>` : ''}
    ${e.script.length ? `
    <div class="m-sec">
      <div class="m-sec-head"><h3>逐字稿</h3><button class="m-copy" type="button">一键复制</button></div>
      <div class="m-script">${e.script.map(p => p ? `<p>${escapeHtml(p)}</p>` : '').join('')}</div>
    </div>` : ''}
  `;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  const copyBtn = document.querySelector('.m-copy');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    const done = () => { copyBtn.textContent = '已复制 ✓'; setTimeout(() => { copyBtn.textContent = '一键复制'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(scriptRaw).then(done).catch(done);
    else { const ta = document.createElement('textarea'); ta.value = scriptRaw; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }
  });
}
function closeModal() {
  document.getElementById('modal').hidden = true;
  document.body.style.overflow = '';
}

/* ============ 榜单渲染 ============ */
function renderBoards(all) {
  const by = (arr, key, asc = false) =>
    arr.filter(e => e[key] !== null && e[key] !== undefined)
       .sort((a, b) => asc ? a[key] - b[key] : b[key] - a[key])
       .slice(0, 5);
  const boards = [
    { title: '⭐ 收藏 TOP5 · 资产榜', desc: '收藏数最高，沉淀价值最强', rows: by(all, 'fav'), val: e => fmt(e.fav) },
    { title: '👍 点赞 TOP5 · 传播力榜', desc: '点赞数最高，破圈能力最强', rows: by(all, 'like'), val: e => fmt(e.like) },
    { title: '📈 收藏比 TOP5 · 资产度', desc: '收藏/点赞，工具书型内容', rows: by(all, 'favRatio'), val: e => e.favRatio.toFixed(2) },
    { title: '⚠️ 倒挂极端 TOP5 · 反面教材', desc: '收藏比最低，流量型无沉淀', rows: all.filter(e => e.favRatio !== null && e.favRatio < 1).sort((a, b) => a.favRatio - b.favRatio).slice(0, 5), val: e => e.favRatio.toFixed(2) },
    { title: '🔁 分享比 TOP5 · 社交货币', desc: '分享/点赞，值得转发的内容', rows: by(all, 'shareRatio'), val: e => (e.shareRatio * 100).toFixed(1) + '%' },
  ];
  return boards.map(b => `
    <div class="board">
      <h3>${b.title}</h3>
      <div class="desc">${b.desc}</div>
      <ol>${b.rows.map((e, i) => `
        <li>
          <span class="rank">${i + 1}</span>
          <a href="${e.link}" target="_blank" rel="noopener" title="点击直接打开原笔记"><span class="who">${e.short}-${e.id}</span>${escapeHtml(e.title)}</a>
          <span class="val">${b.val(e)}</span>
        </li>`).join('')}
      </ol>
    </div>`).join('');
}

/* ============ 主流程 ============ */
let ALL = [];
const PAGE_SIZE = 30;
const state = { q: '', blogger: '', type: '', form: '', sort: 'date', shown: PAGE_SIZE };
let currentList = [];

function applyFilters(resetPage = true) {
  if (resetPage) state.shown = PAGE_SIZE;
  const q = state.q.toLowerCase();
  let list = ALL.filter(e => {
    if (state.blogger && e.blogger !== state.blogger) return false;
    if (state.type && !e.type.includes(state.type)) return false;
    if (state.form === '视频' && !e.isVideo) return false;
    if (state.form === '图文' && e.isVideo) return false;
    if (q) {
      const hay = [e.title, e.type, e.reason, e.tips, e.tags.join(' '), e.structure.join(' '), e.analysis.join(' '), e.script.join(' ')].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sorters = {
    date: (a, b) => (b.date || '').localeCompare(a.date || ''),
    like: (a, b) => (b.like || 0) - (a.like || 0),
    fav: (a, b) => (b.fav || 0) - (a.fav || 0),
    favRatio: (a, b) => (b.favRatio ?? -1) - (a.favRatio ?? -1),
    comRatio: (a, b) => (b.comRatio ?? -1) - (a.comRatio ?? -1),
    shareRatio: (a, b) => (b.shareRatio ?? -1) - (a.shareRatio ?? -1),
  };
  list.sort(sorters[state.sort]);
  currentList = list;
  renderGrid();

  const totLike = list.reduce((s, e) => s + (e.like || 0), 0);
  const totFav = list.reduce((s, e) => s + (e.fav || 0), 0);
  const bloggers = [...new Set(list.map(e => e.blogger))].length;
  document.getElementById('stats').innerHTML =
    `共 <b>${list.length}</b> 条 · 覆盖 <b>${bloggers}</b> 位博主 · 合计点赞 <b>${fmt(totLike)}</b> · 合计收藏 <b>${fmt(totFav)}</b>`;
  syncHash();
}

function renderGrid() {
  const list = currentList;
  document.getElementById('grid').innerHTML = list.slice(0, state.shown).map(cardHtml).join('');
  document.getElementById('empty').hidden = list.length > 0;
  const left = list.length - state.shown;
  const more = document.getElementById('loadMore');
  more.hidden = left <= 0;
  if (left > 0) more.textContent = `加载更多条目（还剩 ${left} 条）`;
  layoutGrid();
}

/* 行优先瀑布流：按数据顺序放入当前最矮列，视觉顺序=从左到右跨行 */
function layoutGrid() {
  const grid = document.getElementById('grid');
  const cards = Array.from(grid.children);
  if (!cards.length) { grid.style.height = ''; return; }
  const gap = 14, W = grid.clientWidth;
  const cols = Math.max(1, Math.floor((W + gap) / (280 + gap)));
  const colW = (W - gap * (cols - 1)) / cols;
  const heights = new Array(cols).fill(0);
  for (const c of cards) {
    c.style.width = colW + 'px';
    const h = c.offsetHeight;
    let ci = 0;
    for (let i = 1; i < cols; i++) if (heights[i] < heights[ci]) ci = i;
    c.style.left = (ci * (colW + gap)) + 'px';
    c.style.top = heights[ci] + 'px';
    heights[ci] += h + gap;
  }
  grid.style.height = (Math.max(...heights) - gap) + 'px';
}

/* ============ 博主统计（下拉与总览共用） ============ */
function bloggerStats() {
  const m = new Map();
  for (const e of ALL) {
    let s = m.get(e.blogger);
    if (!s) { s = { name: e.blogger, n: 0, like: 0, fav: 0, ratios: [] }; m.set(e.blogger, s); }
    s.n++;
    s.like += e.like || 0;
    s.fav += e.fav || 0;
    if (e.favRatio !== null) s.ratios.push(e.favRatio);
  }
  const arr = [...m.values()];
  for (const s of arr) {
    s.ratios.sort((a, b) => a - b);
    s.medFavRatio = s.ratios.length ? s.ratios[Math.floor(s.ratios.length / 2)] : null;
    s.top = ALL.filter(e => e.blogger === s.name).sort((a, b) => (b.like || 0) - (a.like || 0))[0];
  }
  return arr.sort((a, b) => b.like - a.like);
}

/* ============ 筛选状态 ⇄ URL hash（刷新保留、链接可分享） ============ */
function syncHash() {
  const p = new URLSearchParams();
  if (state.blogger) p.set('b', state.blogger);
  if (state.type) p.set('t', state.type);
  if (state.form) p.set('f', state.form);
  if (state.sort && state.sort !== 'date') p.set('s', state.sort);
  if (state.q) p.set('q', state.q);
  const h = p.toString();
  history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
}

function restoreFromHash() {
  if (!location.hash) return;
  const p = new URLSearchParams(location.hash.slice(1));
  state.blogger = p.get('b') || '';
  state.q = p.get('q') || '';
  document.getElementById('search').value = state.q;
  const setSel = (id, v) => { const el = document.getElementById(id); el.value = v; return el.value; };
  state.type = setSel('typeFilter', p.get('t') || '');
  state.form = setSel('formFilter', p.get('f') || '');
  state.sort = setSel('sortSelect', p.get('s') || 'date') || 'date';
  if (!state.sort) { state.sort = 'date'; document.getElementById('sortSelect').value = 'date'; }
}

/* ============ 博主下拉选择器（可搜索，撑得住数百位博主） ============ */
function syncBloggerBtn() {
  const btn = document.getElementById('bloggerBtn');
  btn.innerHTML = state.blogger
    ? `${escapeHtml(state.blogger)}<span class="cnt">${ALL.filter(e => e.blogger === state.blogger).length} 条</span> ▾`
    : `全部博主<span class="cnt">${ALL.length} 条</span> ▾`;
}

function renderBloggerList(filter = '') {
  const stats = bloggerStats();
  const f = filter.trim().toLowerCase();
  const rows = stats.filter(s => !f || s.name.toLowerCase().includes(f));
  document.getElementById('bloggerList').innerHTML =
    `<div class="bselect-row ${state.blogger === '' ? 'active' : ''}" data-b="">全部博主<span class="n">${ALL.length} 条</span></div>` +
    rows.map(s => `<div class="bselect-row ${state.blogger === s.name ? 'active' : ''}" data-b="${escapeHtml(s.name)}"><span><i class="dot" style="background:${colorOf(s.name)[1]}"></i>${escapeHtml(s.name)}</span><span class="n">${s.n} 条</span></div>`).join('');
}

function initBloggerSelect() {
  const panel = document.getElementById('bloggerPanel');
  const input = document.getElementById('bloggerSearch');
  syncBloggerBtn();
  renderBloggerList();
  document.getElementById('bloggerBtn').addEventListener('click', ev => {
    ev.stopPropagation();
    panel.hidden = !panel.hidden;
    if (!panel.hidden) { input.value = ''; renderBloggerList(); input.focus(); }
  });
  input.addEventListener('input', () => renderBloggerList(input.value));
  input.addEventListener('click', ev => ev.stopPropagation());
  panel.addEventListener('click', ev => ev.stopPropagation());
  document.getElementById('bloggerList').addEventListener('click', ev => {
    const row = ev.target.closest('.bselect-row');
    if (!row) return;
    state.blogger = row.dataset.b;
    panel.hidden = true;
    syncBloggerBtn();
    applyFilters();
  });
  document.addEventListener('click', () => { panel.hidden = true; });
}

/* ============ 博主总览 ============ */
function renderBloggers() {
  const stats = bloggerStats();
  document.getElementById('bloggerStatsLine').innerHTML =
    `已收录 <b>${stats.length}</b> 位博主 · <b>${ALL.length}</b> 条验证爆款 · 点卡片看该博主全部条目`;
  document.getElementById('bloggerGrid').innerHTML = stats.map(s => {
    const [bg, fg] = colorOf(s.name);
    return `
    <button class="bcard" data-b="${escapeHtml(s.name)}">
      <div class="bcard-head">
        <span class="dot" style="background:${fg}"></span>
        <span class="name">${escapeHtml(s.name)}</span>
        <span class="cnt" style="background:${bg};color:${fg}">${s.n} 条</span>
      </div>
      <div class="metrics">
        <div class="metric"><div class="v">${fmt(s.like)}</div><div class="k">总赞</div></div>
        <div class="metric"><div class="v">${fmt(s.fav)}</div><div class="k">总藏</div></div>
        <div class="metric"><div class="v">${s.medFavRatio !== null ? s.medFavRatio.toFixed(2) : '—'}</div><div class="k">藏比中位</div></div>
      </div>
      <div class="bcard-top">👑 ${s.top ? escapeHtml(s.top.title) : ''}</div>
    </button>`;
  }).join('');
  document.getElementById('bloggerGrid').addEventListener('click', ev => {
    const c = ev.target.closest('.bcard');
    if (!c) return;
    gotoBlogger(c.dataset.b);
  });
}

function gotoBlogger(name) {
  state.blogger = name;
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === 'library'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-library').classList.add('active');
  syncBloggerBtn();
  applyFilters();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initTabs() {
  document.getElementById('tabs').addEventListener('click', ev => {
    const t = ev.target.closest('.tab');
    if (!t) return;
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + t.dataset.tab).classList.add('active');
  });
}

async function init() {
  try {
    SOURCES = await (await fetch(MANIFEST_FILE)).json();
    const results = await Promise.all(SOURCES.map(async s => {
      const res = await fetch(s.file);
      if (!res.ok) throw new Error(s.file);
      return parseEntries(await res.text(), s);
    }));
    ALL = results.flat();

    restoreFromHash();
    initBloggerSelect();
    renderBloggers();
    initTabs();
    document.getElementById('boards').innerHTML = renderBoards(ALL);

    const rulesRes = await fetch(RULES_FILE);
    document.getElementById('rulesBody').innerHTML = renderRulesVisual(await rulesRes.text());

    document.getElementById('search').addEventListener('input', ev => {
      state.q = ev.target.value.trim();
      applyFilters();
    });
    document.getElementById('typeFilter').addEventListener('change', ev => { state.type = ev.target.value; applyFilters(); });
    document.getElementById('formFilter').addEventListener('change', ev => { state.form = ev.target.value; applyFilters(); });
    document.getElementById('sortSelect').addEventListener('change', ev => { state.sort = ev.target.value; applyFilters(); });
    document.getElementById('loadMore').addEventListener('click', () => { state.shown += PAGE_SIZE; renderGrid(); });
    document.getElementById('grid').addEventListener('load', layoutGrid, true);
    let _rT; window.addEventListener('resize', () => { clearTimeout(_rT); _rT = setTimeout(layoutGrid, 120); });
    document.getElementById('modalMask').addEventListener('click', closeModal);
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeModal(); });
    document.getElementById('grid').addEventListener('click', ev => {
      const bd = ev.target.closest('.bd-btn');
      if (bd) {
        const e = ALL.find(x => x.blogger === bd.dataset.b && x.id === bd.dataset.id);
        if (e) openBreakdown(e);
        return;
      }
      const tag = ev.target.closest('.tag');
      if (!tag) return;
      const s = document.getElementById('search');
      s.value = tag.dataset.tag;
      state.q = tag.dataset.tag;
      applyFilters();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    applyFilters();
  } catch (err) {
    document.getElementById('grid').innerHTML =
      `<div class="empty">无法加载数据文件（${err.message}）。<br>请通过本地服务器访问（如 python3 -m http.server），file:// 协议下浏览器禁止读取本地文件。</div>`;
  }
}

init();
