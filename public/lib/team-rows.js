// チームの表の計算（ブラウザとテストの両方で使う）。決まった計算だけ。AI は使わない・人の評価もしない。
import { surname } from './names.js';

// 担当の人数から状態を決める：空き／1人だけ／2人以上
export function coverage(people) {
  if (people.length === 0) return 'empty';
  if (people.length === 1) return 'single';
  return 'ok';
}

// 止まる役割：空き・1人だけの工程。理由は人数から作る文だけ
export function stopRisks(rows) {
  return rows
    .filter((r) => r.coverage !== 'ok')
    .map((r) => ({
      role: r.role,
      coverage: r.coverage,
      person: r.coverage === 'single' ? r.people[0] : null,
      reason: r.coverage === 'empty' ? '担当している人がいない' : `担当が${r.people[0]}さん1人だけ`,
    }));
}

// チームが「お願いする」と決めた人を、その募集カードの工程の担当に足す。
// 決めるのはチーム（decided に印があるものだけ）。AI は人を選ばない。並びは手を挙げた順のまま。
export function applyDecided(rows, cards, decided = {}) {
  const add = new Map();
  for (const c of cards) {
    for (const h of c.hands || []) {
      if (!decided[`${c.id}:${h.name}`]) continue;
      add.set(c.role, [...(add.get(c.role) || []), surname(h.name)]);
    }
  }
  return rows.map((r) => {
    const extra = (add.get(r.role) || []).filter((p) => !r.people.includes(p));
    if (!extra.length) return r;
    const people = [...r.people, ...extra];
    return { ...r, people, added: extra, coverage: coverage(people) };
  });
}
