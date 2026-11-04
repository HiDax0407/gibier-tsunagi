import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STATES, ACTIONS, stateOf, nextOf, act, daysSince, requiredGaps, canSend, monthlyApp, expiringLicenses, lastReturn } from '../public/lib/applications.js';

const apps = JSON.parse(readFileSync(new URL('../data/applications.json', import.meta.url), 'utf8')).applications;
const rules = JSON.parse(readFileSync(new URL('../data/town_rules.json', import.meta.url), 'utf8'));
const roles = JSON.parse(readFileSync(new URL('../data/kitazawa_roles.json', import.meta.url), 'utf8'));
const now = new Date('2026-11-05T09:00:00+09:00').getTime();

test('状態は5つ。各状態に「次に動くのは誰」がある', () => {
  assert.deepEqual(Object.keys(STATES), ['draft', 'checking', 'returned', 'confirmed', 'done']);
  assert.deepEqual(Object.values(STATES).map((s) => s.next), ['team', 'town', 'team', 'town', null]);
});

test('デモの申請：9月分＝戻った→再提出→確認済み、10月分＝町が確認中（11/1 に出した）、11月分＝下書き', () => {
  const by = Object.fromEntries(apps.filter((a) => a.district === 'kitazawa').map((a) => [a.month, a]));
  assert.equal(stateOf(by['2026-09']), 'confirmed');
  assert.equal(lastReturn(by['2026-09']).reason, '写真が不鮮明');
  assert.equal(stateOf(by['2026-10']), 'checking');
  assert.equal(nextOf(by['2026-10']), 'town');
  assert.equal(daysSince('2026-11-01', now), 4);
  assert.equal(stateOf(by['2026-11']), 'draft');
});

test('出す・再提出はチーム、確認・戻す・支払いは町。順番を飛ばせない。戻すには理由が要る', () => {
  const draft = monthlyApp([], 'kitazawa', '2026-12');
  assert.equal(stateOf(draft), 'draft');
  const sent = act(draft, 'send', { at: '2026-12-31' });
  assert.equal(stateOf(sent), 'checking');
  assert.equal(sent.history.at(-1).by, 'team');
  assert.throws(() => act(draft, 'confirm', { at: '2026-12-31' }), /できません/);
  assert.throws(() => act(sent, 'return', { at: '2027-01-05' }), /理由/);
  const back = act(sent, 'return', { at: '2027-01-05', reason: '写真が不鮮明', note: '3番' });
  assert.equal(stateOf(back), 'returned');
  assert.equal(nextOf(back), 'team');
  const again = act(back, 'resend', { at: '2027-01-07' });
  const ok = act(again, 'confirm', { at: '2027-01-15' });
  assert.equal(stateOf(ok), 'confirmed');
  assert.equal(stateOf(act(ok, 'pay', { at: '2027-02-10' })), 'done');
  assert.ok(Object.values(ACTIONS).every((a) => ['team', 'town'].includes(a.by)));
});

test('町の必要項目と照らす：足りない記録だけ、何が足りないかを一行で。そろえば出せる', () => {
  const recs = [
    { id: 'x1', kind: '捕獲', datetime: '2026-11-05T06:00', trapNo: 1, species: 'シカ', count: 1, by: '岩田', photo: true },
    { id: 'x2', kind: '捕獲', datetime: '2026-11-05T06:00', trapNo: 7, species: 'シカ', count: null, by: '岩田', photo: false },
    { id: 'x3', kind: '出動', datetime: null, trapNo: 4, by: '佐伯', photo: false },
  ];
  const gaps = requiredGaps(recs, rules);
  assert.deepEqual(gaps, [{ id: 'x2', missing: ['捕獲の写真', '頭数'] }, { id: 'x3', missing: ['日時'] }]);
  assert.equal(canSend(gaps), false);
  assert.equal(canSend(requiredGaps([recs[0]], rules)), true);
  // 町が求めなければ尻尾は要らない（enabled: false）
  assert.ok(!gaps.some((g) => g.missing.includes('尻尾などの提出')));
});

test('申請のデータと町の決まりに、金額や対象の判定の欄がない', () => {
  const text = JSON.stringify(apps) + JSON.stringify(rules.required) + JSON.stringify(rules.deadlines);
  for (const w of ['円', '金額', 'amount', 'eligible', '対象外']) assert.ok(!text.includes(w), w);
  assert.deepEqual(rules.return_reasons, ['写真が不鮮明', '日時が合わない', '場所が地図の外', '頭数が合わない', 'その他']);
});

test('免許・許可の期限：60日前から知らせる。デモでは1人だけ 50 日後に切れる', () => {
  const soon = expiringLicenses(roles.licenses, now, 60);
  assert.equal(soon.length, 1);
  assert.equal(soon[0].name, '佐伯 隆（架空）');
  assert.equal(soon[0].kind, 'わな猟免許');
  assert.equal(soon[0].days, 50);
  assert.equal(expiringLicenses(roles.licenses, now, 30).length, 0);
});
