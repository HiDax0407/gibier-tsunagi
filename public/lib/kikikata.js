// 熟練の業を引き出す聞き方の型（ブラウザとテストの両方で使う）。
// 型の正は .claude/skills/jukuren-kikikata/SKILL.md。ここはその型を画面で使うための写し。
// Claude をつなぐ前は、言葉の照らし合わせで「まだ聞けていない工程」を出し、型から聞き返しを1つだけ作る。
// 聞くだけで、答えない。捕獲・処理のやり方、法令、衛生、資格の決まりについて、アプリは答えない・断定しない。

export const KATA = [
  { id: 'shippai', label: '失敗談', ask: (s) => `${s}で、うまくいかなかったときのことを教えてください。` },
  { id: 'mikiwake', label: '良し悪しの見分け方', ask: (s) => `${s}で、良いときと悪いときは、どこで見分けますか？` },
  { id: 'ryou', label: '感覚と量', ask: (s) => `${s}は、どのくらい（時間・回数・量）が目安ですか？` },
  { id: 'mukashi', label: '昔と今の違い', ask: (s) => `${s}は、昔と今で変わったところはありますか？` },
  { id: 'shinjin', label: '新人がよくやる間違い', ask: (s) => `${s}で、新しく入った人がよくやる間違いは何ですか？` },
  // 話の食い違いの確認は、二つの話を読み比べる必要があるため Claude をつないでから使う
  { id: 'kuichigai', label: '話の食い違いの確認', ask: (s) => `${s}について、前のお話と少し違うところがありました。どちらが近いですか？`, needsClaude: true },
];

// 工程ごとの、話に出てきたと分かる言葉
export const STEP_WORDS = {
  '見回り': ['見回り', '見て回', '毎朝見'],
  'わなの設置・点検': ['仕掛け', '設置', '点検', '壊れ'],
  '止め・搬送': ['止め', '運ぶ', '運んで', '仲間を呼', '冷や'],
  '処理（洗浄・解体）': ['処理場', '洗う', '洗っ', '皮'],
  '冷蔵・保管': ['冷蔵', '温度'],
  '出荷・店とのやりとり': ['店', '出荷', '注文'],
  '記録（日付・場所）': ['紙に書', '記録', '何月何日'],
};

export function stepCoverage(texts, steps) {
  const all = texts.join('\n');
  return steps.map((step) => ({ step, heard: (STEP_WORDS[step] || [step]).some((w) => all.includes(w)) }));
}

export const missingSteps = (texts, steps) => stepCoverage(texts, steps).filter((x) => !x.heard).map((x) => x.step);

// その工程の言葉が出てくる文だけを、話に出てきた順に集め、手順と注意に分ける（文は本人の言葉のまま・言い換えない）
export function stepSentences(texts, step) {
  const words = STEP_WORDS[step] || [step];
  const tejun = [];
  const chui = [];
  for (const text of texts) {
    const sp = splitTejun(text);
    for (const s of sp.tejun) if (words.some((w) => s.includes(w))) tejun.push(s);
    for (const s of sp.chui) if (words.some((w) => s.includes(w))) chui.push(s);
  }
  return { tejun, chui };
}

// ---------- 「とにかく早く」のような、量の分からない言い方 ----------
// 勘どころは、たいてい「どのくらい」に隠れている。数のない言い方を見つけたら、そこを先に聞く（感覚と量）。
const VAGUE = [
  { re: /(早く|早う|はよう|すぐ)/, ask: 'どのくらいの早さで' },
  { re: /(しっかり|よう|よく|ちゃんと|きれいに)/, ask: 'どこまでやれば十分' },
  { re: /(ちょっと|少し|だいたい)/, ask: 'どのくらいの量で' },
];
const HAS_NUMBER = /[0-9０-９一二三四五六七八九十]+\s*(分|時間|日|回|度|℃|頭|人|キロ|kg|cm|センチ|メートル|m)|半日|半時間/;
// 工程ごとの「すること」の言い方（聞き返しの文に使う）
const VERB = {
  '見回り': '見て回る', 'わなの設置・点検': '点検する', '止め・搬送': '冷やす',
  '処理（洗浄・解体）': '洗う', '冷蔵・保管': '冷蔵庫で見る', '出荷・店とのやりとり': '店に連絡する', '記録（日付・場所）': '書いて残す',
};
const sentences = (text) => String(text || '').split(/(?<=[。！？!?\n])/).map((x) => x.trim()).filter(Boolean);

// 言葉 → 聞き返しに使う「すること」
const VERB_BY_WORD = { '冷や': '冷やす', '運ぶ': '運ぶ', '運んで': '運ぶ', '洗う': '洗う', '洗っ': '洗う', '見回り': '見て回る', '点検': '点検する', '紙に書': '書いて残す', '温度': '温度を見る' };

export function vagueQuestion(texts, steps) {
  const allSen = sentences(texts.join('\n'));
  // 新しい話から見る
  for (const text of [...texts].reverse()) {
    for (const sen of sentences(text)) {
      const v = VAGUE.find((x) => x.re.test(sen));
      if (!v || HAS_NUMBER.test(sen)) continue;
      // この文に出てくる工程の言葉（量の言い方のすぐ後ろにある言葉を、聞く相手にする）
      const at = sen.search(v.re);
      const hits = steps.flatMap((st) => (STEP_WORDS[st] || [st]).filter((w) => sen.includes(w)).map((w) => ({ st, w, i: sen.indexOf(w) })));
      if (!hits.length) continue;
      const after = hits.filter((h) => h.i > at).sort((a, b) => a.i - b.i);
      const hit = after[0] || hits[0];
      // 同じ言葉について、どこかでもう数を言っていれば聞かない
      if (allSen.some((x) => HAS_NUMBER.test(x) && x.includes(hit.w))) continue;
      const verb = VERB_BY_WORD[hit.w] || VERB[hit.st] || hit.st;
      return { step: hit.st, kata: '感覚と量', text: `${verb}のは、${v.ask}？`, reason: '数の分からない言い方', said: sen };
    }
  }
  return null;
}

// 次に聞くことを1つだけ。
// 1) 話の中の「とにかく早く」のような数のない言い方（勘どころ）を先に聞く
// 2) まだ聞けていない工程があれば、そこから
// 型は話の数で順に回す（毎回同じ聞き方にならないように）。食い違いの確認は使わない。
export function nextQuestion(texts, steps) {
  const vague = vagueQuestion(texts, steps);
  if (vague) return vague;
  const usable = KATA.filter((k) => !k.needsClaude);
  const kata = usable[texts.length % usable.length];
  const missing = missingSteps(texts, steps);
  if (missing.length) {
    const step = missing[0];
    return { step, kata: kata.label, text: `${step}のことは、まだ聞けていません。${kata.ask(step)}`, reason: 'まだ聞けていない工程' };
  }
  const step = steps[texts.length % steps.length];
  return { step, kata: kata.label, text: kata.ask(step), reason: '深く聞く' };
}

// ---------- 手順と注意に分ける（Claude をつなぐ前の見本） ----------
// 文は本人の言葉のまま。分けるだけで、言い換えない・足さない。
// 危ない・ダメ・手抜き などの言葉がある文と、その直前の「なぜ」にあたる文を「注意」に置く。
const CAUTION = /(危な|ダメ|だめ|いかん|あかん|手抜き|台無し|気をつけ|絶対|必ず|せんと|しないと|誰も知らん)/;
export function splitTejun(text) {
  const tejun = [];
  const chui = [];
  for (const sen of sentences(text)) (CAUTION.test(sen) ? chui : tejun).push(sen);
  return { tejun, chui };
}
