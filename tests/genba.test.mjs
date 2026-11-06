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
