/* ============ 数据源：清单驱动，md 单一数据源 ============ */
/* 新增博主：建专册 md + 在 bloggers.json 加一行，无需改代码 */
const MANIFEST_FILE = 'bloggers.json';
const APP_VER = "202608281501";
const VQ = '?v=' + APP_VER;
const RULES_FILE = '../00-总览与跨博主规律.md';
let COVER_DIMS = {};
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
    const tags = (get(/｜\s*标签：([^｜]+?)(?=\s*｜|$)/m) || '').split(/\s+/).map(t => t.replace(/^#/, '')).filter(t => t && t !== '等');
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
      account: source.account || '',
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
    if (/^\*\*[A-F]\./.test(t)) { html.push(groupHeadHtml(t)); i++; continue; }
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
  const d = COVER_DIMS[key];
  const ar = d ? ` style="aspect-ratio:${d[0]}/${d[1]}"` : '';
  return `
    <div class="card-cover">
      <a href="${e.link}" target="_blank" rel="noopener" title="点击打开原笔记"${ar}>
        <img src="../covers/${key}.webp" alt="${escapeHtml(e.title)} 封面" loading="lazy" decoding="async"
             onerror="this.closest('.card-cover').remove();layoutGrid(null,true)">
      </a>
      ${e.coverNote ? `<div class="cover-note"><span class="cn-ico">🔍</span>${escapeHtml(e.coverNote)}</div>` : ''}
    </div>`;
}

const AVATARS = {
  '清华姜学长': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo31hn2o0js34005n3t9vc456j1o5uj1s8?imageView2/2/w/540/format/webp',
  '黄白': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo31l88bsrs4q004al8pg1jvf463ckfd1o?imageView2/2/w/540/format/webp',
  '未来设计师KiK': 'https://sns-avatar-qc.xhscdn.com/avatar/640d8975a41e0aa3a66d63f6.jpg?imageView2/2/w/540/format/webp',
  '张咋啦': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo31fl1gsq2g40049mmbftcr46vum9nk9o?imageView2/2/w/540/format/webp',
  '料到Ai': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo31gbuvm1qjc605o6o22u85o5obfkkmc0?imageView2/2/w/540/format/webp',
  'AI红发魔女': 'https://sns-avatar-qc.xhscdn.com/avatar/66011779c7e48421f309f904.jpg?imageView2/2/w/540/format/webp',
  '嘿腿子腿子（AI版）': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo3202to2tuig005olteitmt0t4p8o71rg?imageView2/2/w/540/format/webp',
  'Rico有三猫': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo317k4dcll3q6g4a0q75jh45s5hle20q0?imageView2/2/w/540/format/webp',
  '数字游牧人': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo30ncmhoib6e0g5n0vha61nh1t08apn1o?imageView2/2/w/540/format/webp',
  '赛文乔伊': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo31ve9844sjq005n1df7q1fp0ebqtorrg?imageView2/2/w/540/format/webp',
  '西门聪明蛋': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo31sc85tqplc005ptkkag3jv85rm8nen0?imageView2/2/w/540/format/webp',
  'Xuan酱': 'https://sns-avatar-qc.xhscdn.com/avatar/642d4d51a61cee6d85ad0f2e.jpg?imageView2/2/w/540/format/webp',
  '卡尔的AI沃茨': 'https://sns-avatar-qc.xhscdn.com/avatar/667ce4d3abe1e6168f265e94.jpg?imageView2/2/w/540/format/webp',
  '数字生命卡兹克': 'https://sns-avatar-qc.xhscdn.com/avatar/63fa31de24b3a2242c5fef99.jpg?imageView2/2/w/540/format/webp',
  '歸藏': 'https://sns-avatar-qc.xhscdn.com/avatar/64155f889e2ef0a4db21a149.jpg?imageView2/2/w/540/format/webp',
  '蔡不菜（AI版）': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo31s5gi1mmlk005o0uqep0991odp40o9o?imageView2/2/w/540/format/webp',
  '跟着阿亮学AI': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo31mq3mt7f4q005ns4d5fg934diqnlr20?imageView2/2/w/540/format/webp',
  '是金三啊': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo31ut0jvemhu00492mspm75bfdhu29bdo?imageView2/2/w/540/format/webp',
  '阿囤囤': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo31o0qhk9s5m005pto2aainiov1g0v67g?imageView2/2/w/540/format/webp',
  '机器坏人（AI版）': 'https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo316h6ilv20k005p81pvrln6cup5ff230?imageView2/2/w/540/format/webp'
};
/* 博主头像；CDN 失效时回退彩色圆点 */
function avatarHtml(name) {
  const u = AVATARS[name];
  if (!u) return `<i class="dot" style="background:${colorOf(name)[1]}"></i>`;
  return `<img class="avatar" src="${u}" alt="" loading="lazy" onerror="this.outerHTML='<i class=&quot;dot&quot; style=&quot;background:${colorOf(name)[1]}&quot;></i>'">`;
}

function trunc(s, n) { s = s || ''; return s.length > n ? s.slice(0, n) + '…' : s; }

function cardHtml(e) {
  const [bcBg, bcFg] = colorOf(e.blogger);
  const typeShort = mainType(e.type);
  return `
  <article class="card">
    <div class="card-head">
      <div class="badges">
        <span class="badge who" style="background:${bcBg};color:${bcFg}">${avatarHtml(e.blogger)}${e.blogger} · ${e.id}</span>
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
      <div class="metric"><div class="v">${fmt(e.like)}</div><div class="k">点赞</div></div>
      <div class="metric"><div class="v">${fmt(e.fav)}</div><div class="k">收藏</div></div>
      <div class="metric"><div class="v">${fmt(e.com)}</div><div class="k">评论</div></div>
      <div class="metric"><div class="v">${fmt(e.share)}</div><div class="k">分享</div></div>
    </div>
    <div class="ratios">
      ${ratioChip('收藏比', e.favRatio, 'fav')}
      ${ratioChip('评论比', e.comRatio, 'pct')}
      ${ratioChip('分享比', e.shareRatio, 'pct')}
    </div>
    <div class="tags">${e.tags.map(t => `<span class="tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join('')}</div>
    ${(e.structure.length || e.analysis.length || e.modules.length || e.storyboard.length || e.advice.length) ? `<button class="bd-btn" type="button" data-b="${escapeHtml(e.blogger)}" data-id="${escapeHtml(e.id)}">📖 内容拆解</button>` : ''}
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
  document.getElementById('modalBody').innerHTML = `
    <div class="m-head">
      <div class="badges">
        <span class="badge who" style="background:${bcBg};color:${bcFg}">${avatarHtml(e.blogger)}${escapeHtml(e.blogger)} · ${escapeHtml(e.id)}</span>
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
  `;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modal').hidden = true;
  document.body.style.overflow = '';
}

/* ============ 榜单渲染 ============ */
function renderBoards(all, pre = '') {
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
      <h3>${pre}${b.title}</h3>
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

/* ============ 双轨视图 ============ */
function accountEntries() { return state.account ? ALL.filter(e => e.account === state.account) : ALL; }
function setAccount(v) {
  state.account = v;
  document.querySelectorAll('#trackSeg .seg-btn').forEach(x => x.classList.toggle('active', x.dataset.v === v));
  syncHash();
  applyFilters();
  renderBloggerBar();
  renderBloggers();
  renderBoardsView();
  renderRulesView();
}
function renderBoardsView() {
  const pre = state.account === '摄影号' ? '摄影赛道 ' : state.account === '主账号-AI' ? 'AI 赛道 ' : '';
  let html = renderBoards(accountEntries(), pre);
  if (state.account === '摄影号') html = '<div class="rcallout"><p>摄影赛道比值基准：中位藏/赞≈16%，与 AI 教程赛道（≈100%）量纲不同——榜内位次有效，跨赛道绝对值不可比。</p></div>' + html;
  document.getElementById('boards').innerHTML = html;
}
function filterRulesMd(md) {
  if (!state.account) return md;
  const isPhoto = state.account === '摄影号';
  return md.split(/(?=^## )/m).map(p => {
    if (p.startsWith('## 一、博主名录')) {
      return p.split('\n').filter(L => {
        const m = L.match(/^\|\s*(\d+)\s*\|/);
        if (!m) return true;
        const s = SOURCES.find(x => x.file.startsWith(m[1] + '-'));
        return isPhoto ? (s && s.account === '摄影号') : (!s || s.account !== '摄影号');
      }).join('\n');
    }
    if (p.startsWith('## 二、')) {
      if (isPhoto) return '## 二、跨博主总榜\n\n> 摄影赛道独立榜单见「赛道榜单」页——跨赛道比值绝对值不可比，总榜为全库合计，仅供 AI 赛道对照。';
      return p;
    }
    if (p.startsWith('## 三、')) {
      return p.split(/(?=^\*\*[A-F]\.)/m).map(b => {
        const m = b.match(/^\*\*([A-F])\./);
        if (!m) return b;
        const keep = isPhoto ? (m[1] === 'E' || m[1] === 'F') : m[1] !== 'F';
        return keep ? b : '';
      }).join('');
    }
    return p;
  }).join('');
}
function renderRulesView() {
  if (RULES_MD) document.getElementById('rulesBody').innerHTML = renderRulesVisual(filterRulesMd(RULES_MD));
}

/* ============ 主流程 ============ */
let ALL = [];
let RULES_MD = '';
const PAGE_SIZE = 30;
const state = { q: '', blogger: '', type: '', form: '', account: '', sort: 'date', shown: PAGE_SIZE };
let currentList = [];

function applyFilters(resetPage = true) {
  if (resetPage) state.shown = PAGE_SIZE;
  const q = state.q.toLowerCase();
  let list = ALL.filter(e => {
    if (state.blogger && e.blogger !== state.blogger) return false;
    if (state.account && e.account !== state.account) return false;
    if (state.type && mainType(e.type) !== state.type) return false;
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
  const grid = document.getElementById('grid');
  grid.classList.add('boot'); // 首帧布局禁用过渡，避免卡片从 (0,0) “扩散”出来
  grid.innerHTML = list.slice(0, state.shown).map(cardHtml).join('');
  document.getElementById('empty').hidden = list.length > 0;
  const left = list.length - state.shown;
  const more = document.getElementById('loadMore');
  more.hidden = left <= 0;
  if (left > 0) more.textContent = `加载更多条目（还剩 ${left} 条）`;
  layoutGrid();
  requestAnimationFrame(() => requestAnimationFrame(() => grid.classList.remove('boot')));
  if (checkMoreHook) checkMoreHook();
}

let checkMoreHook = null; // 无限滚动：渲染完成后的自动加载检查

/* 行优先瀑布流：按数据顺序放入当前最矮列，视觉顺序=从左到右跨行 */
function layoutGrid(heightOverride, keepCols) {
  const grid = document.getElementById('grid');
  const cards = Array.from(grid.children);
  if (!cards.length) { grid.style.height = ''; return; }
  const gap = 14, W = grid.clientWidth;
  const cols = Math.max(1, Math.floor((W + gap) / (280 + gap)));
  const colW = (W - gap * (cols - 1)) / cols;
  const widths = colW + 'px';
  for (const c of cards) if (c.style.width !== widths) c.style.width = widths;
  // 高度集中读（仅一次回流），再集中写位置，避免逐卡写后读的布局抖动
  const hs = cards.map(c => (heightOverride && heightOverride.has(c)) ? heightOverride.get(c) : c.offsetHeight);
  const heights = new Array(cols).fill(0);
  cards.forEach((c, idx) => {
    // keepCols：沿用既有列号（展开/收起时只动同列下方卡片，隔壁列不动）
    let ci = -1;
    if (keepCols && c.dataset.col !== undefined && +c.dataset.col < cols) ci = +c.dataset.col;
    if (ci < 0) { ci = 0; for (let i = 1; i < cols; i++) if (heights[i] < heights[ci]) ci = i; }
    c.dataset.col = ci;
    c.style.left = (ci * (colW + gap)) + 'px';
    c.style.top = heights[ci] + 'px';
    heights[ci] += hs[idx] + gap;
  });
  grid.style.height = (Math.max(...heights) - gap) + 'px';
}

/* ============ 博主统计（下拉与总览共用） ============ */
function bloggerStats(list = ALL) {
  const m = new Map();
  for (const e of list) {
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
    s.top = list.filter(e => e.blogger === s.name).sort((a, b) => (b.like || 0) - (a.like || 0))[0];
  }
  return arr.sort((a, b) => b.like - a.like);
}

/* ============ 筛选状态 ⇄ URL hash（刷新保留、链接可分享） ============ */
function syncHash() {
  const p = new URLSearchParams();
  if (state.blogger) p.set('b', state.blogger);
  if (state.account) p.set('a', state.account);
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
  state.account = p.get('a') || '';
  document.querySelectorAll('#trackSeg .seg-btn').forEach(x => x.classList.toggle('active', x.dataset.v === state.account));
  state.q = p.get('q') || '';
  document.getElementById('search').value = state.q;
  state.type = p.get('t') || '';
  if (!typeOptions().some(o => o[0] === state.type)) state.type = '';
  state.form = p.get('f') || '';
  document.querySelectorAll('#formSeg .seg-btn').forEach(x => x.classList.toggle('active', x.dataset.v === state.form));
  state.sort = p.get('s') || 'date';
  if (!SORT_OPTIONS.some(o => o[0] === state.sort)) state.sort = 'date';
}

/* ============ 博主下拉选择器（可搜索，撑得住数百位博主） ============ */
function syncBloggerBtn() {
  const btn = document.getElementById('bloggerBtn');
  btn.innerHTML = state.blogger
    ? `${escapeHtml(state.blogger)}<span class="cnt">${ALL.filter(e => e.blogger === state.blogger).length} 条</span> ▾`
    : `全部博主<span class="cnt">${ALL.length} 条</span> ▾`;
}

function renderBloggerBar() {
  const bar = document.getElementById('bloggerBar');
  if (!bar) return;
  const stats = bloggerStats(accountEntries());
  bar.innerHTML =
    `<button type="button" class="bbar-item ${state.blogger === '' ? 'active' : ''}" data-b=""><span class="bbar-av">全部</span><span class="bbar-name">全部</span></button>` +
    stats.map(s => `<button type="button" class="bbar-item ${state.blogger === s.name ? 'active' : ''}" data-b="${escapeHtml(s.name)}"><span class="bbar-av">${avatarHtml(s.name)}</span><span class="bbar-name">${escapeHtml(s.name)}</span></button>`).join('');
}

function setBlogger(b) {
  state.blogger = b;
  document.getElementById('bloggerPanel').hidden = true;
  syncBloggerBtn();
  renderBloggerBar();
  renderBloggerList();
  applyFilters();
}

function renderBloggerList(filter = '') {
  const stats = bloggerStats(accountEntries());
  const f = filter.trim().toLowerCase();
  const rows = stats.filter(s => !f || s.name.toLowerCase().includes(f));
  const hl = name => {
    if (!f) return escapeHtml(name);
    const i = name.toLowerCase().indexOf(f);
    if (i < 0) return escapeHtml(name);
    return escapeHtml(name.slice(0, i)) + '<mark>' + escapeHtml(name.slice(i, i + f.length)) + '</mark>' + escapeHtml(name.slice(i + f.length));
  };
  document.getElementById('bloggerList').innerHTML =
    `<div class="bselect-row ${state.blogger === '' ? 'active' : ''}" data-b="">全部博主<span class="n">${ALL.length} 条</span></div>` +
    rows.map(s => `<div class="bselect-row ${state.blogger === s.name ? 'active' : ''}" data-b="${escapeHtml(s.name)}"><span>${avatarHtml(s.name)}${hl(s.name)}</span><span class="n">${s.n} 条</span></div>`).join('');
}

function initBloggerSelect() {
  const panel = document.getElementById('bloggerPanel');
  const input = document.getElementById('bloggerSearch');
  syncBloggerBtn();
  renderBloggerList();
  renderBloggerBar();
  document.getElementById('bloggerBtn').addEventListener('click', ev => {
    ev.stopPropagation();
    panel.hidden = !panel.hidden;
    if (!panel.hidden) { input.value = ''; renderBloggerList(); input.focus(); }
  });
  input.addEventListener('input', () => renderBloggerList(input.value));
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { panel.hidden = true; return; }
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(ev.key)) return;
    ev.preventDefault();
    const rows = [...document.getElementById('bloggerList').querySelectorAll('.bselect-row')];
    if (!rows.length) return;
    let i = rows.findIndex(r => r.classList.contains('kb'));
    if (ev.key === 'Enter') { setBlogger(rows[i > -1 ? i : 0].dataset.b); return; }
    rows.forEach(r => r.classList.remove('kb'));
    i = ev.key === 'ArrowDown' ? Math.min(rows.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1);
    rows[i].classList.add('kb');
    rows[i].scrollIntoView({ block: 'nearest' });
  });
  input.addEventListener('click', ev => ev.stopPropagation());
  document.getElementById('bloggerBar').addEventListener('click', ev => {
    const it = ev.target.closest('.bbar-item');
    if (it) setBlogger(it.dataset.b);
  });
  panel.addEventListener('click', ev => ev.stopPropagation());
  document.getElementById('bloggerList').addEventListener('click', ev => {
    const row = ev.target.closest('.bselect-row');
    if (!row) return;
    setBlogger(row.dataset.b);
  });
  document.addEventListener('click', () => { panel.hidden = true; });
}

/* ============ 通用下拉（类型/排序，与博主下拉同款面板） ============ */
function mainType(t) { return (t || '').split(/·|（|\(/)[0].trim(); }
function typeOptions() {
  const c = {};
  ALL.forEach(e => { const m = mainType(e.type); if (m) c[m] = (c[m] || 0) + 1; });
  return [['', '全部内容类型']].concat(Object.keys(c).sort((a, b) => c[b] - c[a]).map(k => [k, k]));
}
const SORT_OPTIONS = [['date', '发布日 · 新→旧'], ['like', '点赞 · 高→低'], ['fav', '收藏 · 高→低'], ['favRatio', '收藏比 · 高→低'], ['comRatio', '评论比 · 高→低'], ['shareRatio', '分享比 · 高→低']];
function initDropdown(cfg) {
  const btn = document.getElementById(cfg.btn), panel = document.getElementById(cfg.panel), list = document.getElementById(cfg.list);
  const sync = () => {
    const cur = cfg.get();
    btn.textContent = ((cfg.options.find(o => o[0] === cur) || cfg.options[0])[1]) + ' ▾';
    list.innerHTML = cfg.options.map(([v, label]) =>
      `<div class="bselect-row ${v === cur ? 'active' : ''}" data-v="${escapeHtml(v)}">${escapeHtml(label)}</div>`).join('');
  };
  btn.addEventListener('click', ev => { ev.stopPropagation(); panel.hidden = !panel.hidden; if (!panel.hidden) sync(); });
  panel.addEventListener('click', ev => ev.stopPropagation());
  list.addEventListener('click', ev => {
    const row = ev.target.closest('.bselect-row');
    if (!row) return;
    cfg.set(row.dataset.v);
    panel.hidden = true;
    sync();
    applyFilters();
  });
  document.addEventListener('click', () => { panel.hidden = true; });
  sync();
}

/* ============ 博主总览 ============ */
function renderBloggers() {
  const list = accountEntries();
  const stats = bloggerStats(list);
  const accOf = n => (SOURCES.find(s => s.name === n) || {}).account || '';
  const card = s => {
    const [bg, fg] = colorOf(s.name);
    return `
    <button class="bcard" data-b="${escapeHtml(s.name)}">
      <div class="bcard-head">
        ${avatarHtml(s.name)}
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
  };
  let html;
  if (!state.account) {
    html = [['主账号-AI', 'AI 赛道'], ['摄影号', '摄影赛道']].map(([a, label]) => {
      const gs = stats.filter(s => accOf(s.name) === a);
      return gs.length ? `<div class="bgroup-head">${label} · ${gs.length} 位博主</div><div class="bgrid">${gs.map(card).join('')}</div>` : '';
    }).join('');
  } else {
    html = `<div class="bgrid">${stats.map(card).join('')}</div>`;
  }
  document.getElementById('bloggerStatsLine').innerHTML =
    `已收录 <b>${stats.length}</b> 位博主 · <b>${list.length}</b> 条验证爆款 · 点卡片看该博主全部条目`;
  document.getElementById('bloggerGrid').innerHTML = html;
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
    SOURCES = await (await fetch(MANIFEST_FILE + VQ)).json();
    COVER_DIMS = await fetch('covers.json' + VQ).then(r => r.ok ? r.json() : {}).catch(() => ({}));
    const results = await Promise.all(SOURCES.map(async s => {
      const res = await fetch(s.file + VQ);
      if (!res.ok) throw new Error(s.file);
      return parseEntries(await res.text(), s);
    }));
    ALL = results.flat();

    restoreFromHash();
    initBloggerSelect();
    initDropdown({ btn: 'typeBtn', panel: 'typePanel', list: 'typeList', options: typeOptions(), get: () => state.type, set: v => { state.type = v; } });
    initDropdown({ btn: 'sortBtn', panel: 'sortPanel', list: 'sortList', options: SORT_OPTIONS, get: () => state.sort, set: v => { state.sort = v; } });
    renderBloggers();
    initTabs();
    renderBoardsView();

    const rulesRes = await fetch(RULES_FILE + VQ);
    RULES_MD = await rulesRes.text();
    renderRulesView();

    document.getElementById('search').addEventListener('input', ev => {
      state.q = ev.target.value.trim();
      applyFilters();
    });
    document.getElementById('formSeg').addEventListener('click', ev => {
      const b = ev.target.closest('.seg-btn');
      if (!b) return;
      state.form = b.dataset.v;
      document.querySelectorAll('#formSeg .seg-btn').forEach(x => x.classList.toggle('active', x === b));
      applyFilters();
    });
    document.getElementById('trackSeg').addEventListener('click', ev => {
      const b = ev.target.closest('.seg-btn');
      if (!b) return;
      setAccount(b.dataset.v);
    });
    const moreBtn = document.getElementById('loadMore');
    moreBtn.addEventListener('click', () => { state.shown += PAGE_SIZE; renderGrid(); });
    /* 无限滚动：接近底部（提前600px）自动加载下一页 */
    const checkMore = () => {
      if (moreBtn.hidden) return;
      if (moreBtn.getBoundingClientRect().top < window.innerHeight + 600) { state.shown += PAGE_SIZE; renderGrid(); }
    };
    checkMoreHook = checkMore;
    let _mR = 0;
    window.addEventListener('scroll', () => {
      if (_mR) return;
      _mR = requestAnimationFrame(() => { _mR = 0; checkMore(); });
    }, { passive: true });
    checkMore();
    document.getElementById('grid').addEventListener('load', () => layoutGrid(null, true), true);
    let _rT; window.addEventListener('resize', () => { clearTimeout(_rT); _rT = setTimeout(layoutGrid, 120); });
    /* 爆款原因/可借鉴点 展开收起动画：body 高度过渡 + 下方卡片用终态高度同步滑动 */
    document.getElementById('grid').addEventListener('click', (ev) => {
      const sum = ev.target.closest('summary');
      if (!sum || !sum.parentElement.classList.contains('analysis')) return;
      ev.preventDefault();
      const det = sum.parentElement;
      if (det.dataset.anim) return;
      const body = det.querySelector('.body');
      const card = det.closest('.card');
      const opening = !det.open;
      det.dataset.anim = '1';
      body.style.overflow = 'hidden';
      if (opening) {
        det.open = true;
        const mTop = parseFloat(getComputedStyle(body).marginTop) || 0;
        body.style.height = '0px';
        body.style.marginTop = '0px';
        const collapsed = card.offsetHeight;
        const target = body.scrollHeight;
        layoutGrid(new Map([[card, collapsed + target + mTop]]), true);
        void body.offsetHeight;
        body.style.transition = 'height .3s ease, margin-top .3s ease';
        body.style.height = target + 'px';
        body.style.marginTop = mTop + 'px';
      } else {
        const mTop = parseFloat(getComputedStyle(body).marginTop) || 0;
        const startH = body.scrollHeight;
        body.style.height = startH + 'px';
        // 终态高度=收起后真实高度（含 margin 消失），避免结尾跳变
        layoutGrid(new Map([[card, card.offsetHeight - startH - mTop]]), true);
        void body.offsetHeight;
        body.style.transition = 'height .3s ease, margin-top .3s ease';
        body.style.height = '0px';
        body.style.marginTop = '0px';
      }
      const finish = () => {
        if (!det.dataset.anim) return;
        delete det.dataset.anim;
        body.style.height = body.style.transition = body.style.overflow = body.style.marginTop = '';
        if (!opening) det.open = false;
        // 终态排布在点击时已用精确高度完成，结尾零重排，避免末帧卡顿
      };
      body.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 400);
    });
    document.getElementById('modalMask').addEventListener('click', closeModal);
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeModal(); });
    /* 右下角版本徽标：一眼确认当前运行版本，排查缓存问题 */
    const _ver = ((document.querySelector('script[src*="app.js"]') || { src: '' }).src.match(/v=([\w-]+)/) || [])[1];
    if (_ver) {
      const vb = document.createElement('div');
      vb.textContent = 'v' + _ver;
      vb.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:99;font:10px/1.4 monospace;color:#8a8375;background:rgba(255,255,255,.75);border:1px solid var(--line);border-radius:6px;padding:2px 7px;pointer-events:none;';
      document.body.appendChild(vb);
    }
    /* 版本自检：页面跑旧版时自动更新 SW 并重载一次（session 内防循环） */
    setTimeout(() => {
      if (!('serviceWorker' in navigator)) return;
      fetch('sw.js?probe=' + Date.now(), { cache: 'no-store' })
        .then(r => r.text())
        .then(async (txt) => {
          const remote = (txt.match(/const VER = "([^"]+)"/) || [])[1];
          const scr = document.querySelector('script[src*="app.js"]');
          const cur = new URLSearchParams((scr ? scr.src.split('?')[1] : '') || '').get('v');
          if (!remote || !cur || remote === cur) return;
          if (sessionStorage.getItem('swprobe-' + remote)) return;
          sessionStorage.setItem('swprobe-' + remote, '1');
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) await reg.update();
          location.reload();
        })
        .catch(() => {});
    }, 600);
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
