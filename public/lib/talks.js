// 残した話は、話した本人のもの（ブラウザとテストの両方で使う）。
// 「使ってよい範囲」は本人が決める。アプリや AI は範囲を勝手に広げない・言葉を足さない。
// ログインはないので、範囲は「本人の了承の宣言」であって、閲覧の制限（強制）ではない。
import { toCsvText } from './csv.js';
import { splitTejun } from './kikikata.js';

export const SCOPES = [
  { id: 'team', label: 'チームの中で使ってよい（新しく入る人が読める）', short: 'チームの中' },
  { id: 'self', label: 'まだ本人だけ（チームには見せない）', short: '本人だけ' },
];
export const scopeOf = (talk) => (SCOPES.some((s) => s.id === talk?.scope) ? talk.scope : 'team');
export const scopeLabel = (id, short = false) => (SCOPES.find((s) => s.id === id) || SCOPES[0])[short ? 'short' : 'label'];

// チームが使ってよい話だけ（チームの表・町の数・工程ごとの言葉に使う）
export const teamTalks = (talks) => talks.filter((t) => scopeOf(t) === 'team');

// 書き出し：出典（誰が・いつ・範囲）を必ず付ける。本人だけの話は書き出さない
export function talksCsv(talks) {
  const head = ['日付', '話した人', '使ってよい範囲', '手順か注意', '文（本人の言葉のまま）'];
  const rows = [];
  for (const t of teamTalks(talks)) {
    const sp = splitTejun(t.text);
    for (const s of sp.tejun) rows.push([t.date, t.who, scopeLabel('team', true), '手順', s]);
    for (const s of sp.chui) rows.push([t.date, t.who, scopeLabel('team', true), '注意', s]);
  }
  return toCsvText(head, rows);
}
