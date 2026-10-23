// Utilitas umum: format angka/tanggal, escape HTML, ikon SVG
export const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

export const rp = (n) => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '-Rp' : 'Rp') + nf.format(Math.abs(v));
};
export const num = (n) => nf.format(Math.round(Number(n) || 0));
export const pct = (x) => (isFinite(x) ? nf1.format(x * 100) + '%' : '–');
export const rak = (butir) => nf1.format((Number(butir) || 0) / 30);

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- Tanggal (string YYYY-MM-DD, zona waktu perangkat) ----
export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISO(new Date());
export const parseISO = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s, n) => {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const diffDays = (a, b) => Math.round((parseISO(a) - parseISO(b)) / 86400000);
export const ym = (s) => String(s).slice(0, 7); // "2026-10"
export const ymAdd = (k, n) => {
  const [y, m] = k.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const ymIndex = (k) => {
  const [y, m] = k.split('-').map(Number);
  return y * 12 + (m - 1);
};
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const fmtDate = (s) => {
  if (!s) return '–';
  const d = parseISO(s);
  return `${d.getDate()} ${BLN[d.getMonth()]} ${d.getFullYear()}`;
};
export const fmtShort = (s) => {
  const d = parseISO(s);
  return `${d.getDate()} ${BLN[d.getMonth()]}`;
};
export const fmtLong = (s) => {
  const d = parseISO(s);
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};
export const fmtMonth = (k) => {
  const [y, m] = k.split('-').map(Number);
  return `${BULAN[m - 1]} ${y}`;
};
export const fmtMonthShort = (k) => {
  const [y, m] = k.split('-').map(Number);
  return `${BLN[m - 1]} ${String(y).slice(2)}`;
};
export const relDays = (s) => {
  const n = diffDays(s, today());
  if (n === 0) return 'Hari ini';
  if (n === 1) return 'Besok';
  if (n === -1) return 'Kemarin';
  return n > 0 ? `${n} hari lagi` : `${-n} hari lalu`;
};

export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
export const groupBy = (arr, f) => arr.reduce((m, x) => ((m[f(x)] ||= []).push(x), m), {});

// Nomor WA → format 62xxxx
export const waNumber = (s) => {
  let p = String(s ?? '').replace(/[^0-9]/g, '');
  if (!p) return '';
  if (p.startsWith('62')) return p;
  if (p.startsWith('0')) return '62' + p.slice(1);
  return '62' + p;
};
export const waLink = (phone, text) => {
  const n = waNumber(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
};

// ---- Ikon (garis, 24px, mengikuti currentColor) ----
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
  egg: '<path d="M12 3c-3.6 0-6.5 5.2-6.5 9.6A6.5 6.5 0 0 0 12 21a6.5 6.5 0 0 0 6.5-8.4C18.5 8.2 15.6 3 12 3Z"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2.5 3h2.6l2.4 12h11.2l2-8H6.3"/>',
  wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3"/><rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/><path d="M16 13.5h2.5"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2A6.5 6.5 0 0 1 21.5 20"/>',
  file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8Z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h5"/>',
  chart: '<path d="M3.5 20.5h17"/><path d="M5 16l4.5-5 3.5 3 6-7"/><path d="M15 7h4v4"/>',
  coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7"/><path d="M9.5 16.4c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-4c0-1.3-2-2.3-4.6-2.5"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  send: '<path d="M21 3 10 14"/><path d="M21 3 14.5 21 10 14 3 9.5Z"/>',
  print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7Z"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  logout: '<path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  alert: '<path d="M12 3.5 2.5 20h19Z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.3"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  wa: '<path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6Z"/><path d="M9 9.2c.2 2.6 2.7 5 5.4 5.4l1.1-1.2-1.8-1-.8.8c-.8-.3-1.9-1.4-2.3-2.3l.8-.8-1-1.8Z"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.6L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.6L20 15.5"/><path d="M20 20v-4.5h-4.5"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-4 6-6 10-8"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  google: '',
};
export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

export const GOOGLE_ICON = `<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

// Logo usaha (telur + daun)
export const LOGO_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true" class="logo-mark">
  <path d="M18 50c-7-3-9-11-5-17 3 6 8 10 15 11" fill="#4CAF50"/>
  <path d="M46 50c7-3 9-11 5-17-3 6-8 10-15 11" fill="#2E8B47"/>
  <path d="M32 6c-9 0-16 13-16 24a16 16 0 0 0 32 0C48 19 41 6 32 6Z" fill="#FFC83D"/>
  <path d="M32 6c-9 0-16 13-16 24 0 4 1.3 7.6 3.5 10.4C20 26 25 12 32 6Z" fill="#FFE08A" opacity=".9"/>
  <ellipse cx="26" cy="20" rx="3" ry="5" fill="#fff" opacity=".55" transform="rotate(20 26 20)"/>
</svg>`;
