// わなの地図：わなの状態を決める決まった計算（ブラウザとテストの両方で使う）。
// 機器は作らない。センサーの知らせは画面のボタンとタイマーで模擬する。
// わなの場所はチームの中だけで見る（町の画面には数だけ）。

export const STATE_LABEL = { caught: '入った', stale: 'しばらく見ていない', empty: '空', checked: '見回り済み' };
export const STATE_ORDER = ['caught', 'stale', 'empty', 'checked'];

const sameDay = (a, b) => {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};

// わなの状態
//  入った：センサーの知らせ（模擬）か、見回った人の話で「かかっていた」とき
//  しばらく見ていない：最後に見た時から、チームで決めた時間より長くたった
//  見回り済み：今日見た / 空：それ以外
export function trapState(trap, now, staleHours) {
  if (trap.signal === 'caught') return 'caught';
  const last = trap.lastChecked ? Date.parse(trap.lastChecked) : NaN;
  if (!Number.isFinite(last) || now - last > staleHours * 3600e3) return 'stale';
  if (sameDay(last, now)) return 'checked';
  return 'empty';
}

export function countStates(traps, now, staleHours) {
  const n = Object.fromEntries(STATE_ORDER.map((s) => [s, 0]));
  for (const t of traps) n[trapState(t, now, staleHours)] += 1;
  return n;
}

// デモデータの「◯時間前に見た」を、画面を開いた時刻からの日時にする（いつ開いても同じ見え方になる）
export function placeTraps(list, now) {
  return list.map((t) => ({
    ...t,
    lastChecked: t.checkedHoursAgo == null ? null : new Date(now - t.checkedHoursAgo * 3600e3).toISOString(),
    signal: t.signal || null,
  }));
}

// 模擬の知らせ：まだ「入った」になっていないわなを、番号の順に1つ選ぶ（決まった順。人は選ばない）
export function nextSignalTrap(traps, afterNo = 0) {
  const open = traps.filter((t) => t.signal !== 'caught').sort((a, b) => a.no - b.no);
  return open.find((t) => t.no > afterNo) || open[0] || null;
}

// ---------- 見回った人の話から、わなの番号・結果・獣の種類・頭数を拾う ----------
// Claude をつなぐ前の、言葉の照らし合わせ。拾えたものは画面に出し、本人が確かめてから残す。
const KANJI = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function toNum(s) {
  if (/^\d+$/.test(s)) return Number(s);
  if (s === 'ひと') return 1;
  if (s === 'ふた') return 2;
  if (s === '十') return 10;
  if (/^十[一二三四五六七八九]$/.test(s)) return 10 + KANJI[s[1]];
  if (/^[一二三四五六七八九]十$/.test(s)) return KANJI[s[0]] * 10;
  return KANJI[s] ?? null;
}

// 「かかっていない」などの打ち消しを先に見る（「かかっ」を含むため）
const NEG = /(おらん|おらへん|おらな|おらんかった|いない|いなかった|かかってない|かかってなかった|かかっとらん|かかっていない|かかっていなかった|かかってへん|入ってない|入っとらん|入っていない|何もなし|なにもなし|からっぽ|空っぽ|空(だ|や|で|。|、|$))/;
const POS = /(かかっ|掛かっ|入っ|おった|おりました)/;

export function parsePatrol(text, traps = []) {
  const t = String(text || '').normalize('NFKC');
  const m = t.match(/([0-9]+|[一二三四五六七八九十]+)\s*番/);
  const no = m ? toNum(m[1]) : null;
  const trap = no == null ? null : traps.find((x) => x.no === no) || null;

  let result = null;
  if (NEG.test(t)) result = 'empty';
  else if (POS.test(t)) result = 'caught';

  let species = null;
  if (/(シカ|鹿)/.test(t)) species = 'シカ';
  else if (/(イノシシ|いのしし|猪)/.test(t)) species = 'イノシシ';

  const c = t.match(/([0-9]+|[一二三四五六七八九]|ひと|ふた)\s*(頭|とう)/);
  const count = c ? toNum(c[1]) : null;

  return { no, trapId: trap ? trap.id : null, result, species, count };
}
