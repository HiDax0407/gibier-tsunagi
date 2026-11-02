// ジビエつなぎ：画面の切り替えと表示。
// AI は人を選ばない・順位をつけない。手を挙げた人の並びは、手を挙げた順のまま。
const view = document.getElementById('view');
const MARK = { empty: '×', single: '△', ok: '○' };
const STATE_TEXT = { empty: '空き', single: '1人だけ', ok: '2人以上' };

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
const strip = (name) => name.replace(/（架空）/g, '').trim();

let data;

async function load() {
  const res = await fetch('/api/team');
  if (!res.ok) throw new Error('データを読めませんでした');
  data = await res.json();
  document.getElementById('area').textContent = data.area.name;
}

function licenseBadge(license) {
  return `<span class="badge ${esc(license)}">${esc(data.licenseLabels[license] || '要確認')}</span>`;
}

function goalBlock() {
  const { ok, total } = data.goal.progress;
  const checks = store.get('goalChecks', {});
  const items = data.goal.checks.map((c) => {
    if (c.auto) {
      const done = ok === total;
      return `<li class="${done ? 'done' : ''}"><span class="box">${done ? '✓' : ''}</span><span>${esc(c.label)}（今 ${ok}/${total} 工程）</span></li>`;
    }
    const done = !!checks[c.id];
    return `<li class="${done ? 'done' : ''}"><button class="box" data-goal="${esc(c.id)}" aria-pressed="${done}" aria-label="${esc(c.label)}をチームが確認した">${done ? '✓' : ''}</button><span>${esc(c.label)}</span></li>`;
  });
  return `
    <section class="goal">
      <div class="label">ゴール</div>
      <div class="title">${esc(data.goal.title)}</div>
      <div class="bar" role="img" aria-label="2人以上いる工程 ${ok}/${total}"><i style="width:${Math.round((ok / total) * 100)}%"></i></div>
      <ul>${items.join('')}</ul>
      <p class="muted">印はチームが確認して付けます（AI は判定しません）。この先：${data.goal.next.map(esc).join('・')}</p>
    </section>`;
}

function renderTeam() {
  const rows = data.rows.map((r) => `
    <li class="row">
      <div class="mark" aria-label="${STATE_TEXT[r.coverage]}">${MARK[r.coverage]}</div>
      <div>
        <div class="role">${esc(r.role)}</div>
        <div class="plain">${esc(r.plain)}</div>
        <div class="people">${r.people.length ? r.people.map((p) => esc(p) + 'さん').join('・') : '<b>担当なし</b>'}</div>
      </div>
      <div class="meta">
        <span class="badge state-${r.coverage}">${STATE_TEXT[r.coverage]}</span>
        ${licenseBadge(r.license)}
      </div>
    </li>`).join('');
  view.innerHTML = `
    <h1>チームの表</h1>
    <p class="lead">工程ごとに、今だれが担っているか。1人だけ・空きの工程は、その人が休むと止まります。</p>
    ${goalBlock()}
    <div class="legend"><span>○ 2人以上</span><span>△ 1人だけ</span><span>× 空き</span></div>
    <ul class="rows">${rows}</ul>
    <p class="muted">${esc(data.licenseCheckNote)}</p>`;
}

function renderRisk() {
  const items = data.risks.map((r) => `
    <div class="risk">
      <div class="role">${MARK[r.coverage]} ${esc(r.role)}</div>
      <div class="reason">${esc(r.reason)}</div>
    </div>`).join('');
  view.innerHTML = `
    <h1>この人が倒れたら止まる役割</h1>
    <p class="lead">並べているのは役割だけです。人には順位をつけません。</p>
    ${items}
    <div class="pending">Claude をつなぐと、ベテランの話から理由が足されます（例：店の連絡先を岩田さんしか知らない）。準備中。</div>
    <div class="actions"><button class="primary" data-go="cards">募集カードを見る</button></div>`;
}

function handsFor(card) {
  const added = store.get('addedHands', []).filter((h) => h.card === card.id);
  return [...card.hands, ...added.map((h) => ({ ...h, local: true }))];
}

function renderCards() {
  const decided = store.get('decided', {});
  const cards = data.cards.map((c) => {
    const hands = handsFor(c);
    const handList = hands.length
      ? hands.map((h) => {
          const key = `${c.id}:${h.name}`;
          const isDecided = !!decided[key];
          return `<div class="hand">
            <span class="name">${esc(strip(h.name))}さん</span>${isDecided ? '<span class="decided">チームで決定</span>' : ''}${h.local ? '<span class="muted">（この端末で追加）</span>' : ''}
            <div class="cond">本人が書いた条件：${esc(h.conditions) || '（なし）'}</div>
            <div class="actions"><button class="ghost small" data-decide="${esc(key)}">${isDecided ? '決定を取り消す' : 'チームで話して、お願いする'}</button></div>
          </div>`;
        }).join('')
      : '<p class="muted">まだ手は挙がっていません。</p>';
    const path = c.path.map((p) => `<li><span class="step">${esc(p.step)}</span>${esc(p.text)}</li>`).join('');
    return `
      <article class="card" id="card-${esc(c.id)}">
        ${licenseBadge(c.license)}
        <div class="role">${esc(c.role)}</div>
        <p class="why">${esc(c.why_now)}</p>
        <dl>
          <dt>いつ</dt><dd>${esc(c.when)}</dd>
          <dt>どうやって</dt><dd>${esc(c.how)}</dd>
          <dt>向く人</dt><dd>${esc(c.fits)}</dd>
        </dl>
        <h3 style="font-size:14px;margin:12px 0 0">一人前までの道のり</h3>
        <ol class="path">${path}</ol>
        ${c.license === 'needs_check' ? `<p class="check-note">${esc(data.licenseCheckNote)}</p>` : ''}
        <div class="hands">
          <h3>手を挙げた人（手を挙げた順）</h3>
          ${handList}
          <div class="actions"><button class="primary" data-raise="${esc(c.id)}">この役割に手を挙げる</button></div>
          <div data-form="${esc(c.id)}"></div>
        </div>
      </article>`;
  }).join('');
  view.innerHTML = `
    <h1>募集カード</h1>
    <p class="lead">空いている役割と、1人だけの役割の募集です。見た人が自分で手を挙げ、決めるのはチームです。AI は人を評価しません。</p>
    ${cards}
    <p class="muted">カードの文は、Claude をつなぐ前の手書きの下書きです。</p>`;
}

function renderTalk() {
  const t = data.veteranTalk;
  view.innerHTML = `
    <h1>経験を集める</h1>
    <p class="lead">ベテランが話すだけで、工程ごとの「手順」と「注意（なぜそうするか）」にまとまります。本人の言葉のまま残し、AI は足しません。</p>
    <h2>これまでに聞いた話</h2>
    <div class="quote"><div class="who">${esc(strip(t.speaker))}さん・${esc(t.date)}</div>${esc(t.text)}</div>
    <h2>話す</h2>
    <textarea class="talk" rows="4" placeholder="声で話すか、ここに書いてください" disabled></textarea>
    <div class="actions"><button class="primary" disabled>話した内容をまとめる</button></div>
    <div class="pending" style="margin-top:12px">Claude をつなぐと、ここに工程ごとの「手順」と「注意」が並び、抜けている点を1つだけ聞き返します。準備中。</div>`;
}

const ROUTES = { team: renderTeam, risk: renderRisk, cards: renderCards, talk: renderTalk };

function route() {
  const name = (location.hash.replace('#/', '') || 'team').split('/')[0];
  const render = ROUTES[name] || renderTeam;
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.tab === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  render();
  window.scrollTo(0, 0);
}

// ボタンの動き（画面を描き直しても効くよう、まとめて受ける）
view.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { location.hash = `#/${go.dataset.go}`; return; }
  const goal = e.target.closest('[data-goal]');
  if (goal) {
    const checks = store.get('goalChecks', {});
    checks[goal.dataset.goal] = !checks[goal.dataset.goal];
    store.set('goalChecks', checks);
    return renderTeam();
  }
  const decide = e.target.closest('[data-decide]');
  if (decide) {
    const decided = store.get('decided', {});
    decided[decide.dataset.decide] = !decided[decide.dataset.decide];
    store.set('decided', decided);
    return renderCards();
  }
  const raise = e.target.closest('[data-raise]');
  if (raise) {
    const id = raise.dataset.raise;
    const slot = view.querySelector(`[data-form="${CSS.escape(id)}"]`);
    slot.innerHTML = `
      <form class="raise" data-card="${esc(id)}">
        <label>お名前<input name="name" required maxlength="40" autocomplete="off"></label>
        <label>動ける日・できること（自分で書く）<textarea name="conditions" rows="2" maxlength="200"></textarea></label>
        <div class="actions"><button class="primary" type="submit">手を挙げる</button></div>
      </form>`;
    slot.querySelector('input').focus();
  }
});

view.addEventListener('submit', (e) => {
  const form = e.target.closest('form.raise');
  if (!form) return;
  e.preventDefault();
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  if (!name) return;
  const added = store.get('addedHands', []);
  added.push({ card: form.dataset.card, name, conditions: String(fd.get('conditions') || '').trim() });
  store.set('addedHands', added);
  renderCards();
  document.getElementById(`card-${form.dataset.card}`)?.scrollIntoView({ block: 'start' });
});

window.addEventListener('hashchange', route);

load().then(route).catch((err) => {
  view.innerHTML = `<p>${esc(err.message)}</p>`;
});
