import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRaw, buildTeam, coverage } from '../src/team.mjs';

test('担当の人数から状態を決める', () => {
  assert.equal(coverage([]), 'empty');
  assert.equal(coverage(['岩田']), 'single');
  assert.equal(coverage(['岩田', '佐伯']), 'ok');
});

test('北沢地区（架空）で止まる役割は、処理・出荷・記録', () => {
  const team = buildTeam(loadRaw());
  const roles = team.risks.map((r) => r.role);
  assert.deepEqual(roles, ['処理（洗浄・解体）', '出荷・店とのやりとり', '記録（日付・場所）']);
  assert.equal(team.goal.progress.ok, 4);
  assert.equal(team.goal.progress.total, 7);
});

test('手を挙げた人は、手を挙げた順のまま（名前・条件・手を挙げた日だけ。点数や順位を持たない）', () => {
  const team = buildTeam(loadRaw());
  for (const card of team.cards) {
    for (const h of card.hands) {
      assert.deepEqual(Object.keys(h).sort(), ['conditions', 'name', 'since']);
      assert.match(h.since, /^\d{4}-\d{2}-\d{2}$/, h.name);
    }
  }
});

test('すべての工程に資格の区分の印がある', () => {
  const team = buildTeam(loadRaw());
  for (const r of team.rows) assert.ok(['needs_check', 'no_license'].includes(r.license), r.role);
});

test('募集カードの道のりは4段（今日から→資格の確認→先輩と二人で→一人で）', () => {
  const team = buildTeam(loadRaw());
  assert.deepEqual(team.pathSteps, ['今日からできること', '資格の確認', '先輩と二人で', '一人で']);
  for (const c of team.cards) assert.equal(c.path.length, 4, c.role);
});

test('止まる役割から、その役割の募集カードへつながる', () => {
  const team = buildTeam(loadRaw());
  for (const r of team.risks) assert.ok(r.cardId, r.role);
});
