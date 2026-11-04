// 被害を減らす：見える化の画面（グラフは手書きの SVG・外のライブラリは使わない）。
// 目的は害獣の被害を減らすこと。捕まえる人と見回りが続いているか、被害の知らせが減っているかを数で見る。
// 数を並べるだけで、良い・悪いの判定や人の評価はしない。数はすべて架空（デモ）。
import { ctx, view, esc, icon, renderTop } from '../ui.js';
import { change, catches, niceMax, monthShort } from '../lib/impact.js';
import { countDistrict, townRows } from '../lib/town.js';
import { districtTotals } from '../lib/log.js';
import { logs, reports } from '../model.js';

// 色の役目：シカ・イノシシ（見分けにくい人でも区別できる組み合わせを検査済み）、被害の知らせは墨色
const C = { deer: '#14875c', boar: '#6250d6', ink: '#161616', grid: '#ececec', axis: '#8c8c8c' };
const W = 340;

const tip = (text) => `data-tip="${esc(text)}" tabindex="0"`;

// 上だけ角を丸めた棒（下は基準線にそろえる）
function topRound(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
// 右だけ角を丸めた横棒
function rightRound(x, y, w, h, r = 4) {
  if (w <= 0) return '';
  r = Math.min(r, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

function yAxis(max, step, top, bottom, left, right) {
  let g = '';
  for (let v = 0; v <= max; v += step) {
    const y = bottom - ((bottom - top) * v) / max;
    g += `<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="${C.grid}" stroke-width="1"/>`;
    g += `<text x="${left - 6}" y="${y + 4}" text-anchor="end" class="ax">${v}</text>`;
  }
  return g;
}

// 被害の知らせ（1本の折れ線）
function lineChart(labels, values, unit) {
  const H = 190, L = 30, R = W - 26, T = 16, B = H - 26;
  const { max, step } = niceMax(values);
  const x = (i) => L + ((R - L) * i) / (values.length - 1);
  const y = (v) => B - ((B - T) * v) / max;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('');
  const pts = values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="${C.ink}" stroke="#fff" stroke-width="2"/>`).join('');
  const hits = values.map((v, i) => `<rect x="${x(i) - 22}" y="${T}" width="44" height="${B - T}" fill="transparent" ${tip(`${labels[i]}：${v}${unit}`)}/>`).join('');
  const last = values.length - 1;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(labels.map((l, i) => `${l} ${values[i]}${unit}`).join('、'))}">
    ${yAxis(max, step, T, B, L, R)}
    ${labels.map((l, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="ax">${esc(l)}</text>`).join('')}
    <path d="${d}" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts}
    <text x="${x(last) + 8}" y="${y(values[last]) + 4}" class="dl">${values[last]}${unit}</text>
    <text x="${x(0) + 8}" y="${y(values[0]) - 8}" class="dl muted-t">${values[0]}${unit}</text>
    ${hits}
  </svg>`;
}

// 月ごとの捕獲（シカとイノシシを積み上げた縦棒）
function stackedBars(labels, deer, boar) {
  const H = 200, L = 30, R = W - 10, T = 16, B = H - 26;
  const tot = catches(deer, boar);
  const { max, step } = niceMax(tot);
  const slot = (R - L) / labels.length;
  const bw = Math.min(30, slot * 0.56);
  const h = (v) => ((B - T) * v) / max;
  let bars = '';
  labels.forEach((l, i) => {
    const cx = L + slot * i + slot / 2;
    const x0 = cx - bw / 2;
    const hd = h(deer[i]);
    const hb = h(boar[i]);
    // 下＝シカ、上＝イノシシ。あいだに 2px のすき間
    if (boar[i]) {
      bars += `<rect x="${x0}" y="${B - hd}" width="${bw}" height="${hd}" fill="${C.deer}"/>`;
      bars += `<path d="${topRound(x0, B - hd - hb, bw, Math.max(hb - 2, 0))}" fill="${C.boar}"/>`;
    } else {
      bars += `<path d="${topRound(x0, B - hd, bw, hd)}" fill="${C.deer}"/>`;
    }
    bars += `<text x="${cx}" y="${B - hd - hb - 6}" text-anchor="middle" class="dl">${tot[i]}</text>`;
    bars += `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="ax">${esc(l)}</text>`;
    bars += `<rect x="${cx - slot / 2}" y="${T}" width="${slot}" height="${B - T}" fill="transparent" ${tip(`${l}：シカ ${deer[i]}頭・イノシシ ${boar[i]}頭（計 ${tot[i]}頭）`)}/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(labels.map((l, i) => `${l} シカ${deer[i]}頭 イノシシ${boar[i]}頭`).join('、'))}">
    ${yAxis(max, step, T, B, L, R)}${bars}</svg>`;
}

// 地区ごとの捕獲（横棒・町へ出した記録の数）
function districtBars(rows) {
  const rowH = 46, T = 6, L = 92, R = W - 40;
  const H = T + rows.length * rowH;
  const { max } = niceMax(rows.map((r) => r.deer + r.boar));
  const w = (v) => ((R - L) * v) / max;
  const body = rows.map((r, i) => {
    const y = T + i * rowH + 10;
    const bh = 18;
    const wd = w(r.deer);
    const wb = w(r.boar);
    return `<text x="0" y="${y + 13}" class="lb">${esc(r.name.replace('（架空）', ''))}</text>
      ${r.deer ? `<path d="${r.boar ? `M${L},${y}H${L + wd}V${y + bh}H${L}Z` : rightRound(L, y, wd, bh)}" fill="${C.deer}"/>` : ''}
      ${r.boar ? `<path d="${rightRound(L + wd + (r.deer ? 2 : 0), y, Math.max(wb - (r.deer ? 2 : 0), 0), bh)}" fill="${C.boar}"/>` : ''}
      <text x="${L + wd + wb + 6}" y="${y + 13}" class="dl">${r.deer + r.boar}頭</text>
      <text x="${L}" y="${y + bh + 14}" class="ax">住民の知らせ ${r.reports}件</text>
      <rect x="0" y="${y - 6}" width="${W}" height="${rowH - 4}" fill="transparent" ${tip(`${r.name}：シカ ${r.deer}頭・イノシシ ${r.boar}頭・住民の知らせ ${r.reports}件`)}/>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(rows.map((r) => `${r.name} シカ${r.deer}頭 イノシシ${r.boar}頭`).join('、'))}">${body}</svg>`;
}

const legend = () => `<div class="legend2"><span><i style="background:${C.deer}"></i>シカ</span><span><i style="background:${C.boar}"></i>イノシシ</span></div>`;

function tile(label, value, unit, sub) {
  return `<div class="kpi"><span>${esc(label)}</span><b>${value}<small>${esc(unit)}</small></b><em>${sub}</em></div>`;
}

export function renderImpact() {
  renderTop({ back: '#/team', here: '被害を減らす' });
  const d = ctx.data.impact;
  const labels = d.months.map(monthShort);
  const dmg = change(d.damage);
  const tot = catches(d.deer, d.boar);
  const ctot = change(tot);
  const pat = change(d.patrol);
  const two = change(d.twoOrMore);
  const total = ctx.data.rows.length;
  const first = labels[0];
  const lastM = labels.at(-1);

  // 地区ごとの数（北沢はチームの記録から、ほかは架空の数）
  const live = {
    ...countDistrict({ rows: ctx.data.rows, cards: [], records: [], experienceRoles: [] }),
    ...districtTotals(logs(), ctx.data.homeDistrict),
    reports: reports().filter((r) => r.district === ctx.data.homeDistrict).length,
  };
  const dist = townRows(ctx.data.town.districts, live);

  const table = `<table><thead><tr><th>月</th><th>被害の知らせ</th><th>シカ</th><th>イノシシ</th><th>見回り</th><th>2人以上いる工程</th></tr></thead><tbody>
    ${labels.map((l, i) => `<tr><td>${esc(l)}</td><td>${d.damage[i]}件</td><td>${d.deer[i]}頭</td><td>${d.boar[i]}頭</td><td>${d.patrol[i]}回</td><td>${d.twoOrMore[i]}/${total}</td></tr>`).join('')}
  </tbody></table>`;

  view.innerHTML = `
    <p class="kicker">目的</p>
    <h1>害獣の被害を<br>減らす</h1>
    <p class="lead">捕まえる人と見回りが続いているか。そのあいだに、畑の被害の知らせが減っているか。北沢地区（架空）の数で見ます。</p>

    <section class="hero-card">
      <span class="hc-label">住民からの被害の知らせ（${esc(lastM)}）</span>
      <b class="hc-num">${dmg.last}<small>件</small></b>
      <span class="hc-sub">${esc(first)}は ${dmg.first}件 → ${dmg.diff <= 0 ? `${-dmg.diff}件 少ない` : `${dmg.diff}件 多い`}<small class="muted">（架空のデモの数。効果ではありません）</small></span>
      ${lineChart(labels, d.damage, '件')}
    </section>

    <div class="kpis">
      ${tile(`捕獲（${lastM}）`, ctot.last, '頭', `${esc(first)} ${ctot.first}頭`)}
      ${tile(`見回り（${lastM}）`, pat.last, '回', `${esc(first)} ${pat.first}回`)}
      ${tile('2人以上いる工程', `${two.last}<i>/${total}</i>`, '', `${esc(first)} ${two.first}/${total}`)}
    </div>

    <section class="vcard">
      <h2>月ごとの捕獲</h2>
      ${legend()}
      ${stackedBars(labels, d.deer, d.boar)}
    </section>

    <section class="vcard">
      <h2>地区ごとの捕獲と知らせ</h2>
      <p class="muted" style="margin:-4px 0 8px">町へ出した記録の数です。北沢はチームの記録から数え、南沢・東原は架空の数です。</p>
      ${legend()}
      ${districtBars(dist)}
    </section>

    <details class="tview"><summary>表で見る</summary><div class="tscroll">${table}</div></details>

    <div class="tip" id="vtip" role="status" hidden></div>

    <h2>町・県とつながるところ</h2>
    <div class="links">
      <a href="#/town">${icon('town')}<span><b>町の地区一覧・県へ上げる数</b><small>地区ごとの数だけ。個人名は出しません</small></span></a>
      <a href="#/log">${icon('doc')}<span><b>町へ出す一覧（活動と捕獲の記録）</b><small>チームが確かめて「出す」を押したものだけ</small></span></a>
      <a href="#/report">${icon('chat')}<span><b>住民の方の「見かけたら知らせる」</b><small>ログインなし。地区に置いてチームへ回す</small></span></a>
      <a href="#/map">${icon('pin')}<span><b>わなの地図</b><small>入ったわな・しばらく見ていないわなを色で</small></span></a>
    </div>

    <ul class="notes">
      <li>グラフの数はすべて架空のデモです。実際には、町へ出した捕獲の記録・住民の知らせ・チームの表から月ごとに数えます。</li>
      <li>被害の増え減りは、天候・獣の数・柵などでも変わります。このアプリだけの効果とは言いません。被害の額は、町・県の調べで確かめてください。</li>
      <li>数を並べるだけで、地区や人に順位をつけたり、良い・悪いを決めたりはしません。</li>
    </ul>`;
}

// グラフの上を押す・なぞると、その月の数を出す
function showTip(el) {
  const box = document.getElementById('vtip');
  if (!box || !el) return;
  box.textContent = el.dataset.tip;
  box.hidden = false;
  const r = el.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.left + r.width / 2 - 110), window.innerWidth - 228);
  box.style.left = `${left}px`;
  box.style.top = `${Math.max(8, r.top - 46)}px`;
}
const hideTip = () => { const b = document.getElementById('vtip'); if (b) b.hidden = true; };

export function impactPointer(e) {
  const t = e.target.closest?.('svg.chart [data-tip]');
  if (t) { showTip(t); return true; }
  if (e.type === 'click' || e.type === 'pointerover') hideTip();
  return false;
}
document.addEventListener('pointerover', (e) => { if (document.getElementById('vtip')) impactPointer(e); });
document.addEventListener('focusin', (e) => { if (e.target.closest?.('svg.chart [data-tip]')) showTip(e.target); });
window.addEventListener('scroll', hideTip, { passive: true });
