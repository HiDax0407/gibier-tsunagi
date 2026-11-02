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
  '止め・搬送': ['止め', '運ぶ', '運んで', '仲間を呼'],
  '処理（洗浄・解体）': ['処理場', '洗う', '洗っ', '皮'],
  '冷蔵・保管': ['冷や', '冷蔵'],
  '出荷・店とのやりとり': ['店', '出荷', '注文'],
  '記録（日付・場所）': ['紙に書', '記録', '何月何日'],
};

export function stepCoverage(texts, steps) {
  const all = texts.join('\n');
  return steps.map((step) => ({ step, heard: (STEP_WORDS[step] || [step]).some((w) => all.includes(w)) }));
}

export const missingSteps = (texts, steps) => stepCoverage(texts, steps).filter((x) => !x.heard).map((x) => x.step);

// 次に聞くことを1つだけ。まだ聞けていない工程があれば、そこから。
// 型は話の数で順に回す（毎回同じ聞き方にならないように）。食い違いの確認は使わない。
export function nextQuestion(texts, steps) {
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
