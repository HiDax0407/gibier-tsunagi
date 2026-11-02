// わなの地図（チームの中だけで見る画面）。
// わなの点を色で見せる：入った（濃い色）／しばらく見ていない（注意の色）／空（灰色）／見回り済み（深緑）。
// 機器は作らない。センサーの知らせは、ボタンとタイマーで模擬する。実機は既存のわなセンサーの知らせを受ける想定。
// 「二人で行く」相手はチームが決めた組み合わせ。AI は人を選ばない。
import { ctx, view, esc, icon, renderTop, toast, voiceField, agoLabel, timeLabel, loadLeaflet, store } from '../ui.js';
import { traps, setTrap, staleHours, addLog, addTeach, markSpoke, reports } from '../model.js';
import { STATE_LABEL, STATE_ORDER, trapState, countStates, nextSignalTrap, parsePatrol } from '../lib/traps.js';
import { splitHealth } from '../lib/watch.js';

let map = null;         // Leaflet の地図
let markers = {};       // わなの id → 印
let selected = null;    // 選んでいるわな
let autoTimer = null;   // 模擬の知らせ（自動）
let lastSimNo = 0;

const now = () => Date.now();
const stateOf = (t) => trapState(t, now(), staleHours());
const trapHtml = (t, cls = '') => `<span class="trap s-${stateOf(t)} ${cls}">${t.no}</span>`;

export function leaveMap() {
  clearInterval(autoTimer);
  autoTimer = null;
  if (map) { map.remove(); map = null; }
  markers = {};
}

export function renderMap() {
  leaveMap();
  renderTop();
  const d = ctx.data;
  const choices = d.traps.staleHoursChoices.map((h) => `<option value="${h}"${h === staleHours() ? ' selected' : ''}>${h}時間</option>`).join('');
  view.innerHTML = `
    <h1>わなの地図</h1>
    <p class="lead">わなの点を色で見せます。押すと、担当と「二人で行く」相手が出ます。</p>
    <div class="legend" id="legend"></div>
    <div class="mapbox"><div id="map" role="region" aria-label="わなの地図"></div><p class="map-msg" id="map-msg">地図を読み込んでいます…</p></div>
    <div class="sim">
      <button class="outline" data-sim>${icon('bell')}センサーの知らせを試す（模擬）</button>
      <label class="auto"><input type="checkbox" data-sim-auto> 30秒ごとに自動で知らせる（模擬）</label>
    </div>
    <section id="trap-panel"></section>
    <h2>わなの一覧</h2>
    <div class="tlist" id="trap-list"></div>
    <h2>住民からの知らせ</h2>
    <div id="map-reports"></div>
    <button class="outline wide" data-go="report">${icon('chat')}見かけたら知らせる（住民の方の画面）</button>
    <button class="outline wide" data-go="log" style="margin-top:12px">${icon('doc')}活動と捕獲の記録・町へ出す一覧</button>
    <label class="stale-set">「しばらく見ていない」の目安（チームで決める）<select data-stale>${choices}</select></label>
    <ul class="notes">
      <li>見回りの決まり（どのくらいの間隔で見るか など）は、チームと県に確認してください。このアプリは決まりを答えません。</li>
      <li>わなの場所はチームの中だけで見ます。町の画面には数だけを出します。</li>
      <li>機器は作っていません。実際には、今あるわなセンサーの知らせを受ける想定です。知らせは LINE でも送れる形を考えています（今は送りません）。</li>
      <li>地図の場所は見本のための仮の位置で、わなの点はすべて架空です。</li>
    </ul>`;
  refresh();
  loadLeaflet().then(initMap).catch(() => {
    const msg = document.getElementById('map-msg');
    if (msg) msg.textContent = '地図を読み込めませんでした。下の一覧から選べます。';
  });
}

function initMap(L) {
  const el = document.getElementById('map');
  if (!el || !location.hash.startsWith('#/map')) return;
  document.getElementById('map-msg')?.remove();
  const d = ctx.data.traps;
  map = L.map(el, { zoomControl: true, attributionControl: true }).setView(d.center, d.zoom);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  // 地名の入っていない「陰影起伏図」を使う（実在の地名を画面に出さないため）
  L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png', {
    maxZoom: 18,
    maxNativeZoom: 16,
    minZoom: 5,
    attribution: '出典：<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル（陰影起伏図）</a>（国土地理院）',
  }).addTo(map);
  map.fitBounds(L.latLngBounds(traps().map((t) => [t.lat, t.lng])), { padding: [28, 28] });
  for (const t of traps()) {
    markers[t.id] = L.marker([t.lat, t.lng], { icon: trapIcon(L, t), keyboard: true, title: `${t.no}番のわな` })
      .addTo(map)
      .on('click', () => select(t.id));
  }
  // 住民の知らせは、家の場所ではなく地区に置く（地区の真ん中あたり）
  const mine = reports().filter((r) => r.district === ctx.data.homeDistrict && !r.seen);
  mine.forEach((r, i) => {
    L.marker([d.center[0] + 0.0012 * i, d.center[1] - 0.0015 * i], {
      icon: L.divIcon({ className: '', html: '<span class="rmark">知</span>', iconSize: [30, 30], iconAnchor: [15, 15] }),
      title: '住民からの知らせ（地区に置いています）',
    }).addTo(map).on('click', () => document.getElementById('map-reports')?.scrollIntoView({ behavior: 'smooth' }));
  });
}

function trapIcon(L, t) {
  const sel = t.id === selected ? 'sel' : '';
  return L.divIcon({ className: '', html: trapHtml(t, sel), iconSize: [36, 36], iconAnchor: [18, 18] });
}

function select(id) {
  selected = id;
  refresh();
  document.getElementById('trap-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 色と一覧と下の欄を描き直す（地図は作り直さない）
function refresh() {
  const list = traps();
  const n = countStates(list, now(), staleHours());
  const legend = document.getElementById('legend');
  if (!legend) return;
  legend.innerHTML = STATE_ORDER.map((s) => `<span class="lg"><i class="trap s-${s} dot"></i>${STATE_LABEL[s]}<b>${n[s]}</b></span>`).join('');
  document.getElementById('trap-list').innerHTML = list.map((t) => `
    <button class="ti${t.id === selected ? ' on' : ''}" data-trap="${esc(t.id)}">${trapHtml(t)}<span><b>${STATE_LABEL[stateOf(t)]}</b><small>${esc(agoLabel(t.lastChecked))}に見た・担当 ${esc(t.owner)}さん</small></span></button>`).join('');
  if (map && window.L) for (const t of list) markers[t.id]?.setIcon(trapIcon(window.L, t));
  renderPanel(list.find((t) => t.id === selected));
  renderReports();
}

function renderPanel(t) {
  const el = document.getElementById('trap-panel');
  if (!t) { el.innerHTML = '<p class="muted pick">地図の点か、下の一覧からわなを選んでください。</p>'; return; }
  const st = stateOf(t);
  const people = ctx.data.teach.people;
  const who = people.map((p) => `<option${p === t.owner ? ' selected' : ''}>${esc(p)}</option>`).join('');
  el.innerHTML = `
    <div class="tpanel s-${st}">
      <div class="tp-head">${trapHtml(t)}<div><b>${t.no}番のわな</b><span class="st">${STATE_LABEL[st]}</span></div></div>
      <p class="tp-sub">最後に見た：${esc(agoLabel(t.lastChecked))}${t.signalAt && st === 'caught' ? `　知らせ：${esc(timeLabel(t.signalAt))}` : ''}</p>
      <div class="pair"><div><span>担当</span><b>${esc(t.owner)}さん</b></div><div><span>二人で行く</span><b>${esc(t.pair)}さん</b></div></div>
      <p class="muted" style="margin:6px 0 0">組み合わせはチームが決めたものです。AI は人を選びません。</p>
      ${st === 'caught' ? (t.goingAt
        ? `<p class="going">${icon('team')}${esc(t.owner)}さんと${esc(t.pair)}さんが向かっています（${esc(timeLabel(t.goingAt))}）</p>`
        : `<button class="primary" data-trap-go="${esc(t.id)}" style="margin-top:14px">二人で向かう（教えた記録にも残す）</button>`) : ''}
      <h3>見回った人が話す</h3>
      <p class="muted" style="margin:-4px 0 8px">例：「3番、シカが1頭かかっとった」「5番は空やった」。話すだけで色が変わります。</p>
      <form class="patrol" data-trap="${esc(t.id)}">
        <label>話す人<select name="by">${who}</select></label>
        ${voiceField('patrol-text', '話すか、文字で入れてください')}
        <div class="parsed" id="patrol-parse"></div>
        <button class="outline wide" type="submit">この内容で残す</button>
      </form>
    </div>`;
  showParse();
}

function renderReports() {
  const el = document.getElementById('map-reports');
  if (!el) return;
  const names = Object.fromEntries(ctx.data.town.districts.map((x) => [x.id, x.name]));
  const mine = reports().filter((r) => r.district === ctx.data.homeDistrict);
  el.innerHTML = mine.length
    ? mine.map((r) => `
      <div class="rep${r.seen ? ' seen' : ''}">
        <div class="rh"><span class="rmark sm">知</span><b>${esc(r.kind)}</b><span class="muted">${esc(r.datetime ? timeLabel(r.datetime) : '')}・${esc(names[r.district] || '')}</span></div>
        <p>${esc(r.text)}</p>
        ${r.photo ? '<span class="pill sm">写真あり（添付）</span>' : ''}
        <button class="outline sm" data-report-seen="${esc(r.id)}" ${r.seen ? 'disabled' : ''}>${r.seen ? 'チームで見ました' : 'チームで見た'}</button>
      </div>`).join('')
    : '<p class="muted">知らせはまだありません。</p>';
}

// 話した言葉から拾えたものを見せる（本人が確かめてから残す）
export function showParse() {
  const box = document.getElementById('patrol-parse');
  const field = document.getElementById('patrol-text');
  if (!box || !field) return;
  const list = traps();
  const p = parsePatrol(field.value, list);
  const trapNo = p.trapId ? p.no : list.find((t) => t.id === selected)?.no;
  const result = p.result || 'empty';
  box.innerHTML = `
    <div class="pf"><span>わな</span><select name="trap">${list.map((t) => `<option value="${t.id}"${t.no === trapNo ? ' selected' : ''}>${t.no}番</option>`).join('')}</select></div>
    <div class="pf"><span>結果</span>
      <label class="rb"><input type="radio" name="result" value="empty"${result === 'empty' ? ' checked' : ''}> 空だった</label>
      <label class="rb"><input type="radio" name="result" value="caught"${result === 'caught' ? ' checked' : ''}> 入っていた</label>
    </div>
    <div class="pf"><span>獣の種類</span><select name="species"><option value="">（なし）</option>${['シカ', 'イノシシ', 'その他'].map((s) => `<option${s === p.species ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="pf"><span>頭数</span><input name="count" type="number" min="0" max="20" inputmode="numeric" value="${p.count ?? ''}"></div>
    <p class="muted" style="margin:2px 0 0">話した言葉から拾いました（Claude をつなぐ前の、言葉の照らし合わせ）。違うところは直してください。獣の種類は、話した人の言葉だけで決めます。</p>`;
}

function savePatrol(form) {
  const fd = new FormData(form);
  const t = traps().find((x) => x.id === String(fd.get('trap')));
  if (!t) return;
  const said = splitHealth(String(document.getElementById('patrol-text')?.value || '').trim());
  const caught = fd.get('result') === 'caught';
  const by = String(fd.get('by'));
  const at = new Date().toISOString();
  addLog({
    datetime: at, kind: caught ? '捕獲' : '見回り', trapNo: t.no, by,
    species: caught ? String(fd.get('species') || '') || null : null,
    count: caught ? Number(fd.get('count')) || null : null,
    text: said.kept,
  });
  setTrap(t.id, { signal: null, signalAt: null, goingAt: null, lastChecked: at });
  markSpoke(by);
  selected = t.id;
  refresh();
  toast(`${t.no}番を「見回り済み」にしました。${caught ? '捕獲' : '見回り'}の記録に一行足しました（チームの確認待ち）。${said.dropped.length ? '体のぐあいの話は残していません。' : ''}`);
}

function simSignal() {
  const t = nextSignalTrap(traps(), lastSimNo);
  if (!t) return;
  lastSimNo = t.no;
  setTrap(t.id, { signal: 'caught', signalAt: new Date().toISOString(), goingAt: null });
  selected = t.id;
  refresh();
  toast(`${t.no}番のわなに入った知らせ（模擬）。担当の${t.owner}さんと${t.pair}さんに知らせる想定です（LINE でも送れる形・今は送りません）。`);
}

function goTwo(id) {
  const t = traps().find((x) => x.id === id);
  if (!t) return;
  const at = new Date().toISOString();
  addLog({ datetime: at, kind: '出動', trapNo: t.no, by: t.owner, text: `${t.no}番の知らせで、${t.owner}さんと${t.pair}さんの二人で向かった` });
  setTrap(t.id, { goingAt: at });
  // 新しく入った人と一緒なら、ベテランの「教えた記録」にも残す（確かめるのは本人とチーム）
  const isVeteran = (name) => ctx.data.teach.teachers.includes(name);
  if (isVeteran(t.owner) && !isVeteran(t.pair)) {
    addTeach({ role: '見回り', teacher: t.owner, partner: t.pair, what: `${t.no}番の知らせで、二人で向かった` });
    toast(`出動を記録しました。${t.pair}さんとの同行は、${t.owner}さんの「教えた記録」にも残しました（本人とチームの確認待ち）。`);
  } else {
    toast('出動を記録しました（チームの確認待ち）。');
  }
  refresh();
}

// 地図の画面のボタン（app.js からまとめて呼ぶ）。扱ったら true
export function mapClick(e) {
  const tr = e.target.closest('[data-trap]');
  if (tr && tr.tagName === 'BUTTON') { select(tr.dataset.trap); return true; }
  if (e.target.closest('[data-sim]')) { simSignal(); return true; }
  const go = e.target.closest('[data-trap-go]');
  if (go) { goTwo(go.dataset.trapGo); return true; }
  const seen = e.target.closest('[data-report-seen]');
  if (seen) {
    const s = store.get('reportSeen', {});
    s[seen.dataset.reportSeen] = true;
    store.set('reportSeen', s);
    renderReports();
    return true;
  }
  return false;
}

export function mapChange(e) {
  if (e.target.matches('[data-sim-auto]')) {
    clearInterval(autoTimer);
    autoTimer = e.target.checked ? setInterval(simSignal, 30000) : null;
    if (e.target.checked) simSignal();
    return true;
  }
  if (e.target.matches('[data-stale]')) {
    store.set('staleHours', Number(e.target.value));
    refresh();
    return true;
  }
  return false;
}

export function mapSubmit(e) {
  const f = e.target.closest('form.patrol');
  if (!f) return false;
  e.preventDefault();
  savePatrol(f);
  return true;
}

