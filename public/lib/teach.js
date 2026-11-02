// 教えた記録：決まった数え方だけ（ブラウザとテストの両方で使う）。
// 金額は決めない・お金は動かさない・教え方に点数をつけない。
// 人の並びは、渡された順（チームの名簿の順）のまま。回数の多い順には並べ替えない。

export const monthOf = (date) => String(date).slice(0, 7); // "2026-10-24" → "2026-10"

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const monthLabel = (month) => {
  const [y, m] = month.split('-').map(Number);
  return `${y}年${m}月`;
};

// ベテラン本人とチームの両方が「はい」を押したら、確かめ済み
export const isConfirmed = (r) => !!(r.teacherOk && r.teamOk);

export function recordsForMonth(records, month) {
  return records.filter((r) => monthOf(r.date) === month).sort((a, b) => a.date.localeCompare(b.date));
}

// 教えた人ごとの回数（確かめ済み／確認待ち）。order に並びを渡す（名簿の順）
export function summarizeByTeacher(records, order = []) {
  const map = new Map(order.map((name) => [name, { teacher: name, confirmed: 0, waiting: 0, roles: [] }]));
  for (const r of records) {
    if (!map.has(r.teacher)) map.set(r.teacher, { teacher: r.teacher, confirmed: 0, waiting: 0, roles: [] });
    const s = map.get(r.teacher);
    if (isConfirmed(r)) s.confirmed += 1;
    else s.waiting += 1;
    if (!s.roles.includes(r.role)) s.roles.push(r.role);
  }
  return [...map.values()].filter((s) => s.confirmed + s.waiting > 0);
}

// 表計算ソフトで開いたときに式として動かないよう、先頭の = + - @ を無効にする
function cell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 月ごとの一覧を CSV に（Excel で文字化けしないよう、先頭に BOM を付けるのは呼ぶ側）
export function toCsv(records) {
  const head = ['日付', '工程', '教えた人', '一緒にやった人', 'したこと', 'ベテラン本人の確認', 'チームの確認'];
  const rows = records.map((r) => [
    r.date, r.role, r.teacher, r.partner, r.what || '',
    r.teacherOk ? 'はい' : '未', r.teamOk ? 'はい' : '未',
  ]);
  return [head, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
