// ジビエつなぎ：画面の切り替えと表示。
// AI は人を選ばない・順位をつけない。手を挙げた人の並びは、手を挙げた順のまま。
import { ICON, ROLE_ICON } from './icons.js';
import { countDistrict, townRows } from './lib/town.js';
import { monthOf, shiftMonth, monthLabel, isConfirmed, recordsForMonth, summarizeByTeacher, toCsv } from './lib/teach.js';

const view = document.getElementById('view');
const top = document.getElementById('top');
const tabs = document.getElementById('tabs');

// この端末だけに残すもの（手を挙げた人の追加・チームの決定・ゴールの印）。使えない環境でも画面は動く
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 保存できなくても続ける */ }
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const strip = (name) => String(name).replace(/（架空）/g, '').trim();
const icon = (name) => `<span class="ico">${ICON[name] || ''}</span>`;
const roleIcon = (role) => icon(ROLE_ICON[role] || 'doc');

let data;

async function load() {
  const res = await fetch('/api/team');
  if (!res.ok) throw new Error('データを読めませんでした');
  data = await res.json();
}

// ---------- 上の帯と下のタブ ----------
const TABS = [
  { id: 'talk', label: '話す', icon: 'mic' },
  { id: 'team', label: 'チーム', icon: 'team' },
  { id: 'risk', label: '止まる役割', icon: 'alert' },
  { id: 'cards', label: '募集', icon: 'card' },
  { id: 'teach', label: '教えた記録', icon: 'clipboard' },
];

function renderTabs(current) {
  tabs.innerHTML = TABS.map((t) =>
    `<a href="#/${t.id}" ${t.id === current ? 'aria-current="page"' : ''}>${icon(t.icon)}${t.label}</a>`).join('');
}

function renderTop({ back, here } = {}) {
  if (back) {
    top.className = 'top line';
    top.innerHTML = `<a class="back" href="${esc(back)}">${icon('back')}ジビエつなぎ</a>${here ? `<span class="here">${esc(here)}</span>` : ''}`;
  } else {
    top.className = 'top';
    top.innerHTML = `<span class="brand">ジビエつなぎ</span><span class="area">${esc(data.area.name)}</span>
      <button class="zoom" data-zoom aria-pressed="${document.body.classList.contains('big')}">大きな字</button>`;
  }
}

function licensePill(license, { big = false, sm = false } = {}) {
  const text = license === 'no_license' && big ? '資格なしで今日から始められます' : data.licenseLabels[license] || '要確認';
  return `<span class="pill ${esc(license)}${big ? ' big' : ''}${sm ? ' sm' : ''}">${esc(text)}</span>`;
}

// ---------- 2 チームの表 ----------
function renderTeam() {
  renderTop();
  const { ok, total } = data.goal.progress;
  const left = total - ok;
  const areaName = strip(data.area.name);
  const rows = data.rows.map((r, i) => {
    const who = r.people.map((p) => `<span class="av"><b>${esc(p.slice(0, 1))}</b>${esc(p)}</span>`).join('');
    const pill = r.coverage === 'single' ? '<span class="pill">1人だけ</span>' : r.coverage === 'empty' ? '<span class="pill">空き</span>' : '';
    return `<li class="trow">
      <span class="no">${i + 1}</span>
      <div><div class="role">${esc(r.role)}</div><div class="lic">${licensePill(r.license, { sm: true })}</div></div>
      <div class="who">${who}${pill}</div>
    </li>`;
  }).join('');
  const checks = store.get('goalChecks', {});
  const manual = data.goal.checks.filter((c) => !c.auto).map((c) => `
    <div class="check"><button data-goal="${esc(c.id)}" aria-pressed="${!!checks[c.id]}" aria-label="${esc(c.label)}">✓</button><span>${esc(c.label)}</span></div>`).join('');

  view.innerHTML = `
    <h1>${esc(areaName)}のチーム</h1>
    <p class="goal-head">名産として出せる状態まで</p>
    <p class="goal-num">${left === 0 ? 'そろいました' : `あと${left}<small>つ</small>`}</p>
    <div class="segments" style="grid-template-columns:repeat(${total},1fr)" role="img" aria-label="2人以上いる工程 ${ok}/${total}">
      ${Array.from({ length: total }, (_, i) => `<i class="${i < ok ? 'on' : ''}"></i>`).join('')}
    </div>
    <ul class="table">
      <li class="head"><span>工程</span><span>担当</span></li>
      ${rows}
    </ul>
    <p class="muted">${esc(data.licenseCheckNote)}</p>
    <section class="checks">
      <h3>ほかにチームが確かめること</h3>
      ${manual}
      <p class="muted" style="margin:6px 0 8px">印はチームが付けます。AI は判定しません。</p>
    </section>
    <figure class="photo">
      <img src="/img/photo_03_shokudo.jpg" alt="山あいの食堂に並ぶ鹿肉の煮込み定食（AI で生成した架空の場面）" loading="lazy">
      <figcaption>ゴール：地域の名産として出せる状態。この先に、新しく入る人が増える・農村の被害が減る・ジビエが普段の食べものになる。（写真は AI で生成した架空の場面）</figcaption>
    </figure>
    <button class="outline wide" data-go="town" style="margin-top:20px">${icon('town')}町の地区一覧（町の担当の方向け）</button>`;
}

// ---------- 3 止まる役割 ----------
function renderRisk() {
  renderTop({ back: '#/team', here: '止まる役割' });
  let n = 0;
  const card = (r) => `
    <article class="stop">
      <span class="num">${++n}</span>
      <div><div class="title">${esc(r.role)}</div><div class="reason">${esc(r.reason)}</div></div>
      <span class="big-ico">${ICON[ROLE_ICON[r.role] || 'doc']}</span>
      <div class="act">${r.cardId ? `<button class="outline" data-go="cards/${esc(r.cardId)}">募集カードを作る</button>` : ''}</div>
    </article>`;

  // 人ごとにまとめる（人に順位はつけない。並びは工程の順）
  const byPerson = new Map();
  const empty = [];
  for (const r of data.risks) {
    if (r.person) byPerson.set(r.person, [...(byPerson.get(r.person) || []), r]);
    else empty.push(r);
  }
  let html = '';
  for (const [person, list] of byPerson) html += `<h1>${esc(person)}さんが休むと<br>止まる役割</h1>${list.map(card).join('')}`;
  if (empty.length) html += `<h2>担当がいない役割</h2>${empty.map(card).join('')}`;
  view.innerHTML = `${html}
    <div class="pending">Claude をつなぐと、ベテランの話から理由が足されます（例：店の連絡先を岩田さんしか知らない）。準備中。</div>`;
}

// ---------- 4 募集カード（一覧） ----------
function handsFor(card) {
  const added = store.get('addedHands', []).filter((h) => h.card === card.id);
  return [...card.hands, ...added.map((h) => ({ ...h, local: true }))];
}

function renderCards() {
  renderTop();
  const items = data.cards.map((c) => {
    const n = handsFor(c).length;
    return `<li><a href="#/cards/${esc(c.id)}">
      <span class="ci">${ICON[ROLE_ICON[c.role] || 'doc']}</span>
      <div>
        <div class="t">${esc(c.role)}</div>
        <div class="s">${esc(c.when)}・${esc(c.why_now)}</div>
        <div class="m">${licensePill(c.license, { sm: true })}<span class="muted">手を挙げた人 ${n}人</span></div>
      </div>
      <span class="chev">${ICON.next}</span>
    </a></li>`;
  }).join('');
  view.innerHTML = `
    <div class="hero">
      <img src="/img/photo_01_mimawari.jpg" alt="霜の林道を見回りに向かう猟師の後ろ姿（AI で生成した架空の場面）">
      <div class="cap"><b>一緒に担ってくれる人を<br>募集しています</b><span>${esc(data.area.name)}・写真は AI で生成した架空の場面</span></div>
    </div>
    <p class="lead" style="margin-top:0">見た人が自分で手を挙げ、決めるのはチームです。AI は人を評価しません。</p>
    <ul class="clist">${items}</ul>
    <p class="muted">カードの文は、Claude をつなぐ前の手書きの下書きです。</p>`;
}

// ---------- 4 募集カード（詳しく） ----------
function renderCard(id) {
  const c = data.cards.find((x) => x.id === id);
  if (!c) return renderCards();
  renderTop({ back: '#/cards' });
  const decided = store.get('decided', {});
  const hands = handsFor(c);
  const handList = hands.length
    ? hands.map((h) => {
        const key = `${c.id}:${h.name}`;
        const isDecided = !!decided[key];
        return `<div class="hand">
          <span class="name">${esc(strip(h.name))}さん</span>${isDecided ? '<span class="decided">チームで決定</span>' : ''}${h.local ? '<span class="muted">（この端末で追加）</span>' : ''}
          <div class="cond">本人が書いた条件：${esc(h.conditions) || '（なし）'}</div>
          <button class="outline sm" data-decide="${esc(key)}">${isDecided ? '決定を取り消す' : 'チームで話して、お願いする'}</button>
        </div>`;
      }).join('')
    : '<p class="muted">まだ手は挙がっていません。</p>';
  const path = c.path.map((text, i) => `
    <li><span class="dot">${i + 1}</span><div><div class="step">${esc(data.pathSteps[i] || '')}</div><div class="text">${esc(text)}</div></div></li>`).join('');

  view.innerHTML = `
    <p class="kicker">募集カード</p>
    <h1>${esc(c.role)}</h1>
    ${licensePill(c.license, { big: true })}
    <ul class="facts">
      <li>${icon('calendar')}<span>${esc(c.when)}</span></li>
      <li>${icon('chat')}<span>${esc(c.how)}</span></li>
      <li>${icon('person')}<span>${esc(c.fits)}</span></li>
    </ul>
    <p class="why">${esc(c.why_now)}</p>
    ${c.image ? `<figure class="photo"><img src="${esc(c.image.src)}" alt="${esc(c.image.alt)}" loading="lazy"><figcaption>写真は AI で生成した架空の場面</figcaption></figure>` : ''}
    <h2>一人前までの道のり</h2>
    <ol class="path">${path}</ol>
    ${c.license === 'needs_check' ? `<p class="check-note">${esc(data.licenseCheckNote)}</p>` : ''}
    <section class="hands">
      <h3>手を挙げた人（手を挙げた順）</h3>
      ${handList}
      <div id="raise-slot"></div>
    </section>
    <div class="cta"><button data-raise="${esc(c.id)}">手を挙げる</button></div>`;
  document.body.classList.add('has-cta');
}

// ---------- 1 経験を集める（高齢の猟師さんが使える形） ----------
// 押して話すだけ・ログインなし・大きな字・読み上げ。
// 話した言葉は方言も言い直しもそのまま残す（標準語に書き換えない）。
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;          // 声の聞き取り（ブラウザの音声入力）
let heard = '';          // まだ残していない言葉
let listening = false;

function savedTalks() {
  const t = data.veteranTalk;
  // 新しい話から上に
  return [
    ...store.get('talks', []).map((x) => ({ ...x, local: true })).reverse(),
    { id: 'prepared', who: strip(t.speaker).split('（')[0], date: t.date, text: t.text },
  ];
}

function renderTalk() {
  renderTop();
  const talks = savedTalks().map((x) => `
    <div class="quote">
      <div class="who-line">${esc(x.who)}さん・${esc(x.date)}${x.local ? '（この端末で残した話）' : ''}</div>
      <p class="said">${esc(x.text)}</p>
      <button class="say" data-say="${esc(x.id)}">${icon('speaker')}声で聞く</button>
    </div>`).join('');

  view.innerHTML = `
    <h1>話す</h1>
    <p class="talk-lead">ボタンを押して、いつもの言葉で話してください。</p>
    <div class="center">
      <button class="mic${SR ? '' : ' off'}" data-mic aria-pressed="${listening}" aria-label="押して話す">${listening ? ICON.stop : ICON.mic}</button>
      <div class="mic-label" id="mic-label">${SR ? (listening ? '聞いています。終わったら、もう一度押す' : '押して話す') : 'この端末では声の入力が使えません。下に文字で入れてください'}</div>
    </div>
    <div class="heard"${heard ? '' : ' hidden'} id="heard">
      <p class="said" id="heard-text">${esc(heard)}</p>
      <button class="primary" data-talk-save>この言葉のまま残す</button>
      <div class="row2">
        <button class="outline" data-mic>続けて話す</button>
        <button class="outline" data-talk-clear>残さずに消す</button>
      </div>
    </div>
    <details class="type-in"${SR ? '' : ' open'}>
      <summary>文字で入れる</summary>
      <textarea class="talk" id="talk-text" rows="3" maxlength="2000" placeholder="例：朝はまず、わなの見回り。"></textarea>
      <button class="outline wide" data-talk-type>この言葉のまま残す</button>
    </details>
    <p class="muted">ログインはありません。チームが渡すリンクを開くだけです。若い人が横でスマホを持って聞き取ってもかまいません。方言も言い直しも、そのまま残します。</p>
    <h2>残した話</h2>
    ${talks}
    <div class="pending">Claude をつなぐと、残した話を工程ごとの「手順」と「注意」にまとめ、抜けている点を<b>1つだけ</b>聞き返して、声で読み上げます。準備中。</div>`;
}

function showHeard() {
  const box = document.getElementById('heard');
  if (!box) return;
  box.hidden = !heard;
  document.getElementById('heard-text').textContent = heard;
}

function startListening() {
  if (!SR) { document.getElementById('talk-text')?.focus(); return; }
  if (listening) { rec?.stop(); return; }
  rec = new SR();
  rec.lang = 'ja-JP';
  rec.continuous = true;
  rec.interimResults = true;
  const base = heard ? `${heard}　` : '';
  rec.onresult = (ev) => {
    let text = '';
    for (const r of ev.results) text += r[0].transcript;
    heard = base + text;
    showHeard();
  };
  rec.onend = () => { listening = false; if (location.hash.startsWith('#/talk')) renderTalk(); };
  rec.onerror = () => { listening = false; };
  speechSynthesis?.cancel();
  listening = true;
  rec.start();
  renderTalk();
}

function saveTalk(text) {
  text = String(text || '').trim();
  if (!text) return;
  const talks = store.get('talks', []);
  talks.push({ id: `talk-${Date.now()}`, who: strip(data.veteranTalk.speaker).split('（')[0], date: new Date().toLocaleDateString('sv-SE'), text });
  store.set('talks', talks);
  heard = '';
  renderTalk();
}

// 読み上げ（端末の声を使う。外には送らない）
function speak(text, btn) {
  if (!('speechSynthesis' in window)) return;
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 0.9;
  btn?.classList.add('on');
  u.onend = u.onerror = () => btn?.classList.remove('on');
  speechSynthesis.speak(u);
}

// ---------- 5 教えた記録 ----------
// 一緒にやった日・工程・相手を残し、ベテラン本人とチームが「はい」で確かめる。
// 金額は決めない・お金は動かさない・教え方に点数をつけない。
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const dayLabel = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return `${m}月${d}日（${WEEK[new Date(y, m - 1, d).getDay()]}）`;
};
const todayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

// データの記録＋この端末で足した記録に、この端末で押した「はい」を重ねる
function teachRecords() {
  const oks = store.get('teachOk', {});
  return [...data.teach.records, ...store.get('teachAdded', []).map((r) => ({ ...r, local: true }))]
    .map((r) => ({ ...r, ...(oks[r.id] || {}) }));
}

function okButton(r, who) {
  const key = who === 'teacher' ? 'teacherOk' : 'teamOk';
  const label = who === 'teacher' ? `${r.teacher}さん` : 'チーム';
  return `<button class="ok" data-ok="${esc(r.id)}:${key}" aria-pressed="${!!r[key]}">
    <span class="box">✓</span><span>${esc(label)}<b>${r[key] ? 'はい' : 'まだ'}</b></span></button>`;
}

function renderTeach(month) {
  renderTop();
  month = /^\d{4}-\d{2}$/.test(month || '') ? month : monthOf(todayStr());
  const list = recordsForMonth(teachRecords(), month);
  const sum = summarizeByTeacher(list, data.teach.teachers);
  const area = data.area.name;

  const sumHtml = sum.length
    ? sum.map((s) => `<div class="tsum">
        <span class="av"><b>${esc(s.teacher.slice(0, 1))}</b></span>
        <div><div class="nm">${esc(s.teacher)}さん</div><div class="rl">${esc(s.roles.join('・'))}</div></div>
        <div class="ct"><b>${s.confirmed}<small>回</small></b><span>${s.waiting ? `確認待ち ${s.waiting}回` : '確かめ済み'}</span></div>
      </div>`).join('')
    : '<p class="muted">この月の記録はまだありません。</p>';

  const recHtml = list.map((r) => `
    <article class="rec">
      <div class="d">${esc(dayLabel(r.date))}${r.local ? '<span class="muted">（この端末で追加）</span>' : ''}</div>
      <div class="r">${roleIcon(r.role)}<b>${esc(r.role)}</b></div>
      <div class="pp">教えた人 <b>${esc(r.teacher)}さん</b>　一緒にやった人 <b>${esc(r.partner)}さん</b></div>
      ${r.what ? `<div class="w">${esc(r.what)}</div>` : ''}
      <div class="oks">${okButton(r, 'teacher')}${okButton(r, 'team')}</div>
    </article>`).join('');

  const printRows = list.map((r) => `<tr><td>${esc(r.date)}</td><td>${esc(r.role)}</td><td>${esc(r.teacher)}</td><td>${esc(r.partner)}</td><td>${esc(r.what || '')}</td><td>${r.teacherOk ? 'はい' : '未'}</td><td>${r.teamOk ? 'はい' : '未'}</td></tr>`).join('');
  const printSum = sum.map((s) => `${esc(s.teacher)}さん　確かめ済み ${s.confirmed}回${s.waiting ? `（確認待ち ${s.waiting}回）` : ''}`).join('<br>');

  view.innerHTML = `
    <div class="no-print">
      <h1>教えた記録</h1>
      <p class="lead">ベテランと一緒にやった日を残します。ベテラン本人とチームが「はい」を押して確かめます。</p>
      <div class="month">
        <button class="mbtn" data-go="teach/${shiftMonth(month, -1)}" aria-label="前の月">${ICON.back}</button>
        <b>${esc(monthLabel(month))}</b>
        <button class="mbtn" data-go="teach/${shiftMonth(month, 1)}" aria-label="次の月">${ICON.next}</button>
      </div>
      <h2>教えた人ごとの回数</h2>
      <p class="muted" style="margin-top:-6px">確かめ済み＝本人とチームの両方が「はい」。並びは名簿の順です。</p>
      ${sumHtml}
      <div class="fee-note">金額はこのアプリでは決めません。お金も動かしません。謝礼の扱いは、チームと町・処理場で決めてください。教え方に点数はつけません。</div>
      <h2>この月の記録</h2>
      ${recHtml || '<p class="muted">まだありません。</p>'}
      <div id="teach-form-slot"></div>
      <button class="outline wide" data-teach-add="${esc(month)}">${icon('doc')}記録を足す</button>
      <div class="row2">
        <button class="outline" data-print>印刷する</button>
        <button class="outline" data-csv="${esc(month)}">書き出す（CSV）</button>
      </div>
    </div>
    <section class="print-only">
      <h1>教えた記録　${esc(monthLabel(month))}</h1>
      <p>${esc(area)}　／　確かめ済み＝ベテラン本人とチームの両方が「はい」</p>
      <table><thead><tr><th>日付</th><th>工程</th><th>教えた人</th><th>一緒にやった人</th><th>したこと</th><th>本人</th><th>チーム</th></tr></thead>
      <tbody>${printRows || '<tr><td colspan="7">記録なし</td></tr>'}</tbody></table>
      <p>${printSum}</p>
      <p>チームの確認者（署名）＿＿＿＿＿＿＿＿＿＿　　確認日＿＿＿＿＿＿</p>
      <p class="small">金額はこのアプリでは決めません。謝礼の扱いは、チームと町・処理場で決めてください。人名・地名はすべて架空のデモです。</p>
    </section>`;
}

function teachForm(month) {
  const opt = (list, sel) => list.map((v) => `<option${v === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const today = todayStr();
  const date = monthOf(today) === month ? today : `${month}-01`;
  return `
    <form class="raise teach" data-month="${esc(month)}">
      <label>日付<input type="date" name="date" value="${esc(date)}" required></label>
      <label>工程<select name="role">${opt(data.rows.map((r) => r.role))}</select></label>
      <label>教えた人<select name="teacher">${opt(data.teach.teachers)}</select></label>
      <label>一緒にやった人<select name="partner">${opt(data.teach.people, '高木')}</select></label>
      <label>したこと（短く・なくてもよい）<input name="what" maxlength="60" autocomplete="off"></label>
      <button class="primary" type="submit">この内容で残す</button>
      <p class="muted" style="margin:0">残したあと、教えた人とチームが「はい」を押します。</p>
    </form>`;
}

function downloadCsv(month) {
  const csv = toCsv(recordsForMonth(teachRecords(), month));
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `教えた記録_${month}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- 6 町の画面（町の担当の方向け） ----------
// 地区ごとの数だけを出す。個人名は出さない。
function renderTown() {
  renderTop({ back: '#/team', here: '町の地区一覧' });
  const live = countDistrict({
    rows: data.rows,
    cards: data.cards.map((c) => ({ hands: handsFor(c) })),
    records: teachRecords(),
    experienceRoles: data.experienceRoles,
  });
  const rows = townRows(data.town.districts, live);
  const num = (n, unit, label, sub = '') => `<div class="tn"><b>${n}<small>${unit}</small></b><span>${label}</span>${sub ? `<em>${sub}</em>` : ''}</div>`;
  const cards = rows.map((d) => `
    <article class="dist">
      <div class="dn">${esc(d.name)}${d.live ? '<span class="pill sm">チームのデータから数える</span>' : ''}</div>
      <div class="tgrid">
        ${num(d.single, '', '1人だけの役割', d.empty ? `担当がいない役割 ${d.empty}` : '')}
        ${num(d.experience, `<i>/${d.roles}</i>`, '経験が残った工程')}
        ${num(d.hands, '人', '手を挙げた人')}
        ${num(d.teach, '回', '教えた回数', '確かめ済み')}
      </div>
    </article>`).join('');
  view.innerHTML = `
    <p class="kicker">町の担当の方向け</p>
    <h1>${esc(strip(data.town.name))}の<br>地区一覧</h1>
    <p class="lead">地区ごとの数だけを出します。個人名は出しません。</p>
    ${cards}
    <ul class="notes">
      <li>北沢地区の数は、チームの表・募集カード・教えた記録から数えています。南沢・東原は画面を見せるための架空の数です。</li>
      <li>「経験が残った工程」は、話す画面で残した話を Claude が工程ごとにまとめてから数えます（準備中のため、北沢は今 0）。</li>
      <li>計画の見直しや報告の材料に使えるかは、町の窓口で確かめてください（要確認）。</li>
    </ul>`;
}

// ---------- 切り替え ----------
function route() {
  const [name, arg] = (location.hash.replace(/^#\/?/, '') || 'team').split('/');
  if (name !== 'talk') { rec?.stop(); try { speechSynthesis.cancel(); } catch { /* 読み上げなし */ } }
  document.body.classList.remove('has-cta');
  const tab = TABS.some((t) => t.id === name) ? name : 'team';
  renderTabs(tab);
  if (name === 'cards' && arg) renderCard(arg);
  else if (name === 'teach') renderTeach(arg);
  else if (name === 'town') renderTown();
  else ({ team: renderTeam, risk: renderRisk, cards: renderCards, talk: renderTalk }[tab])();
  window.scrollTo(0, 0);
}

// ボタンの動き（画面を描き直しても効くよう、まとめて受ける）
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { location.hash = `#/${go.dataset.go}`; return; }

  const goal = e.target.closest('[data-goal]');
  if (goal) {
    const checks = store.get('goalChecks', {});
    checks[goal.dataset.goal] = !checks[goal.dataset.goal];
    store.set('goalChecks', checks);
    goal.setAttribute('aria-pressed', String(checks[goal.dataset.goal]));
    return;
  }

  const decide = e.target.closest('[data-decide]');
  if (decide) {
    const decided = store.get('decided', {});
    decided[decide.dataset.decide] = !decided[decide.dataset.decide];
    store.set('decided', decided);
    const y = window.scrollY;
    renderCard(decide.dataset.decide.split(':')[0]);
    window.scrollTo(0, y);
    return;
  }

  if (e.target.closest('[data-zoom]')) {
    const on = document.body.classList.toggle('big');
    store.set('bigText', on);
    e.target.closest('[data-zoom]').setAttribute('aria-pressed', String(on));
    return;
  }
  if (e.target.closest('[data-mic]')) { startListening(); return; }
  if (e.target.closest('[data-talk-save]')) { rec?.stop(); saveTalk(heard); return; }
  if (e.target.closest('[data-talk-clear]')) { rec?.stop(); heard = ''; showHeard(); return; }
  if (e.target.closest('[data-talk-type]')) { saveTalk(document.getElementById('talk-text')?.value); return; }
  const say = e.target.closest('[data-say]');
  if (say) {
    const t = savedTalks().find((x) => x.id === say.dataset.say);
    if (t) speak(t.text, say);
    return;
  }

  const ok = e.target.closest('[data-ok]');
  if (ok) {
    const [id, key] = ok.dataset.ok.split(':');
    const oks = store.get('teachOk', {});
    const cur = teachRecords().find((r) => r.id === id);
    oks[id] = { ...(oks[id] || {}), [key]: !cur?.[key] };
    store.set('teachOk', oks);
    const y = window.scrollY;
    renderTeach(monthOf(cur.date));
    window.scrollTo(0, y);
    return;
  }

  const add = e.target.closest('[data-teach-add]');
  if (add) {
    const slot = document.getElementById('teach-form-slot');
    if (!slot.firstChild) slot.innerHTML = teachForm(add.dataset.teachAdd);
    add.hidden = true;
    slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (e.target.closest('[data-print]')) { window.print(); return; }

  const csv = e.target.closest('[data-csv]');
  if (csv) { downloadCsv(csv.dataset.csv); return; }

  const raise = e.target.closest('[data-raise]');
  if (raise) {
    const slot = document.getElementById('raise-slot');
    if (!slot.firstChild) {
      slot.innerHTML = `
        <form class="raise" data-card="${esc(raise.dataset.raise)}">
          <label>お名前<input name="name" required maxlength="40" autocomplete="off"></label>
          <label>動ける日・できること（自分で書きます）<textarea name="conditions" rows="2" maxlength="200"></textarea></label>
          <button class="primary" type="submit">この内容で手を挙げる</button>
        </form>`;
    }
    slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
    slot.querySelector('input').focus({ preventScroll: true });
  }
});

document.addEventListener('submit', (e) => {
  const tf = e.target.closest('form.teach');
  if (tf) {
    e.preventDefault();
    const fd = new FormData(tf);
    const date = String(fd.get('date') || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const added = store.get('teachAdded', []);
    added.push({
      id: `local-${Date.now()}`, date,
      role: String(fd.get('role')), teacher: String(fd.get('teacher')), partner: String(fd.get('partner')),
      what: String(fd.get('what') || '').trim(), teacherOk: false, teamOk: false,
    });
    store.set('teachAdded', added);
    location.hash = `#/teach/${monthOf(date)}`;
    if (monthOf(date) === tf.dataset.month) route();
    return;
  }
  const form = e.target.closest('form.raise');
  if (!form) return;
  e.preventDefault();
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  if (!name) return;
  const added = store.get('addedHands', []);
  added.push({ card: form.dataset.card, name, conditions: String(fd.get('conditions') || '').trim() });
  store.set('addedHands', added);
  renderCard(form.dataset.card);
  document.querySelector('.hands')?.scrollIntoView({ block: 'start' });
});

window.addEventListener('hashchange', route);
if (store.get('bigText', false)) document.body.classList.add('big');

load().then(route).catch((err) => {
  view.innerHTML = `<p>${esc(err.message)}</p>`;
});
