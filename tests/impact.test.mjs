import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRaw, buildTeam } from '../src/team.mjs';
import { change, catches, niceMax, monthShort } from '../public/lib/impact.js';

const team = buildTeam(loadRaw());

test('見える化：月ごとの数がそろっている（架空の推移）', () => {
  const d = team.impact;
  for (const k of ['deer', 'boar', 'damage', 'patrol', 'twoOrMore']) assert.equal(d[k].length, d.months.length, k);
  // いちばん新しい月の「2人以上いる工程」は、今のチームの表と同じ
  assert.equal(d.twoOrMore.at(-1), team.goal.progress.ok);
});

test('最初と最後の月の差・捕獲の合計・目盛り', () => {
  assert.deepEqual(change([12, 9, 4]), { first: 12, last: 4, diff: -8 });
  assert.deepEqual(catches([2, 3], [1, 0]), [3, 3]);
  assert.deepEqual(niceMax([12, 4]), { max: 20, step: 5 });
  assert.equal(niceMax([0]).max > 0, true);
  assert.equal(monthShort('2026-05'), '5月');
});

test('見える化のデータに、人名・順位・点数を持たない', () => {
  const text = JSON.stringify(team.impact);
  for (const n of team.teach.people) assert.ok(!text.includes(n), n);
  for (const k of Object.keys(team.impact)) assert.ok(!/rank|score|順位|点/.test(k), k);
});
