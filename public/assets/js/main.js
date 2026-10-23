// Titik awal aplikasi: animasi pembuka, login, tata letak, navigasi
import { state, initSupabase, client, loadAll, isDemo } from './store.js';
import { peringatan, pelangganNama } from './calc.js';
import { icon, esc, LOGO_SVG, GOOGLE_ICON } from './util.js';
import { $, $$, toast, destroyCharts, basketSVG } from './ui.js';
import { setOnSaved, quickSheet } from './actions.js';
import * as Dash from './pages/dashboard.js';
import * as Cat from './pages/catatan.js';
import * as PO from './pages/po.js';
import * as Pel from './pages/pelanggan.js';
import * as Keu from './pages/keuangan.js';
import * as SetPage from './pages/pengaturan.js';

const ROUTES = {
  dashboard: { t: 'Dashboard', ic: 'home', r: Dash.render },
  produksi: { t: 'Produksi telur', ic: 'egg', r: Cat.renderProduksi },
  penjualan: { t: 'Telur keluar', ic: 'cart', r: Cat.renderPenjualan },
  pengeluaran: { t: 'Pengeluaran', ic: 'wallet', r: Cat.renderPengeluaran },
  po: { t: 'Pre-order', ic: 'calendar', r: PO.render },
  pelanggan: { t: 'Pelanggan', ic: 'users', r: Pel.renderPelanggan },
  invoice: { t: 'Invoice', ic: 'receipt', r: Pel.renderInvoiceList },
  laporan: { t: 'Laporan keuangan', ic: 'chart', r: Keu.renderLaporan },
  kas: { t: 'Kas & modal', ic: 'coins', r: Keu.renderKas },
  aset: { t: 'Aset', ic: 'box', r: Keu.renderAset },
  pengaturan: { t: 'Pengaturan', ic: 'settings', r: SetPage.render },
};
const NAV = [
  ['Utama', ['dashboard']],
  ['Catatan harian', ['produksi', 'penjualan', 'pengeluaran']],
  ['Pesanan & pelanggan', ['po', 'pelanggan', 'invoice']],
  ['Keuangan', ['laporan', 'kas', 'aset']],
  ['', ['pengaturan']],
];
let user = null;

// ---------------------------------------------------------------- Tema
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
function setTheme(v) {
  lsSet('tk_theme', v);
  if (v === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', v);
  if (state.ready && $('#content')) route();
}
setTheme(lsGet('tk_theme') || 'auto');

// ---------------------------------------------------------------- Animasi pembuka
function splash() {
  let shown = false;
  try { shown = sessionStorage.getItem('tk_splash') === '1'; sessionStorage.setItem('tk_splash', '1'); } catch (_) {}
  if (shown) return Promise.resolve();
  const leaf = `<svg viewBox="0 0 60 60"><path d="M6 54C6 26 22 8 56 6c0 30-18 48-50 48Z" fill="#4CAF50"/><path d="M8 52C20 36 32 26 48 16" stroke="#2E7D32" stroke-width="2.5" fill="none"/></svg>`;
  const el = document.createElement('div');
  el.id = 'splash';
  el.innerHTML = `<div class="sp-stage">
      <div class="sp-leaf l">${leaf}</div><div class="sp-leaf r">${leaf}</div>
      <div class="sp-shadow"></div><div class="sp-yolk"></div>
      <div class="sp-egg"><svg viewBox="0 0 104 132">
        <defs><radialGradient id="eg" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#FBF1DE"/><stop offset="1" stop-color="#EBD3AC"/></radialGradient></defs>
        <path d="M52 132C24 132 4 112 4 84c0-4 .3-8 1-12l20 8 14-12 14 12 14-12 14 12 18-8c.7 4 1 8 1 12 0 28-20 48-48 48Z" fill="url(#eg)"/>
        <g class="sp-top"><path d="M5 72C9 34 28 2 52 2s43 32 47 70l-18 8-14-12-14 12-14-12-14 12Z" fill="url(#eg)"/><ellipse cx="36" cy="34" rx="8" ry="14" fill="#fff" opacity=".7" transform="rotate(18 36 34)"/></g>
        <path class="sp-crack" d="M5 72l20 8 14-12 14 12 14-12 14 12 18-8" fill="none" stroke="#C89B5A" stroke-width="2.5" stroke-linejoin="round"/>
      </svg></div>
      <div class="sp-bar"></div>
    </div>
    <div class="sp-brand"><b>Telur Kita</b><span>Keuangan &amp; penjualan telur</span></div>
    <button class="sp-skip">Lewati</button>`;
  document.body.append(el);
  return new Promise((res) => {
    const end = () => { el.classList.add('out'); setTimeout(() => el.remove(), 600); res(); };
    const t = setTimeout(end, 2900);
    el.querySelector('.sp-skip').onclick = () => { clearTimeout(t); end(); };
  });
}

// ---------------------------------------------------------------- Login
function showLogin({ error = '', demo = false } = {}) {
  $('#app').classList.add('hide');
  const L = $('#login');
  L.classList.remove('hide');
  L.innerHTML = `<div class="lg-art">${basketSVG('basket')}<div class="quote">Telur berkualitas untuk masa depan yang lebih baik.<small>Catat produksi, penjualan, pre-order, dan uang usaha dalam satu tempat.</small></div></div>
    <div class="lg-form"><div class="lg-card">
      <div class="brand">${LOGO_SVG}<div><b>Telur Kita</b><small>Keuangan &amp; penjualan telur</small></div></div>
      <h1>Masuk ke dashboard</h1><p>Khusus pengelola usaha yang sudah terdaftar.</p>
      ${demo ? `<button class="btn" style="width:100%;padding:13px" data-demo>${icon('egg')}Coba mode demo</button>
        <div class="lg-note">${icon('info')}<span>Supabase belum disambungkan (config.js masih kosong). Mode demo memakai data contoh yang tersimpan di browser ini saja.</span></div>`
      : `<button class="btn-google" data-google>${GOOGLE_ICON}Masuk dengan Google</button>
        <div class="lg-note">${icon('info')}<span>Hanya email yang didaftarkan pemilik yang bisa masuk. Data aman di Supabase dan dibackup otomatis ke Google Spreadsheet.</span></div>`}
      ${error ? `<div class="lg-err">${error}</div>` : ''}
    </div></div>`;
  const g = L.querySelector('[data-google]');
  if (g) g.onclick = async () => {
    g.disabled = true;
    const { error: e } = await client().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
    if (e) { toast(e.message, true); g.disabled = false; }
  };
  const d = L.querySelector('[data-demo]');
  if (d) d.onclick = () => { try { sessionStorage.setItem('tk_demo_in', '1'); } catch (_) {} user = { nama: 'Sinta', email: 'sinta@contoh.id' }; start(); };
}

// ---------------------------------------------------------------- Tata letak
function shell() {
  $('#login').classList.add('hide');
  const app = $('#app');
  app.classList.remove('hide');
  const nav = NAV.map(([g, items]) => `${g ? `<div class="nav-group">${g}</div>` : '<div style="height:8px"></div>'}<nav class="nav">${items
    .map((k) => `<a href="#/${k}" data-r="${k}">${icon(ROUTES[k].ic)}<span>${ROUTES[k].t}</span>${k === 'po' ? '<span class="count hide" data-pocount></span>' : ''}</a>`).join('')}</nav>`).join('');
  app.innerHTML = `<aside class="sidebar"><a class="brand" href="#/dashboard">${LOGO_SVG}<div><b data-nama>Telur Kita</b><small>Keuangan &amp; penjualan telur</small></div></a>${nav}
      <div class="side-card">${basketSVG()}<p>Telur berkualitas untuk masa depan yang lebih baik 💚</p></div></aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn burger" data-burger aria-label="Menu">${icon('menu')}</button>
        <a class="brand brand-mini" href="#/dashboard">${LOGO_SVG}<b data-nama>Telur Kita</b></a>
        <div class="search">${icon('search')}<input id="q" placeholder="Cari pelanggan, no. PO, atau no. invoice…" autocomplete="off"><div class="search-res hide" id="qres"></div></div>
        <div class="top-actions">
          ${isDemo() ? '' : `<button class="icon-btn" data-refresh title="Muat ulang data">${icon('refresh')}</button>`}
          <div style="position:relative"><button class="icon-btn" data-bell aria-label="Pemberitahuan">${icon('bell')}<span class="dot hide" data-dot></span></button><div class="menu-pop hide" data-bellpop style="width:340px"></div></div>
          <div style="position:relative"><button class="user" data-user>${user?.avatar ? `<span class="avatar"><img src="${esc(user.avatar)}" alt="" referrerpolicy="no-referrer"></span>` : `<span class="avatar">${esc((user?.nama || '?')[0].toUpperCase())}</span>`}
            <span class="who" style="text-align:left"><b>${esc(user?.nama || '')}</b><small>Pengelola usaha</small></span></button>
            <div class="menu-pop hide" data-userpop><div style="padding:8px 12px 10px"><b>${esc(user?.nama || '')}</b><div class="muted" style="font-size:12.5px">${esc(user?.email || '')}</div></div>
              <button data-theme-toggle>${icon('moon')}Ganti tema terang/gelap</button><a href="#/pengaturan">${icon('settings')}Pengaturan</a><button data-logout>${icon('logout')}${isDemo() ? 'Keluar dari demo' : 'Keluar'}</button></div></div>
        </div>
      </header>
      <main class="content"><div id="content"></div></main>
    </div>
    <nav class="bottom-nav"><a href="#/dashboard" data-r="dashboard">${icon('home')}Beranda</a><a href="#/produksi" data-r="produksi">${icon('egg')}Produksi</a>
      <button data-fab aria-label="Catat cepat"><span class="fab">${icon('plus')}</span></button><a href="#/po" data-r="po">${icon('calendar')}PO</a><a href="#/laporan" data-r="laporan">${icon('chart')}Laporan</a></nav>`;

  $('[data-burger]').onclick = () => document.body.classList.toggle('drawer');
  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('drawer') && !e.target.closest('.sidebar') && !e.target.closest('[data-burger]')) document.body.classList.remove('drawer');
    if (!e.target.closest('[data-bell]') && !e.target.closest('[data-bellpop]')) $('[data-bellpop]')?.classList.add('hide');
    if (!e.target.closest('[data-user]') && !e.target.closest('[data-userpop]')) $('[data-userpop]')?.classList.add('hide');
    if (!e.target.closest('.search')) $('#qres')?.classList.add('hide');
  });
  $('[data-fab]').onclick = () => quickSheet();
  $('[data-user]').onclick = () => $('[data-userpop]').classList.toggle('hide');
  $('[data-bell]').onclick = () => { renderBell(); $('[data-bellpop]').classList.toggle('hide'); };
  $('[data-theme-toggle]').onclick = () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches) ? 'light' : 'dark');
  $('[data-logout]').onclick = async () => {
    if (isDemo()) { try { sessionStorage.removeItem('tk_demo_in'); } catch (_) {} location.reload(); return; }
    await client().auth.signOut(); location.reload();
  };
  const r = $('[data-refresh]');
  if (r) r.onclick = async () => { r.disabled = true; await refreshData(); r.disabled = false; toast('Data terbaru dimuat'); };
  wireSearch();
}

function renderBell() {
  const A = peringatan(state);
  const pop = $('[data-bellpop]');
  pop.innerHTML = `<h4>Pemberitahuan</h4>${A.length ? A.map((a) => `<button class="alert-item" ${a.aksi ? `data-go="${a.aksi}"` : ''}>${icon(a.level === 'info' ? 'info' : 'alert')}<span>${esc(a.teks)}</span></button>`).join('') : '<p class="muted" style="padding:0 12px">Semua aman 👍</p>'}`;
  pop.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => { pop.classList.add('hide'); go(b.dataset.go); }));
}
function updateChrome() {
  const A = peringatan(state);
  $('[data-dot]')?.classList.toggle('hide', !A.some((a) => a.level !== 'info'));
  const n = state.po.filter((p) => p.status === 'Dipesan').length;
  const c = $('[data-pocount]');
  if (c) { c.textContent = n; c.classList.toggle('hide', !n); }
  $$('[data-nama]').forEach((e) => (e.textContent = state.pengaturan.nama_usaha || 'Telur Kita'));
  document.title = `${state.pengaturan.nama_usaha || 'Telur Kita'} — Keuangan & Penjualan Telur`;
}

function wireSearch() {
  const q = $('#q'), res = $('#qres');
  q.oninput = () => {
    const s = q.value.trim().toLowerCase();
    if (s.length < 2) return res.classList.add('hide');
    const R = [
      ...state.pelanggan.filter((c) => c.nama.toLowerCase().includes(s)).slice(0, 5).map((c) => [`👤 ${c.nama}`, c.alamat || 'Pelanggan', 'pelanggan']),
      ...state.po.filter((p) => (p.no_po || '').toLowerCase().includes(s) || pelangganNama(state, p.pelanggan_id).toLowerCase().includes(s)).slice(0, 5).map((p) => [`📅 ${p.no_po} · ${pelangganNama(state, p.pelanggan_id)}`, p.status, 'po']),
      ...state.invoice.filter((v) => (v.no_invoice || '').toLowerCase().includes(s)).slice(0, 5).map((v) => [`🧾 ${v.no_invoice}`, pelangganNama(state, v.pelanggan_id), 'invoice/' + v.id]),
    ];
    res.innerHTML = R.length ? R.map(([a, b, r]) => `<a href="#/${r}"><span>${esc(a)}</span><small class="muted">${esc(b)}</small></a>`).join('') : '<div class="muted" style="padding:12px">Tidak ditemukan</div>';
    res.classList.remove('hide');
  };
  res.onclick = () => { res.classList.add('hide'); q.value = ''; };
}

// ---------------------------------------------------------------- Router
export function go(r) { if (location.hash === '#/' + r) route(); else location.hash = '#/' + r; }
function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [name, arg] = h.split('/');
  const el = $('#content');
  if (!el) return;
  destroyCharts();
  $$('[data-r]').forEach((a) => a.classList.toggle('active', a.dataset.r === name));
  document.body.classList.remove('drawer');
  const ctx = { go, user, refresh: () => route(), setTheme };
  try {
    if (name === 'invoice' && arg) Pel.renderInvoice(el, ctx, arg);
    else (ROUTES[name] || ROUTES.dashboard).r(el, ctx);
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="card"><b>Terjadi kesalahan saat menampilkan halaman.</b><p class="muted">${esc(e.message)}</p></div>`;
  }
  if (isDemo() && !$('.demo-banner')) {
    const b = document.createElement('div');
    b.className = 'demo-banner';
    b.innerHTML = `${icon('info')}<span><b>Mode demo</b> — data contoh, tersimpan di browser ini saja. Isi <code>config.js</code> untuk memakai Supabase.</span>`;
    $('.content').prepend(b);
  }
  updateChrome();
}
async function refreshData() {
  try { await loadAll(); route(); } catch (e) { toast('Gagal memuat data: ' + (e.message || e), true); }
}

async function start() {
  try { await loadAll(); } catch (e) { showLogin({ error: 'Gagal memuat data: ' + esc(e.message || e) }); return; }
  const me = (state.app_users || []).find((u) => u.email.toLowerCase() === String(user?.email || '').toLowerCase());
  if (me?.nama) user.nama = me.nama;
  shell();
  setOnSaved(() => route());
  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
  route();
  if (!isDemo()) {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !document.querySelector('dialog[open]')) refreshData(); });
    setInterval(() => { if (document.visibilityState === 'visible' && !document.querySelector('dialog[open]')) { const y = scrollY; loadAll().then(() => { route(); scrollTo(0, y); }).catch(() => {}); } }, 120000);
  }
}

// ---------------------------------------------------------------- Boot
async function boot() {
  const sp = splash();
  const sb = initSupabase();
  if (!sb) {
    await sp;
    let inDemo = false;
    try { inDemo = sessionStorage.getItem('tk_demo_in') === '1'; } catch (_) {}
    if (inDemo) { user = { nama: 'Sinta', email: 'sinta@contoh.id' }; start(); } else showLogin({ demo: true });
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
  await sp;
  if (!session) return showLogin({ error: new URLSearchParams(location.search).get('error_description') || '' });
  const email = session.user.email;
  const { data: ok, error } = await sb.rpc('is_allowed');
  if (error || !ok) {
    await sb.auth.signOut();
    return showLogin({ error: `Email <b>${esc(email)}</b> belum terdaftar sebagai pengelola. Minta pemilik menambahkan email ini di Supabase (tabel app_users).` });
  }
  const meta = session.user.user_metadata || {};
  user = { email, nama: meta.full_name || meta.name || email.split('@')[0], avatar: meta.avatar_url || meta.picture };
  await start();
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.reload(); });
}
boot();
