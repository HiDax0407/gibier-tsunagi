// 過去の捕獲・目撃から見る候補（現場の方の指摘③：過去に取れた所から、設置の候補を見たい）。
// 決まった数え方だけ：地図を約300m四方のます目に分け、直近3か月の捕獲と目撃の件数を数えて、多い順に3つ並べる。
// 獣の動きを予測しない（「予測」とは言わない）。設置の可否（道路・人家からの距離・許可の区域）は、
// 県・町の決まりとチームが確認する。AI は使わない。
import { shiftMonth } from './teach.js';

export const CELL = { lat: 0.0027, lng: 0.0033 }; // 約300m四方（北緯35度あたり）

const cellOf = (p) => `${Math.floor(p.lat / CELL.lat)}:${Math.floor(p.lng / CELL.lng)}`;

// 直近 n か月：今月の n か月前から今月まで（例：11月なら 8月〜11月）
export function windowMonths(month, n = 3) {
  return { from: shiftMonth(month, -n), to: month };
}
const inWindow = (m, w) => m >= w.from && m <= w.to;

// 2点の距離（m）
function meters(a, b) {
  const r = Math.PI / 180;
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(x));
}

// 候補：直近3か月の捕獲と目撃が多います目、上位 top 個。根拠の件数を一緒に返す
export function candidates(history, month, { top = 3, traps = [] } = {}) {
  const w = windowMonths(month);
  const cells = new Map();
  const add = (p, kind) => {
    if (!inWindow(p.month, w)) return;
    const k = cellOf(p);
    const c = cells.get(k) || { key: k, catches: 0, sightings: 0, pts: [] };
    c[kind] += 1;
    c.pts.push(p);
    cells.set(k, c);
  };
  for (const p of history.catches || []) add(p, 'catches');
  for (const p of history.sightings || []) add(p, 'sightings');
  return [...cells.values()]
    .map((c) => {
      const lat = c.pts.reduce((n, p) => n + p.lat, 0) / c.pts.length;
      const lng = c.pts.reduce((n, p) => n + p.lng, 0) / c.pts.length;
      const near = traps.map((t) => ({ no: t.no, m: meters({ lat, lng }, t) })).sort((a, b) => a.m - b.m)[0] || null;
      return { key: c.key, lat: +lat.toFixed(6), lng: +lng.toFixed(6), catches: c.catches, sightings: c.sightings, total: c.catches + c.sightings, near: near && { no: near.no, m: Math.round(near.m / 10) * 10 } };
    })
    .sort((a, b) => b.total - a.total || b.catches - a.catches || a.key.localeCompare(b.key))
    .slice(0, top);
}

// 地図に重ねる点：古い月ほど薄く（0.25〜0.9）
export function historyDots(history, month, months = 6) {
  const from = shiftMonth(month, -months);
  const dots = [];
  const push = (p, kind) => {
    if (p.month < from || p.month > month) return;
    const age = Math.max(0, monthDiff(p.month, month) - 1); // 先月＝0
    dots.push({ lat: p.lat, lng: p.lng, kind, month: p.month, opacity: +Math.max(0.25, 0.9 - age * 0.13).toFixed(2) });
  };
  for (const p of history.catches || []) push(p, 'catch');
  for (const p of history.sightings || []) push(p, 'sighting');
  return dots;
}
function monthDiff(a, b) {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}
