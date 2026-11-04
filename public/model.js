// データのまとめ役：デモデータ（/api/team）に、この端末で足したもの・押したものを重ねる。
import { ctx, store, todayStr } from './ui.js';
import { placeTraps } from './lib/traps.js';
import { surname } from './lib/names.js';
import { applyDecided, stopRisks } from './lib/team-rows.js';
import { monthlyApp } from './lib/applications.js';

// デモデータの「◯時間前」「◯日前」は、画面を開いた時刻から数える
export const OPENED = Date.now();

// ---------- 撮影用の「ある朝」の最初の状態 ----------
// 高木さんはひと月前に「記録」に手を挙げたまま（チームはまだ決めていない）・わなはまだ知らせなし・今朝の記録なし・
// 岩田さんの話はまだ残っていない。デモデータは消さず、画面に出すときに外すだけ（「デモを最初の状態に戻す」で元に戻る）。
export const SCENE_ASA = {
  hideSignals: true,
  hideTalk: true,
};
export const scene = () => (store.get('scene', null) === 'asa' ? SCENE_ASA : null);

// ---------- 募集カードの手を挙げた人（データ＋この端末で足した人） ----------
export function handsFor(card) {
  const added = store.get('addedHands', []).filter((h) => h.card === card.id);
  return [...card.hands, ...added.map((h) => ({ ...h, local: true }))];
}

// ---------- チームの表（チームが「お願いする」と決めた人を担当に足す） ----------
export function teamRows() {
  const cards = ctx.data.cards.map((c) => ({ ...c, hands: handsFor(c) }));
  return applyDecided(ctx.data.rows, cards, store.get('decided', {}));
}
export function teamRisks() {
  const cardByRole = Object.fromEntries(ctx.data.cards.map((c) => [c.role, c.id]));
  return stopRisks(teamRows()).map((r) => ({ ...r, cardId: cardByRole[r.role] || null }));
}

// ---------- わな ----------
export function traps() {
  const over = store.get('trapOver', {});
  const sc = scene();
  return placeTraps(ctx.data.traps.list, OPENED)
    .map((t) => (sc?.hideSignals ? { ...t, signal: null } : t))
    .map((t) => ({ ...t, ...(over[t.id] || {}) }));
}
export function setTrap(id, patch) {
  const over = store.get('trapOver', {});
  over[id] = { ...(over[id] || {}), ...patch };
  store.set('trapOver', over);
}
export const staleHours = () => store.get('staleHours', ctx.data.traps.staleHoursDefault);

// ---------- 活動と捕獲の記録 ----------
export function logs() {
  const edits = store.get('logEdits', {});
  const photos = store.get('photos', {});
  return [...ctx.data.logs, ...store.get('logsAdded', []).map((r) => ({ ...r, local: true }))]
    .map((r) => ({ ...r, ...(edits[r.id] || {}) }))
    .map((r) => ({ ...r, photo: !!(r.photo || photos[r.id]), photoData: photos[r.id] || null }));
}
export function addLog(rec) {
  const id = `log-${Date.now()}`;
  const list = store.get('logsAdded', []);
  list.push({ id, district: ctx.data.homeDistrict, teamOk: false, sent: false, photo: false, ...rec });
  store.set('logsAdded', list);
  return id;
}
export function editLog(id, patch) {
  const edits = store.get('logEdits', {});
  edits[id] = { ...(edits[id] || {}), ...patch };
  store.set('logEdits', edits);
}
export function setPhoto(id, dataUrl) {
  const photos = store.get('photos', {});
  photos[id] = dataUrl;
  return store.set('photos', photos);
}

// ---------- 住民の知らせ ----------
export function reports() {
  const seen = store.get('reportSeen', {});
  const photos = store.get('photos', {});
  return [...ctx.data.reports, ...store.get('reportsAdded', []).map((r) => ({ ...r, local: true }))]
    .map((r) => ({ ...r, seen: !!(r.seen || seen[r.id]), photo: !!(r.photo || photos[r.id]) }))
    .sort((a, b) => String(b.datetime).localeCompare(String(a.datetime)));
}
export function addReport(rec) {
  const id = `rep-${Date.now()}`;
  const list = store.get('reportsAdded', []);
  list.push({ id, seen: false, photo: false, ...rec });
  store.set('reportsAdded', list);
  return id;
}

// ---------- 教えた記録（地図の「二人で向かう」から足す） ----------
export function addTeach(rec) {
  const list = store.get('teachAdded', []);
  list.push({ id: `local-${Date.now()}`, date: todayStr(), teacherOk: false, teamOk: false, ...rec });
  store.set('teachAdded', list);
}

// ---------- 町とのやりとり（月ごとの申請）：データに、この端末で動かした状態を重ねる ----------
export function applications() {
  const over = store.get('appsOver', {});
  const base = ctx.data.applications.map((a) => over[a.id] || a);
  const extra = Object.values(over).filter((a) => !ctx.data.applications.some((b) => b.id === a.id));
  return [...base, ...extra];
}
export function saveApplication(app) {
  const over = store.get('appsOver', {});
  over[app.id] = app;
  store.set('appsOver', over);
}
export const appFor = (district, month) => monthlyApp(applications(), district, month);

// ---------- 見守り：最後に話した日 ----------
export function lastSpoke() {
  const local = store.get('spoke', {});
  const out = {};
  for (const p of ctx.data.watch) {
    const base = new Date(OPENED - p.spokeDaysAgo * 86400e3).toISOString();
    out[p.name] = local[p.name] && local[p.name] > base ? local[p.name] : base;
  }
  return out;
}
export function markSpoke(name) {
  const local = store.get('spoke', {});
  local[surname(name)] = new Date().toISOString();
  store.set('spoke', local);
}
export function watchSettings() {
  const local = store.get('watchSet', {});
  return Object.fromEntries(ctx.data.watch.map((p) => [p.name, { afterDays: p.afterDays, notify: p.notify, ...(local[p.name] || {}) }]));
}
export function setWatch(name, patch) {
  const local = store.get('watchSet', {});
  local[name] = { ...(local[name] || {}), ...patch };
  store.set('watchSet', local);
}
