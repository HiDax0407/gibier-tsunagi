// CSV の書き出し（教えた記録・活動の記録・町の集計で共通）。
// 表計算ソフトで開いたときに式として動かないよう、先頭の = + - @ を無効にする。
// Excel で文字化けしないよう、先頭に BOM を付けるのは呼ぶ側。
export function cell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsvText = (head, rows) =>
  [head, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
