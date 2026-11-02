// 活動と捕獲の記録（自治体の手間を減らす）と、住民の知らせ。
// 現場の記録が、そのまま町へ出す一覧の下書きになる。
// AI は下書きと抜けの指摘まで。交付金・報償金の対象かどうかと金額は判断しない。
// 町に出すのは、チームが確かめて「出す」を押したものだけ。
// 写真は添付として残すだけで、写真から獣の種類を判定しない。
import { ICON } from '../icons.js';
import { ctx, view, esc, icon, renderTop, toast, voiceField, timeLabel, localInput, downloadCsv, readPhoto, store, todayStr } from '../ui.js';
import { logs, addLog, editLog, setPhoto, addReport, traps, markSpoke } from '../model.js';
import { COLUMNS, DEFAULT_COLUMNS, KINDS, SPECIES, findGaps, logsForMonth, draftTable, draftCsv, fmtDateTime } from '../lib/log.js';
import { parsePatrol } from '../lib/traps.js';
import { monthOf, shiftMonth, monthLabel } from '../lib/teach.js';
import { splitHealth } from '../lib/watch.js';

const districtNames = () => Object.fromEntries(ctx.data.town.districts.map((d) => [d.id, d.name]));
const columns = () => store.get('logColumns', DEFAULT_COLUMNS);
let editing = null; // 直している記録の id

// ---------- 活動と捕獲の記録 ----------
export function renderLog(month) {
  renderTop({ back: '#/map', here: '活動と捕獲の記録' });
  month = /^\d{4}-\d{2}$/.test(month || '') ? month : monthOf(todayStr());
  const list = logsForMonth(logs(), month);
  const gaps = findGaps(list);
  const byRec = new Map();
  for (const g of gaps) byRec.set(g.id, [...(byRec.get(g.id) || []), g.label]);

  const gapHtml = byRec.size
    ? `<ul class="gap-list">${[...byRec].map(([id, labels]) => {
        const r = list.find((x) => x.id === id);
        return `<li><a href="#log-${esc(id)}" data-jump="${esc(id)}">${esc(r.datetime ? timeLabel(r.datetime) : '日時なし')}・${r.trapNo ? `${r.trapNo}番・` : ''}${esc(r.kind)}</a><span>${labels.map(esc).join('・')}</span></li>`;
      }).join('')}</ul>`
    : '<p class="muted" style="margin:0">抜けはありません。</p>';

  const recHtml = list.map((r) => recordCard(r)).join('') || '<p class="muted">この月の記録はまだありません。</p>';
  const cols = columns();
  const table = draftTable(list, cols, districtNames());
  const colPicker = [...cols, ...COLUMNS.map((c) => c.id).filter((c) => !cols.includes(c))].map((id) => {
    const c = COLUMNS.find((x) => x.id === id);
    const on = cols.includes(id);
    return `<li><label><input type="checkbox" data-col="${esc(id)}"${on ? ' checked' : ''}> ${esc(c.label)}</label>${on && cols.indexOf(id) > 0 ? `<button class="up" data-col-up="${esc(id)}" aria-label="${esc(c.label)}を前へ">↑</button>` : ''}</li>`;
  }).join('');
  const tableHtml = (cls = '') => `<table class="${cls}"><thead><tr>${table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${table.rows.map((row) => `<tr>${row.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${table.head.length || 1}">町へ出したものはまだありません</td></tr>`}</tbody></table>`;

  view.innerHTML = `
    <div class="no-print">
      <h1>活動と捕獲の記録</h1>
      <p class="lead">見回り・捕獲・出動を、話す＋写真で一行ずつ残します。月末に、町へ出す一覧の下書きになります。</p>
      <div class="month">
        <button class="mbtn" data-go="log/${shiftMonth(month, -1)}" aria-label="前の月">${ICON.back}</button>
        <b>${esc(monthLabel(month))}</b>
        <button class="mbtn" data-go="log/${shiftMonth(month, 1)}" aria-label="次の月">${ICON.next}</button>
      </div>
      <section class="gaps">
        <h3>${icon('alert')}抜けチェック <b>${byRec.size}件</b></h3>
        ${gapHtml}
        <p class="muted" style="margin:8px 0 0">写真なし（捕獲のとき）・日時なし・獣種や頭数なし・チームの確認待ちを出しています。今は決まった照らし合わせです。Claude をつなぐと、話した言葉の中身からも抜けを探します（準備中）。</p>
      </section>
      <div id="log-form-slot"></div>
      <button class="outline wide" data-log-add>${icon('mic')}記録を足す（話す）</button>
      <h2>この月の記録</h2>
      ${recHtml}
      <h2>町へ出す一覧（下書き）</h2>
      <p class="muted" style="margin-top:-6px">チームが確かめて「町へ出す」を押した記録だけが入ります。町の様式に合わせて、列と並びを選べます。</p>
      <details class="cols"><summary>列を選ぶ（町の様式に合わせる）</summary><ul>${colPicker}</ul></details>
      <div class="tscroll">${tableHtml('draft')}</div>
      <div class="row2">
        <button class="outline" data-print>印刷する</button>
        <button class="outline" data-log-csv="${esc(month)}">書き出す（CSV）</button>
      </div>
      <ul class="notes">
        <li>交付金や報償金の対象になるか、金額がいくらかは、このアプリでは判断しません。町の窓口で確かめてください。</li>
        <li>写真は記録に添えて残すだけです。写真から獣の種類を判定しません。</li>
        <li>日時・わなの番号・人名はすべて架空のデモです。</li>
      </ul>
    </div>
    <section class="print-only">
      <h1>活動と捕獲の一覧（下書き）　${esc(monthLabel(month))}</h1>
      <p>${esc(ctx.data.area.name)}　／　チームが確かめて「町へ出す」を押した記録</p>
      ${tableHtml()}
      <p>チームの確認者（署名）＿＿＿＿＿＿＿＿＿＿　　確認日＿＿＿＿＿＿</p>
      <p class="small">交付金・報償金の対象かどうかと金額は、このアプリでは判断していません。人名・地名はすべて架空のデモです。</p>
    </section>`;
}

function recordCard(r) {
  const sp = r.kind === '捕獲' ? `${r.species || '獣種なし'}・${r.count ? `${r.count}頭` : '頭数なし'}` : '';
  const photo = r.photo
    ? `<details class="ph"><summary>写真あり（添付）</summary>${r.photoData ? `<img src="${esc(r.photoData)}" alt="添えた写真">` : '<p class="muted">デモのため、写真は載せていません。</p>'}</details>`
    : `<label class="addph">${icon('camera')}写真を添える<input type="file" accept="image/*" data-photo="${esc(r.id)}" hidden></label>`;
  const edit = editing === r.id ? editForm(r) : '';
  return `
    <article class="rec log${r.kind === '捕獲' ? ' catch' : ''}" id="log-${esc(r.id)}">
      <div class="d">${r.datetime ? esc(timeLabel(r.datetime)) : '<b class="warn">日時なし</b>'}${r.local ? '<span class="muted">（この端末で追加）</span>' : ''}</div>
      <div class="r"><b>${esc(r.kind)}</b>${r.trapNo ? `<span class="tno">${r.trapNo}番</span>` : ''}${sp ? `<span class="sp">${esc(sp)}</span>` : ''}</div>
      <div class="pp">記録した人 <b>${esc(r.by || '—')}さん</b></div>
      ${r.text ? `<p class="w">「${esc(r.text)}」</p>` : ''}
      ${photo}
      <div class="oks">
        <button class="ok" data-log-ok="${esc(r.id)}" aria-pressed="${!!r.teamOk}"><span class="box">✓</span><span>チームの確認<b>${r.teamOk ? 'はい' : 'まだ'}</b></span></button>
        <button class="ok send" data-log-send="${esc(r.id)}" aria-pressed="${!!r.sent}" ${r.teamOk ? '' : 'disabled'}><span class="box">✓</span><span>町へ<b>${r.sent ? '出した' : '出す'}</b></span></button>
      </div>
      <button class="link" data-log-edit="${esc(r.id)}">${editing === r.id ? '閉じる' : '直す'}</button>
      ${edit}
    </article>`;
}

function editForm(r) {
  const opt = (list, sel) => list.map((v) => `<option${v === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
  return `
    <form class="raise logedit" data-id="${esc(r.id)}">
      <label>日時<input type="datetime-local" name="datetime" value="${r.datetime ? esc(localInput(r.datetime)) : ''}"></label>
      <label>種類<select name="kind">${opt(KINDS, r.kind)}</select></label>
      <label>獣の種類（捕獲のとき）<select name="species"><option value="">（なし）</option>${opt(SPECIES, r.species)}</select></label>
      <label>頭数（捕獲のとき）<input type="number" name="count" min="0" max="20" inputmode="numeric" value="${r.count ?? ''}"></label>
      <button class="primary" type="submit">直した内容で残す</button>
      <p class="muted" style="margin:0">直すと、チームの確認と「町へ出す」は外れます。もう一度確かめてください。</p>
    </form>`;
}

function addForm() {
  const people = ctx.data.teach.people.map((p) => `<option>${esc(p)}</option>`).join('');
  return `
    <form class="raise logadd">
      <label>話す人<select name="by">${people}</select></label>
      ${voiceField('log-text', '例：3番、シカが1頭かかっとった')}
      <div class="parsed" id="log-parse"></div>
      <label>写真（なくてもよい）<input type="file" name="photo" accept="image/*"></label>
      <button class="primary" type="submit">この内容で残す</button>
    </form>`;
}

export function showLogParse() {
  const box = document.getElementById('log-parse');
  const field = document.getElementById('log-text');
  if (!box || !field) return;
  const list = traps();
  const p = parsePatrol(field.value, list);
  const kind = p.result === 'caught' ? '捕獲' : '見回り';
  const opt = (arr, sel) => arr.map((v) => `<option${v === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
  box.innerHTML = `
    <div class="pf"><span>日時</span><input type="datetime-local" name="datetime" value="${esc(localInput())}"></div>
    <div class="pf"><span>種類</span><select name="kind">${opt(KINDS, kind)}</select></div>
    <div class="pf"><span>わな</span><select name="trap"><option value="">（なし）</option>${list.map((t) => `<option value="${t.no}"${t.no === p.no ? ' selected' : ''}>${t.no}番</option>`).join('')}</select></div>
    <div class="pf"><span>獣の種類</span><select name="species"><option value="">（なし）</option>${opt(SPECIES, p.species)}</select></div>
    <div class="pf"><span>頭数</span><input name="count" type="number" min="0" max="20" inputmode="numeric" value="${p.count ?? ''}"></div>
    <p class="muted" style="margin:2px 0 0">話した言葉から拾いました（Claude をつなぐ前の、言葉の照らし合わせ）。違うところは直してください。</p>`;
}

async function saveAdd(form) {
  const fd = new FormData(form);
  const said = splitHealth(String(document.getElementById('log-text')?.value || '').trim());
  const kind = String(fd.get('kind') || '見回り');
  const dt = String(fd.get('datetime') || '');
  const by = String(fd.get('by'));
  const id = addLog({
    datetime: dt ? new Date(dt).toISOString() : null,
    kind, trapNo: Number(fd.get('trap')) || null, by,
    species: kind === '捕獲' ? String(fd.get('species') || '') || null : null,
    count: kind === '捕獲' ? Number(fd.get('count')) || null : null,
    text: said.kept,
  });
  markSpoke(by);
  const file = fd.get('photo');
  if (file && file.size) await attach(id, file);
  const m = dt ? monthOf(dt.slice(0, 10)) : monthOf(todayStr());
  if (location.hash === `#/log/${m}`) renderLog(m); else location.hash = `#/log/${m}`;
  toast(`一行足しました（チームの確認待ち）。${said.dropped.length ? '体のぐあいの話は残していません。' : ''}`);
}

async function attach(id, file) {
  try {
    const data = await readPhoto(file);
    if (!setPhoto(id, data)) toast('この端末に写真を残せませんでした（空きが足りません）。');
  } catch (err) {
    toast(err.message);
  }
}

const currentMonth = () => (location.hash.split('/')[2] || monthOf(todayStr()));
const rerender = () => { const y = window.scrollY; renderLog(currentMonth()); window.scrollTo(0, y); };

export function logClick(e) {
  if (e.target.closest('[data-log-add]')) {
    const slot = document.getElementById('log-form-slot');
    if (!slot.firstChild) { slot.innerHTML = addForm(); showLogParse(); }
    e.target.closest('[data-log-add]').hidden = true;
    return true;
  }
  const ok = e.target.closest('[data-log-ok]');
  if (ok) {
    const r = logs().find((x) => x.id === ok.dataset.logOk);
    editLog(r.id, r.teamOk ? { teamOk: false, sent: false } : { teamOk: true });
    rerender();
    return true;
  }
  const send = e.target.closest('[data-log-send]');
  if (send) {
    const r = logs().find((x) => x.id === send.dataset.logSend);
    if (!r.teamOk) return true;
    editLog(r.id, { sent: !r.sent });
    rerender();
    return true;
  }
  const ed = e.target.closest('[data-log-edit]');
  if (ed) { editing = editing === ed.dataset.logEdit ? null : ed.dataset.logEdit; rerender(); return true; }
  const jump = e.target.closest('[data-jump]');
  if (jump) { e.preventDefault(); document.getElementById(`log-${jump.dataset.jump}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return true; }
  const up = e.target.closest('[data-col-up]');
  if (up) {
    const cols = [...columns()];
    const i = cols.indexOf(up.dataset.colUp);
    if (i > 0) [cols[i - 1], cols[i]] = [cols[i], cols[i - 1]];
    store.set('logColumns', cols);
    rerender();
    document.querySelector('details.cols')?.setAttribute('open', '');
    return true;
  }
  const csv = e.target.closest('[data-log-csv]');
  if (csv) {
    const m = csv.dataset.logCsv;
    downloadCsv(`活動と捕獲の一覧_${m}.csv`, draftCsv(logsForMonth(logs(), m), columns(), districtNames()));
    return true;
  }
  return false;
}

export function logChange(e) {
  const col = e.target.closest('[data-col]');
  if (col) {
    let cols = columns().filter((c) => c !== col.dataset.col);
    if (col.checked) cols = [...cols, col.dataset.col];
    store.set('logColumns', cols);
    rerender();
    document.querySelector('details.cols')?.setAttribute('open', '');
    return true;
  }
  const ph = e.target.closest('[data-photo]');
  if (ph && ph.files[0]) {
    attach(ph.dataset.photo, ph.files[0]).then(rerender);
    return true;
  }
  return false;
}

export function logSubmit(e) {
  const add = e.target.closest('form.logadd');
  if (add) { e.preventDefault(); saveAdd(add); return true; }
  const ed = e.target.closest('form.logedit');
  if (ed) {
    e.preventDefault();
    const fd = new FormData(ed);
    const dt = String(fd.get('datetime') || '');
    const kind = String(fd.get('kind'));
    editLog(ed.dataset.id, {
      datetime: dt ? new Date(dt).toISOString() : null,
      kind,
      species: kind === '捕獲' ? String(fd.get('species') || '') || null : null,
      count: kind === '捕獲' ? Number(fd.get('count')) || null : null,
      teamOk: false, sent: false,
    });
    editing = null;
    const m = dt ? monthOf(fmtDateTime(new Date(dt).toISOString())) : currentMonth();
    if (location.hash === `#/log/${m}`) rerender(); else location.hash = `#/log/${m}`;
    return true;
  }
  return false;
}

// ---------- 住民の知らせ（ログインなし・名前はいらない） ----------
let reportKind = '出没';

export function renderReport(done = false) {
  renderTop({ back: '#/map', here: '見かけたら知らせる' });
  const opts = ctx.data.town.districts.map((d) => `<option value="${esc(d.id)}"${d.id === ctx.data.homeDistrict ? ' selected' : ''}>${esc(d.name)}</option>`).join('');
  view.innerHTML = `
    <p class="kicker">住民の方へ</p>
    <h1>見かけたら<br>知らせる</h1>
    ${done ? '<div class="thanks">ありがとうございます。地区のチームへ回しました。<br><small>デモでは、この端末の地図に出ます。</small></div>' : ''}
    <p class="talk-lead">名前はいりません。話すか、文字で入れてください。</p>
    <form class="report">
      <div class="kinds">
        <button type="button" class="kbtn" data-rkind="出没" aria-pressed="${reportKind === '出没'}">見かけた（出没）</button>
        <button type="button" class="kbtn" data-rkind="被害" aria-pressed="${reportKind === '被害'}">畑などの被害</button>
      </div>
      <label>地区<select name="district">${opts}</select></label>
      ${voiceField('report-text', '例：夕方、道の向こうに2頭見えた')}
      <label>写真（なくてもよい）<input type="file" name="photo" accept="image/*"></label>
      <button class="primary" type="submit">チームへ知らせる</button>
    </form>
    <ul class="notes">
      <li>地図には、家の場所ではなく地区に置きます。チームの中だけで見ます。</li>
      <li>写真は知らせに添えて残すだけです。写真から獣の種類を判定しません。</li>
      <li>急ぎのときの連絡先は、町の窓口で確かめてください（要確認）。</li>
    </ul>`;
}

export function reportClick(e) {
  const k = e.target.closest('[data-rkind]');
  if (!k) return false;
  reportKind = k.dataset.rkind;
  document.querySelectorAll('[data-rkind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rkind === reportKind)));
  return true;
}

export function reportSubmit(e) {
  const f = e.target.closest('form.report');
  if (!f) return false;
  e.preventDefault();
  const fd = new FormData(f);
  const text = splitHealth(String(document.getElementById('report-text')?.value || '').trim()).kept;
  if (!text) { toast('知らせる言葉を、話すか入れてください。'); return true; }
  const id = addReport({ datetime: new Date().toISOString(), district: String(fd.get('district')), kind: reportKind, text });
  const file = fd.get('photo');
  (file && file.size ? attach(id, file) : Promise.resolve()).then(() => { renderReport(true); window.scrollTo(0, 0); });
  return true;
}
