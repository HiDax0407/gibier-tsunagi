// 町の画面：地区ごとの数だけを出す（個人名は出さない）。決まった数え方だけ。
import { isConfirmed } from './teach.js';

// チームのデータから、その地区の数を数える
//  single＝担当が1人だけの工程 / empty＝担当がいない工程 / experience＝ベテランの話が残った工程
//  hands＝募集カードに手を挙げた人（同じ人は1人と数える） / teach＝確かめ済みの「教えた記録」
export function countDistrict({ rows, cards, records, experienceRoles = [] }) {
  const handNames = new Set(cards.flatMap((c) => c.hands.map((h) => h.name)));
  return {
    roles: rows.length,
    single: rows.filter((r) => r.coverage === 'single').length,
    empty: rows.filter((r) => r.coverage === 'empty').length,
    experience: rows.filter((r) => experienceRoles.includes(r.role)).length,
    hands: handNames.size,
    teach: records.filter(isConfirmed).length,
  };
}

// 県へ上げる数の下書き：地区ごとの数と合計（数だけ）
export function townTotals(rows) {
  const keys = ['deer', 'boar', 'patrol', 'reports'];
  const total = Object.fromEntries(keys.map((k) => [k, rows.reduce((n, r) => n + (Number(r[k]) || 0), 0)]));
  return { rows: rows.map((r) => ({ name: r.name, ...Object.fromEntries(keys.map((k) => [k, r[k] ?? 0])) })), total };
}

// 町の画面に渡す形：数と地区名だけ
export function townRows(districts, liveCounts) {
  return districts.map((d) => {
    const n = d.live ? liveCounts : d;
    return {
      id: d.id, name: d.name, live: !!d.live,
      roles: n.roles, single: n.single, empty: n.empty, experience: n.experience, hands: n.hands, teach: n.teach,
      deer: n.deer ?? 0, boar: n.boar ?? 0, patrol: n.patrol ?? 0, reports: n.reports ?? 0,
    };
  });
}
