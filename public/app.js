// ジビエつなぎ：画面の切り替えと表示。
// AI は人を選ばない・順位をつけない。手を挙げた人の並びは、手を挙げた順のまま。
import { ICON, ROLE_ICON } from './icons.js';
import { ctx, view, tabsEl as tabs, store, esc, strip, icon, roleIcon, renderTop, SR, speak, dayLabel, todayStr, downloadCsv as saveCsv, toast, voice, aiTag, dateStr, AI, loadAi, askAi, recSeg } from './ui.js';
import { countDistrict, townRows, townTotals } from './lib/town.js';
import { monthOf, shiftMonth, monthLabel, recordsForMonth, summarizeByTeacher, toCsv } from './lib/teach.js';
import { districtTotals, fmtDateTime } from './lib/log.js';
import { splitHealth } from './lib/watch.js';
import { stepCoverage, nextQuestion, splitTejun, stepSentences } from './lib/kikikata.js';
import { toCsvText } from './lib/csv.js';
import { logs, reports, markSpoke, handsFor, teamRows, teamRisks, scene } from './model.js';
import { SCOPES, scopeOf, scopeLabel, teamTalks, talksCsv } from './lib/talks.js';
import { renderMap, leaveMap, mapClick, mapChange, mapSubmit, showParse } from './screens/map.js';
import { renderLog, logClick, logChange, logSubmit, showLogParse, renderReport, reportClick, reportSubmit } from './screens/log.js';
import { renderWatch, watchClick } from './screens/watch.js';
import { renderImpact, impactPointer } from './screens/impact.js';
import { change, monthShort } from './lib/impact.js';

let data;

async function load() {
  const res = await fetch('/api/team');
  if (!res.ok) throw new Error('データを読めませんでした');
  data = ctx.data = await res.json();
  await loadAi();
}

// ---------- 上の帯と下のタブ ----------
// 下のタブは4つ。「止まる役割」「募集」はチームの中から、「教えた記録」は記録の中の切り替えから
const TABS = [
  { id: 'talk', label: '話す', icon: 'mic' },
  { id: 'map', label: 'わな', icon: 'pin' },
  { id: 'team', label: 'チーム', icon: 'team' },
  { id: 'log', label: '記録', icon: 'doc' },
];

function renderTabs(current) {
  tabs.innerHTML = TABS.map((t) =>
    `<a href="#/${t.id}" ${t.id === current ? 'aria-current="page"' : ''}>${icon(t.icon)}${t.label}</a>`).join('');
}

function licensePill(license, { big = false, sm = false } = {}) {
  const text = license === 'no_license' && big ? '資格なしで今日から始められます' : data.licenseLabels[license] || '要確認';
  return `<span class="pill ${esc(license)}${big ? ' big' : ''}${sm ? ' sm' : ''}">${esc(text)}</span>`;
}

// ---------- 2 チームの表 ----------
// 今朝、ベテランと新しく入った人が二人で向かったわな（出動の記録から）
function todayPairs() {
  const today = todayStr();
  return logs().filter((r) => r.kind === '出動' && r.with && r.datetime && dateStr(new Date(r.datetime)) === today);
}

function renderTeam() {
  renderTop();
  const rowsNow = teamRows();
  const ok = rowsNow.filter((r) => r.coverage === 'ok').length;
  const total = rowsNow.length;
  const left = total - ok;
  const areaName = strip(data.area.name);
  const heard = new Map(stepCoverage(teamTexts(), rowsNow.map((r) => r.role)).map((c) => [c.step, c.heard]));
  const nHeard = [...heard.values()].filter(Boolean).length;
  const pairs = todayPairs();
  const rows = rowsNow.map((r, i) => {
    const who = r.people.map((p) => `<span class="av${r.added?.includes(p) ? ' new' : ''}"><b>${esc(p.slice(0, 1))}</b>${esc(p)}</span>`).join('');
    const pill = r.coverage === 'single' ? '<span class="pill">1人だけ</span>' : r.coverage === 'empty' ? '<span class="pill">空き</span>' : '';
    const words = heard.get(r.role);
    const no = words
      ? `<button class="no on" data-step="${esc(r.role)}" aria-expanded="${openStep === r.role}" aria-label="${esc(r.role)}で残った言葉を読む" title="押すと、この工程で残った本人の言葉が読めます">${i + 1}</button>`
      : `<span class="no">${i + 1}</span>`;
    return `<li class="trow">
      ${no}
      <div><div class="role">${esc(r.role)}</div><div class="lic">${licensePill(r.license, { sm: true })}</div></div>
      <div class="who">${who}${pill}</div>
    </li>`;
  }).join('');
  // 今日あったこと（表の高さを変えないよう、表の下に出す）
  const todayNotes = [
    ...pairs.map((x) => `今朝、${x.trapNo}番のわなに${x.by}さんと${x.with}さんの二人で向かいました`),
    ...rowsNow.filter((r) => r.added?.length).map((r) => `「${r.role}」に、チームで決めて${r.added.join('・')}さんが入りました`),
  ];
  // 先頭の一行：止まる役割（人数から作る文だけ。AI は使わない）
  const risks = teamRisks();
  const stopLine = risks.length
    ? risks.map((r) => `${r.role.replace(/（.*?）/, '')}（${r.coverage === 'empty' ? '担当なし' : `${r.person}さん1人だけ`}）`).join('・')
    : 'なし（すべての工程に2人以上）';
  const checks = store.get('goalChecks', {});
  const manual = data.goal.checks.filter((c) => !c.auto).map((c) => `
    <div class="check"><button data-goal="${esc(c.id)}" aria-pressed="${!!checks[c.id]}" aria-label="${esc(c.label)}">✓</button><span>${esc(c.label)}</span></div>`).join('');

  view.innerHTML = `
    <h1>${esc(areaName)}のチーム</h1>
    <a class="stop-line" href="#/risk"><span class="k">${icon('alert')}止まる役割</span><span class="v">${esc(stopLine)}</span>${ICON.next}</a>
    <button class="outline wide" data-go="cards" style="margin:0 0 18px">${icon('card')}募集カードを出す</button>
    <p class="goal-head">名産として出せる状態まで</p>
    <p class="goal-num">${left === 0 ? 'そろいました' : `あと${left}<small>つ</small>`}</p>
    <div class="segments" style="grid-template-columns:repeat(${total},1fr)" role="img" aria-label="2人以上いる工程 ${ok}/${total}">
      ${Array.from({ length: total }, (_, i) => `<i class="${i < ok ? 'on' : ''}"></i>`).join('')}
    </div>
    <div class="exp-line"><span>ベテランの経験が本人の言葉で残った工程</span><b>${nHeard}<small>/${total}</small></b></div>
    <ul class="table">
      <li class="head"><span>工程<em><i class="no-dot"></i>＝言葉が残った工程（押すと読める）</em></span><span>担当</span></li>
      ${rows}
    </ul>
    <section id="step-panel">${stepPanelHtml()}</section>
    ${todayNotes.length ? `<ul class="today-notes">${todayNotes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <p class="muted">${esc(data.licenseCheckNote)}</p>
    <p class="muted" style="margin-top:-4px">番号が緑の工程は、話す画面で残した話にその工程が出てきた印です。押すと、その工程で残った本人の言葉が読めます。人名・数は架空のデモです。</p>
    <section class="checks">
      <h3>ほかにチームが確かめること</h3>
      ${manual}
      <p class="muted" style="margin:6px 0 8px">印はチームが付けます。AI は判定しません。</p>
    </section>
    <figure class="photo">
      <img src="/img/photo_03_shokudo.jpg" alt="山あいの食堂に並ぶ鹿肉の煮込み定食（AI で生成した架空の場面）" loading="lazy">
      <figcaption>ゴール：地域の名産として出せる状態。この先に、新しく入る人が増える・農村の被害が減る・ジビエが普段の食べものになる。（写真は AI で生成した架空の場面）</figcaption>
    </figure>
    <a class="goal-link" href="#/impact" style="margin-top:20px">
      <span class="gl-k">目的：害獣の被害を減らす</span>
      <span class="gl-v"><span>町と同じ数（捕獲・見回り・住民の知らせ）を、月ごとに見る</span></span>
      <span class="gl-go">見える化を見る ${ICON.next}</span>
    </a>
    <button class="outline wide" data-go="watch" style="margin-top:4px">${icon('clock')}見守り（話していない日が続いたら知らせる）</button>
    <button class="outline wide" data-go="town" style="margin-top:12px">${icon('town')}町の地区一覧（町の担当の方向け）</button>
    <button class="outline wide" data-go="report" style="margin-top:12px">${icon('chat')}見かけたら知らせる（住民の方の画面）</button>
    <button class="link reset" data-scene="asa">撮影用：「ある朝」の最初の状態にする</button>
    <button class="link reset" data-reset style="margin-top:0">デモを最初の状態に戻す（この端末で足したものを消す）</button>`;
}

// 緑の番号を押したときに出る「この工程で残った言葉」（新しく入る人が、先輩の言葉を工程ごとに読める）
let openStep = null;
function stepPanelHtml() {
  if (!openStep) return '';
  const talks = teamTalks(savedTalks());
  const sp = stepSentences(talks.map((t) => ({ text: t.text, ai: aiCache.split.get(t.id) || null })), openStep);
  if (!sp.tejun.length && !sp.chui.length) return '';
  const who = [...new Set(talks.map((t) => t.who))].join('・');
  const li = (list) => list.map((t) => `<li>${esc(t)}</li>`).join('') || '<li class="muted">（なし）</li>';
  return `<div class="step-panel">
    <div class="sp-head"><b>「${esc(openStep)}」で残った言葉</b><span class="muted">${esc(who)}さん・本人の言葉のまま</span><button class="outline sm" data-step-close>閉じる</button></div>
    <div class="split"><div><h4>手順</h4><ul>${li(sp.tejun)}</ul></div><div class="c"><h4>注意</h4><ul>${li(sp.chui)}</ul></div></div>
    <div class="ask-foot"><button class="say" data-say-step>${icon('speaker')}声で聞く</button><a href="#/talk">この工程を深く聞く →</a>${aiTag('整理', 'seiri')}</div>
    <p class="muted" style="margin:6px 0 0">${AI.connected ? 'Claude が工程ごとに割り当てた文です（本人の言葉のまま）。' : '言葉の照らし合わせで集めた文です。'}やり方として正しいかは、このアプリは答えません。新しく入る人は、先輩と二人で確かめてください。</p>
  </div>`;
}
function showStepPanel() {
  const el = document.getElementById('step-panel');
  if (!el) return;
  ensureSplits(teamTalks(savedTalks()), () => { if (document.getElementById('step-panel')) document.getElementById('step-panel').innerHTML = stepPanelHtml(); });
  el.innerHTML = stepPanelHtml();
  document.querySelectorAll('button.no.on').forEach((b) => b.setAttribute('aria-expanded', String(b.dataset.step === openStep)));
  if (openStep) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  for (const r of teamRisks()) {
    if (r.person) byPerson.set(r.person, [...(byPerson.get(r.person) || []), r]);
    else empty.push(r);
  }
  let html = '';
  for (const [person, list] of byPerson) html += `<h1>${esc(person)}さんが休むと<br>止まる役割</h1>${list.map(card).join('')}`;
  if (empty.length) html += `<h2>担当がいない役割</h2>${empty.map(card).join('')}`;
  view.innerHTML = `${html}
    <div class="pending">Claude をつなぐと、ベテランの話から理由が足されます（例：店の連絡先を岩田さんしか知らない）。準備中。</div>
    <button class="outline wide" data-go="watch" style="margin-top:16px">${icon('clock')}見守り：話していない日が続いたら知らせる</button>`;
}

// ---------- 4 募集カード（一覧） ----------
function renderCards() {
  renderTop({ back: '#/team', here: '募集' });
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
        const next = isDecided ? `<div class="next-step"><b>次の一歩</b><a href="#/team">先輩の言葉を工程ごとに読む（チームの表の緑の番号）</a><a href="#/teach">先輩と二人でやった日は「教えた記録」に残る</a><span class="muted">やり方や資格の決まりは、先輩と県の窓口で確かめる（要確認）</span></div>` : '';
        return `<div class="hand">
          <span class="name">${esc(strip(h.name))}さん</span>${isDecided ? '<span class="decided">チームで決定</span>' : ''}${h.since ? `<span class="muted">（${esc(dayLabel(h.since))}に手を挙げた）</span>` : ''}${h.local ? '<span class="muted">（この端末で追加）</span>' : ''}
          <div class="cond">本人が書いた条件：${esc(h.conditions) || '（なし）'}</div>
          <button class="outline sm" data-decide="${esc(key)}">${isDecided ? '決定を取り消す' : 'チームで話して、お願いする'}</button>
          ${next}
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
let rec = null;          // 声の聞き取り（ブラウザの音声入力）
let heard = '';          // まだ残していない言葉
let listening = false;
let healthDropped = 0;   // 残さなかった体のぐあいの話の文の数（中身は持たない）

function savedTalks() {
  const t = data.veteranTalk;
  const scopes = store.get('talkScope', {});
  const hidden = store.get('talkHidden', {});
  // 新しい話から上に。使ってよい範囲（本人が決める）と、本人が消した話を重ねる
  return [
    ...store.get('talks', []).map((x) => ({ ...x, local: true })).reverse(),
    ...(scene()?.hideTalk ? [] : [{ id: 'prepared', who: strip(t.speaker).split('（')[0], date: t.date, text: t.text }]),
  ].filter((x) => !hidden[x.id]).map((x) => ({ ...x, scope: scopes[x.id] || x.scope || 'team' }));
}

// 本人の画面（話す）では全部。チームの表・町の数・工程ごとの言葉は、本人が「チームの中で使ってよい」とした話だけ
function talkTexts() {
  return savedTalks().map((x) => x.text);
}
function teamTexts() {
  return teamTalks(savedTalks()).map((x) => x.text);
}

function renderTalk() {
  renderTop();
  const steps = data.rows.map((r) => r.role);
  const cover = stepCoverage(talkTexts(), steps);
  const q = nextQuestion(talkTexts(), steps);
  const missing = cover.filter((c) => !c.heard);
  const talks = savedTalks().map((x) => {
    const sp = aiCache.split.get(x.id) || splitTejun(x.text);
    return `
    <div class="quote">
      <div class="who-line">${esc(x.who)}さん・${esc(x.date)}${x.local ? '（この端末で残した話）' : ''}</div>
      <p class="said">${esc(x.text)}</p>
      <div class="split" data-split="${esc(x.id)}">${splitHtml(sp)}</div>
      <div class="ask-foot"><button class="say" data-say="${esc(x.id)}">${icon('speaker')}声で聞く</button>${aiTag('整理', 'seiri')}</div>
      <div class="scope-row">
        <label>使ってよい範囲（本人が決める）<select data-scope="${esc(x.id)}">${SCOPES.map((s) => `<option value="${s.id}"${scopeOf(x) === s.id ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
        <button class="link" data-talk-del="${esc(x.id)}">この話を消す</button>
      </div>
    </div>`;
  }).join('');
  const qKey = questionKey();
  const qShown = aiCache.q.get(qKey) || q;

  const nHeard = cover.filter((c) => c.heard).length;
  view.innerHTML = `
    <h1>話す</h1>
    <p class="talk-lead">いつもの言葉で。方言のままで大丈夫。</p>
    <p class="talk-progress">本人の言葉で残った工程 <b>${nHeard}</b><small>/${steps.length}</small><span>${nHeard === steps.length ? '全部そろいました' : `あと${steps.length - nHeard}つ`}</span></p>
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
    ${healthDropped ? `<div class="hnote">体のぐあいの話（${healthDropped}文）は残しませんでした。見守りは、話した日だけを見ます。</div>` : ''}
    <p class="muted">ログインはありません。チームが渡すリンクを開くだけです。若い人が横でスマホを持って聞き取ってもかまいません。方言も言い直しも、そのまま残します。体のぐあいの話は残しません。</p>
    <h2 id="talks">残した話</h2>
    <p class="muted" style="margin-top:-6px">残した話は、話した本人のものです。使ってよい範囲は本人が決め、アプリや AI は勝手に広げません・言葉を足しません。</p>
    ${talks || '<p class="muted">まだありません。</p>'}
    ${savedTalks().length ? `<button class="outline wide" data-talks-csv>${icon('doc')}話を書き出す（CSV・誰がいつ話したかを付ける）</button>` : ''}
    <section class="ask" data-q="${esc(qKey)}">
      <h3>次に聞くこと（1つだけ）</h3>
      <p class="said" id="q-text">${esc(qShown.text)}</p>
      <p class="muted" id="q-said" style="margin:-4px 0 8px"${qShown.said ? '' : ' hidden'}>「${esc(qShown.said || '')}」の、どのくらいを聞きます。</p>
      <div class="ask-foot"><button class="say" data-say-q>${icon('speaker')}声で聞く</button><span class="muted">聞き方の型：<span id="q-kata">${esc(qShown.kata)}</span></span>${aiTag('聞き返し', 'kikikaeshi', '＋聞き方の型')}</div>
      <form class="answer" data-answer><label>答える（話すか、文字で）</label>${voiceFieldLite('answer-text')}<button class="outline wide" type="submit">この答えを残す</button></form>
      <h3 style="margin-top:14px">まだ聞けていない工程</h3>
      <div class="steps">${cover.map((c) => `<span class="stp${c.heard ? ' on' : ''}">${c.heard ? '✓ ' : ''}${esc(c.step)}</span>`).join('')}</div>
      <p class="muted" style="margin:8px 0 0">${missing.length ? `${missing.length}つの工程が、まだ話に出ていません。` : 'すべての工程が話に出ました。次は、深く聞きます。'}今は言葉の照らし合わせで出しています。Claude をつなぐと、聞き方の型（失敗談・見分け方・どのくらい・昔と今・新人の間違い・話の食い違い）で、話の中身から1つだけ聞き返します。</p>
    </section>
    <p class="muted">${AI.connected
      ? '手順と注意は Claude が分けました。文は本人の言葉のままで、言い換えも足しもしません（型を守れていない返事は使わず、見本に戻します）。'
      : '手順と注意は、今は言葉の照らし合わせで分けた見本です（本人の言葉のまま・言い換えない）。Claude をつなぐと、Claude が分けます。'}</p>`;
  enrichTalk();
}

// ---------- Claude につながっているとき：残した話の整理と聞き返しを、Claude のものに差し替える ----------
// 画面はまず見本（言葉の照らし合わせ）で出し、Claude の返事が届いたら置き換える。返事が型を守れていなければ見本のまま。
const aiCache = { split: new Map(), q: new Map() };
const splitHtml = (sp) => {
  const li = (list) => list.map((t) => `<li>${esc(t)}</li>`).join('') || '<li class="muted">（なし）</li>';
  return `<div><h4>手順</h4><ul>${li(sp.tejun)}</ul></div><div class="c"><h4>注意</h4><ul>${li(sp.chui)}</ul></div>`;
};
const questionKey = () => {
  const texts = talkTexts();
  return `${texts.length}-${texts.join('\n').length}`;
};
// 残した話の整理（手順・注意・工程）を Claude に頼んで cache に入れる。届いたら onDone
function ensureSplits(talks, onDone) {
  if (!AI.connected) return;
  const steps = data.rows.map((r) => r.role);
  for (const x of talks) {
    if (aiCache.split.has(x.id)) continue;
    aiCache.split.set(x.id, null); // 頼んだ印（二重に頼まない）
    askAi('seiri', { text: x.text, steps }).then((sp) => {
      aiCache.split.set(x.id, { tejun: sp.tejun, chui: sp.chui, koutei: sp.koutei || {} });
      onDone?.(x.id, sp);
    }).catch(() => aiCache.split.delete(x.id));
  }
}
function enrichTalk() {
  if (!AI.connected) return;
  ensureSplits(savedTalks(), (id, sp) => {
    const el = document.querySelector(`[data-split="${CSS.escape(id)}"]`);
    if (el) el.innerHTML = splitHtml(sp);
  });
  const key = questionKey();
  if (aiCache.q.has(key)) return;
  aiCache.q.set(key, null);
  askAi('kikikaeshi', { texts: talkTexts(), steps: data.rows.map((r) => r.role) }).then((q) => {
    aiCache.q.set(key, q);
    const sec = document.querySelector('.ask');
    if (!sec || sec.dataset.q !== key) return;
    document.getElementById('q-text').textContent = q.text;
    document.getElementById('q-kata').textContent = q.kata;
    const said = document.getElementById('q-said');
    said.hidden = !q.said;
    said.textContent = q.said ? `「${q.said}」の、どのくらいを聞きます。` : '';
  }).catch(() => aiCache.q.delete(key));
}

// 答える欄（話す画面の聞き返しの下）
const voiceFieldLite = (id) => `
  <div class="vfield">
    <button type="button" class="vmic${SR ? '' : ' off'}" data-voice="${esc(id)}" aria-pressed="false" aria-label="押して話す">${ICON.mic}<span>${SR ? '押して話す' : '声は使えません'}</span></button>
    <textarea class="talk" id="${esc(id)}" rows="2" maxlength="600" placeholder="例：一時間のうちには冷やし始める。"></textarea>
  </div>`;

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
  // 体のぐあいの話の文は残さない（数だけ伝え、中身は持たない）
  const { kept, dropped } = splitHealth(String(text || '').trim());
  healthDropped = dropped.length;
  heard = '';
  const who = strip(data.veteranTalk.speaker).split('（')[0];
  if (kept) {
    const talks = store.get('talks', []);
    talks.push({ id: `talk-${Date.now()}`, who, date: todayStr(), text: kept });
    store.set('talks', talks);
    markSpoke(who);
  }
  renderTalk();
  // 残した話（手順と注意に分かれたところ）が見える所まで動く
  if (kept) document.getElementById('talks')?.scrollIntoView({ block: 'start' });
  healthDropped = 0;
}

// ---------- 5 教えた記録 ----------
// 一緒にやった日・工程・相手を残し、ベテラン本人とチームが「はい」で確かめる。
// 金額は決めない・お金は動かさない・教え方に点数をつけない。
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

  // 画面では新しい日を上に（印刷と CSV は日付の順）
  const recHtml = [...list].reverse().map((r) => `
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
      ${recSeg('teach')}
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
  saveCsv(`教えた記録_${month}.csv`, toCsv(recordsForMonth(teachRecords(), month)));
}

// ---------- 6 町の画面（町の担当の方向け） ----------
// 地区ごとの数だけを出す。個人名は出さない。
// 町の担当の方は月ごと（または全部）で数を見る。month＝"2026-11"／"all"
function townMonth(arg) {
  return arg === 'all' ? 'all' : /^\d{4}-\d{2}$/.test(arg || '') ? arg : monthOf(todayStr());
}
function townLive(month) {
  const m = month === 'all' ? null : month;
  return {
    ...districtTotals(logs(), data.homeDistrict, m),
    reports: reports().filter((r) => r.district === data.homeDistrict && (!m || String(r.datetime || '').startsWith(m))).length,
  };
}
function renderTown(arg) {
  renderTop({ back: '#/team', here: '町の地区一覧' });
  const month = townMonth(arg);
  const monthText = month === 'all' ? 'すべての月' : monthLabel(month);
  const rowsNow = teamRows();
  // チームの表と同じ数え方（話す画面で残した話に、その工程の言葉が出てきたか）
  const heardSteps = stepCoverage(teamTexts(), rowsNow.map((r) => r.role)).filter((c) => c.heard).map((c) => c.step);
  const live = {
    ...countDistrict({
      rows: rowsNow,
      cards: data.cards.map((c) => ({ hands: handsFor(c) })),
      records: teachRecords(),
      experienceRoles: heardSteps,
    }),
    ...townLive(month),
  };
  const rows = townRows(data.town.districts, live);
  const totals = townTotals(rows);
  // チームがまだ確かめていない・出していない記録（数には入っていない）
  const pending = logs().filter((r) => r.district === data.homeDistrict && !(r.teamOk && r.sent) && (month === 'all' || !r.datetime || monthOf(fmtDateTime(r.datetime)) === month)).length;
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
      <div class="tgrid sub">
        ${num(d.deer, '頭', 'シカ')}
        ${num(d.boar, '頭', 'イノシシ')}
        ${num(d.patrol, '回', '見回り')}
        ${num(d.reports, '件', '住民の知らせ')}
      </div>
    </article>`).join('');
  const trow = (r, th = 'td') => `<tr><${th}>${esc(r.name)}</${th}><td>${r.deer}</td><td>${r.boar}</td><td>${r.patrol}</td><td>${r.reports}</td></tr>`;
  const sumTable = `<table class="sum"><thead><tr><th>地区</th><th>シカ（頭）</th><th>イノシシ（頭）</th><th>見回り（回）</th><th>住民の知らせ（件）</th></tr></thead>
    <tbody>${totals.rows.map((r) => trow(r)).join('')}${trow({ name: '合計', ...totals.total }, 'th')}</tbody></table>`;
  view.innerHTML = `
    <div class="no-print">
    <p class="kicker">町の担当の方向け</p>
    <h1>${esc(strip(data.town.name))}の<br>地区一覧</h1>
    <p class="lead">地区ごとの数だけを出します。個人名は出しません。</p>
    <div class="month">
      ${month === 'all' ? '<span></span>' : `<button class="mbtn" data-go="town/${shiftMonth(month, -1)}" aria-label="前の月">${ICON.back}</button>`}
      <b>${esc(monthText)}</b>
      ${month === 'all' ? '<span></span>' : `<button class="mbtn" data-go="town/${shiftMonth(month, 1)}" aria-label="次の月">${ICON.next}</button>`}
    </div>
    <p class="muted" style="margin:0 0 10px">シカ・イノシシ・見回り・住民の知らせは、${esc(monthText)}の数。役割・工程・手を挙げた人・教えた回数は今の状態です。
      <button class="link" data-go="town/${month === 'all' ? monthOf(todayStr()) : 'all'}" style="padding:4px 0">${month === 'all' ? '今月だけを見る' : 'すべての月を見る'}</button></p>
    ${cards}
    <ul class="notes">
      <li>北沢地区の数は、チームの表・募集カード・教えた記録・町へ出した記録から数えています。南沢・東原は画面を見せるための架空の見本の数で、月で変わりません。</li>
      <li>「経験が残った工程」は、話す画面で残した話にその工程の言葉が出てきた数です（チームの表と同じ。今は言葉の照らし合わせで、Claude をつなぐと工程ごとにまとめてから数えます）。</li>
      <li>シカ・イノシシ・見回りの数は、チームが確かめて「町へ出す」を押した記録だけを数えます。住民の知らせは件数だけです。</li>
      <li>計画の見直しや報告の材料に使えるかは、町の窓口で確かめてください（要確認）。</li>
    </ul>
    <a class="goal-link" href="#/impact" style="margin-top:20px"><span class="gl-k">目的：害獣の被害を減らす</span><span class="gl-v"><span>被害の知らせ・捕獲・見回りの移り変わりをグラフで見る</span></span><span class="gl-go">見える化 ${ICON.next}</span></a>
    <h2>県へ上げる数の下書き（${esc(monthText)}）</h2>
    <p class="muted" style="margin-top:-6px">地区ごとの数と合計です。個人名は出しません。交付金・報償金の対象かどうかと金額は判断しません。数に入るのは、チームが確かめて「町へ出す」を押した記録だけです。</p>
    ${pending ? `<p class="pending-note">${icon('clock')}北沢地区で、チームが確かめ中の記録が <b>${pending}件</b> あります（まだ数に入っていません）。</p>` : ''}
    <div class="tscroll">${sumTable}</div>
    <div class="row2">
      <button class="outline" data-print>印刷する</button>
      <button class="outline" data-town-csv="${esc(month)}">書き出す（CSV）</button>
    </div>
    </div>
    <section class="print-only">
      <h1>県へ上げる数の下書き　${esc(strip(data.town.name))}　${esc(monthText)}</h1>
      ${sumTable}
      <p>町の確認者（署名）＿＿＿＿＿＿＿＿＿＿　　確認日＿＿＿＿＿＿</p>
      <p class="small">チームが確かめて町へ出した記録の数です。町名・地区名・数はすべて架空のデモです。</p>
    </section>`;
}

function townCsv(month) {
  const { rows, total } = townTotals(townRows(data.town.districts, townLive(month)));
  const line = (r) => [r.name, r.deer, r.boar, r.patrol, r.reports];
  saveCsv(`県へ上げる数の下書き_${month === 'all' ? '全部' : month}.csv`, toCsvText(['地区', 'シカ（頭）', 'イノシシ（頭）', '見回り（回）', '住民の知らせ（件）'], [...rows.map(line), line({ name: '合計', ...total })]));
}

// ---------- 切り替え ----------
const LOCAL_KEYS = ['addedHands', 'decided', 'goalChecks', 'teachAdded', 'teachOk', 'talks', 'talkScope', 'talkHidden', 'trapOver', 'staleHours', 'logsAdded', 'logEdits', 'photos', 'reportsAdded', 'reportSeen', 'logColumns', 'spoke', 'watchSet', 'scene'];
function clearLocal() {
  for (const k of LOCAL_KEYS) {
    try { localStorage.removeItem(k); } catch { /* 使えない環境 */ }
  }
}
// 撮影用の「ある朝」：この端末で足したものを消してから、最初の状態にする。
// 画面の中に残る状態（模擬の知らせの番号・開いた時刻・話しかけの言葉）も戻すため、チームの表で読み込み直す
function startScene() {
  clearLocal();
  store.set('scene', 'asa');
  try { sessionStorage.setItem('sceneMsg', '撮影用の「ある朝」の最初の状態にしました。'); } catch { /* 使えない環境 */ }
  location.replace('#/team');
  location.reload();
}

function route() {
  const [name, arg] = (location.hash.replace(/^#\/?/, '') || 'team').split('/');
  // リンクを開いただけで消えないよう、必ず確かめてから
  if (name === 'asa') {
    if (confirm('この端末で足したものを消して、撮影用の「ある朝」の最初の状態にします。よろしいですか？')) { startScene(); return; }
    location.replace('#/team');
    return;
  }
  if (name !== 'talk') rec?.stop();
  voice.stop();
  try { speechSynthesis.cancel(); } catch { /* 読み上げなし */ }
  if (name !== 'map') leaveMap();
  document.body.classList.remove('has-cta');
  // タブのない画面は、つながっているタブを光らせる
  const parent = { teach: 'log', report: 'map', watch: 'team', town: 'team', impact: 'team', risk: 'team', cards: 'team' }[name];
  const tab = TABS.some((t) => t.id === name) ? name : parent || 'team';
  renderTabs(tab);
  if (name === 'cards' && arg) renderCard(arg);
  else if (name === 'teach') renderTeach(arg);
  else if (name === 'town') renderTown(arg);
  else if (name === 'log') renderLog(arg);
  else if (name === 'report') renderReport();
  else if (name === 'watch') renderWatch();
  else if (name === 'impact') renderImpact();
  else (({ team: renderTeam, risk: renderRisk, cards: renderCards, talk: renderTalk, map: renderMap })[name] || renderTeam)();
  window.scrollTo(0, 0);
}

// ボタンの動き（画面を描き直しても効くよう、まとめて受ける）
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { location.hash = `#/${go.dataset.go}`; return; }
  if (mapClick(e) || logClick(e) || reportClick(e) || watchClick(e) || impactPointer(e)) return;

  // 地図・記録・住民の知らせの「押して話す」
  const vb = e.target.closest('[data-voice]');
  if (vb) {
    const field = document.getElementById(vb.dataset.voice);
    voice.toggle(vb, field, () => { if (vb.dataset.voice === 'patrol-text') showParse(); if (vb.dataset.voice === 'log-text') showLogParse(); });
    return;
  }
  if (e.target.closest('[data-say-q]')) {
    speak(document.getElementById('q-text')?.textContent || '', e.target.closest('[data-say-q]'));
    return;
  }
  const tcsv = e.target.closest('[data-town-csv]');
  if (tcsv) { townCsv(townMonth(tcsv.dataset.townCsv)); return; }
  if (e.target.closest('[data-talks-csv]')) { saveCsv(`残した話_${todayStr()}.csv`, talksCsv(savedTalks())); return; }
  const del = e.target.closest('[data-talk-del]');
  if (del) {
    if (!confirm('この話を消します。消すのは本人（話した人）だけです。よろしいですか？')) return;
    const hidden = store.get('talkHidden', {});
    hidden[del.dataset.talkDel] = true;
    store.set('talkHidden', hidden);
    renderTalk();
    return;
  }
  if (e.target.closest('[data-reset]')) {
    if (!confirm('この端末で足した記録・押した「はい」・設定を消して、デモを最初の状態に戻します。よろしいですか？')) return;
    clearLocal();
    toast('デモを最初の状態に戻しました。');
    route();
    return;
  }

  if (e.target.closest('[data-scene]')) {
    if (!confirm('この端末で足したものを消して、撮影用の「ある朝」の最初の状態にします。よろしいですか？')) return;
    startScene();
    return;
  }

  const stepBtn = e.target.closest('[data-step]');
  if (stepBtn) { openStep = openStep === stepBtn.dataset.step ? null : stepBtn.dataset.step; showStepPanel(); return; }
  if (e.target.closest('[data-step-close]')) { openStep = null; showStepPanel(); return; }
  if (e.target.closest('[data-say-step]')) {
    const sp = stepSentences(teamTalks(savedTalks()).map((t) => ({ text: t.text, ai: aiCache.split.get(t.id) || null })), openStep || '');
    speak([...sp.tejun, ...sp.chui].join(''), e.target.closest('[data-say-step]'));
    return;
  }
  // 「チームが確かめること」は、文字の所を押しても印が付く
  const crow = e.target.closest('.check');
  if (crow && !e.target.closest('[data-goal]')) { crow.querySelector('[data-goal]')?.click(); return; }
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
  if (mapSubmit(e) || logSubmit(e) || reportSubmit(e)) return;
  if (e.target.closest('[data-answer]')) {
    e.preventDefault();
    voice.stop();
    const text = document.getElementById('answer-text')?.value;
    if (String(text || '').trim()) saveTalk(text);
    return;
  }
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

document.addEventListener('change', (e) => {
  const sc = e.target.closest('[data-scope]');
  if (sc) {
    const scopes = store.get('talkScope', {});
    scopes[sc.dataset.scope] = sc.value;
    store.set('talkScope', scopes);
    toast(`この話の範囲を「${scopeLabel(sc.value, true)}」にしました。`);
    return;
  }
  if (mapChange(e)) return;
  logChange(e);
});
// 文字で入れたときも、拾えたものを見せ直す
document.addEventListener('input', (e) => {
  if (e.target.id === 'patrol-text') showParse();
  if (e.target.id === 'log-text') showLogParse();
});

window.addEventListener('hashchange', route);
if (store.get('bigText', false)) document.body.classList.add('big');

// 電波のない所（山の中）でも開けるように、画面のファイルを端末に残す。記録はもともと端末の中
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { /* 使えない環境 */ });
function showOffline() {
  let el = document.getElementById('offline');
  if (navigator.onLine) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('p');
    el.id = 'offline';
    el.className = 'offline';
    el.setAttribute('role', 'status');
    el.textContent = '今は電波がありません。話した言葉や記録はこの端末に残り、つながってからも同じように使えます。';
    document.body.insertBefore(el, document.getElementById('view'));
  }
}
window.addEventListener('online', showOffline);
window.addEventListener('offline', showOffline);
showOffline();

load().then(() => {
  route();
  // 撮影用の最初の状態にしたあとの読み込み直しなら、知らせを出す
  try {
    const m = sessionStorage.getItem('sceneMsg');
    if (m) { sessionStorage.removeItem('sceneMsg'); toast(m); }
  } catch { /* 使えない環境 */ }
}).catch((err) => {
  view.innerHTML = `<p>${esc(err.message)}</p>`;
});
