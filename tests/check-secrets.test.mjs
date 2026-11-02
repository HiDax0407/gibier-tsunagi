import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText, isBlockedName } from '../scripts/check-secrets.mjs';

test('API キーらしき文字列を見つける', () => {
  const fake = 'sk-ant-' + 'x'.repeat(30); // 試験用の偽物
  assert.equal(scanText(`const k = "${fake}";`).length >= 1, true);
});

test('空の設定例は止めない', () => {
  assert.deepEqual(scanText('ANTHROPIC_API_KEY=\nPORT=8791'), []);
});

test('.env は名前だけで止め、.env.example は通す', () => {
  assert.equal(isBlockedName('.env'), true);
  assert.equal(isBlockedName('.env.local'), true);
  assert.equal(isBlockedName('.env.example'), false);
});
