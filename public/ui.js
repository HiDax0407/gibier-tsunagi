// 画面で共通に使う部品（保存・文字の安全な出し方・上の帯・声・地図の読み込み・知らせの表示）。
import { ICON, ROLE_ICON } from './icons.js';
import { howtoFor } from './lib/howto.js';

export const view = document.getElementById('view');
export const top = document.getElementById('top');
export const tabsEl = document.getElementById('tabs');

// 読み込んだデータ（/api/team）
export const ctx = { data: null };

// この端末だけに残すもの。使えない環境でも画面は動く
export const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const strip = (name) => String(name).replace(/（架空）/g, '').trim();
export const icon = (name) => `<span class="ico">${ICON[name] || ''}</span>`;
export const roleIcon = (role) => icon(ROLE_ICON[role] || 'doc');

// 今いる画面の名前（#/talk → talk。無ければ team）
export const screenName = () => (location.hash.replace(/^#\/?/, '') || 'team').split('/')[0];

export function renderTop({ back, here } = {}) {
  // 「使い方」は、3行の説明がある画面（話す・わな・チーム・記録・町の地区一覧・見かけたら知らせる）にだけ出す。「大きな字」の左隣・同じ見た目
  const howto = howtoFor(screenName()) ? '<button class="zoom howto" data-howto aria-expanded="false" aria-controls="howto-card">使い方</button>' : '';
  const zoom = `<button class="zoom" data-zoom aria-pressed="${document.body.classList.contains('big')}">大きな字</button>`;
  if (back) {
    top.className = 'top line';
    // 下の画面にも「大きな字」（高齢の方が使う前提。戻る矢印＋題名の並びはそのまま）
    top.innerHTML = `<a class="back" href="${esc(back)}">${icon('back')}<span class="bt">ジビエつなぎ</span></a>${here ? `<span class="here">${esc(here)}</span>` : ''}
      ${howto}${zoom}`;
  } else {
    top.className = 'top';
    // 地区名は狭い画面で「北沢地区／（架空）」の2行に折れる（途中で切れない）
    const [areaA, areaB] = String(ctx.data.area.name).split(/(?=（)/);
    top.innerHTML = `<span class="brand">ジビエつなぎ</span><span class="area"><i>${esc(areaA)}</i>${areaB ? `<i>${esc(areaB)}</i>` : ''}</span>
      ${howto}${zoom}`;
  }
}

// ---------- 使い方（見出しの下の白いカード・3行＋読み上げ＋閉じる） ----------
// 上の「使い方」を押すと開き、もう一度押すか「閉じる」で閉じる。文は public/lib/howto.js の決まった3行だけ
export function howtoCardHtml(h) {
  return `<section class="howto-card" id="howto-card" aria-label="${esc(h.name)}の使い方">
    <ul class="hc-lines">${h.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    <div class="hc-foot"><button class="say" data-howto-say>${icon('speaker')}読み上げ</button><button class="outline hc-close" data-howto-close>閉じる</button></div>
  </section>`;
}
export function toggleHowto() {
  const btn = top.querySelector('[data-howto]');
  const cur = document.getElementById('howto-card');
  if (cur) {
    cur.remove();
    try { speechSynthesis.cancel(); } catch { /* 読み上げなし */ }
    btn?.setAttribute('aria-expanded', 'false');
    return;
  }
  const h = howtoFor(screenName());
  const h1 = view.querySelector('h1');
  if (!h || !h1) return;
  h1.insertAdjacentHTML('afterend', howtoCardHtml(h));
  btn?.setAttribute('aria-expanded', 'true');
}
// 読み上げ（もう一度押すと止まる）
export function sayHowto(btn) {
  const h = howtoFor(screenName());
  if (h) speak(h.lines.join(''), btn);
}

// 記録タブの中の切り替え（活動と捕獲／教えた記録）
export const recSeg = (cur) => `<div class="seg" role="tablist" aria-label="記録の種類">
  <a href="#/log" role="tab" ${cur === 'log' ? 'aria-current="page"' : ''}>活動と捕獲</a>
  <a href="#/teach" role="tab" ${cur === 'teach' ? 'aria-current="page"' : ''}>教えた記録</a>
</div>`;

// ---------- 日付 ----------
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const pad = (n) => String(n).padStart(2, '0');
export const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => dateStr(new Date());
export const dayLabel = (date) => {
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  return `${m}月${d}日（${WEEK[new Date(y, m - 1, d).getDay()]}）`;
};
export const timeLabel = (iso) => {
  const d = new Date(iso);
  return `${dayLabel(dateStr(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
// datetime-local の入力欄に入れる形
export const localInput = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  return `${dateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export function agoLabel(iso, now = Date.now()) {
  if (!iso) return '記録なし';
  const h = Math.floor((now - Date.parse(iso)) / 3600e3);
  if (h < 1) return '1時間以内';
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日と${h % 24}時間前`;
}

// ---------- Claude が働くところの小さな印 ----------
// つながっているかはサーバーが決める（キーは環境変数か .env・リポジトリには入れない）。
// つなぐまでは「見本（未接続）」と出し、決まった照らし合わせで動かす。つなぐと役とモデルの名前に変わる。
export const AI = { connected: false, models: {} };
export const aiTag = (role, task, suffix = '') =>
  `<span class="ai-tag">${esc(role)}：${AI.connected ? esc((AI.models[task] || 'Claude') + suffix) : '見本（未接続）'}</span>`;
export async function loadAi() {
  try {
    const r = await fetch('/api/ai/status');
    if (r.ok) Object.assign(AI, await r.json());
  } catch { /* 未接続のまま */ }
  return AI;
}
// Claude に頼む（整理・聞き返し）。うまくいかなければ投げる（呼ぶ側は見本のまま）
export async function askAi(task, payload) {
  const r = await fetch(`/api/ai/${task}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `返事がありません（${r.status}）`);
  return body;
}

// ---------- 書き出し ----------
export function downloadCsv(name, csv) {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- 短い知らせ（画面の下に数秒出す） ----------
let toastTimer;
export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 5200);
}

// ---------- 声 ----------
export const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

// 押すと聞き取りを始め、もう一度押すと止める。聞き取った言葉は入力欄に足していく
export const voice = {
  rec: null,
  btn: null,
  toggle(btn, field, onUpdate) {
    if (!SR) { field?.focus(); return; }
    if (this.rec) { this.stop(); return; }
    const rec = new SR();
    rec.lang = 'ja-JP';
    rec.continuous = true;
    rec.interimResults = true;
    const base = field.value ? `${field.value}　` : '';
    rec.onresult = (ev) => {
      let text = '';
      for (const r of ev.results) text += r[0].transcript;
      field.value = base + text;
      onUpdate?.();
    };
    rec.onend = rec.onerror = () => {
      this.btn?.setAttribute('aria-pressed', 'false');
      this.rec = null;
      this.btn = null;
    };
    try { speechSynthesis.cancel(); } catch { /* 読み上げなし */ }
    this.rec = rec;
    this.btn = btn;
    btn.setAttribute('aria-pressed', 'true');
    rec.start();
  },
  stop() { try { this.rec?.stop(); } catch { /* 止まっている */ } },
};

// 小さな「話す」ボタンと入力欄の組（地図・記録・住民の知らせで使う）
export const voiceField = (id, placeholder, value = '') => `
  <div class="vfield">
    <button type="button" class="vmic${SR ? '' : ' off'}" data-voice="${esc(id)}" aria-pressed="false" aria-label="押して話す">${ICON.mic}<span>${SR ? '押して話す' : '声は使えません'}</span></button>
    <textarea class="talk" id="${esc(id)}" rows="2" maxlength="600" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
  </div>`;

// 読み上げ（端末の声を使う。外には送らない）
export function speak(text, btn) {
  if (!('speechSynthesis' in window)) return;
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 0.9;
  btn?.classList.add('on');
  u.onend = u.onerror = () => btn?.classList.remove('on');
  speechSynthesis.speak(u);
}

// ---------- 写真（添付として残すだけ。中身は判定しない） ----------
// 端末の中で小さくしてから残す（外には送らない）
export function readPhoto(file, max = 640) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('写真ではありません')); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('写真を読めませんでした')); };
    img.src = url;
  });
}

// ---------- 地図の部品（Leaflet 1.9.4・オープンソース・BSD-2-Clause）を、地図の画面を開いたときだけ読み込む ----------
// 同梱したもの（public/vendor/leaflet・LICENSE つき）を先に使い、読めなければ unpkg から。どちらも改ざん防止の値で確かめる
const LEAFLET = {
  cssHash: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
  jsHash: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
  sources: [
    { css: '/vendor/leaflet/leaflet.css', js: '/vendor/leaflet/leaflet.js' },
    { css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' },
  ],
};
let leafletLoading = null;
function loadLeafletFrom(src) {
  return new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = src.css;
    css.integrity = LEAFLET.cssHash;
    css.crossOrigin = '';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = src.js;
    s.integrity = LEAFLET.jsHash;
    s.crossOrigin = '';
    s.onload = () => resolve(window.L);
    s.onerror = () => { css.remove(); s.remove(); reject(new Error('地図を読み込めませんでした')); };
    document.head.appendChild(s);
  });
}
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoading) return leafletLoading;
  leafletLoading = LEAFLET.sources.reduce((p, src) => p.catch(() => loadLeafletFrom(src)), Promise.reject())
    .catch((e) => { leafletLoading = null; throw e; });
  return leafletLoading;
}

// 見本の写真（架空）：灰色の札に「見本」と写すものの名前だけ。実際の獣の写真は使わない
export function samplePhoto(label) {
  const t = esc(label);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" fill="#e9ecea"/><rect x="10" y="10" width="300" height="220" rx="10" fill="none" stroke="#8c958f" stroke-width="2" stroke-dasharray="8 7"/><text x="160" y="70" font-size="22" text-anchor="middle" fill="#4a4a4a" font-family="sans-serif">見本の写真（架空）</text><text x="160" y="108" font-size="20" font-weight="700" text-anchor="middle" fill="#161616" font-family="sans-serif">${t}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
