import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv, aiStatus, PROMPTS, MODELS, requestBody, parseJson, callClaude, checkSeiri, checkKikikaeshi, checkNuke, API_VERSION } from '../src/ai.mjs';
import { server } from '../server.mjs';

const STEPS = ['見回り', 'わなの設置・点検', '止め・搬送', '処理（洗浄・解体）', '冷蔵・保管', '出荷・店とのやりとり', '記録（日付・場所）'];

test('キーが無ければ未接続。あれば接続（キーの中身は返さない）', () => {
  assert.deepEqual(aiStatus({}), { connected: false, models: { seiri: 'Claude Opus 5.5', kikikaeshi: 'Claude Haiku 5.5', nuke: 'Claude Haiku 5.5' } });
  const s = aiStatus({ ANTHROPIC_API_KEY: 'dummy' });
  assert.equal(s.connected, true);
  assert.ok(!JSON.stringify(s).includes('dummy'));
});

test('.env は KEY=VALUE の行だけ読む（コメントと引用符）', () => {
  assert.deepEqual(parseEnv('# メモ\nA=1\nB="two"\nC=\n\nbad line\n'), { A: '1', B: 'two', C: '' });
});

test('モデルの使い分け：整理＝上位モデル、聞き返し＝軽いモデル。頼み方に言い換え禁止・答えない・1つだけ', () => {
  assert.equal(MODELS.seiri.id, 'claude-opus-5-5');
  assert.equal(MODELS.kikikaeshi.id, 'claude-haiku-5-5');
  for (const p of Object.values(PROMPTS)) {
    for (const w of ['言い換えない', '答えない', '評価しない', '足さない']) assert.ok(p.system.includes(w), w);
  }
  assert.ok(PROMPTS.kikikaeshi.system.includes('1つだけ'));
  const body = requestBody('kikikaeshi', { texts: ['朝は見回り。'], steps: STEPS });
  assert.equal(body.model, 'claude-haiku-5-5');
  assert.equal(body.messages.at(-1).role, 'user'); // 先回りの返事（prefill）は使わない
  assert.ok(!('temperature' in body));
  assert.equal(API_VERSION, '2026-10-21');
});

test('Claude の返事から JSON を取り出し、エラーと答えなかったときは投げる', async () => {
  const ok = { ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: '```json\n{"tejun":["朝は見回り。"],"chui":[]}\n```' }] }) };
  const env = { ANTHROPIC_API_KEY: 'dummy', ANTHROPIC_BASE_URL: 'http://localhost:1' };
  let seen;
  const r = await callClaude('seiri', { text: '朝は見回り。' }, { env, fetchImpl: async (url, init) => { seen = { url, init }; return ok; } });
  assert.deepEqual(r, { data: { tejun: ['朝は見回り。'], chui: [] }, model: 'Claude Opus 5.5' });
  assert.equal(seen.url, 'http://localhost:1/v1/messages');
  assert.equal(seen.init.headers['x-api-key'], 'dummy');
  await assert.rejects(callClaude('seiri', { text: 'a' }, { env, fetchImpl: async () => ({ ok: false, status: 500 }) }), /500/);
  await assert.rejects(callClaude('seiri', { text: 'a' }, { env, fetchImpl: async () => ({ ok: true, json: async () => ({ stop_reason: 'refusal', content: [] }) }) }), /答えません/);
  await assert.rejects(callClaude('seiri', { text: 'a' }, { env: {}, fetchImpl: async () => ok }), /未接続/);
  assert.throws(() => parseJson('説明だけ'), /JSON/);
});

test('整理の検査：文は本人の言葉のまま・順のまま。言い換えた返事は使わない', () => {
  const said = '朝はまず、わなの見回り。一人で行くと危ない。止めたら、とにかく早う冷やして運ぶ。';
  const good = checkSeiri(said, { tejun: ['止めたら、とにかく早う冷やして運ぶ。', '朝はまず、わなの見回り。'], chui: ['一人で行くと危ない。'], koutei: { '一人で行くと危ない。': '止め・搬送', '朝はまず、わなの見回り。': '見回り', '直した文。': '見回り', '止めたら、とにかく早う冷やして運ぶ。': '知らない工程' } }, STEPS);
  assert.deepEqual(good, { tejun: ['朝はまず、わなの見回り。', '止めたら、とにかく早う冷やして運ぶ。'], chui: ['一人で行くと危ない。'], koutei: { '一人で行くと危ない。': '止め・搬送', '朝はまず、わなの見回り。': '見回り' } }); // 無い文・一覧にない工程は付けない
  assert.equal(checkSeiri(said, { tejun: ['朝はまず、わなの見回りをします。'], chui: [] }), null); // 標準語に直した
  assert.equal(checkSeiri(said, { tejun: [], chui: ['必ず二人で行くこと。'] }), null); // 言っていないことを足した
  assert.deepEqual(checkSeiri(said, 'json ではない'), { tejun: ['朝はまず、わなの見回り。', '一人で行くと危ない。', '止めたら、とにかく早う冷やして運ぶ。'], chui: [], koutei: {} }); // 形が違っても文は落とさない
});

test('聞き返しの検査：1つだけ・工程と型は一覧の中・短く・？で終わる', () => {
  const ok = checkKikikaeshi({ step: '止め・搬送', kata: '感覚と量', text: '冷やすのは、どのくらいの早さで？', said: 'とにかく早う冷やして' }, STEPS);
  assert.equal(ok.text, '冷やすのは、どのくらいの早さで？');
  assert.equal(ok.kata, '感覚と量');
  assert.equal(checkKikikaeshi({ step: '止め・搬送', kata: '感覚と量', text: '冷やすのは早さは？運ぶのは誰と？' }, STEPS), null); // 2つ
  assert.equal(checkKikikaeshi({ step: '解体', kata: '感覚と量', text: 'どのくらい？' }, STEPS), null); // 一覧にない工程
  assert.equal(checkKikikaeshi({ step: '見回り', kata: '正しいやり方', text: 'どのくらい？' }, STEPS), null); // 一覧にない型
  assert.equal(checkKikikaeshi({ step: '見回り', kata: '失敗談', text: '一時間以内に冷やすのが正しいです。' }, STEPS), null); // 答えている（？で終わらない）
});

test('抜け探しの検査：ある記録の id だけ・短い指摘だけ。お金や交付金の判断が混ざれば使わない', () => {
  const logs = [{ id: 'a5', text: '7番にシカが二頭かかっとった。', count: 1 }, { id: 'a6', text: '4番の知らせで向かった。' }];
  assert.deepEqual(checkNuke({ items: [{ id: 'a5', label: '言葉は二頭、頭数は1' }, { id: 'zz', label: 'ない記録' }, { id: 'a6', label: '' }] }, logs), [{ id: 'a5', label: '言葉は二頭、頭数は1' }]);
  assert.equal(checkNuke({ items: [{ id: 'a5', label: '報償金の対象になる' }] }, logs), null);
  assert.deepEqual(checkNuke('json ではない', logs), []);
  assert.ok(PROMPTS.nuke.system.includes('金額を書かない'));
  assert.ok(PROMPTS.nuke.system.includes('直す案を書かない'));
});

test('サーバー：キーが無いときは未接続と返し、Claude には頼まない', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  try {
    const s = await (await fetch(`${base}/api/ai/status`)).json();
    assert.equal(s.connected, false);
    const r = await fetch(`${base}/api/ai/seiri`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: '朝は見回り。' }) });
    assert.equal(r.status, 503);
    const r2 = await fetch(`${base}/api/ai/nuke`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ logs: [] }) });
    assert.equal(r2.status, 503);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
