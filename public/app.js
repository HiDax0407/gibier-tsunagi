// ジビエつなぎ：画面の切り替えと表示。
// AI は人を選ばない・順位をつけない。手を挙げた人の並びは、手を挙げた順のまま。
import { ICON, ROLE_ICON } from './icons.js';

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
    top.innerHTML = `<span class="brand">ジビエつなぎ</span><span class="area">${esc(data.area.name)}</span>`;
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
    </figure>`;
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

// ---------- 1 経験を集める ----------
function renderTalk() {
  renderTop();
  const t = data.veteranTalk;
  view.innerHTML = `
    <h1>経験を集める</h1>
    <p class="lead" style="margin-top:-8px">ベテランが話すだけで、工程ごとの「手順」と「注意（なぜそうするか）」にまとまります。本人の言葉のまま残し、AI は足しません。</p>
    <div class="center">
      <button class="mic" disabled aria-label="話す（準備中）">${ICON.mic}</button>
      <div class="muted">ボタンを押して話す（準備中）</div>
    </div>
    <h2>これまでに聞いた話</h2>
    <div class="quote"><div class="who-line">${esc(strip(t.speaker))}さん・${esc(t.date)}</div>${esc(t.text)}</div>
    <div class="pending">Claude をつなぐと、ここに工程ごとの「手順」と「注意」が並び、抜けている点を1つだけ聞き返します。準備中。</div>`;
}

// ---------- 切り替え ----------
function route() {
  const [name, arg] = (location.hash.replace(/^#\/?/, '') || 'team').split('/');
  document.body.classList.remove('has-cta');
  const tab = TABS.some((t) => t.id === name) ? name : 'team';
  renderTabs(tab);
  if (name === 'cards' && arg) renderCard(arg);
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

load().then(route).catch((err) => {
  view.innerHTML = `<p>${esc(err.message)}</p>`;
});
