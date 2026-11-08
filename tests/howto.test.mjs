import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOWTO, FIRST_STEPS, howtoFor } from '../public/lib/howto.js';

// 「使い方」は、3行の説明がある6画面（主タブ4つ＋町の地区一覧＋見かけたら知らせる）
test('使い方は6画面・それぞれ3行', () => {
  assert.deepEqual(Object.keys(HOWTO).sort(), ['log', 'map', 'report', 'talk', 'team', 'town']);
  for (const h of Object.values(HOWTO)) {
    assert.equal(h.lines.length, 3, h.name);
    for (const l of h.lines) assert.ok(l.trim().length > 0 && l.length <= 60, l);
  }
});

// 文は決まった3行のまま（勝手に変えない・足さない）
test('話すの3行は決まった文のまま', () => {
  assert.deepEqual(HOWTO.talk.lines, [
    '1 丸いボタンを押して、いつもの言葉で話します。方言のままで大丈夫。',
    '2 手順と注意に分かれて残ります。',
    '3 AI がひとつだけ聞き返すことがあります。',
  ]);
  assert.deepEqual(HOWTO.report.lines, ['名前はいりません。', '見かけた地区を選び、話すか文字で入れます。', '写真は添えるだけで、獣の種類は判定しません。']);
});

// 「短縮」「早くなる」と書かない。数字は、画面の順番の 1〜3 と「写真4枚」「1件ずつ」だけ
test('使い方と入口の文に「短縮」「早くなる」が無い', () => {
  const all = [...Object.values(HOWTO).flatMap((h) => h.lines), FIRST_STEPS.lead, ...FIRST_STEPS.steps.flatMap((s) => [s.label, s.note])];
  for (const t of all) {
    assert.ok(!/短縮|早くなる|速くなる/.test(t), t);
  }
});

// 入口の「はじめての方へ」は、わな → 話す → 記録 の順（下のタブへつながる）
test('はじめての方へは3つ・わな→話す→記録', () => {
  assert.equal(FIRST_STEPS.lead, 'はじめての朝は、この順で。');
  assert.deepEqual(FIRST_STEPS.steps.map((s) => s.go), ['map', 'talk', 'log']);
  assert.deepEqual(FIRST_STEPS.steps.map((s) => s.label), ['わな', '話す', '記録']);
});

// 無い画面（教えた記録・募集カードなど）には出さない
test('使い方が無い画面は null', () => {
  assert.equal(howtoFor('teach'), null);
  assert.equal(howtoFor('cards'), null);
  assert.equal(howtoFor('map').name, 'わな');
});
