// Claude をつなぐ配線。
// キーは環境変数 ANTHROPIC_API_KEY（.env も読む）で受け取り、コードやリポジトリには入れない。
// キーが無ければ「見本（未接続）」のままで、画面は言葉の照らし合わせ（public/lib/kikikata.js）で動く。
// Claude にさせるのは2つだけ：整理（話を手順と注意に分ける・上位モデル）／聞き返し（1つだけ・軽いモデル）。
// 本人の言葉のまま（言い換えない・足さない）、答えない・断定しない、人を評価しない、を型と検査（check〜）で守る。
// 外部のライブラリは使わず、Node.js の fetch で Messages API を直接呼ぶ。
import { readFileSync } from 'node:fs';
import { KATA } from '../public/lib/kikikata.js';

export const MODELS = {
  seiri: { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
  kikikaeshi: { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
  nuke: { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
};
export const API_VERSION = '2026-10-21';
const apiUrl = (env) => `${String(env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`;

// ---------- .env（KEY=VALUE の行だけ。無ければ何もしない） ----------
export function parseEnv(text) {
  const out = {};
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}
export function loadEnv(path, env = process.env) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { return env; }
  for (const [k, v] of Object.entries(parseEnv(text))) if (!(k in env)) env[k] = v;
  return env;
}

export const apiKey = (env = process.env) => String(env.ANTHROPIC_API_KEY || '').trim();
export const aiStatus = (env = process.env) => ({
  connected: !!apiKey(env),
  models: Object.fromEntries(Object.entries(MODELS).map(([k, m]) => [k, m.label])),
});

// ---------- 型（プロンプト）----------
const RULES = `守ること：
- 本人の言葉のまま。言い換えない・標準語に直さない・言っていないことを足さない・要約しない
- 捕獲・処理のやり方、法令、衛生、資格、見回りの決まりについて、答えない・教えない・断定しない・正しいかどうかを言わない
- 人を評価しない・順位をつけない・点数をつけない
- 体のぐあいの話には触れない。生々しい言い方を足さない
- 出力は JSON だけ。前後に説明を書かない`;

export const PROMPTS = {
  seiri: {
    system: `あなたは「ジビエつなぎ」の整理役です。ベテラン猟師が話した言葉を、文ごとに「手順（すること）」と「注意（なぜそうするか・危ないこと・やってはいけないこと）」に分け、それぞれの文がどの工程の話かを付けます。
文は一字も変えずに、話に出てきた順のまま振り分けます。分けるだけで、足さない・削らない。
工程は渡された一覧の名前だけを使い、どの工程とも言えない文は付けません（「一人で行くと危ない」のように、直前の文の工程の注意なら、その工程を付けます）。
${RULES}
出力の形：{"tejun":["文","文"],"chui":["文"],"koutei":{"文":"工程の名前"}}`,
    user: ({ text, steps = [] }) => `工程の一覧：${steps.join('／')}\n\n話した言葉：\n${text}`,
  },
  kikikaeshi: {
    system: `あなたは「ジビエつなぎ」の聞き手です。ベテラン猟師の話を読み、次に聞くことを「1つだけ」作ります。
聞き方の型（.claude/skills/jukuren-kikikata）：${KATA.map((k) => k.label).join('・')}
進め方：
1. 話の中に「とにかく早く」「しっかり」のような、数の分からない言い方があれば、そこを先に「どのくらい（時間・回数・量）」で聞く（型：感覚と量）。勘どころはそこに隠れている
2. 無ければ、まだ話に出ていない工程を、型のどれかで聞く
3. 全部出ていれば、出ている工程を型で深く聞く
質問は1つだけ（「？」は1つ）。短く、やさしい言葉で。同じ型ばかりにしない。
${RULES}
出力の形：{"step":"工程の名前（渡された一覧から）","kata":"型の名前（上の一覧から）","text":"聞き返しの文（？で終わる）","said":"もとになった本人の言葉を短く（なければ空）"}`,
    user: ({ texts, steps }) => `工程の一覧：${steps.join('／')}\n\nこれまでに残した話（古い順）：\n${texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`,
  },
  nuke: {
    system: `あなたは「ジビエつなぎ」の記録の抜け探し役です（.claude/agents/kiroku-nuke と同じ役）。活動と捕獲の記録を読み、「話した言葉」と「欄（種類・わな・獣種・頭数）」の食い違いだけを見つけます。
例：言葉は「2頭」なのに頭数が 1／言葉は「空やった」なのに種類が捕獲／言葉は「3番」なのにわなが 5番／言葉はイノシシなのに獣種がシカ。
食い違いが無い記録は出しません。写真なし・日時なしなどの抜けはアプリが別に出すので書きません。
${RULES}
- 記録を書き換えない・直す案を書かない（直すのはチーム）
- 交付金・報償金の対象かどうか、金額を書かない
- 写真から獣の種類を判定しない
出力の形：{"items":[{"id":"記録の id","label":"短い指摘（例：言葉は2頭、頭数は1）"}]}`,
    user: ({ logs }) => `記録（JSON）：\n${JSON.stringify(logs)}`,
  },
};

export function requestBody(task, payload) {
  const m = MODELS[task];
  const p = PROMPTS[task];
  if (!m || !p) throw new Error(`知らない役：${task}`);
  return {
    model: m.id,
    max_tokens: 2000,
    system: [{ type: 'text', text: p.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: p.user(payload) }],
    output_config: { effort: 'low' },
  };
}

// 返事の文字から JSON を取り出す（前後に説明や ``` が付いても拾う）
export function parseJson(text) {
  const s = String(text || '').replace(/```(?:json)?/g, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('返事が JSON ではありませんでした');
  return JSON.parse(s.slice(a, b + 1));
}

export async function callClaude(task, payload, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const key = apiKey(env);
  if (!key) throw new Error('未接続');
  const res = await fetchImpl(apiUrl(env), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': API_VERSION },
    body: JSON.stringify(requestBody(task, payload)),
  });
  if (!res.ok) throw new Error(`Claude の返事がエラーでした（${res.status}）`);
  const msg = await res.json();
  if (msg.stop_reason === 'refusal') throw new Error('Claude が答えませんでした');
  const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { data: parseJson(text), model: MODELS[task].label };
}

// ---------- 検査：型を守れていない返事は使わず、見本（言葉の照らし合わせ）に戻す ----------
const sentences = (text) => String(text || '').split(/(?<=[。！？!?\n])/).map((x) => x.trim()).filter(Boolean);

// 整理：文は元の文と一字も違わないものだけ。Claude が決めるのは「どの文が注意か」「どの工程の話か」だけで、並びは元のまま。
// 工程は一覧の中の名前だけを受け取り、合わないものは付けない（文は落とさない）
export function checkSeiri(text, out, steps = []) {
  const src = sentences(text);
  const chui = new Set((Array.isArray(out?.chui) ? out.chui : []).map((s) => String(s).trim()));
  const tejun = (Array.isArray(out?.tejun) ? out.tejun : []).map((s) => String(s).trim());
  for (const s of [...tejun, ...chui]) if (s && !src.includes(s)) return null; // 言い換え・足した文があれば使わない
  const koutei = {};
  for (const [s, st] of Object.entries(out?.koutei && typeof out.koutei === 'object' ? out.koutei : {})) {
    const sen = String(s).trim();
    if (src.includes(sen) && steps.includes(st)) koutei[sen] = st;
  }
  return { tejun: src.filter((s) => !chui.has(s)), chui: src.filter((s) => chui.has(s)), koutei };
}

// 抜け探し：ある記録の id だけ・短い指摘だけ。お金や交付金の判断が混ざっていれば使わない
const MONEY = /(円|金額|交付|報償|対象|補助)/;
export function checkNuke(out, logs) {
  const ids = new Set(logs.map((r) => String(r.id)));
  const items = Array.isArray(out?.items) ? out.items : [];
  const seen = new Set();
  const result = [];
  for (const it of items) {
    const id = String(it?.id || '');
    const label = String(it?.label || '').trim();
    if (!ids.has(id) || !label || label.length > 40 || seen.has(id + label)) continue;
    if (MONEY.test(label)) return null;
    seen.add(id + label);
    result.push({ id, label });
  }
  return result;
}

// 聞き返し：質問は1つだけ・工程と型は一覧の中から・短く・「？」で終わる
export function checkKikikaeshi(out, steps) {
  const text = String(out?.text || '').trim();
  if (!text || text.length > 80) return null;
  if ((text.match(/[？?]/g) || []).length !== 1 || !/[？?]$/.test(text)) return null;
  if (!steps.includes(out?.step)) return null;
  const kata = KATA.find((k) => k.label === out?.kata);
  if (!kata) return null;
  return { step: out.step, kata: kata.label, text, said: String(out?.said || '').trim() || null, reason: 'Claude の聞き返し' };
}
