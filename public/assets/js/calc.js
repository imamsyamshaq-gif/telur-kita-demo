// Semua perhitungan akuntansi (murni, tanpa tampilan). Sama persis dengan
// logika spreadsheet: HPP = (biaya produksi + penyusutan) ÷ telur bagus bulan itu.
import { sum, ym, ymIndex, ymAdd, addDays, today, diffDays } from './util.js';

export const JENIS_KELUAR = ['Jual', 'Konsumsi Sendiri', 'Untuk Keluarga', 'Untuk Tetangga', 'Hadiah / Sedekah', 'Pecah / Rusak (dari stok)'];
export const METODE = ['Tunai', 'Transfer', 'QRIS', 'Utang (Bayar Nanti)'];
export const UTANG = 'Utang (Bayar Nanti)';
export const KELOMPOK = ['HPP - Biaya Produksi', 'Beban Penjualan', 'Beban Lain-lain'];

const n = (x) => Number(x) || 0;

// ---- nilai turunan per baris (dipakai juga di mode demo) ----
export const penjTotal = (p) => (p.jenis === 'Jual' ? n(p.jumlah) * n(p.harga) : 0);
export const penjStatus = (p) =>
  p.jenis !== 'Jual' ? '-' : p.metode === UTANG && !p.tanggal_bayar ? 'BELUM LUNAS' : 'LUNAS';
export const penjSisa = (p) => penjTotal(p) - n(p.dp_terpakai);
export const pgTotal = (e) => n(e.qty) * n(e.harga_satuan);
export const asetTotal = (a) => n(a.qty) * n(a.harga_satuan);
export const poTotal = (p) => n(p.jumlah) * n(p.harga);

export const kelompokOf = (state, kategori) =>
  (state.kategori.find((k) => k.nama === kategori) || {}).kelompok || 'Beban Lain-lain';

export const pelangganNama = (state, id) => (state.pelanggan.find((c) => c.id === id) || {}).nama || '';

// ---- Penyusutan (garis lurus, mulai bulan pembelian) ----
export const asetPerBulan = (a) => (asetTotal(a) - n(a.nilai_sisa)) / Math.max(1, n(a.umur_bulan));
export function penyusutanBulan(state, k, nowYM = ym(today())) {
  if (ymIndex(k) > ymIndex(nowYM)) return 0;
  const i = ymIndex(k);
  return sum(
    state.aset.filter((a) => {
      const s = ymIndex(ym(a.tanggal_beli));
      return i >= s && i < s + n(a.umur_bulan);
    }),
    asetPerBulan
  );
}
export function nilaiBuku(a, nowYM = ym(today())) {
  const jalan = ymIndex(nowYM) - ymIndex(ym(a.tanggal_beli)) + 1;
  return asetTotal(a) - asetPerBulan(a) * Math.max(0, Math.min(n(a.umur_bulan), jalan));
}

// ---- Laba rugi bulanan ----
export function bulanan(state, k) {
  const inM = (r) => ym(r.tanggal) === k;
  const prod = state.produksi.filter(inM);
  const telurBagus = sum(prod, (r) => r.telur_bagus);
  const telurRusak = sum(prod, (r) => r.telur_rusak);
  const ayamHari = sum(prod, (r) => r.ayam_hidup);
  const keluar = state.penjualan.filter(inM);
  const jual = keluar.filter((p) => p.jenis === 'Jual');
  const terjual = sum(jual, (p) => p.jumlah);
  const nonJualPer = {};
  keluar.filter((p) => p.jenis !== 'Jual').forEach((p) => (nonJualPer[p.jenis] = (nonJualPer[p.jenis] || 0) + n(p.jumlah)));
  const nonJual = sum(Object.values(nonJualPer));
  const pendapatan = sum(jual, penjTotal);
  const pg = state.pengeluaran.filter(inM);
  const byKel = (kel) => sum(pg.filter((e) => kelompokOf(state, e.kategori) === kel), pgTotal);
  const biayaProduksi = byKel('HPP - Biaya Produksi');
  const bebanPenjualan = byKel('Beban Penjualan');
  const bebanLain = byKel('Beban Lain-lain');
  const penyusutan = penyusutanBulan(state, k);
  const hpp = telurBagus ? (biayaProduksi + penyusutan) / telurBagus : 0;
  const bpp = hpp * terjual;
  const labaKotor = pendapatan - bpp;
  const pendapatanLain = sum(
    state.po.filter((p) => p.status === 'Batal' && p.dp_dikembalikan === false && p.tanggal_selesai && ym(p.tanggal_selesai) === k),
    (p) => p.dp
  );
  const labaBersih = labaKotor - bebanPenjualan - bebanLain + pendapatanLain;
  return {
    bulan: k, telurBagus, telurRusak, ayamHari, hdp: ayamHari ? (telurBagus + telurRusak) / ayamHari : 0,
    terjual, nonJual, nonJualPer, pendapatan, biayaProduksi, penyusutan, hpp, bpp, labaKotor,
    bebanPenjualan, bebanLain, pendapatanLain, labaBersih, margin: pendapatan ? labaBersih / pendapatan : 0,
    nilaiNonJual: hpp * nonJual, totalPengeluaran: biayaProduksi + bebanPenjualan + bebanLain,
  };
}

// Daftar bulan dari awal pencatatan s.d. bulan ini (atau data terakhir)
export function daftarBulan(state) {
  const dates = [state.pengaturan?.tanggal_mulai, ...['produksi', 'penjualan', 'pengeluaran', 'modal_prive'].flatMap((t) => state[t].map((r) => r.tanggal))].filter(Boolean);
  let start = dates.reduce((a, b) => (a < b ? a : b), today());
  let end = dates.reduce((a, b) => (a > b ? a : b), today());
  if (end < today()) end = today();
  const out = [];
  for (let k = ym(start); ymIndex(k) <= ymIndex(ym(end)); k = ymAdd(k, 1)) out.push(k);
  return out;
}

// ---- Uang di amplop (kas usaha) ----
export function mutasiKas(state) {
  const m = [];
  for (const r of state.modal_prive)
    m.push({ tanggal: r.tanggal, jenis: r.jenis === 'Setoran Modal' ? 'modal' : 'prive', jumlah: r.jenis === 'Setoran Modal' ? n(r.jumlah) : -n(r.jumlah), label: r.keterangan || r.jenis });
  for (const p of state.penjualan) {
    if (p.jenis !== 'Jual') continue;
    const net = penjSisa(p);
    if (p.metode === UTANG) {
      if (p.tanggal_bayar) m.push({ tanggal: p.tanggal_bayar, jenis: 'lunas', jumlah: net, label: 'Pelunasan utang' });
    } else m.push({ tanggal: p.tanggal, jenis: 'jual', jumlah: net, label: 'Penjualan' });
  }
  for (const e of state.pengeluaran)
    if (e.sumber_dana === 'Kas Usaha') m.push({ tanggal: e.tanggal, jenis: 'belanja', jumlah: -pgTotal(e), label: e.kategori });
  for (const a of state.aset)
    if (a.sumber_dana === 'Kas Usaha') m.push({ tanggal: a.tanggal_beli, jenis: 'aset', jumlah: -asetTotal(a), label: a.nama });
  for (const p of state.po) {
    if (n(p.dp) > 0) m.push({ tanggal: p.tanggal_pesan, jenis: 'dp_in', jumlah: n(p.dp), label: 'DP ' + (p.no_po || 'PO') });
    if (p.status === 'Batal' && p.dp_dikembalikan !== false && n(p.dp) > 0 && p.tanggal_selesai)
      m.push({ tanggal: p.tanggal_selesai, jenis: 'dp_out', jumlah: -n(p.dp), label: 'DP dikembalikan ' + (p.no_po || '') });
  }
  return m.sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0));
}

export function amplop(state, k) {
  const m = mutasiKas(state);
  const awal = sum(m.filter((x) => x.tanggal < k + '-01'), (x) => x.jumlah);
  const inM = m.filter((x) => ym(x.tanggal) === k);
  const by = (j) => sum(inM.filter((x) => x.jenis === j), (x) => x.jumlah);
  const r = { awal, modal: by('modal'), jual: by('jual'), lunas: by('lunas'), dpIn: by('dp_in'), belanja: -by('belanja'), aset: -by('aset'), prive: -by('prive'), dpOut: -by('dp_out') };
  r.akhir = r.awal + r.modal + r.jual + r.lunas + r.dpIn - r.belanja - r.aset - r.prive - r.dpOut;
  return r;
}
export const saldoKas = (state, sampai = '9999-12-31') => sum(mutasiKas(state).filter((x) => x.tanggal <= sampai), (x) => x.jumlah);

// ---- Stok telur ----
export const stokSampai = (state, tgl) =>
  sum(state.produksi.filter((r) => r.tanggal <= tgl), (r) => r.telur_bagus) - sum(state.penjualan.filter((p) => p.tanggal <= tgl), (p) => p.jumlah);
export const stokSekarang = (state) => sum(state.produksi, (r) => r.telur_bagus) - sum(state.penjualan, (p) => p.jumlah);
export function stokBulan(state, k) {
  const awal = stokSampai(state, addDays(k + '-01', -1));
  const b = bulanan(state, k);
  const per = { Jual: b.terjual, ...b.nonJualPer };
  return { awal, bagus: b.telurBagus, rusak: b.telurRusak, per, akhir: awal + b.telurBagus - b.terjual - b.nonJual };
}

// ---- Piutang ----
export const piutangList = (state) => state.penjualan.filter((p) => penjStatus(p) === 'BELUM LUNAS');
export const piutangPelanggan = (state, id) => sum(piutangList(state).filter((p) => p.pelanggan_id === id), penjSisa);

// ---- Pre-order ----
export const mulaiSisih = (state, po) =>
  addDays(po.tanggal_kirim, -Math.ceil(n(po.jumlah) / Math.max(1, n(state.pengaturan?.produksi_harian) || 9)));
export function ringkasPO(state) {
  const aktif = state.po.filter((p) => p.status === 'Dipesan').sort((a, b) => (a.tanggal_kirim < b.tanggal_kirim ? -1 : 1));
  const t = today();
  const perluSisih = sum(aktif.filter((p) => mulaiSisih(state, p) <= t), (p) => p.jumlah);
  const stok = stokSekarang(state);
  return { aktif, perluSisih, totalDipesan: sum(aktif, (p) => p.jumlah), dpDipegang: sum(aktif, (p) => p.dp), stok, cukup: stok >= perluSisih };
}

// ---- Seri harian untuk grafik ----
export function seriHarian(state, hari = 14, akhir = today()) {
  const out = [];
  for (let i = hari - 1; i >= 0; i--) {
    const d = addDays(akhir, -i);
    const jual = state.penjualan.filter((p) => p.tanggal === d && p.jenis === 'Jual');
    out.push({
      tanggal: d,
      pendapatan: sum(jual, penjTotal),
      terjual: sum(jual, (p) => p.jumlah),
      produksi: sum(state.produksi.filter((r) => r.tanggal === d), (r) => r.telur_bagus),
    });
  }
  return out;
}

// ---- Transaksi terbaru (gabungan) ----
export function transaksiTerbaru(state, limit = 8) {
  const L = [];
  for (const p of state.penjualan)
    L.push({ tanggal: p.tanggal, id: p.id, ts: p.created_at, tipe: p.jenis === 'Jual' ? 'Penjualan' : 'Telur keluar', warna: p.jenis === 'Jual' ? 'green' : 'cream',
      ket: `${p.jumlah} butir${p.pelanggan_id ? ' · ' + pelangganNama(state, p.pelanggan_id) : ''}${p.jenis !== 'Jual' ? ' · ' + p.jenis : ''}`,
      jumlah: penjTotal(p), status: penjStatus(p) });
  for (const e of state.pengeluaran)
    L.push({ tanggal: e.tanggal, id: e.id, ts: e.created_at, tipe: 'Pengeluaran', warna: 'red', ket: `${e.kategori}${e.keterangan ? ' · ' + e.keterangan : ''}`, jumlah: -pgTotal(e), status: e.sumber_dana });
  for (const r of state.modal_prive)
    L.push({ tanggal: r.tanggal, id: r.id, ts: r.created_at, tipe: r.jenis === 'Setoran Modal' ? 'Modal' : 'Prive', warna: 'blue', ket: r.keterangan || r.jenis, jumlah: r.jenis === 'Setoran Modal' ? n(r.jumlah) : -n(r.jumlah), status: 'Kas' });
  for (const p of state.po.filter((x) => x.status !== 'Menunggu' && x.status !== 'Ditolak'))
    L.push({ tanggal: p.tanggal_pesan, id: p.id, ts: p.created_at, tipe: 'Pre-order', warna: 'yellow', ket: `${p.no_po || ''} · ${p.jumlah} butir · ${pelangganNama(state, p.pelanggan_id)}`, jumlah: n(p.dp), status: p.status });
  return L.sort((a, b) => (a.tanggal === b.tanggal ? String(b.ts || '').localeCompare(String(a.ts || '')) || b.id - a.id : a.tanggal < b.tanggal ? 1 : -1)).slice(0, limit);
}

// ---- Invoice ----
export function invoiceItems(state, inv) {
  if (inv.jenis === 'Nota') return state.penjualan.filter((p) => p.id === inv.penjualan_id);
  return state.penjualan
    .filter((p) => p.jenis === 'Jual' && p.pelanggan_id === inv.pelanggan_id && p.tanggal >= (inv.periode_dari || '0000') && p.tanggal <= (inv.periode_sampai || '9999'))
    .sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : a.id - b.id));
}
export function invoiceTotals(state, inv) {
  const items = invoiceItems(state, inv);
  const total = sum(items, penjTotal);
  const dp = sum(items, (p) => p.dp_terpakai);
  const dibayar = sum(items.filter((p) => penjStatus(p) === 'LUNAS'), penjSisa);
  const butir = sum(items, (p) => p.jumlah);
  const dpAktif = sum(state.po.filter((p) => p.status === 'Dipesan' && p.pelanggan_id === inv.pelanggan_id), (p) => p.dp);
  return { items, total, dp, dibayar, sisa: total - dp - dibayar, butir, dpAktif };
}

// ---- Peringatan untuk dashboard ----
export function peringatan(state) {
  const A = [];
  const t = today();
  const k = ym(t);
  const set = state.pengaturan || {};
  const b = bulanan(state, k);
  if (b.ayamHari > 0 && b.hdp < n(set.batas_hdp))
    A.push({ level: 'danger', teks: `HDP bulan ini ${Math.round(b.hdp * 100)}% di bawah batas ${Math.round(n(set.batas_hdp) * 100)}%. Cek pakan & kesehatan ayam.` });
  if (!state.produksi.some((r) => r.tanggal === t))
    A.push({ level: 'info', teks: 'Produksi telur hari ini belum dicatat.', aksi: 'produksi' });
  const baru = state.po.filter((p) => p.status === 'Menunggu');
  if (baru.length) A.push({ level: 'warn', teks: `${baru.length} pesanan baru dari pelanggan menunggu konfirmasi.`, aksi: 'po' });
  const po = ringkasPO(state);
  for (const p of po.aktif) {
    const d = diffDays(p.tanggal_kirim, t);
    if (d >= 0 && d <= 1) A.push({ level: 'warn', teks: `${p.no_po} (${pelangganNama(state, p.pelanggan_id)}) dikirim ${d === 0 ? 'HARI INI' : 'besok'}: ${p.jumlah} butir.`, aksi: 'po' });
    else if (d < 0) A.push({ level: 'danger', teks: `${p.no_po} lewat tanggal kirim (${-d} hari). Tandai dikirim atau ubah tanggal.`, aksi: 'po' });
  }
  if (po.perluSisih > 0 && !po.cukup)
    A.push({ level: 'danger', teks: `Stok ${po.stok} butir, padahal ${po.perluSisih} butir harus disimpan untuk PO. Tahan penjualan biasa.`, aksi: 'po' });
  const piutang = piutangList(state);
  if (piutang.length) A.push({ level: 'warn', teks: `${piutang.length} penjualan belum lunas, total piutang Rp${new Intl.NumberFormat('id-ID').format(sum(piutang, penjSisa))}.`, aksi: 'pelanggan' });
  const lastOp = state.kas_opname.map((r) => r.tanggal).sort().pop();
  if (state.modal_prive.length && (!lastOp || diffDays(t, lastOp) >= 7))
    A.push({ level: 'info', teks: lastOp ? `Isi amplop terakhir dicocokkan ${diffDays(t, lastOp)} hari lalu.` : 'Isi amplop belum pernah dicocokkan dengan uang fisik.', aksi: 'kas' });
  return A;
}
