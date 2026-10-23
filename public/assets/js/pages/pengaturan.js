// Halaman Pengaturan
import { state, update, insert, isDemo, resetDemo } from '../store.js';
import { KELOMPOK } from '../calc.js';
import { esc, icon, fmtDate } from '../util.js';
import { openForm, readForm, toast, confirmDlg } from '../ui.js';
import { hapus } from '../actions.js';

const FIELDS = [
  { name: 'nama_usaha', label: 'Nama usaha', required: true },
  { name: 'nama_pemilik', label: 'Nama pemilik' },
  { name: 'tanggal_mulai', label: 'Tanggal mulai pencatatan', type: 'date', required: true },
  { name: 'jumlah_ayam_awal', label: 'Jumlah ayam awal (ekor)', type: 'number', min: 0 },
  { name: 'harga_default', label: 'Harga jual per butir (Rp)', type: 'number', min: 0, required: true, help: 'Juga tampil di halaman pesan pelanggan. Ubah di sini kalau ada promo.' },
  { name: 'produksi_harian', label: 'Rata-rata produksi per hari (butir)', type: 'number', min: 1, help: 'Untuk menghitung kapan mulai menyisihkan telur PO.' },
  { name: 'batas_hdp', label: 'Batas peringatan HDP (%)', type: 'number', min: 0, step: '1', help: 'Muncul peringatan kalau HDP bulan ini di bawah angka ini.' },
  { name: 'target_bulanan', label: 'Target penjualan bulanan (Rp)', type: 'number', min: 0 },
  { name: 'info_pembayaran', label: 'Info pembayaran (muncul di invoice & WA)', full: true, placeholder: "mis. BCA 1234567 a.n. Nama Pemilik / QRIS" },
];

export function render(el, ctx) {
  const s = state.pengaturan;
  const backup = state.sistem_status?.find((x) => x.kunci === 'backup_terakhir');
  const values = { ...s, batas_hdp: Math.round(Number(s.batas_hdp || 0) * 100) };
  const field = (f) => {
    const v = values[f.name] ?? '';
    return `<div class="field ${f.full ? 'full' : ''}"><label for="s_${f.name}">${f.label}${f.required ? ' *' : ''}</label>
      <input id="s_${f.name}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${f.min != null ? `min="${f.min}"` : ''} placeholder="${esc(f.placeholder || '')}">${f.help ? `<span class="help">${f.help}</span>` : ''}</div>`;
  };
  el.innerHTML = `<div class="page-head"><div><h1>Pengaturan</h1><p>Data usaha, kategori pengeluaran, akses, dan tampilan.</p></div></div>
  <div class="grid g-main">
    <div class="card"><div class="card-head"><h3>Data usaha</h3></div>
      <form class="form" id="setForm">${FIELDS.map(field).join('')}</form>
      <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn" data-save>${icon('check')}Simpan pengaturan</button></div></div>
    <div class="grid" style="align-content:start">
      <div class="card"><div class="card-head"><h3>${icon('users')} Pengelola (login Google)</h3></div>
        ${(state.app_users || []).map((u) => `<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border)"><div class="avatar" style="width:32px;height:32px;font-size:13px">${esc((u.nama || u.email)[0].toUpperCase())}</div><div><b>${esc(u.nama || '')}</b><div class="muted" style="font-size:12.5px">${esc(u.email)}</div></div></div>`).join('') || '<p class="muted">–</p>'}
        <p class="muted" style="font-size:12.5px;margin:10px 0 0">Hak semua pengelola sama penuh. Menambah/menghapus pengelola dilakukan di Supabase (lihat panduan README, bagian "Akses").</p></div>
      <div class="card"><div class="card-head"><h3>${icon('refresh')} Backup & kalender</h3></div>
        <div class="stat-list"><div><span class="muted">Backup ke spreadsheet</span><span>${backup ? `<span class="badge ok">${fmtTime(backup.nilai)}</span>` : '<span class="badge">Belum aktif</span>'}</span></div>
          <div><span class="muted">Jadwal backup</span><span>tiap 5 menit</span></div><div><span class="muted">Sinkron PO → Google Calendar</span><span>tiap 5 menit</span></div></div>
        ${isDemo() ? `<button class="btn ghost sm" style="margin-top:12px" data-reset>${icon('refresh')}Reset data demo</button>` : ''}</div>
      <div class="card"><div class="card-head"><h3>Tampilan</h3></div>
        <div class="seg">${[['auto', 'Ikuti perangkat'], ['light', 'Terang'], ['dark', 'Gelap']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${(localStorageGet('tk_theme') || 'auto') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    </div>
  </div>
  ${tokoCard(s)}
  <div class="card" style="margin-top:18px"><div class="card-head"><h3>Kategori pengeluaran</h3><button class="btn sm" data-addk>${icon('plus')}Kategori</button></div>
    <div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Kategori</th><th>Kelompok akun</th><th>Keterangan</th><th></th></tr></thead><tbody>
    ${[...state.kategori].sort((a, b) => a.urutan - b.urutan).map((k) => `<tr data-k="${k.id}"><td data-l="Kategori"><b>${esc(k.nama)}</b></td><td data-l="Kelompok"><span class="badge ${k.kelompok.startsWith('HPP') ? 'ok' : k.kelompok === 'Beban Penjualan' ? 'warn' : ''}">${esc(k.kelompok)}</span></td>
      <td data-l="Keterangan" class="muted">${esc(k.keterangan || '')}</td><td class="acts"><button class="btn ghost sm icon" data-a="edit">${icon('edit')}</button><button class="btn ghost sm icon" data-a="del">${icon('trash')}</button></td></tr>`).join('')}
    </tbody></table></div></div>`;

  el.querySelector('[data-save]').onclick = async () => {
    const v = readForm(el.querySelector('#setForm'), FIELDS);
    if (!v.nama_usaha || !v.harga_default || !v.tanggal_mulai) return toast('Nama usaha, tanggal mulai, dan harga wajib diisi', true);
    try {
      await update('pengaturan', 1, { ...v, batas_hdp: (v.batas_hdp || 0) / 100, target_bulanan: v.target_bulanan || 0, jumlah_ayam_awal: v.jumlah_ayam_awal || 0, produksi_harian: v.produksi_harian || 1 });
      toast('Pengaturan tersimpan'); ctx.refresh();
    } catch (e) { toast(e.message, true); }
  };
  pasangToko(el, ctx);
  el.querySelectorAll('[name=theme]').forEach((r) => (r.onchange = () => ctx.setTheme(r.value)));
  const reset = el.querySelector('[data-reset]');
  if (reset) reset.onclick = async () => { if (await confirmDlg('Kembalikan semua data demo ke awal?', { ok: 'Reset' })) { resetDemo(); toast('Data demo direset'); ctx.refresh(); } };
  const kForm = (k = null) => openForm({
    title: k ? 'Ubah kategori' : 'Kategori baru', values: k || { kelompok: 'HPP - Biaya Produksi' },
    fields: [{ name: 'nama', label: 'Nama kategori', required: true, full: true }, { name: 'kelompok', label: 'Kelompok akun', type: 'seg', options: KELOMPOK },
      { name: 'keterangan', label: 'Keterangan', full: true }],
    note: 'HPP - Biaya Produksi = masuk perhitungan modal per telur. Beban Penjualan = biaya menjual/mengantar.',
    onSubmit: async (v) => {
      if (k) await update('kategori_pengeluaran', k.id, v);
      else await insert('kategori_pengeluaran', { ...v, urutan: state.kategori.length + 1 });
      toast('Kategori tersimpan'); ctx.refresh();
    },
  });
  el.querySelector('[data-addk]').onclick = () => kForm();
  el.querySelectorAll('tr[data-k]').forEach((tr) => {
    const k = state.kategori.find((x) => x.id === Number(tr.dataset.k));
    tr.querySelector('[data-a=edit]').onclick = () => kForm(k);
    tr.querySelector('[data-a=del]').onclick = () => hapus('kategori_pengeluaran', k, `kategori "${k.nama}"`);
  });
}
// ---------------------------------------------------------------- Halaman pesan pelanggan
const linkToko = () => location.origin + location.pathname.replace(/admin\/?(index\.html)?$/, '');
let rekDraft = null;
function tokoCard(s) {
  rekDraft = (Array.isArray(s.rekening) ? s.rekening : []).map((r) => ({ ...r }));
  const inp = (name, label, val, attrs = '', help = '') => `<div class="field"><label for="t_${name}">${label}</label><input id="t_${name}" data-t="${name}" value="${esc(val ?? '')}" ${attrs}>${help ? `<span class="help">${help}</span>` : ''}</div>`;
  return `<div class="card" style="margin-top:18px" id="tokoCard"><div class="card-head"><h3>${icon('cart')} Halaman pesan pelanggan</h3>
      <div class="tools" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-tcopy>${icon('file')}Salin link</button><a class="btn ghost sm" href="${linkToko()}" target="_blank" rel="noopener">Buka</a></div></div>
    <p class="muted" style="margin:-4px 0 14px;font-size:13px">Link untuk pelanggan: <b>${esc(linkToko())}</b>. Pelanggan hanya melihat status <b>Tersedia / Terbatas / Habis</b>, tanpa angka stok.</p>
    <div class="form">
      ${inp('wa_pesanan', 'Nomor WhatsApp penerima pesanan', s.wa_pesanan, 'type="tel" placeholder="08xxxxxxxxxx"')}
      ${inp('min_pesan', 'Minimal pesanan (butir)', s.min_pesan ?? 5, 'type="number" min="1"')}
      ${inp('batas_terbatas', 'Di bawah ini tampil "Terbatas" (butir)', s.batas_terbatas ?? 20, 'type="number" min="1"')}
      ${inp('batas_habis', 'Di bawah ini tampil "Habis" (butir)', s.batas_habis ?? 5, 'type="number" min="0"', 'Stok dihitung dari stok sekarang dikurangi telur yang sedang disisihkan untuk PO.')}
      <div class="field full"><label class="chk" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-t="toko_buka" ${s.toko_buka === false ? '' : 'checked'}> Terima pesanan dari pelanggan (matikan untuk menutup sementara)</label></div>
    </div>
    <h4 style="margin:18px 0 8px">Rekening pembayaran</h4>
    <div id="rekList"></div>
    <button class="btn ghost sm" data-radd type="button" style="margin-top:8px">${icon('plus')}Tambah rekening</button>
    <h4 style="margin:18px 0 8px">QRIS</h4>
    <div class="form">
      ${inp('qris_nama', 'Nama di QRIS', s.qris_nama, 'placeholder="sesuai tulisan di QRIS"')}
      <div class="field"><label>Gambar QRIS</label><input type="file" accept="image/*" data-qfile><span class="help">Kosongkan untuk memakai gambar bawaan.</span></div>
      <div class="field full"><label class="chk" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-t="qris_aktif" ${s.qris_aktif === false ? '' : 'checked'}> Tampilkan QRIS di halaman pelanggan</label></div>
    </div>
    <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-top:8px">
      <img data-qprev src="${esc(s.qris_gambar || '../assets/img/qris.jpg')}" alt="QRIS" style="width:140px;border-radius:10px;border:1px solid var(--border);background:#fff">
      ${s.qris_gambar ? '<button class="btn ghost sm" data-qreset type="button">Pakai gambar bawaan</button>' : ''}
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn" data-tsave>${icon('check')}Simpan pengaturan toko</button></div></div>`;
}
function rekRows(el) {
  const box = el.querySelector('#rekList');
  box.innerHTML = rekDraft.map((r, i) => `<div style="display:grid;grid-template-columns:minmax(80px,1fr) minmax(120px,1.4fr) minmax(120px,1.6fr) auto;gap:8px;margin-bottom:8px" data-r="${i}">
      <input placeholder="Bank" value="${esc(r.bank || '')}" data-k="bank" aria-label="Bank"><input placeholder="Nomor rekening" value="${esc(r.nomor || '')}" data-k="nomor" inputmode="numeric" aria-label="Nomor rekening">
      <input placeholder="Atas nama" value="${esc(r.nama || '')}" data-k="nama" aria-label="Atas nama"><button class="btn ghost sm icon" data-rdel type="button" title="Hapus">${icon('trash')}</button></div>`).join('') || '<p class="muted" style="margin:0">Belum ada rekening.</p>';
  box.querySelectorAll('[data-r]').forEach((row) => {
    const i = Number(row.dataset.r);
    row.querySelectorAll('input').forEach((x) => (x.oninput = () => (rekDraft[i][x.dataset.k] = x.value)));
    row.querySelector('[data-rdel]').onclick = () => { rekDraft.splice(i, 1); rekRows(el); };
  });
}
function kecilkanGambar(file) {
  return new Promise((ok, no) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const sk = Math.min(1, 800 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * sk); c.height = Math.round(img.height * sk);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => no(new Error('Gambar tidak bisa dibaca'));
    img.src = url;
  });
}
function pasangToko(el, ctx) {
  const card = el.querySelector('#tokoCard'); if (!card) return;
  rekRows(el);
  let qris = undefined; // undefined = tidak berubah, null = pakai bawaan, string = gambar baru
  card.querySelector('[data-radd]').onclick = () => { rekDraft.push({ bank: '', nomor: '', nama: '' }); rekRows(el); };
  card.querySelector('[data-tcopy]').onclick = async () => { try { await navigator.clipboard.writeText(linkToko()); toast('Link halaman pelanggan disalin'); } catch (_) { toast(linkToko()); } };
  card.querySelector('[data-qfile]').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { qris = await kecilkanGambar(f); card.querySelector('[data-qprev]').src = qris; } catch (er) { toast(er.message, true); }
  };
  const rs = card.querySelector('[data-qreset]'); if (rs) rs.onclick = () => { qris = null; card.querySelector('[data-qprev]').src = '../assets/img/qris.jpg'; };
  card.querySelector('[data-tsave]').onclick = async () => {
    const g = (k) => card.querySelector(`[data-t=${k}]`);
    const rek = rekDraft.map((r) => ({ bank: String(r.bank || '').trim(), nomor: String(r.nomor || '').replace(/\s/g, ''), nama: String(r.nama || '').trim() })).filter((r) => r.bank || r.nomor);
    if (rek.some((r) => !r.bank || !r.nomor || !r.nama)) return toast('Lengkapi bank, nomor, dan atas nama untuk setiap rekening', true);
    if (new Set(rek.map((r) => r.bank)).size !== rek.length) return toast('Nama bank tidak boleh sama dua kali (mis. "BCA" dan "BCA 2")', true);
    const wa = g('wa_pesanan').value.replace(/[^0-9+]/g, '');
    if (!wa) return toast('Nomor WhatsApp penerima pesanan wajib diisi', true);
    const data = { wa_pesanan: wa, min_pesan: Math.max(1, parseInt(g('min_pesan').value, 10) || 5),
      batas_terbatas: Math.max(0, parseInt(g('batas_terbatas').value, 10) || 0), batas_habis: Math.max(0, parseInt(g('batas_habis').value, 10) || 0),
      toko_buka: g('toko_buka').checked, qris_aktif: g('qris_aktif').checked, qris_nama: g('qris_nama').value.trim() || null, rekening: rek };
    if (data.batas_habis > data.batas_terbatas) return toast('Batas "Habis" harus lebih kecil dari batas "Terbatas"', true);
    if (qris !== undefined) data.qris_gambar = qris;
    try { await update('pengaturan', 1, data); toast('Pengaturan toko tersimpan'); ctx.refresh(); } catch (e) { toast(e.message, true); }
  };
}

function fmtTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const m = Math.round((Date.now() - d) / 60000);
  return m < 1 ? 'baru saja' : m < 60 ? `${m} menit lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : fmtDate(d.toISOString().slice(0, 10));
}
function localStorageGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
