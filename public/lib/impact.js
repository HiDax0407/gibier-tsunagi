// 「被害を減らす」見える化：決まった計算だけ（ブラウザとテストの両方で使う）。
// 数を並べるだけで、良い・悪いの判定や、人の評価はしない。
// 被害の増減は天候・獣の数・柵などでも変わるため、アプリの効果とは言わない。

// 最初の月と最後の月の差
export function change(series) {
  const first = series[0] ?? 0;
  const last = series.at(-1) ?? 0;
  return { first, last, diff: last - first };
}

// 月ごとの捕獲（シカ＋イノシシ）
export const catches = (deer, boar) => deer.map((d, i) => d + (boar[i] || 0));

// 目盛り：0 から、最大値を少し超えるきりのよい数まで
export function niceMax(values, steps = 4) {
  const max = Math.max(1, ...values);
  const raw = max / steps;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw);
  return { max: step * steps, step };
}

export const monthShort = (m) => `${Number(String(m).slice(5, 7))}月`;
