/* ============ 数据源：md 单一数据源 ============ */
const SOURCES = [
  { file: '../01-清华姜学长.md', short: '姜' },
  { file: '../02-黄白.md', short: '黄' },
];
const RULES_FILE = '../00-总览与跨博主规律.md';

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
    const link = get(/^- 链接：(\S+)/m);
    const date = get(/发布：(\d{4}-\d{2}-\d{2})/);
    const blogger = get(/｜博主：(.+)$/m);
    const tags = (get(/｜标签：(.+)$/m) || '').split(/\s+/).map(t => t.replace(/^#/, '')).filter(Boolean);
    const type = get(/^- 内容类型：(.+)$/m);

    out.push({
      id, title, link, date, blogger,
      short: source.short,
      form: formLine,
      isVideo: /^视频/.test(formLine),
      tags, type,
      like, fav, com, share,
      favRatio: like ? (fav !== null ? fav / like : null) : null,
      comRatio: like && com !== null ? com / like : null,
      shareRatio: like && share !== null ? share / like : null,
      reason: get(/^- 爆款原因：(.+)$/m),
      tips: get(/^- 可借鉴点：(.+)$/m),
      _text: '',
    });
  }
  return out;
}

/* ============ 极简 md 渲染（规律页） ============ */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inline(s) {
  s = escapeHtml(s);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  return s;
}
function renderMd(md) {
  const lines = md.split('\n');
  const html = [];
  let inList = false, inTable = false;
  const closeList = () => { if (inList) { html.push('</ul>'); inList = false; } };
  const closeTable = () => { if (inTable) { html.push('</tbody></table>'); inTable = false; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\|/.test(line)) {
      closeList();
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue; // 分隔行
      const tag = inTable ? 'td' : 'th';
      if (!inTable) { html.push('<table><thead><tr>' + cells.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'); inTable = true; continue; }
      html.push('<tr>' + cells.map(c => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>');
      continue;
    }
    closeTable();
    if (/^### /.test(line)) { closeList(); html.push(`<h3>${inline(line.slice(4))}</h3>`); continue; }
    if (/^## /.test(line)) { closeList(); html.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }
    if (/^# /.test(line)) { closeList(); html.push(`<h1>${inline(line.slice(2))}</h1>`); continue; }
    if (/^---+$/.test(line)) { closeList(); html.push('<hr>'); continue; }
    if (/^- /.test(line)) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (/^> /.test(line)) { closeList(); html.push(`<p class="quote">${inline(line.slice(2))}</p>`); continue; }
    closeList();
    if (line.trim() === '') continue;
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList(); closeTable();
  return html.join('\n');
}

/* ============ 卡片渲染 ============ */
function ratioChip(label, v, kind) {
  if (v === null) return '';
  let cls = 'mid', txt;
  if (kind === 'fav') { cls = v >= 1 ? 'up' : (v < 0.7 ? 'down' : 'mid'); txt = label + ' ' + v.toFixed(2) + (v >= 1 ? ' ↑' : ' ↓'); }
  else txt = label + ' ' + (v * 100).toFixed(1) + '%';
  return `<span class="ratio ${cls}">${txt}</span>`;
}

function cardHtml(e) {
  const bloggerCls = e.short === '姜' ? 'blogger-a' : 'blogger-b';
  const typeShort = e.type.split(/（|\(/)[0];
  return `
  <article class="card">
    <div class="card-head">
      <div class="badges">
        <span class="badge ${bloggerCls}">${e.blogger} · ${e.id}</span>
        <span class="badge type">${typeShort}</span>
        ${e.form ? `<span class="badge form">${e.form.split('｜')[0]}</span>` : ''}
      </div>
    </div>
    <div class="card-title">
      <a href="${e.link}" target="_blank" rel="noopener">${escapeHtml(e.title)}</a>
      <div class="card-meta">${e.date || '日期未知'}</div>
    </div>
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
    <details class="analysis">
      <summary>爆款原因 · 可借鉴点</summary>
      <div class="body">
        ${e.reason ? `<p><span class="lbl">爆款原因</span>：${escapeHtml(e.reason)}</p>` : ''}
        ${e.tips ? `<p><span class="lbl">可借鉴点</span>：${escapeHtml(e.tips)}</p>` : ''}
      </div>
    </details>
  </article>`;
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
          <a href="${e.link}" target="_blank" rel="noopener"><span class="who">${e.short}-${e.id}</span>${escapeHtml(e.title)}</a>
          <span class="val">${b.val(e)}</span>
        </li>`).join('')}
      </ol>
    </div>`).join('');
}

/* ============ 主流程 ============ */
let ALL = [];
const state = { q: '', blogger: '', type: '', form: '', sort: 'date' };

function applyFilters() {
  const q = state.q.toLowerCase();
  let list = ALL.filter(e => {
    if (state.blogger && e.blogger !== state.blogger) return false;
    if (state.type && !e.type.includes(state.type)) return false;
    if (state.form === '视频' && !e.isVideo) return false;
    if (state.form === '图文' && e.isVideo) return false;
    if (q) {
      const hay = [e.title, e.type, e.reason, e.tips, e.tags.join(' ')].join(' ').toLowerCase();
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

  const grid = document.getElementById('grid');
  grid.innerHTML = list.map(cardHtml).join('');
  document.getElementById('empty').hidden = list.length > 0;

  const totLike = list.reduce((s, e) => s + (e.like || 0), 0);
  const totFav = list.reduce((s, e) => s + (e.fav || 0), 0);
  const bloggers = [...new Set(list.map(e => e.blogger))].length;
  document.getElementById('stats').innerHTML =
    `共 <b>${list.length}</b> 条 · 覆盖 <b>${bloggers}</b> 位博主 · 合计点赞 <b>${fmt(totLike)}</b> · 合计收藏 <b>${fmt(totFav)}</b>`;
}

function initChips() {
  const box = document.getElementById('bloggerChips');
  const bloggers = [...new Set(ALL.map(e => e.blogger))];
  const chips = ['<button class="chip active" data-b="">全部博主</button>']
    .concat(bloggers.map(b => `<button class="chip" data-b="${b}">${b}</button>`));
  box.innerHTML = chips.join('');
  box.addEventListener('click', ev => {
    const c = ev.target.closest('.chip');
    if (!c) return;
    box.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    state.blogger = c.dataset.b;
    applyFilters();
  });
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
    const results = await Promise.all(SOURCES.map(async s => {
      const res = await fetch(s.file);
      if (!res.ok) throw new Error(s.file);
      return parseEntries(await res.text(), s);
    }));
    ALL = results.flat();

    initChips();
    initTabs();
    document.getElementById('boards').innerHTML = renderBoards(ALL);

    const rulesRes = await fetch(RULES_FILE);
    document.getElementById('rulesBody').innerHTML = renderMd(await rulesRes.text());

    document.getElementById('search').addEventListener('input', ev => {
      state.q = ev.target.value.trim();
      applyFilters();
    });
    document.getElementById('typeFilter').addEventListener('change', ev => { state.type = ev.target.value; applyFilters(); });
    document.getElementById('formFilter').addEventListener('change', ev => { state.form = ev.target.value; applyFilters(); });
    document.getElementById('sortSelect').addEventListener('change', ev => { state.sort = ev.target.value; applyFilters(); });
    document.getElementById('grid').addEventListener('click', ev => {
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
