import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRaw, buildTeam } from '../src/team.mjs';
import { trapState, countStates, placeTraps, nextSignalTrap, parsePatrol, routeFor, routeKm } from '../public/lib/traps.js';
import { findGaps, draftTable, draftCsv, districtTotals, logsForMonth, DEFAULT_COLUMNS } from '../public/lib/log.js';
import { splitHealth, daysSince, watchList } from '../public/lib/watch.js';
import { missingSteps, nextQuestion, KATA } from '../public/lib/kikikata.js';
import { countDistrict, townRows, townTotals } from '../public/lib/town.js';

const team = buildTeam(loadRaw());
const now = new Date('2026-11-02T09:00:00').getTime();
const H = 3600e3;

// ---------- わなの地図 ----------
test('わなの状態：入った／しばらく見ていない／見回り済み／空', () => {
  assert.equal(trapState({ signal: 'caught', lastChecked: new Date(now - H).toISOString() }, now, 36), 'caught');
  assert.equal(trapState({ lastChecked: new Date(now - 50 * H).toISOString() }, now, 36), 'stale');
  assert.equal(trapState({ lastChecked: null }, now, 36), 'stale');
  assert.equal(trapState({ lastChecked: new Date(now - 2 * H).toISOString() }, now, 36), 'checked');
  assert.equal(trapState({ lastChecked: new Date(now - 20 * H).toISOString() }, now, 36), 'empty');
  // 目安の時間はチームが決める
  assert.equal(trapState({ lastChecked: new Date(now - 20 * H).toISOString() }, now, 12), 'stale');
});

test('デモのわな8つの色の数（開いた時刻から数える）', () => {
  const traps = placeTraps(team.traps.list, now);
  assert.deepEqual(countStates(traps, now, 36), { caught: 1, stale: 2, empty: 3, checked: 2 });
});

test('模擬の知らせは、まだ入っていないわなを番号の順に選ぶ', () => {
  const traps = placeTraps(team.traps.list, now);
  assert.equal(nextSignalTrap(traps, 0).no, 1);
  assert.equal(nextSignalTrap(traps, 2).no, 4); // 3番はもう入っている
  assert.equal(nextSignalTrap(traps, 8).no, 1); // 最後まで行ったら最初へ
});

test('わなの担当と「二人で行く」相手は、名簿にいる人（チームが決めた組み合わせ）', () => {
  const people = team.teach.people;
  for (const t of team.traps.list) {
    assert.ok(people.includes(t.owner), t.id);
    assert.ok(people.includes(t.pair), t.id);
    assert.notEqual(t.owner, t.pair, t.id);
  }
});

test('見回った人の話から、わなの番号・結果・獣の種類・頭数を拾う', () => {
  const traps = team.traps.list;
  assert.deepEqual(parsePatrol('3番、シカが1頭かかっとった', traps), { no: 3, trapId: 'w3', result: 'caught', species: 'シカ', count: 1 });
  assert.deepEqual(parsePatrol('５番は空やった', traps), { no: 5, trapId: 'w5', result: 'empty', species: null, count: null });
  assert.equal(parsePatrol('二番、かかっとらん', traps).result, 'empty');
  assert.equal(parsePatrol('二番、かかっとらん', traps).no, 2);
  assert.equal(parsePatrol('七番にイノシシが二頭入っとった', traps).count, 2);
  assert.equal(parsePatrol('見回りに行ってきた', traps).result, null);
  assert.equal(parsePatrol('9番', traps).trapId, null); // ないわな
});

test('処理場までの道：わなから道に入り、処理場で終わる。距離は数km・目安の時間はチームが登録', () => {
  const { road, facility, list } = team.traps;
  for (const t of list) {
    const r = routeFor(t, road, facility);
    assert.deepEqual(r[0], [t.lat, t.lng]);
    assert.deepEqual(r.at(-1), [facility.lat, facility.lng]);
    const d = routeKm(r);
    assert.ok(d > 0.3 && d < 5, `${t.id} ${d}`);
    assert.ok(Number.isInteger(t.minutes), t.id);
  }
  assert.equal(routeKm([[35, 135], [35, 135]]), 0);
});

// ---------- 活動と捕獲の記録 ----------
test('抜けチェック：写真なし・日時なし・獣種なし・頭数なし・確認待ちを出す', () => {
  const gaps = findGaps(team.logs);
  const of = (id) => gaps.filter((g) => g.id === id).map((g) => g.type).sort();
  assert.deepEqual(of('a2'), []);
  assert.deepEqual(of('a5'), ['count', 'photo', 'team']);
  assert.deepEqual(of('a6'), ['datetime', 'team']);
});

test('町へ出す下書きは、チームが確かめて「出す」を押したものだけ', () => {
  const t = draftTable(team.logs, DEFAULT_COLUMNS, { kitazawa: '北沢地区（架空）' });
  assert.deepEqual(t.head, ['日時', '種類', 'わな', '地区', '獣種', '頭数', '写真']);
  assert.equal(t.rows.length, 3); // a1・a2・a3（a4 は確かめ済みだがまだ出していない）
  assert.deepEqual(t.rows[1], ['2026-10-22 07:10', '捕獲', '3番', '北沢地区（架空）', 'シカ', '1', 'あり']);
});

test('町の様式に合わせて、列と並びを変えられる', () => {
  const t = draftTable(team.logs, ['district', 'species', 'count'], {});
  assert.deepEqual(t.head, ['地区', '獣種', '頭数']);
  const csv = draftCsv(team.logs, ['kind', 'text'], {});
  assert.ok(csv.startsWith('種類,話した言葉\r\n'));
});

test('月の一覧では、日時のない記録も落とさず最後に並べる', () => {
  const nov = logsForMonth(team.logs, '2026-11').map((r) => r.id);
  assert.deepEqual(nov, ['a5', 'a6']);
});

test('地区の数は、町へ出したものだけを数える', () => {
  assert.deepEqual(districtTotals(team.logs, 'kitazawa'), { deer: 1, boar: 1, other: 0, patrol: 1, dispatch: 0 });
});

test('記録と下書きに、金額や交付金の判定の欄を持たない', () => {
  const t = draftTable(team.logs, DEFAULT_COLUMNS, {});
  for (const h of t.head) assert.ok(!/金|円|報償|交付|対象/.test(h), h);
  for (const r of team.logs) for (const k of Object.keys(r)) assert.ok(!/amount|price|yen|fee|eligible|score/i.test(k), k);
});

// ---------- 町の画面（数だけ） ----------
test('県へ上げる数の下書き：地区ごとの数と合計。個人名を含まない', () => {
  const live = {
    ...countDistrict({ rows: team.rows, cards: team.cards, records: team.teach.records, experienceRoles: [] }),
    ...districtTotals(team.logs, 'kitazawa'),
    reports: team.reports.filter((r) => r.district === 'kitazawa').length,
  };
  const { rows, total } = townTotals(townRows(team.town.districts, live));
  assert.deepEqual(total, { deer: 4, boar: 4, patrol: 12, reports: 6 });
  const text = JSON.stringify(rows);
  for (const name of [...team.teach.people, ...team.traps.list.map((t) => t.owner)]) assert.ok(!text.includes(name), name);
});

// ---------- 見守り ----------
test('体のぐあいの話の文は残さない', () => {
  const r = splitHealth('朝は3番から見る。最近は腰が痛うてな。2番は空やった。');
  assert.equal(r.kept, '朝は3番から見る。2番は空やった。');
  assert.deepEqual(r.dropped, ['最近は腰が痛うてな。']);
  assert.equal(splitHealth('病院に行った').kept, '');
});

test('見守りは「最後に話した日」だけを見る。知らせ先がない人には知らせない', () => {
  const day = (n) => new Date(now - n * 86400e3).toISOString();
  const list = watchList(
    ['岩田', '佐伯', '小川'],
    { 岩田: day(4), 佐伯: day(1), 小川: day(9) },
    { 岩田: { afterDays: 3, notify: ['家族', 'チーム'] }, 佐伯: { afterDays: 5, notify: ['チーム'] }, 小川: { afterDays: 3, notify: [] } },
    now,
  );
  assert.deepEqual(list.map((x) => [x.name, x.days, x.over]), [['岩田', 4, true], ['佐伯', 1, false], ['小川', 9, false]]);
  for (const x of list) assert.deepEqual(Object.keys(x).sort(), ['afterDays', 'days', 'last', 'name', 'notify', 'over']);
  assert.equal(daysSince(null, now), null);
});

test('画面に送る名簿と見守りのデータに、体のぐあいのメモを含まない', () => {
  const text = JSON.stringify({ members: team.members, watch: team.watch });
  for (const w of ['腰', '膝', '体調', 'note']) assert.ok(!text.includes(w), w);
});

// ---------- 聞き方の型 ----------
test('聞き方の型は6つ（失敗談・見分け方・感覚と量・昔と今・新人の間違い・食い違い）', () => {
  assert.deepEqual(KATA.map((k) => k.label), ['失敗談', '良し悪しの見分け方', '感覚と量', '昔と今の違い', '新人がよくやる間違い', '話の食い違いの確認']);
});

test('岩田さんの話で、まだ聞けていない工程は「わなの設置・点検」。聞き返しは1つだけ', () => {
  const steps = team.rows.map((r) => r.role);
  const texts = [team.veteranTalk.text];
  assert.deepEqual(missingSteps(texts, steps), ['わなの設置・点検']);
  const q = nextQuestion(texts, steps);
  assert.equal(q.step, 'わなの設置・点検');
  assert.equal(typeof q.text, 'string');
  assert.equal((q.text.match(/？/g) || []).length <= 1, true);
});
