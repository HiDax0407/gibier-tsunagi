// 見守り：「◯日話していない」ときに、本人が決めた知らせ先（家族・チーム）へ知らせる設定だけ。
// 体調は AI が判断しない（医療の助言はしない）。健康の話は記録しない。
// 止まる役割の表とつなぐ：その人が休むと止まる役割を、すぐ見られるようにする。
import { ctx, view, esc, renderTop, dayLabel, dateStr } from '../ui.js';
import { lastSpoke, watchSettings, setWatch, OPENED } from '../model.js';
import { watchList } from '../lib/watch.js';

const DAYS = [2, 3, 5, 7];
const TO = ['家族', 'チーム'];

export function renderWatch() {
  renderTop({ back: '#/team', here: '見守り' });
  const people = ctx.data.watch.map((p) => p.name); // 名簿の順のまま
  const list = watchList(people, lastSpoke(), watchSettings(), Date.now());
  const singles = new Set(ctx.data.risks.filter((r) => r.person).map((r) => r.person));

  const cards = list.map((w) => {
    const last = w.last ? `${dayLabel(dateStr(new Date(w.last)))}${w.days === 0 ? '（今日）' : `（${w.days}日前）`}` : '記録なし';
    const setting = w.notify.length ? `${w.afterDays}日話していないとき → ${w.notify.join('・')}に知らせる` : '知らせない設定';
    return `
      <article class="watch${w.over ? ' over' : ''}">
        <div class="wh"><span class="av"><b>${esc(w.name.slice(0, 1))}</b></span><div><b>${esc(w.name)}さん</b><span>最後に話した日：${esc(last)}</span></div></div>
        ${w.over ? `<div class="walert">${w.days}日話していません。${esc(w.notify.join('と'))}に知らせます。<small>デモでは、この画面に出すだけです。</small></div>` : ''}
        <p class="wset">${esc(setting)}</p>
        ${singles.has(w.name) ? `<button class="outline sm" data-go="risk">${esc(w.name)}さんが休むと止まる役割を見る</button>` : ''}
        <details class="wedit"><summary>設定を変える（本人と家族・チームで決める）</summary>
          <div class="wrow">何日話していないとき
            ${DAYS.map((d) => `<button class="chip" data-watch-days="${esc(w.name)}:${d}" aria-pressed="${w.afterDays === d}">${d}日</button>`).join('')}</div>
          <div class="wrow">知らせる先
            ${TO.map((t) => `<button class="chip" data-watch-to="${esc(w.name)}:${t}" aria-pressed="${w.notify.includes(t)}">${t}</button>`).join('')}</div>
        </details>
      </article>`;
  }).join('');

  view.innerHTML = `
    <h1>見守り</h1>
    <p class="lead">最後に話した日だけを見ます。「話す」画面やわなの見回りで話すと、その日が更新されます。</p>
    ${cards}
    <ul class="notes">
      <li>体のぐあいは、AI が判断しません。気になるときは、家族やチームが直接声をかけてください。</li>
      <li>健康の話は記録しません。話した言葉に体のぐあいの話が入っていたら、その文は残しません。</li>
      <li>知らせは LINE でも送れる形を考えています（今は送りません）。</li>
      <li>「最後に話した日」は画面を開いた日から数えた架空のデモです（開いたのは${esc(dayLabel(dateStr(new Date(OPENED))))}）。</li>
    </ul>`;
}

export function watchClick(e) {
  const d = e.target.closest('[data-watch-days]');
  const t = e.target.closest('[data-watch-to]');
  if (!d && !t) return false;
  if (d) {
    const [name, n] = d.dataset.watchDays.split(':');
    setWatch(name, { afterDays: Number(n) });
  } else {
    const [name, to] = t.dataset.watchTo.split(':');
    const cur = watchSettings()[name].notify;
    setWatch(name, { notify: cur.includes(to) ? cur.filter((x) => x !== to) : [...cur, to] });
  }
  const openName = (d || t).dataset[d ? 'watchDays' : 'watchTo'].split(':')[0];
  renderWatch();
  // 開いていた設定を開いたままにする
  const idx = ctx.data.watch.findIndex((p) => p.name === openName);
  document.querySelectorAll('details.wedit')[idx]?.setAttribute('open', '');
  return true;
}
