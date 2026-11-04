// 活動と捕獲の記録：決まった計算だけ（ブラウザとテストの両方で使う）。
// AI は下書きと抜けの指摘まで。交付金・報償金の対象かどうかと金額は判断しない。
// 町に出すのは、チームが確かめて「出す」を押したものだけ。
// 写真は添付として残すだけで、写真から獣の種類を判定しない。
import { toCsvText } from './csv.js';
import { monthOf } from './teach.js';

export const KINDS = ['見回り', '捕獲', '出動'];
export const SPECIES = ['シカ', 'イノシシ', 'その他'];

// 町の様式に合わせて、出す列と並びを選べる
export const COLUMNS = [
  { id: 'datetime', label: '日時' },
  { id: 'kind', label: '種類' },
  { id: 'trap', label: 'わな' },
  { id: 'district', label: '地区' },
  { id: 'species', label: '獣種' },
  { id: 'count', label: '頭数' },
  { id: 'photo', label: '写真' },
  { id: 'by', label: '記録した人' },
  { id: 'teamOk', label: 'チームの確認' },
  { id: 'text', label: '話した言葉' },
];
export const DEFAULT_COLUMNS = ['datetime', 'kind', 'trap', 'district', 'species', 'count', 'photo'];

export const fmtDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// 列の値（文字だけ）
export function cellValue(rec, col, districtNames = {}) {
  switch (col) {
    case 'datetime': return fmtDateTime(rec.datetime);
    case 'kind': return rec.kind || '';
    case 'trap': return rec.trapNo ? `${rec.trapNo}番` : '';
    case 'district': return districtNames[rec.district] || rec.district || '';
    case 'species': return rec.kind === '捕獲' ? rec.species || '' : '';
    case 'count': return rec.kind === '捕獲' && rec.count ? String(rec.count) : '';
    case 'photo': return rec.photo ? 'あり' : 'なし';
    case 'by': return rec.by || '';
    case 'teamOk': return rec.teamOk ? 'はい' : '未';
    case 'text': return rec.text || '';
    default: return '';
  }
}

// 日時のない記録は、月の一覧で「日時なし」として最後に並べる
export function logsForMonth(logs, month) {
  return logs
    .filter((r) => !r.datetime || monthOf(fmtDateTime(r.datetime)) === month)
    .sort((a, b) => (a.datetime ? fmtDateTime(a.datetime) : '9').localeCompare(b.datetime ? fmtDateTime(b.datetime) : '9'));
}

// 抜けチェック（Claude をつなぐ前は、決まった照らし合わせだけ）
//  写真なし（捕獲のとき）・日時なし・獣種なし・頭数なし（捕獲のとき）・チームの確認待ち
export function findGaps(logs) {
  const gaps = [];
  for (const r of logs) {
    const add = (type, label) => gaps.push({ id: r.id, type, label });
    if (!r.datetime) add('datetime', '日時なし');
    if (r.kind === '捕獲') {
      if (!r.photo) add('photo', '写真なし');
      if (!r.species) add('species', '獣種なし');
      if (!r.count) add('count', '頭数なし');
    }
    if (!r.teamOk) add('team', 'チームの確認待ち');
  }
  return gaps;
}

// 町へ出した記録（月ごとの申請を「出す」と、その月のチームが確かめた記録に印が付く）
export const sentOnly = (logs) => logs.filter((r) => r.teamOk && r.sent);

// 出す一覧：チームが確かめた記録（出すかどうかは月ごとの申請で決める）
export function draftTable(logs, columns, districtNames = {}) {
  const cols = columns.filter((c) => COLUMNS.some((x) => x.id === c));
  return {
    head: cols.map((c) => COLUMNS.find((x) => x.id === c).label),
    rows: logs.filter((r) => r.teamOk).map((r) => cols.map((c) => cellValue(r, c, districtNames))),
  };
}

export function draftCsv(logs, columns, districtNames = {}) {
  const { head, rows } = draftTable(logs, columns, districtNames);
  return toCsvText(head, rows);
}

// 地区ごとの数（町へ出したものだけ）：シカ・イノシシの頭数、見回りの回数、出動の回数
// month（"2026-11"）を渡すと、その月の分だけ。渡さなければ全部
export function districtTotals(logs, districtId, month = null) {
  const sent = sentOnly(logs).filter((r) => r.district === districtId && (!month || monthOf(fmtDateTime(r.datetime)) === month));
  const heads = (sp) => sent.filter((r) => r.kind === '捕獲' && r.species === sp).reduce((n, r) => n + (Number(r.count) || 0), 0);
  return {
    deer: heads('シカ'),
    boar: heads('イノシシ'),
    other: heads('その他'),
    patrol: sent.filter((r) => r.kind === '見回り').length,
    dispatch: sent.filter((r) => r.kind === '出動').length,
  };
}
