import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthOf, shiftMonth, recordsForMonth, summarizeByTeacher, toCsv, isConfirmed } from '../public/lib/teach.js';
import { loadRaw, buildTeam } from '../src/team.mjs';

const team = buildTeam(loadRaw());
const records = team.teach.records;

test('月の切り替えは年をまたげる', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(monthOf('2026-10-24'), '2026-10');
});

test('確かめ済みは、本人とチームの両方が「はい」のときだけ', () => {
  assert.equal(isConfirmed({ teacherOk: true, teamOk: true }), true);
  assert.equal(isConfirmed({ teacherOk: true, teamOk: false }), false);
  assert.equal(isConfirmed({ teacherOk: false, teamOk: true }), false);
});

test('10月の回数：岩田さんは確かめ済み1・確認待ち1、並びは名簿の順', () => {
  const oct = recordsForMonth(records, '2026-10');
  const sum = summarizeByTeacher(oct, team.teach.teachers);
  assert.deepEqual(sum.map((s) => s.teacher), ['岩田', '佐伯', '小川']);
  const iwata = sum.find((s) => s.teacher === '岩田');
  assert.equal(iwata.confirmed, 1);
  assert.equal(iwata.waiting, 1);
});

test('回数の集計に金額や点数の項目はない', () => {
  const sum = summarizeByTeacher(records, team.teach.teachers);
  for (const s of sum) assert.deepEqual(Object.keys(s).sort(), ['confirmed', 'roles', 'teacher', 'waiting']);
});

test('CSV：見出しがあり、式として動く書き方は無効にする', () => {
  const csv = toCsv([{ date: '2026-11-01', role: '見回り', teacher: '岩田', partner: '=1+1', what: 'a,b', teacherOk: true, teamOk: false }]);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], '日付,工程,教えた人,一緒にやった人,したこと,ベテラン本人の確認,チームの確認');
  assert.equal(lines[1], `2026-11-01,見回り,岩田,'=1+1,"a,b",はい,未`);
});
