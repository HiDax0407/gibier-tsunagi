// 見守り：決まった計算だけ（ブラウザとテストの両方で使う）。
// 体調は AI が判断しない（医療の助言はしない）。見るのは「最後に話した日」だけ。
// 「◯日話していない」ときに、本人が決めた知らせ先（家族・チーム）へ知らせる設定だけを持つ。
// 健康の話は記録しない。

// 体のぐあいの話と分かる言葉（この言葉を含む文は残さない）
export const HEALTH_WORDS = [
  '体調', '具合', 'ぐあい', '痛', 'いたい', '病院', '医者', '診察', '入院', '薬', '病気', '持病',
  '腰', '膝', 'ひざ', '血圧', '熱が', 'しんどい', 'けが', '怪我', '手術', 'めまい', '息切れ',
];

// 文に分けて、体のぐあいの話の文を除く。除いた文は返すだけで、どこにも残さない
export function splitHealth(text) {
  const parts = String(text || '').split(/(?<=[。！？!?\n])|　/).map((s) => s.trim()).filter(Boolean);
  const kept = [];
  const dropped = [];
  for (const p of parts) (HEALTH_WORDS.some((w) => p.includes(w)) ? dropped : kept).push(p);
  return { kept: kept.join(''), dropped };
}

// 暦の日で何日前か（時刻は見ない）
export function daysSince(iso, now) {
  if (!iso) return null;
  const a = new Date(iso);
  const b = new Date(now);
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86400e3);
}

// people：名簿の順（並べ替えない）。last：名前→最後に話した日時。settings：名前→{ afterDays, notify }
export function watchList(people, last, settings, now) {
  return people.map((name) => {
    const s = settings[name] || { afterDays: 3, notify: [] };
    const days = daysSince(last[name], now);
    return {
      name,
      last: last[name] || null,
      days,
      afterDays: s.afterDays,
      notify: s.notify || [],
      over: days != null && days >= s.afterDays && (s.notify || []).length > 0,
    };
  });
}
