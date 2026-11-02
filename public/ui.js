// 画面で共通に使う部品（保存・文字の安全な出し方・上の帯・声・地図の読み込み・知らせの表示）。
import { ICON, ROLE_ICON } from './icons.js';

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

export function renderTop({ back, here } = {}) {
  if (back) {
    top.className = 'top line';
    top.innerHTML = `<a class="back" href="${esc(back)}">${icon('back')}ジビエつなぎ</a>${here ? `<span class="here">${esc(here)}</span>` : ''}`;
  } else {
    top.className = 'top';
    top.innerHTML = `<span class="brand">ジビエつなぎ</span><span class="area">${esc(ctx.data.area.name)}</span>
      <button class="zoom" data-zoom aria-pressed="${document.body.classList.contains('big')}">大きな字</button>`;
  }
}

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
// 今は Claude につないでいない（キーは社長が置いてから・リポジトリには入れない）。
// つなぐまでは「見本（未接続）」と出し、決まった照らし合わせで動かす。
export const AI = { connected: false };
export const aiTag = (role, model) =>
  `<span class="ai-tag">${esc(role)}：${AI.connected ? esc(model) : '見本（未接続）'}</span>`;

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

// ---------- 地図の部品（Leaflet・オープンソース）を、地図の画面を開いたときだけ読み込む ----------
const LEAFLET = {
  css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  cssHash: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
  js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  jsHash: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
};
let leafletLoading = null;
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET.css;
    css.integrity = LEAFLET.cssHash;
    css.crossOrigin = '';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = LEAFLET.js;
    s.integrity = LEAFLET.jsHash;
    s.crossOrigin = '';
    s.onload = () => resolve(window.L);
    s.onerror = () => { leafletLoading = null; reject(new Error('地図を読み込めませんでした')); };
    document.head.appendChild(s);
  });
  return leafletLoading;
}
