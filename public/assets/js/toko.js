// =====================================================================
//  TELUR KITA — Halaman pesan pelanggan (tanpa login)
//  Hanya memanggil 2 fungsi database: info_toko() & pesan_telur().
// =====================================================================
import { CONFIG } from './config.js';
import { rp, esc, waLink, fmtLong, addDays, LOGO_SVG } from './util.js';

const $ = (s, el = document) => el.querySelector(s);
const root = $('#toko');
const COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const KET = {
  Tersedia: 'Telur siap dipesan.',
  Terbatas: 'Stok tinggal sedikit, pesan secepatnya ya.',
  Habis: 'Stok sedang habis. Silakan coba lagi nanti atau chat kami.',
};
const DEMO = {
  nama_usaha: 'Telur Kita', harga: 3000, min_pesan: 5, stok: 'Tersedia', wa: '081200000000',
  rekening: [{ bank: 'Bank Contoh', nomor: '1234567890', nama: 'Sinta (contoh)' }],
  qris_aktif: true, qris_nama: 'Contoh QRIS', qris_gambar: null, demo: true,
};

let sb = null;
let info = null;
const form = { nama: '', wa: '', jumlah: 10, tanggal: '', catatan: '', bayar: '', sudah: false };

function client() {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY || !window.supabase) return null;
  // persistSession:false → tidak menyentuh sesi login pengelola di browser yang sama
  return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
const pesanError = (e) => {
  const m = String(e?.message || e || '');
  if (/fetch|network|Failed/i.test(m)) return 'Koneksi internet bermasalah. Coba lagi sebentar.';
  return m || 'Terjadi kesalahan. Coba lagi.';
};

async function muat() {
  sb = client();
  if (!sb) { info = DEMO; return render(); }
  const { data, error } = await sb.rpc('info_toko');
  if (error || !data) {
    root.innerHTML = `<div class="t-card"><div class="t-err">${esc(pesanError(error))}</div>
      <button class="btn" style="margin-top:12px;width:100%" onclick="location.reload()">Muat ulang</button></div>`;
    return;
  }
  info = data;
  form.jumlah = Math.max(Number(info.min_pesan) || 5, 10);
  render();
}

const harga = () => Number(info.harga) || 0;
const minPesan = () => Number(info.min_pesan) || 5;
const total = () => (Number(form.jumlah) || 0) * harga();
const daftarBayar = () => [
  ...(info.rekening || []).map((r) => ({ id: r.bank, judul: r.bank, ...r })),
  ...(info.qris_aktif ? [{ id: 'QRIS', judul: 'QRIS', qris: true }] : []),
];

function render() {
  const habis = info.stok === 'Habis';
  const today = info.hari_ini || new Date().toISOString().slice(0, 10);
  root.innerHTML = `
    <header class="toko-head">${LOGO_SVG}<div><h1>${esc(info.nama_usaha || 'Telur Kita')}</h1><p>Pesan telur ayam, konfirmasi lewat WhatsApp.</p></div></header>
    ${info.demo ? '<div class="demo-note">Mode contoh. Data dan nomor di halaman ini fiktif.</div>' : ''}

    <section class="t-card">
      <div class="stok ${esc(info.stok)}"><span class="pill">${esc(info.stok)}</span><span class="ket">${KET[info.stok] || ''}</span></div>
      <div class="harga"><div><b>${rp(harga())}</b> <small>/ butir</small></div><small>1 rak (30 butir) = ${rp(harga() * 30)}</small></div>
    </section>

    ${habis ? `<section class="t-card" style="text-align:center">
        <p class="muted" style="margin:0 0 12px">Mau tanya kapan stok ada lagi?</p>
        <a class="btn btn-wa" style="width:100%" href="${waLink(info.wa, `Halo ${info.nama_usaha || 'Telur Kita'}, kapan stok telur tersedia lagi?`)}" target="_blank" rel="noopener">Chat WhatsApp</a></section>` : `
    <form id="f" class="t-card" novalidate>
      <h2><span class="no">1</span>Data pemesan</h2>
      <div class="t-field"><label for="nama">Nama</label><input id="nama" name="nama" autocomplete="name" maxlength="60" placeholder="mis. Bu Sari" value="${esc(form.nama)}"></div>
      <div class="t-field"><label for="wa">Nomor WhatsApp</label><input id="wa" name="wa" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="08xxxxxxxxxx" value="${esc(form.wa)}"></div>

      <h2 style="margin-top:6px"><span class="no">2</span>Pesanan</h2>
      <div class="t-field"><label for="jumlah">Jumlah (butir)</label>
        <div class="qty"><button type="button" data-q="-1" aria-label="Kurangi">−</button><input id="jumlah" name="jumlah" type="number" inputmode="numeric" min="${minPesan()}" max="1000" value="${form.jumlah}"><button type="button" data-q="1" aria-label="Tambah">+</button></div>
        <div class="chips">${[10, 30, 60, 90].map((n) => `<button type="button" data-set="${n}">${n === 30 ? '1 rak' : n === 60 ? '2 rak' : n === 90 ? '3 rak' : n + ' butir'}</button>`).join('')}</div>
        <span class="help">Minimal ${minPesan()} butir.</span></div>
      <div class="t-field"><label for="tanggal">Tanggal kirim <i>(opsional)</i></label><input id="tanggal" name="tanggal" type="date" min="${today}" max="${addDays(today, 90)}" value="${esc(form.tanggal)}"><span class="help">Boleh dikosongkan, nanti disepakati lewat WhatsApp.</span></div>
      <div class="t-field" style="margin-bottom:0"><label for="catatan">Catatan <i>(opsional)</i></label><textarea id="catatan" name="catatan" maxlength="300" placeholder="mis. alamat, minta telur yang besar">${esc(form.catatan)}</textarea></div>
    </form>

    <section class="t-card">
      <h2><span class="no">3</span>Cara bayar</h2>
      <div class="pay">${daftarBayar().map((b) => `
        <label class="pay-opt ${form.bayar === b.id ? 'on' : ''}" data-pay="${esc(b.id)}">
          <input type="radio" name="bayar" value="${esc(b.id)}" ${form.bayar === b.id ? 'checked' : ''}>
          <span class="bank">${esc(b.judul)}</span>
          <div class="detail">${b.qris
            ? `<img class="qris-img" src="${esc(info.qris_gambar || 'assets/img/qris.jpg')}" alt="Kode QRIS ${esc(info.qris_nama || '')}" loading="lazy">
               ${info.qris_nama ? `<div style="text-align:center">a.n. <b>${esc(info.qris_nama)}</b></div>` : ''}<div style="text-align:center">Scan pakai aplikasi bank atau e-wallet apa pun.</div>`
            : `<div class="row"><span class="nomor">${esc(b.nomor)}</span><button type="button" class="copy" data-copy="${esc(String(b.nomor).replace(/\D/g, ''))}">${COPY}Salin</button></div><div>a.n. <b>${esc(b.nama)}</b></div>`}</div>
        </label>`).join('')}</div>
      <p class="bayar-nanti">Pembayaran dilakukan <b>setelah pesanan dikonfirmasi</b> lewat WhatsApp.</p>
      <label class="check ${form.bayar ? '' : 'disabled'}"><input type="checkbox" id="sudah" ${form.sudah ? 'checked' : ''} ${form.bayar ? '' : 'disabled'}>
        <span>Saya <b>sudah bayar</b>${form.bayar ? ` lewat <b>${esc(form.bayar)}</b>` : ''}. Bukti transfer akan saya kirim di chat WhatsApp.${form.bayar ? '' : '<br><span class="faint">Pilih cara bayar dulu.</span>'}</span></label>
    </section>
    <div id="err"></div>`}

    <footer class="toko-foot">${esc(info.nama_usaha || 'Telur Kita')} · <a href="admin/">Masuk pengelola</a></footer>
    ${habis ? '' : `<div class="t-bar"><div class="in"><div class="tot"><small id="totKet">${form.jumlah} butir × ${rp(harga())}</small><b id="tot">${rp(total())}</b></div>
      <button class="btn btn-wa" id="kirim">Pesan via WhatsApp</button></div></div>`}`;
  if (!habis) pasang();
}

function sinkronTotal() {
  $('#tot').textContent = rp(total());
  $('#totKet').textContent = `${Number(form.jumlah) || 0} butir × ${rp(harga())}`;
}

function pasang() {
  const f = $('#f');
  f.addEventListener('input', (e) => {
    const t = e.target;
    if (t.name in form) form[t.name] = t.name === 'jumlah' ? Math.max(0, Math.min(1000, parseInt(t.value, 10) || 0)) : t.value;
    if (t.name === 'jumlah') sinkronTotal();
  });
  f.addEventListener('submit', (e) => { e.preventDefault(); kirim(); });
  root.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => {
    form.jumlah = Math.max(minPesan(), Math.min(1000, (Number(form.jumlah) || 0) + Number(b.dataset.q)));
    $('#jumlah').value = form.jumlah; sinkronTotal();
  }));
  root.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => { form.jumlah = Number(b.dataset.set); $('#jumlah').value = form.jumlah; sinkronTotal(); }));
  root.querySelectorAll('[data-pay]').forEach((el) => (el.onclick = (e) => {
    if (e.target.closest('[data-copy]')) return;
    if (form.bayar === el.dataset.pay) return;
    form.bayar = el.dataset.pay; simpanLalu(render);
  }));
  root.querySelectorAll('[data-copy]').forEach((b) => (b.onclick = async (e) => {
    e.preventDefault(); e.stopPropagation();
    const txt = b.dataset.copy;
    try { await navigator.clipboard.writeText(txt); } catch (_) {
      const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    b.innerHTML = `${COPY}Tersalin`; setTimeout(() => (b.innerHTML = `${COPY}Salin`), 1600);
  }));
  const cb = $('#sudah'); if (cb) cb.onchange = () => (form.sudah = cb.checked);
  $('#kirim').onclick = kirim;
}
// simpan isian form sebelum render ulang (render ulang dipakai saat ganti cara bayar)
function simpanLalu(fn) {
  const f = $('#f'); if (f) ['nama', 'wa', 'tanggal', 'catatan'].forEach((k) => (form[k] = f.elements[k].value));
  const y = scrollY; fn(); scrollTo(0, y);
}

function salah(msg, fokus) {
  $('#err').innerHTML = `<div class="t-err">${esc(msg)}</div>`;
  if (fokus) { const el = $('#' + fokus); el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  else $('#err').scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function pesanWA(hasil) {
  const L = [`Halo ${info.nama_usaha || 'Telur Kita'}, saya mau pesan telur 🥚`, ''];
  if (hasil?.no_po) L.push(`No. pesanan: *${hasil.no_po}*`);
  L.push(`Nama: ${form.nama.trim()}`, `Jumlah: ${form.jumlah} butir`, `Harga: ${rp(harga())}/butir · Total *${rp(total())}*`);
  L.push(`Tanggal kirim: ${form.tanggal ? fmtLong(form.tanggal) : 'menyesuaikan'}`);
  if (form.bayar) L.push(`Pembayaran: ${form.bayar}`);
  if (form.catatan.trim()) L.push(`Catatan: ${form.catatan.trim()}`);
  L.push('');
  L.push(form.sudah && form.bayar
    ? `✅ Saya *sudah transfer* lewat ${form.bayar}. Bukti transfer saya kirim di chat ini.`
    : 'Mohon dikonfirmasi ya. Terima kasih 🙏');
  return waLink(info.wa, L.join('\n'));
}

let sibuk = false;
async function kirim() {
  if (sibuk) return;
  simpanLalu(() => {});
  form.jumlah = parseInt($('#jumlah').value, 10) || 0;
  const wa = form.wa.replace(/\D/g, '');
  if (form.nama.trim().length < 2) return salah('Nama harus diisi.', 'nama');
  if (!/^(0|62)\d{8,13}$/.test(wa)) return salah('Nomor WhatsApp belum benar. Contoh: 081234567890', 'wa');
  if (form.jumlah < minPesan()) return salah(`Minimal pemesanan ${minPesan()} butir.`, 'jumlah');
  if (form.jumlah > 1000) return salah('Untuk pesanan di atas 1.000 butir, silakan chat langsung.', 'jumlah');
  $('#err').innerHTML = '';
  sibuk = true;
  const btn = $('#kirim'); btn.disabled = true; btn.textContent = 'Menyimpan…';
  let hasil = null;
  try {
    if (sb) {
      const { data, error } = await sb.rpc('pesan_telur', {
        p_nama: form.nama.trim(), p_wa: wa, p_jumlah: form.jumlah, p_tanggal: form.tanggal || null,
        p_catatan: form.catatan.trim() || null, p_bayar: form.bayar || null, p_sudah_bayar: !!(form.sudah && form.bayar),
      });
      if (error) throw error;
      hasil = data;
    } else hasil = { no_po: 'PO-DEMO' };
  } catch (e) {
    sibuk = false; btn.disabled = false; btn.textContent = 'Pesan via WhatsApp';
    return salah(pesanError(e));
  }
  const link = pesanWA(hasil);
  root.innerHTML = `<header class="toko-head">${LOGO_SVG}<div><h1>${esc(info.nama_usaha || 'Telur Kita')}</h1><p>Pesan telur ayam, konfirmasi lewat WhatsApp.</p></div></header>
    <section class="t-card sukses"><div class="big">🥚</div><h2>Pesanan ${esc(hasil.no_po || '')} tercatat</h2>
      <p>${form.jumlah} butir · ${rp(total())}<br>Langkah terakhir: kirim pesannya di WhatsApp supaya kami bisa konfirmasi.</p>
      <a class="btn btn-wa" href="${link}" id="bukaWA">Buka WhatsApp</a>
      <button class="btn ghost" style="margin-top:10px" id="lagi">Buat pesanan lain</button></section>
    <footer class="toko-foot">${esc(info.nama_usaha || 'Telur Kita')} · <a href="admin/">Masuk pengelola</a></footer>`;
  $('#lagi').onclick = () => { Object.assign(form, { jumlah: Math.max(minPesan(), 10), tanggal: '', catatan: '', sudah: false }); sibuk = false; render(); };
  if (!info.demo) setTimeout(() => { location.href = link; }, 700);
}

muat().catch((e) => { root.innerHTML = `<div class="t-card"><div class="t-err">${esc(pesanError(e))}</div></div>`; });
