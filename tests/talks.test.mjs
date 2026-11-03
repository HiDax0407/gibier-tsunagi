import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCOPES, scopeOf, teamTalks, talksCsv } from '../public/lib/talks.js';
import { stepCoverage } from '../public/lib/kikikata.js';

const talks = [
  { id: 'a', who: '岩田', date: '2026-11-03', text: '朝はまず、わなの見回り。一人で行くと危ない。' },
  { id: 'b', who: '岩田', date: '2026-11-03', text: '冷蔵庫の温度は毎日見る。', scope: 'self' },
];

test('残した話は本人のもの：範囲は2つ（チームの中／本人だけ）。決めていなければチームの中', () => {
  assert.deepEqual(SCOPES.map((s) => s.id), ['team', 'self']);
  assert.equal(scopeOf(talks[0]), 'team');
  assert.equal(scopeOf(talks[1]), 'self');
  assert.equal(scopeOf({ scope: '勝手な値' }), 'team');
});

test('「本人だけ」の話は、チームの表の数にも工程ごとの言葉にも入らない', () => {
  const texts = teamTalks(talks).map((t) => t.text);
  assert.deepEqual(texts, [talks[0].text]);
  const cover = stepCoverage(texts, ['見回り', '冷蔵・保管']);
  assert.deepEqual(cover, [{ step: '見回り', heard: true }, { step: '冷蔵・保管', heard: false }]);
});

test('書き出しには出典（誰が・いつ・範囲）が必ず付き、本人だけの話は書き出さない。文は本人の言葉のまま', () => {
  const csv = talksCsv(talks);
  const lines = csv.split('\r\n').filter(Boolean);
  assert.equal(lines[0], '日付,話した人,使ってよい範囲,手順か注意,文（本人の言葉のまま）');
  assert.equal(lines.length, 3);
  assert.ok(lines[1].startsWith('2026-11-03,岩田,チームの中,手順,朝はまず、わなの見回り。'));
  assert.ok(lines[2].includes('注意,一人で行くと危ない。'));
  assert.ok(!csv.includes('冷蔵庫'));
});
