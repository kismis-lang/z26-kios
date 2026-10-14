export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const idn = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
export const n = v => idn.format(Number(v) || 0);
export const rp = v => 'Rp ' + idn.format(Math.round(Number(v) || 0));
export const KODE = ['urea', 'phonska', 'organik', 'za'];
export const NAMA = { urea: 'Urea', phonska: 'Phonska', organik: 'Organik', za: 'ZA' };
const _tw = new Map();
// yyyy-mm-dd di WIB (UTC+7, tanpa DST) — versi cepat + cache (dulu toLocaleDateString: lambat)
export const tglWIB = d => { if (d == null) return ''; const k = typeof d === 'string' ? d : null; if (k && _tw.has(k)) return _tw.get(k); const t = new Date(d).getTime(); if (isNaN(t)) return ''; const r = new Date(t + 7 * 3600e3).toISOString().slice(0, 10); if (k) { if (_tw.size > 50000) _tw.clear(); _tw.set(k, r); } return r; };
const _fT = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' });
const _fJ = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
export const tgl = d => d ? _fT.format(new Date(d)) : '';
export const jam = d => d ? _fJ.format(new Date(d)).replace(':', '.') : '';
export const tglJam = d => d ? tgl(d) + ' ' + jam(d) : '';
export const ini = s => (s || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
export const sak = (kg, b = 50) => { const v = (Number(kg) || 0) / (Number(b) || 50); return Math.round(v * 10) / 10; };
export const kgsak = (kg, b = 50) => `${n(kg)} kg (${n(sak(kg, b))} sak)`;
const p2 = x => String(x).padStart(2, '0');
export const dtLocal = (d = new Date()) => { const x = new Date(d); return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}T${p2(x.getHours())}:${p2(x.getMinutes())}`; };
export const fromLocal = v => (v ? new Date(v).toISOString() : new Date().toISOString());
export const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 8) : Math.random().toString(16).slice(2, 10));
export const pct = (a, b) => b > 0 ? Math.max(0, Math.min(100, a / b * 100)) : 0;
export const debounce = (f, ms = 180) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

export function toast(msg) {
  const t = $('#toast'), e = document.createElement('div');
  e.className = 'ti'; e.textContent = msg; t.appendChild(e); setTimeout(() => e.remove(), 3200);
}
export function lsGet(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
export function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { } }

const P = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const I = {
  home: P('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  users: P('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3.2-6 6.5-6s6 2 6.5 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2 .7 3.3 2.7 3.5 6"/>'),
  cart: P('<path d="M3 4h2.5l2 11h10l2-8H7"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>'),
  box: P('<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>'),
  more: P('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  x: P('<path d="M6 6l12 12M18 6L6 18"/>'),
  clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  camera: P('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  alert: P('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>'),
  money: P('<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/>'),
  calc: P('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M8 15h2M12 15h2M16 11v6"/>'),
  print: P('<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>'),
  chart: P('<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>'),
  truck: P('<path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
  out: P('<path d="M9 4H4v16h5M16 8l4 4-4 4M20 12H9"/>'),
  download: P('<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>'),
  upload: P('<path d="M12 16V4M7 8l5-5 5 5M4 20h16"/>'),
  edit: P('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  eye: P('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  file: P('<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>'),
  trash: P('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  install: P('<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 8v6M9.5 11.5L12 14l2.5-2.5"/>'),
  check: P('<path d="M5 12l5 5 9-10"/>'),
  copy: P('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>'),
  map: P('<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
};
