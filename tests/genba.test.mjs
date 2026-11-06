// 現場の方（現役の猟師さん）の指摘で足したところ（11/6）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRaw, buildTeam } from '../src/team.mjs';
import { applyPlaced, sampleSpot, accLabel } from '../public/lib/traps.js';

const team = buildTeam(loadRaw());

// ---------- 指摘① わなの位置 ----------
test('「ここに置いた」の位置で、わなの点が動く。記録のないわなはそのまま', () => {
  const list = team.traps.list;
  const out = applyPlaced(list, { w1: { lat: 35.21, lng: 133.61, acc: 8, source: 'gps', at: '2026-11-06T06:10:00Z' } });
  assert.equal(out[0].lat, 35.21);
  assert.equal(out[0].placed.acc, 8);
  assert.equal(out[1].lat, list[1].lat);
  assert.equal(out[1].placed, undefined);
  // 数でない位置は使わない
  assert.equal(applyPlaced(list, { w1: { lat: 'x', lng: null } })[0].lat, list[0].lat);
});

test('見本の位置は架空で、いつも同じ。もとの位置の近く（数十m）', () => {
  const t = team.traps.list[0];
  const a = sampleSpot(t);
  assert.deepEqual(a, sampleSpot(t));
  assert.equal(a.source, 'sample');
  for (const x of team.traps.list) assert.notDeepEqual([sampleSpot(x).lat, sampleSpot(x).lng], [x.lat, x.lng], x.id);
  assert.ok(Math.abs(a.lat - t.lat) < 0.001 && Math.abs(a.lng - t.lng) < 0.001);
  assert.equal(accLabel(7.6), '精度 約8m');
  assert.equal(accLabel(null), '精度 不明');
});

// ---------- 指摘② 知らせに写真と音 ----------
import { signalMedia } from '../public/lib/traps.js';
import { existsSync } from 'node:fs';
test('知らせに添える写真と音の見本は、順に使う。ファイルがある', () => {
  const ex = team.traps.cameraExamples;
  assert.ok(ex.length >= 2);
  assert.equal(signalMedia(ex, 0).photo, ex[0].photo);
  assert.equal(signalMedia(ex, 1).photo, ex[1].photo);
  assert.equal(signalMedia(ex, 2).photo, ex[0].photo);
  assert.equal(signalMedia([], 0), null);
  for (const e of ex) {
    assert.ok(existsSync(new URL(`../public${e.photo}`, import.meta.url)), e.photo);
    assert.ok(existsSync(new URL(`../public${e.sound}`, import.meta.url)), e.sound);
    assert.match(e.alt, /架空/);
  }
});

// ---------- 指摘③ 過去の捕獲・目撃から見る候補 ----------
import { candidates, historyDots, windowMonths } from '../public/lib/candidates.js';
test('候補は、直近（8月〜11月）の捕獲と目撃が多い所を3つ。根拠の件数と近いわなを付ける', () => {
  assert.deepEqual(windowMonths('2026-11'), { from: '2026-08', to: '2026-11' });
  const list = candidates(team.history, '2026-11', { traps: team.traps.list });
  assert.equal(list.length, 3);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].total >= list[i].total);
  for (const c of list) {
    assert.equal(c.total, c.catches + c.sightings);
    assert.ok(Number.isInteger(c.near.no) && c.near.m >= 0);
    // 返すのは件数と場所だけ（予測の値・点数は持たない）
    assert.deepEqual(Object.keys(c).sort(), ['catches', 'key', 'lat', 'lng', 'near', 'sightings', 'total']);
  }
  // 前は多かった南の林道（5〜6月）は、直近の候補に入らない
  assert.ok(list.every((c) => c.lat > 35.2));
});

test('過去の点は北沢地区の中だけ。古い月ほど薄い', () => {
  const dots = historyDots(team.history, '2026-11');
  assert.equal(dots.length, team.history.catches.length + team.history.sightings.length);
  const old = dots.find((d) => d.month === '2026-05');
  const recent = dots.find((d) => d.month === '2026-10');
  assert.ok(old.opacity < recent.opacity);
  for (const d of dots) assert.ok(d.lat > 35.19 && d.lat < 35.22 && d.lng > 133.6 && d.lng < 133.64);
});

// ---------- 指摘④ 精算の準備を先に ----------
import { advanceCheck, advanceState, advanceAct, advancePacket } from '../public/lib/advance.js';
const adv = team.townRules.advance;
const rec = { id: 'x1', kind: '捕獲', by: '岩田', datetime: '2026-11-06T06:10:00Z', trapNo: 1, district: 'kitazawa' };
const four = Object.fromEntries(adv.photos.map((p) => [p.id, 'sample']));
test('町に出す写真は4枚（全体・部位・場所の札・日付）。枚数と項目の有無だけを見る', () => {
  assert.deepEqual(adv.photos.map((p) => p.id), ['whole', 'part', 'place', 'date']);
  const c0 = advanceCheck(rec, {}, adv);
  assert.equal(c0.ready, false);
  assert.equal(c0.missingPhotos.length, 4);
  const c1 = advanceCheck(rec, four, adv);
  assert.deepEqual([c1.photos, c1.of, c1.ready], [4, 4, true]);
  const noTrap = advanceCheck({ ...rec, trapNo: null }, four, adv);
  assert.deepEqual(noTrap.missingItems, ['場所（わな番号）']);
  assert.equal(noTrap.ready, false);
});

test('先に送る→準備できた（現物待ち）→町が現物を確認→精算へ。順番を飛ばせない', () => {
  const ok = advanceCheck(rec, four, adv);
  assert.throws(() => advanceAct({}, 'send', '2026-11-06', advanceCheck(rec, {}, adv)));
  const a1 = advanceAct({}, 'send', '2026-11-06', ok);
  assert.equal(advanceState(a1, ok), 'ready');
  assert.throws(() => advanceAct(a1, 'settle', '2026-11-06', ok));
  const a2 = advanceAct(a1, 'receive', '2026-11-07', ok);
  assert.equal(advanceState(a2, ok), 'received');
  const a3 = advanceAct(a2, 'settle', '2026-11-07', ok);
  assert.equal(advanceState(a3, ok), 'settle');
  assert.throws(() => advanceAct(a3, 'send', '2026-11-07', ok));
});

test('先に送る中身は、写真と捕獲者・日時・場所だけ。金額・対象・獣種の判定の欄を持たない', () => {
  const pk = advancePacket(rec, four, adv);
  assert.deepEqual(Object.keys(pk).sort(), ['by', 'datetime', 'district', 'photos', 'recordId', 'trapNo']);
  assert.deepEqual(pk.photos, ['whole', 'part', 'place', 'date']);
  for (const k of Object.keys(pk)) assert.ok(!/amount|price|yen|fee|eligible|score|species/i.test(k), k);
});
