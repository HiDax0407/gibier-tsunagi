// 町とのやりとり（月ごとの申請）：決まった計算だけ（ブラウザとテストの両方で使う）。
// アプリは「対象かどうか・金額・許可の可否」を判断しない。止まっている所と足りない物を見えるようにし、
// 「出す」「再提出」はチームが、「確認」「戻す」「支払い」は町の人が押す。AI は使わない。
export const STATES = {
  draft: { label: '下書き', next: 'team' },
  checking: { label: '町が確認中', next: 'town' },
  returned: { label: '不足で戻った', next: 'team' },
  confirmed: { label: '確認済み・支払い待ち', next: 'town' },
  done: { label: '完了', next: null },
};
export const WHO = { team: 'チーム', town: '町' };

// 動き：誰が・どの状態から・どの状態へ
export const ACTIONS = {
  send: { by: 'team', from: ['draft'], to: 'checking', label: '町へ出す', note: '出した' },
  resend: { by: 'team', from: ['returned'], to: 'checking', label: '直して再提出', note: '直して再提出' },
  confirm: { by: 'town', from: ['checking'], to: 'confirmed', label: '確認' },
  return: { by: 'town', from: ['checking'], to: 'returned', label: '戻す' },
  pay: { by: 'town', from: ['confirmed'], to: 'done', label: '支払った', note: '支払い' },
};

export const stateOf = (app) => app.history.at(-1)?.state || 'draft';
export const sinceOf = (app) => app.history.at(-1)?.at || null;
export const nextOf = (app) => STATES[stateOf(app)]?.next || null;
export const lastReturn = (app) => [...app.history].reverse().find((h) => h.state === 'returned') || null;

// 止まっている日数（最後に動いた日から）。日付は YYYY-MM-DD
export function daysSince(date, now = Date.now()) {
  if (!date) return null;
  const t = Date.parse(String(date).slice(0, 10));
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86400e3));
}

export function act(app, action, { at, reason = '', note = '' } = {}) {
  const a = ACTIONS[action];
  if (!a) throw new Error(`知らない動き：${action}`);
  const cur = stateOf(app);
  if (!a.from.includes(cur)) throw new Error(`「${STATES[cur].label}」からは「${a.label}」できません`);
  if (action === 'return' && !reason) throw new Error('戻す理由を選んでください');
  const entry = { state: a.to, at: String(at).slice(0, 10), by: a.by };
  if (a.note || note) entry.note = note || a.note;
  if (reason) entry.reason = reason;
  return { ...app, history: [...app.history, entry] };
}

// 町の必要項目と照らす。足りない記録だけを返す（指摘だけ。直すのはチーム）
export function requiredGaps(records, rules) {
  const items = (rules?.required || []).filter((it) => it.enabled !== false);
  const has = { photo: (r) => !!r.photo, datetime: (r) => !!r.datetime, trap: (r) => !!r.trapNo, species: (r) => !!r.species, count: (r) => !!r.count, by: (r) => !!r.by, tail: (r) => !!r.tail };
  const out = [];
  for (const r of records) {
    const missing = items.filter((it) => (it.kinds || []).includes(r.kind) && has[it.id] && !has[it.id](r)).map((it) => it.label);
    if (missing.length) out.push({ id: r.id, missing });
  }
  return out;
}
export const canSend = (gaps) => gaps.length === 0;

// その地区・その月の申請。無ければ下書きを作る
export function monthlyApp(apps, district, month) {
  const found = apps.find((a) => a.district === district && a.month === month);
  return found || { id: `ap-${district}-${month}`, district, month, history: [{ state: 'draft', at: `${month}-01`, by: 'team' }], local: true };
}

// 免許・許可の期限：ahead 日前から知らせる（可否は判断しない・本人申告）
export function expiringLicenses(list, now = Date.now(), ahead = 60) {
  const out = [];
  for (const p of list || []) {
    for (const it of p.items || []) {
      const d = daysUntil(it.expires, now);
      if (d != null && d <= ahead) out.push({ name: p.name, kind: it.kind, expires: it.expires, days: d });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}
export function daysUntil(date, now = Date.now()) {
  const t = Date.parse(String(date).slice(0, 10));
  return Number.isNaN(t) ? null : Math.ceil((t - now) / 86400e3);
}
