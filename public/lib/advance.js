// 精算の準備を先に（現場の方の指摘④：駆除のあとの手続きが面倒。先に捕獲者名と必要な写真を送り、
// 町はそれで精算の準備をする。現物を持ってきたら、すぐに対応できるように）。
// 決まった照らし合わせだけ：写真の枚数と項目の有無を見る。AI は使わない。
// 獣種を写真から判定しない・金額を決めない・対象かどうかを判断しない。「先に送る」はチーム、「現物を確認」「精算へ」は町の人が押す。

const HAS = { by: (r) => !!r.by, datetime: (r) => !!r.datetime, trap: (r) => !!r.trapNo };

// 写真と項目の揃い。photos は { 写真のid: 画像 } 
export function advanceCheck(rec, photos = {}, rules = {}) {
  const need = rules.photos || [];
  const items = rules.items || [];
  const missingPhotos = need.filter((p) => !photos[p.id]).map((p) => p.label);
  const missingItems = items.filter((it) => HAS[it.id] && !HAS[it.id](rec)).map((it) => it.label);
  return {
    photos: need.length - missingPhotos.length,
    of: need.length,
    missingPhotos,
    missingItems,
    ready: need.length > 0 && !missingPhotos.length && !missingItems.length,
  };
}

// 町側の状態：まだ送っていない → 準備できた（現物待ち） → 現物を確認した → 精算へ
export const ADV_STATES = {
  none: { label: 'まだ送っていません', next: 'team' },
  short: { label: '写真か項目が足りない', next: 'team' },
  ready: { label: '精算の準備できた（現物待ち）', next: 'town' },
  received: { label: '現物を確認した', next: 'town' },
  settle: { label: '精算へ回した', next: null },
};
export function advanceState(adv, check) {
  if (!adv?.sentAt) return 'none';
  if (adv.settleAt) return 'settle';
  if (adv.receivedAt) return 'received';
  return check?.ready ? 'ready' : 'short';
}

// 動き（押すのは人）：send＝チームが先に送る／receive・settle＝町の人
export function advanceAct(adv = {}, action, at, check) {
  const st = advanceState(adv, check);
  if (action === 'send') {
    if (!check?.ready) throw new Error('写真と項目がそろってから送れます');
    if (st !== 'none' && st !== 'short') throw new Error('もう送っています');
    return { ...adv, sentAt: at };
  }
  if (action === 'receive') {
    if (st !== 'ready') throw new Error('準備ができてから、現物を確認します');
    return { ...adv, receivedAt: at };
  }
  if (action === 'settle') {
    if (st !== 'received') throw new Error('現物を確認してから、精算へ回します');
    return { ...adv, settleAt: at };
  }
  throw new Error(`知らない動き：${action}`);
}

// 先に送る中身：写真と、自動で付く捕獲者・日時・場所だけ（金額・対象の欄は持たない）
export function advancePacket(rec, photos = {}, rules = {}) {
  return {
    recordId: rec.id,
    by: rec.by || null,
    datetime: rec.datetime || null,
    trapNo: rec.trapNo || null,
    district: rec.district || null,
    photos: (rules.photos || []).filter((p) => photos[p.id]).map((p) => p.id),
  };
}
