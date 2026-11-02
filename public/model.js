// データのまとめ役：デモデータ（/api/team）に、この端末で足したもの・押したものを重ねる。
import { ctx, store, todayStr } from './ui.js';
import { placeTraps } from './lib/traps.js';
import { surname } from './lib/names.js';

// デモデータの「◯時間前」「◯日前」は、画面を開いた時刻から数える
export const OPENED = Date.now();

// ---------- わな ----------
export function traps() {
  const over = store.get('trapOver', {});
  return placeTraps(ctx.data.traps.list, OPENED).map((t) => ({ ...t, ...(over[t.id] || {}) }));
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
