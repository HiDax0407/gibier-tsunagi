// 線のアイコン（この作品用に手で描いたもの）。24×24・線の色は文字色に合わせる。
const svg = (body) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>'),
  team: svg('<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>'),
  alert: svg('<path d="M12 4 2.8 19.5h18.4L12 4Z"/><path d="M12 10v4.5"/><path d="M12 17.2v.1"/>'),
  card: svg('<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16a3 3 0 0 1 6 0"/><path d="M14.5 10h3.5M14.5 13.5h3.5"/>'),
  back: svg('<path d="M15 5 8 12l7 7"/>'),
  next: svg('<path d="m9 5 7 7-7 7"/>'),
  calendar: svg('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  chat: svg('<path d="M4 5h16v11H9l-5 4V5Z"/>'),
  person: svg('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
  // 工程ごとのアイコン
  compass: svg('<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>'),
  clipboard: svg('<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5h6v2.5H9z"/><path d="m9 13 2 2 4-4"/>'),
  move: svg('<path d="M3 12h14"/><path d="m13 7 5 5-5 5"/><path d="M21 6v12"/>'),
  drop: svg('<path d="M12 3.5c3.5 4.4 5.5 7.6 5.5 10.2a5.5 5.5 0 0 1-11 0c0-2.6 2-5.8 5.5-10.2Z"/>'),
  snow: svg('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>'),
  truck: svg('<path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5h4l3 3.2v2.8h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
  doc: svg('<path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4"/><path d="M9 12h6M9 15.5h6"/>'),
};

export const ROLE_ICON = {
  '見回り': 'compass',
  'わなの設置・点検': 'clipboard',
  '止め・搬送': 'move',
  '処理（洗浄・解体）': 'drop',
  '冷蔵・保管': 'snow',
  '出荷・店とのやりとり': 'truck',
  '記録（日付・場所）': 'doc',
};
