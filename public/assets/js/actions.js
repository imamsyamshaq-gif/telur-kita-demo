// Semua form input (dipakai dari halaman & tombol + cepat)
import { state, insert, update, remove, rpc } from './store.js';
import { openForm, confirmDlg, dialog, toast } from './ui.js';
import { today, rp, num, fmtDate, addDays, esc, icon, ym, ymAdd, pct } from './util.js';
import { JENIS_KELUAR, METODE, UTANG, stokSekarang, mulaiSisih, asetPerBulan, saldoKas, bulanan, pelangganNama, penjSisa } from './calc.js';

let onSaved = () => {};
export const setOnSaved = (f) => (onSaved = f);
const done = (msg) => { toast(msg); onSaved(); };

const pelangganOpts = () => state.pelanggan.map((c) => c.nama).sort((a, b) => a.localeCompare(b));
export async function ensurePelanggan(nama, wa = null) {
  if (!nama) return null;
  const found = state.pelanggan.find((c) => c.nama.trim().toLowerCase() === nama.trim().toLowerCase());
  if (found) return found.id;
  const r = await insert('pelanggan', wa ? { nama: nama.trim(), no_wa: wa } : { nama: nama.trim() });
  toast(`Pelanggan baru "${nama}" ditambahkan`);
  return r.id;
}
const harga0 = () => Number(state.pengaturan.harga_default) || 0;
const ayamTerakhir = () => {
  const last = [...state.produksi].filter((r) => r.ayam_hidup > 0 && r.ayam_hidup <= 5000).sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1))[0];
  return last ? last.ayam_hidup : state.pengaturan.jumlah_ayam_awal || 0;
};

// ---------------------------------------------------------------- Produksi
export function formProduksi(row = null) {
  const dup = (t) => !row && state.produksi.some((r) => r.tanggal === t);
  openForm({
    title: row ? 'Ubah catatan produksi' : 'Catat telur hari ini',
    values: row || { tanggal: today(), ayam_hidup: ayamTerakhir(), telur_rusak: 0, ayam_mati: 0 },
    fields: [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true },
      { name: 'ayam_hidup', label: 'Ayam hidup (ekor)', type: 'number', min: 0, required: true, help: 'Kalau 1 baris mewakili beberapa hari, isi ekor × jumlah hari.' },
      { name: 'telur_bagus', label: 'Telur bagus (butir)', type: 'number', min: 0, required: true },
      { name: 'telur_rusak', label: 'Telur pecah / rusak', type: 'number', min: 0 },
      { name: 'ayam_mati', label: 'Ayam mati hari ini', type: 'number', min: 0 },
      { name: 'catatan', label: 'Catatan', type: 'textarea', placeholder: 'Opsional' },
    ],
    onChange: (v) => {
      const tot = (v.telur_bagus || 0) + (v.telur_rusak || 0);
      const hdp = v.ayam_hidup ? tot / v.ayam_hidup : 0;
      let s = `<span>Total produksi <b>${num(tot)}</b> butir</span><span>HDP <b>${pct(hdp)}</b></span>`;
      if (dup(v.tanggal)) s += `</div><div class="calc-line" style="background:var(--yolk-50)">Tanggal ini sudah punya catatan — ini akan jadi baris tambahan.`;
      return s;
    },
    onSubmit: async (v) => {
      const data = { ...v, telur_rusak: v.telur_rusak || 0, ayam_mati: v.ayam_mati || 0 };
      if (row) await update('produksi', row.id, data); else await insert('produksi', data);
      done('Produksi tersimpan');
    },
  });
}

// ---------------------------------------------------------------- Penjualan / telur keluar
export function formPenjualan(row = null, jenisAwal = 'Jual') {
  const v0 = row ? { ...row, pelanggan: pelangganNama(state, row.pelanggan_id) } : { tanggal: today(), jenis: jenisAwal, metode: 'Tunai', harga: harga0() };
  const stok = stokSekarang(state) + (row ? Number(row.jumlah) : 0);
  openForm({
    title: row ? 'Ubah telur keluar' : jenisAwal === 'Jual' ? 'Jual telur' : 'Catat telur keluar',
    values: v0,
    fields: [
      { name: 'jenis', label: 'Jenis', type: 'seg', options: JENIS_KELUAR, default: 'Jual' },
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true },
      { name: 'pelanggan', label: 'Pelanggan', type: 'datalist', options: pelangganOpts(), placeholder: 'Ketik nama (baru otomatis ditambahkan)', help: 'Boleh dikosongkan untuk pembeli umum.' },
      { name: 'jumlah', label: 'Jumlah (butir)', type: 'number', min: 1, required: true },
      { name: 'harga', label: 'Harga per butir (Rp)', type: 'number', min: 0, show: (v) => v.jenis === 'Jual' },
      { name: 'metode', label: 'Pembayaran', type: 'seg', options: METODE, show: (v) => v.jenis === 'Jual' },
      { name: 'tanggal_bayar', label: 'Tanggal dilunasi', type: 'date', show: (v) => v.jenis === 'Jual' && v.metode === UTANG, help: 'Kosongkan kalau belum dibayar.' },
      { name: 'catatan', label: 'Catatan', type: 'textarea', placeholder: 'Opsional' },
    ],
    onChange: (v) => {
      const tot = v.jenis === 'Jual' ? (v.jumlah || 0) * (v.harga ?? harga0()) : 0;
      const warn = v.jumlah > stok ? ` <b style="color:var(--danger)">· melebihi stok!</b>` : '';
      return `<span>${v.jenis === 'Jual' ? `Total <b>${rp(tot)}</b>` : 'Tidak menambah pendapatan'}</span><span>Stok tersedia <b>${num(stok)}</b> butir${warn}</span>`;
    },
    onSubmit: async (v) => {
      const pelanggan_id = await ensurePelanggan(v.pelanggan);
      const data = { tanggal: v.tanggal, jenis: v.jenis, pelanggan_id, jumlah: v.jumlah, catatan: v.catatan,
        harga: v.jenis === 'Jual' ? v.harga ?? harga0() : null, metode: v.jenis === 'Jual' ? v.metode || 'Tunai' : null,
        tanggal_bayar: v.jenis === 'Jual' && v.metode === UTANG ? v.tanggal_bayar : null };
      if (row) await update('penjualan', row.id, data); else await insert('penjualan', data);
      done(v.jenis === 'Jual' && pelanggan_id && !row ? 'Penjualan tersimpan · nota otomatis dibuat' : 'Tersimpan');
    },
  });
}

export async function lunasi(p) {
  openForm({
    title: 'Tandai lunas', submit: 'Tandai lunas',
    note: `${esc(pelangganNama(state, p.pelanggan_id) || 'Pembeli')} · ${num(p.jumlah)} butir · sisa ${rp(penjSisa(p))}`,
    values: { tanggal_bayar: today() },
    fields: [{ name: 'tanggal_bayar', label: 'Tanggal dibayar', type: 'date', required: true }],
    onSubmit: async (v) => { await update('penjualan', p.id, { tanggal_bayar: v.tanggal_bayar }); done('Pembayaran dicatat, uang masuk amplop'); },
  });
}

// ---------------------------------------------------------------- Pengeluaran
export function formPengeluaran(row = null) {
  openForm({
    title: row ? 'Ubah pengeluaran' : 'Catat belanja',
    values: row || { tanggal: today(), qty: 1, sumber_dana: 'Kas Usaha', kategori: 'Pakan' },
    fields: [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true },
      { name: 'kategori', label: 'Kategori', type: 'select', required: true, options: [...state.kategori].sort((a, b) => a.urutan - b.urutan).map((k) => ({ value: k.nama, label: `${k.nama} — ${k.kelompok}` })) },
      { name: 'keterangan', label: 'Keterangan', placeholder: 'mis. Pakan layer 25 kg', full: true },
      { name: 'qty', label: 'Jumlah', type: 'number', min: 0, required: true },
      { name: 'satuan', label: 'Satuan', placeholder: 'kg / pak / botol' },
      { name: 'harga_satuan', label: 'Harga satuan (Rp)', type: 'number', min: 0, required: true },
      { name: 'sumber_dana', label: 'Dibayar dari', type: 'seg', options: [{ value: 'Kas Usaha', label: 'Amplop usaha' }, { value: 'Uang Pribadi', label: 'Uang pribadi' }] },
      { name: 'catatan', label: 'Catatan', type: 'textarea', placeholder: 'Opsional' },
    ],
    onChange: (v) => `<span>Total <b>${rp((v.qty || 0) * (v.harga_satuan || 0))}</b></span><span>${v.sumber_dana === 'Uang Pribadi' ? 'Dicatat sebagai tambahan modal' : 'Mengurangi uang di amplop'}</span>`,
    onSubmit: async (v) => {
      if (row) await update('pengeluaran', row.id, v); else await insert('pengeluaran', v);
      done('Pengeluaran tersimpan');
    },
  });
}

// ---------------------------------------------------------------- Pre-order
export function formPO(row = null, opt = {}) {
  const prodHarian = Number(state.pengaturan.produksi_harian) || 9;
  const terima = !!(row && opt.terima);
  const totalRow = row ? Number(row.jumlah) * Number(row.harga ?? harga0()) : 0;
  openForm({
    title: terima ? `Terima pesanan ${row.no_po}` : row ? `Ubah ${row.no_po}` : 'Pre-order baru',
    submit: terima ? 'Terima pesanan' : undefined,
    note: terima ? `Pesanan dari halaman pelanggan (${esc(row.nama_pemesan || '')}, WA ${esc(row.wa_pemesan || '-')}). Isi tanggal kirim yang sudah disepakati.${row.sudah_bayar ? ` Pelanggan bilang <b>sudah bayar lewat ${esc(row.sudah_bayar)}</b>: cek mutasi dulu, lalu isi DP sebesar uang yang benar-benar masuk.` : ''}` : undefined,
    values: terima ? { ...row, pelanggan: pelangganNama(state, row.pelanggan_id) || row.nama_pemesan, tanggal_kirim: row.tanggal_kirim || addDays(today(), 1), dp: row.sudah_bayar ? totalRow : 0 }
      : row ? { ...row, pelanggan: pelangganNama(state, row.pelanggan_id) } : { tanggal_pesan: today(), tanggal_kirim: addDays(today(), 7), harga: harga0(), dp: 0 },
    fields: [
      { name: 'pelanggan', label: 'Pelanggan', type: 'datalist', options: pelangganOpts(), required: true, full: true, placeholder: 'Ketik nama (baru otomatis ditambahkan)' },
      { name: 'tanggal_pesan', label: 'Tanggal pesan (DP diterima)', type: 'date', required: true },
      { name: 'tanggal_kirim', label: 'Tanggal kirim', type: 'date', required: true },
      { name: 'jumlah', label: 'Jumlah (butir)', type: 'number', min: 1, required: true },
      { name: 'harga', label: 'Harga per butir (Rp)', type: 'number', min: 0 },
      { name: 'dp', label: 'DP / uang muka (Rp)', type: 'number', min: 0, help: 'DP masuk amplop sekarang, belum dihitung pendapatan.' },
      { name: 'catatan', label: 'Catatan', type: 'textarea', placeholder: 'mis. untuk hajatan, minta telur besar' },
    ],
    onChange: (v) => {
      const total = (v.jumlah || 0) * (v.harga ?? harga0());
      const hari = Math.ceil((v.jumlah || 0) / prodHarian);
      const mulai = v.tanggal_kirim ? addDays(v.tanggal_kirim, -hari) : null;
      return `<span>Total <b>${rp(total)}</b> · sisa bayar <b>${rp(total - (v.dp || 0))}</b></span><span>Mulai sisihkan <b>${mulai ? fmtDate(mulai) : '–'}</b> (±${hari} hari)</span>`;
    },
    onSubmit: async (v) => {
      if (v.tanggal_kirim < v.tanggal_pesan) throw new Error('Tanggal kirim tidak boleh sebelum tanggal pesan');
      const pelanggan_id = await ensurePelanggan(v.pelanggan, terima ? row.wa_pemesan : null);
      const data = { pelanggan_id, tanggal_pesan: v.tanggal_pesan, tanggal_kirim: v.tanggal_kirim, jumlah: v.jumlah, harga: v.harga ?? harga0(), dp: v.dp || 0, catatan: v.catatan };
      if (terima) data.status = 'Dipesan';
      if (row) await update('po', row.id, data); else await insert('po', data);
      done(terima ? `${row.no_po} diterima · masuk PO aktif & jadwal kalender` : 'Pre-order tersimpan · jadwal Google Calendar diperbarui dalam ±5 menit');
    },
  });
}
export async function tolakPO(po) {
  if (!(await confirmDlg(`Tolak pesanan ${po.no_po} dari ${po.nama_pemesan || 'pelanggan'} (${num(po.jumlah)} butir)? Jangan lupa kabari pelanggan lewat WhatsApp.`, { ok: 'Tolak pesanan', danger: true }))) return;
  try { await update('po', po.id, { status: 'Ditolak' }); done(`${po.no_po} ditolak`); } catch (e) { toast(e.message, true); }
}
export function kirimPO(po) {
  const sisa = Number(po.total ?? po.jumlah * po.harga) - Number(po.dp || 0);
  openForm({
    title: `Kirim ${po.no_po}`, submit: 'Tandai terkirim',
    note: `${esc(pelangganNama(state, po.pelanggan_id))} · ${num(po.jumlah)} butir. Penjualan akan tercatat otomatis (DP ${rp(po.dp)} dipotong), nota ikut dibuat.`,
    values: { tanggal: today(), metode: 'Tunai' },
    fields: [
      { name: 'tanggal', label: 'Tanggal dikirim', type: 'date', required: true },
      { name: 'metode', label: `Pelunasan sisa ${rp(sisa)}`, type: 'seg', options: METODE },
    ],
    onChange: () => `<span>Stok sekarang <b>${num(stokSekarang(state))}</b> butir</span><span>Dibutuhkan <b>${num(po.jumlah)}</b></span>`,
    onSubmit: async (v) => { await rpc('kirim_po', { p_po_id: po.id, p_metode: v.metode || 'Tunai', p_tanggal: v.tanggal }); done(`${po.no_po} terkirim · penjualan & nota dibuat`); },
  });
}
export function batalPO(po) {
  openForm({
    title: `Batalkan ${po.no_po}`, submit: 'Batalkan PO',
    values: { tanggal: today(), kembali: true },
    fields: [
      { name: 'tanggal', label: 'Tanggal batal', type: 'date', required: true },
      ...(Number(po.dp) > 0 ? [{ name: 'kembali', type: 'checkbox', text: `DP ${rp(po.dp)} dikembalikan ke pelanggan (keluar dari amplop)`, full: true, help: 'Kalau tidak dicentang, DP hangus dan dihitung pendapatan lain.' }] : []),
    ],
    onSubmit: async (v) => { await update('po', po.id, { status: 'Batal', tanggal_selesai: v.tanggal, dp_dikembalikan: v.kembali !== false }); done(`${po.no_po} dibatalkan`); },
  });
}

// ---------------------------------------------------------------- Modal / prive / cek amplop
export function formModal(row = null, jenis = 'Setoran Modal') {
  const lalu = bulanan(state, ymAdd(ym(today()), -1));
  openForm({
    title: row ? 'Ubah modal / prive' : jenis === 'Setoran Modal' ? 'Tambah modal' : 'Ambil uang (prive)',
    values: row || { tanggal: today(), jenis },
    fields: [
      { name: 'jenis', label: 'Jenis', type: 'seg', options: [{ value: 'Setoran Modal', label: 'Setor modal ke amplop' }, { value: 'Prive (Ambil Uang)', label: 'Ambil uang (prive)' }] },
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true },
      { name: 'jumlah', label: 'Jumlah (Rp)', type: 'number', min: 1, required: true },
      { name: 'keterangan', label: 'Keterangan', full: true, placeholder: 'Opsional' },
    ],
    onChange: (v) => v.jenis === 'Prive (Ambil Uang)'
      ? `<span>Saran: ambil maksimal laba bulan lalu <b>${rp(Math.max(0, lalu.labaBersih))}</b></span><span>Amplop sekarang <b>${rp(saldoKas(state))}</b></span>`
      : `<span>Amplop sekarang <b>${rp(saldoKas(state))}</b></span>`,
    onSubmit: async (v) => { if (row) await update('modal_prive', row.id, v); else await insert('modal_prive', v); done('Tersimpan'); },
  });
}
export function cekAmplop() {
  const catatan = saldoKas(state, today());
  openForm({
    title: 'Cocokkan isi amplop', submit: 'Simpan hasil cek',
    note: `Hitung uang fisik di amplop / rekening usaha, lalu ketik di bawah. Menurut catatan: <b>${rp(catatan)}</b>`,
    values: { tanggal: today() },
    fields: [
      { name: 'saldo_fisik', label: 'Uang fisik sebenarnya (Rp)', type: 'number', min: 0, required: true },
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true },
      { name: 'catatan', label: 'Catatan', full: true, placeholder: 'Opsional' },
    ],
    onChange: (v) => {
      if (v.saldo_fisik == null) return '';
      const s = v.saldo_fisik - catatan;
      return Math.abs(s) < 1 ? `<span style="color:var(--green-600)"><b>COCOK ✔</b> pencatatan sudah benar</span>`
        : `<span style="color:var(--danger)"><b>Selisih ${rp(s)}</b></span><span>${s > 0 ? 'Ada pemasukan belum dicatat' : 'Ada pengeluaran / prive belum dicatat'}</span>`;
    },
    onSubmit: async (v) => { await insert('kas_opname', { ...v, saldo_catatan: saldoKas(state, v.tanggal) }); done('Hasil cek amplop tersimpan'); },
  });
}

// ---------------------------------------------------------------- Aset
export function formAset(row = null) {
  openForm({
    title: row ? 'Ubah aset' : 'Tambah aset',
    values: row || { tanggal_beli: today(), kategori: 'Peralatan', qty: 1, umur_bulan: 24, nilai_sisa: 0, sumber_dana: 'Uang Pribadi' },
    fields: [
      { name: 'kategori', label: 'Kategori', type: 'seg', options: ['Ayam', 'Kandang', 'Peralatan', 'Lainnya'] },
      { name: 'nama', label: 'Nama aset', required: true, full: true },
      { name: 'tanggal_beli', label: 'Tanggal beli', type: 'date', required: true },
      { name: 'qty', label: 'Jumlah', type: 'number', min: 0, required: true },
      { name: 'harga_satuan', label: 'Harga satuan (Rp)', type: 'number', min: 0, required: true },
      { name: 'umur_bulan', label: 'Umur manfaat (bulan)', type: 'number', min: 1, required: true, help: 'Ayam petelur umumnya produktif ±18 bulan.' },
      { name: 'nilai_sisa', label: 'Nilai sisa (Rp)', type: 'number', min: 0, help: 'Perkiraan nilai jual saat sudah tidak dipakai (mis. ayam afkir).' },
      { name: 'sumber_dana', label: 'Dibayar dari', type: 'seg', options: [{ value: 'Kas Usaha', label: 'Amplop usaha' }, { value: 'Uang Pribadi', label: 'Uang pribadi' }] },
      { name: 'catatan', label: 'Catatan', type: 'textarea' },
    ],
    onChange: (v) => `<span>Total <b>${rp((v.qty || 0) * (v.harga_satuan || 0))}</b></span><span>Penyusutan <b>${rp(asetPerBulan(v))}</b>/bulan</span>`,
    onSubmit: async (v) => { if (row) await update('aset', row.id, v); else await insert('aset', v); done('Aset tersimpan'); },
  });
}

// ---------------------------------------------------------------- Pelanggan & tagihan
export function formPelanggan(row = null) {
  openForm({
    title: row ? 'Ubah pelanggan' : 'Pelanggan baru',
    values: row || {},
    fields: [
      { name: 'nama', label: 'Nama', required: true, full: true },
      { name: 'no_wa', label: 'No. WhatsApp', type: 'tel', placeholder: '0812…' },
      { name: 'alamat', label: 'Alamat / area' },
      { name: 'catatan', label: 'Catatan', type: 'textarea' },
    ],
    onSubmit: async (v) => { if (row) await update('pelanggan', row.id, v); else await insert('pelanggan', v); done('Pelanggan tersimpan'); },
  });
}
export function formTagihan(pelangganId = null, go) {
  const k = ym(today());
  openForm({
    title: 'Buat tagihan (invoice)', submit: 'Buat tagihan',
    note: 'Tagihan merangkum semua penjualan ke satu pelanggan dalam periode tertentu. Nota per transaksi sudah dibuat otomatis.',
    values: { pelanggan_id: pelangganId, dari: k + '-01', sampai: today(), tanggal: today() },
    fields: [
      { name: 'pelanggan_id', label: 'Pelanggan', type: 'select', required: true, full: true, placeholder: 'Pilih pelanggan', options: [...state.pelanggan].sort((a, b) => a.nama.localeCompare(b.nama)).map((c) => ({ value: c.id, label: c.nama })) },
      { name: 'dari', label: 'Dari tanggal', type: 'date', required: true },
      { name: 'sampai', label: 'Sampai tanggal', type: 'date', required: true },
      { name: 'tanggal', label: 'Tanggal invoice', type: 'date', required: true },
    ],
    onSubmit: async (v) => {
      const r = await insert('invoice', { jenis: 'Tagihan', pelanggan_id: Number(v.pelanggan_id), periode_dari: v.dari, periode_sampai: v.sampai, tanggal: v.tanggal });
      done(`Tagihan ${r.no_invoice || ''} dibuat`);
      go && go('invoice/' + r.id);
    },
  });
}

// ---------------------------------------------------------------- Hapus umum
export async function hapus(table, row, label) {
  if (!(await confirmDlg(`Hapus ${label}? Data yang dihapus tidak bisa dikembalikan.`, { ok: 'Hapus', danger: true }))) return;
  try { await remove(table, row.id); done('Terhapus'); } catch (e) { toast(e.message, true); }
}

// ---------------------------------------------------------------- Lembar aksi cepat (tombol +)
export function quickSheet() {
  const opts = [
    ['egg', 'Telur hari ini', () => formProduksi()], ['cart', 'Jual telur', () => formPenjualan(null, 'Jual')],
    ['wallet', 'Catat belanja', () => formPengeluaran()], ['calendar', 'Pre-order baru', () => formPO()],
    ['box', 'Telur keluar lain', () => formPenjualan(null, 'Konsumsi Sendiri')], ['coins', 'Modal / ambil uang', () => formModal()],
  ];
  const d = dialog({ title: 'Catat cepat', cls: 'fab-sheet', body: `<div class="opts">${opts.map(([ic, t], i) => `<button data-i="${i}">${icon(ic)}${t}</button>`).join('')}</div>` });
  d.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { d.close(); opts[b.dataset.i][2](); }));
}
