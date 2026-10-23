// Data contoh (fiktif) untuk MODE DEMO — dibuat relatif terhadap hari ini
// supaya grafik & dashboard selalu terlihat "hidup".
import { today, addDays, ym, ymAdd } from './util.js';
import { saldoKas } from './calc.js';

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buatDataDemo() {
  const r = rng(20261015);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const t0 = today();
  const mulai = ymAdd(ym(t0), -1) + '-01';
  const ts = (d) => d + 'T08:00:00+07:00';

  const pengaturan = [{ id: 1, nama_usaha: 'Telur Kita', nama_pemilik: 'Sinta', tanggal_mulai: mulai, jumlah_ayam_awal: 30, harga_default: 2500,
    batas_hdp: 0.75, produksi_harian: 26, target_bulanan: 2000000, info_pembayaran: 'BCA 1234567890 a.n. Sinta (contoh)',
    wa_pesanan: '081200000000', rekening: [{ bank: 'Bank Contoh', nomor: '1234567890', nama: 'Sinta (contoh)' }], qris_aktif: true, qris_nama: 'Contoh QRIS',
    qris_gambar: null, min_pesan: 5, batas_terbatas: 20, batas_habis: 5, toko_buka: true }];
  const kategori = [
    ['Pakan', 'HPP - Biaya Produksi'], ['Vitamin / Obat / Vaksin', 'HPP - Biaya Produksi'], ['Listrik & Air Kandang', 'HPP - Biaya Produksi'],
    ['Tenaga Kerja Kandang', 'HPP - Biaya Produksi'], ['Perawatan Kandang', 'HPP - Biaya Produksi'], ['Kemasan (Plastik / Thinwall)', 'Beban Penjualan'],
    ['Transport / BBM / Ongkir', 'Beban Penjualan'], ['Promosi', 'Beban Penjualan'], ['Lain-lain', 'Beban Lain-lain'],
  ].map(([nama, kelompok], i) => ({ id: i + 1, nama, kelompok, keterangan: null, urutan: i + 1 }));
  const pelanggan = [
    ['Bu Sari', '081234500001', 'RT 02'], ['Warung Pak Joko', '081234500002', 'Jl. Melati 5'], ['Mbak Rina', '081234500003', 'Perum Asri B3'],
    ['Pak Budi', '', 'RT 04'], ['Kantin Bu Ani', '081234500005', 'SD Harapan'],
  ].map(([nama, no_wa, alamat], i) => ({ id: i + 1, nama, no_wa, alamat, catatan: null, created_at: ts(mulai) }));

  const produksi = [], penjualan = [], pengeluaran = [], modal_prive = [], invoice = [];
  let stok = 0, pid = 0, sid = 0, eid = 0;
  const jual = (d, cust, jml, harga, metode = 'Tunai', bayar = null, extra = {}) => {
    penjualan.push({ id: ++sid, tanggal: d, jenis: 'Jual', pelanggan_id: cust, jumlah: jml, harga, metode, tanggal_bayar: bayar, po_id: null, dp_terpakai: 0, catatan: null, created_at: ts(d), ...extra });
    stok -= jml;
  };
  const keluar = (d, jenis, jml, catatan = null) => {
    penjualan.push({ id: ++sid, tanggal: d, jenis, pelanggan_id: null, jumlah: jml, harga: null, metode: null, tanggal_bayar: null, po_id: null, dp_terpakai: 0, catatan, created_at: ts(d) });
    stok -= jml;
  };
  const belanja = (d, kategori, ket, qty, satuan, harga, sumber = 'Kas Usaha') =>
    pengeluaran.push({ id: ++eid, tanggal: d, kategori, keterangan: ket, qty, satuan, harga_satuan: harga, sumber_dana: sumber, catatan: null, created_at: ts(d) });

  modal_prive.push({ id: 1, tanggal: mulai, jenis: 'Setoran Modal', jumlah: 1000000, keterangan: 'Modal awal kas usaha', created_at: ts(mulai) });

  const poKirimLalu = addDays(t0, -12);
  let d = mulai, hari = 0;
  while (d <= t0) {
    const bagus = Math.round(30 * (0.82 + r() * 0.1));
    const rusak = r() < 0.3 ? 1 : 0;
    produksi.push({ id: ++pid, tanggal: d, ayam_hidup: 30, telur_bagus: bagus, telur_rusak: rusak, ayam_mati: 0, catatan: null, created_at: ts(d) });
    stok += bagus;
    if (hari % 7 === 0) belanja(d, 'Pakan', 'Pakan layer 25 kg', 25, 'kg', 9500);
    if (hari % 7 === 2) belanja(d, 'Kemasan (Plastik / Thinwall)', 'Plastik & egg tray', 1, 'pak', 15000);
    if (hari % 4 === 1) belanja(d, 'Transport / BBM / Ongkir', 'Bensin antar telur', 1, 'kali', 20000, r() < 0.3 ? 'Uang Pribadi' : 'Kas Usaha');
    if (d.slice(8) === '03') { belanja(d, 'Vitamin / Obat / Vaksin', 'Vitamin & vaksin ND', 1, 'paket', 35000); belanja(d, 'Listrik & Air Kandang', 'Listrik lampu kandang', 1, 'bulan', 50000); }
    if (hari % 3 === 0) keluar(d, 'Konsumsi Sendiri', int(3, 4));
    if (hari % 9 === 4) keluar(d, 'Untuk Keluarga', 6, 'Kirim ke orang tua');
    if (hari % 13 === 6) keluar(d, 'Untuk Tetangga', 4);
    if (rusak && r() < 0.2) keluar(d, 'Pecah / Rusak (dari stok)', 1, 'Pecah saat diantar');
    if (d === poKirimLalu) jual(d, 2, 90, 2300, 'Transfer', null, { po_id: 1, dp_terpakai: 100000, catatan: 'PO-0001' });
    const sisih = d >= addDays(poKirimLalu, -4) && d < poKirimLalu;
    const n = sisih ? 0 : d > addDays(t0, -4) ? 1 : int(1, 3);
    for (let i = 0; i < n && stok > 25; i++) {
      const c = pick([1, 1, 2, 3, 4, 5]);
      const jml = c === 2 ? 30 : c === 5 ? int(15, 25) : int(6, 15);
      const harga = c === 2 ? 2300 : 2500;
      const utang = c === 4 || (c === 5 && r() < 0.5);
      const lunas = utang && addDays(d, 5) <= t0 && r() < 0.75 ? addDays(d, int(2, 5)) : null;
      jual(d, c, Math.min(jml, stok - 20), harga, utang ? 'Utang (Bayar Nanti)' : pick(['Tunai', 'Tunai', 'Transfer', 'QRIS']), utang ? (lunas && lunas <= t0 ? lunas : null) : null);
    }
    if (d === addDays(ymAdd(ym(t0), 0) + '-01', -1)) modal_prive.push({ id: 2, tanggal: d, jenis: 'Prive (Ambil Uang)', jumlah: 400000, keterangan: 'Ambil untung bulan lalu', created_at: ts(d) });
    d = addDays(d, 1); hari++;
  }

  // Pre-order
  const po = [];
  po.push({ id: 1, tanggal_pesan: addDays(t0, -20), pelanggan_id: 2, tanggal_kirim: poKirimLalu, jumlah: 90, harga: 2300, dp: 100000, status: 'Dikirim', tanggal_selesai: poKirimLalu, dp_dikembalikan: true, catatan: 'Stok warung akhir pekan', created_at: ts(addDays(t0, -20)) });
  po.push({ id: 2, tanggal_pesan: addDays(t0, -3), pelanggan_id: 5, tanggal_kirim: addDays(t0, 4), jumlah: 100, harga: 2500, dp: 100000, status: 'Dipesan', tanggal_selesai: null, dp_dikembalikan: true, catatan: 'Untuk menu kantin minggu depan', created_at: ts(addDays(t0, -3)) });
  po.push({ id: 3, tanggal_pesan: addDays(t0, -1), pelanggan_id: 3, tanggal_kirim: addDays(t0, 18), jumlah: 300, harga: 2400, dp: 250000, status: 'Dipesan', tanggal_selesai: null, dp_dikembalikan: true, catatan: 'Hajatan keluarga', created_at: ts(addDays(t0, -1)) });
  po.push({ id: 4, tanggal_pesan: addDays(t0, -15), pelanggan_id: 1, tanggal_kirim: addDays(t0, -8), jumlah: 60, harga: 2500, dp: 50000, status: 'Batal', tanggal_selesai: addDays(t0, -10), dp_dikembalikan: true, catatan: 'Acara diundur', created_at: ts(addDays(t0, -15)) });
  po.push({ id: 5, no_po: 'PO-0005', tanggal_pesan: t0, pelanggan_id: null, tanggal_kirim: addDays(t0, 2), jumlah: 30, harga: 2500, dp: 0, status: 'Menunggu', sumber: 'Pelanggan', nama_pemesan: 'Bu Rahma', wa_pemesan: '081200000001', sudah_bayar: 'Bank Contoh', tanggal_selesai: null, dp_dikembalikan: true, catatan: 'Minta telur yang besar · Bayar: Bank Contoh', created_at: ts(t0) });

  // Nota otomatis untuk setiap penjualan ke pelanggan + 1 tagihan bulan lalu
  const seq = {};
  const nomor = (tgl) => { const p = ym(tgl).replace('-', ''); seq[p] = (seq[p] || 0) + 1; return `INV/${p}/${String(seq[p]).padStart(3, '0')}`; };
  [...penjualan].sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1)).forEach((p) => {
    if (p.jenis === 'Jual' && p.pelanggan_id)
      invoice.push({ id: invoice.length + 1, no_invoice: nomor(p.tanggal), jenis: 'Nota', tanggal: p.tanggal, pelanggan_id: p.pelanggan_id, penjualan_id: p.id, periode_dari: p.tanggal, periode_sampai: p.tanggal, dikirim_via: null, created_at: ts(p.tanggal) });
  });
  const akhirLalu = addDays(ym(t0) + '-01', -1);
  invoice.push({ id: invoice.length + 1, no_invoice: nomor(akhirLalu), jenis: 'Tagihan', tanggal: akhirLalu, pelanggan_id: 4, penjualan_id: null, periode_dari: mulai, periode_sampai: akhirLalu, dikirim_via: 'WhatsApp', dikirim_at: ts(akhirLalu), created_at: ts(akhirLalu) });

  const aset = [
    { id: 1, tanggal_beli: mulai, kategori: 'Ayam', nama: 'Ayam petelur siap bertelur', qty: 30, harga_satuan: 75000, umur_bulan: 18, nilai_sisa: 900000, sumber_dana: 'Uang Pribadi', catatan: null },
    { id: 2, tanggal_beli: mulai, kategori: 'Kandang', nama: 'Kandang baterai 3 tingkat', qty: 1, harga_satuan: 1500000, umur_bulan: 36, nilai_sisa: 0, sumber_dana: 'Uang Pribadi', catatan: null },
    { id: 3, tanggal_beli: mulai, kategori: 'Peralatan', nama: 'Tempat pakan & minum', qty: 6, harga_satuan: 25000, umur_bulan: 24, nilai_sisa: 0, sumber_dana: 'Uang Pribadi', catatan: null },
  ];
  const kas_opname = [];

  const tables = {
    pengaturan, kategori_pengeluaran: kategori, pelanggan, produksi, po, penjualan, pengeluaran, aset, modal_prive, kas_opname, invoice,
    app_users: [{ email: 'sinta@contoh.id', nama: 'Sinta' }, { email: 'bima@contoh.id', nama: 'Bima' }],
    sistem_status: [{ kunci: 'backup_terakhir', nilai: new Date(Date.now() - 3 * 60000).toISOString(), updated_at: new Date().toISOString() }],
  };
  const tglCek = addDays(t0, -9);
  const sc = saldoKas({ ...tables, kategori }, tglCek);
  kas_opname.push({ id: 1, tanggal: tglCek, saldo_fisik: sc, saldo_catatan: sc, catatan: 'Cek mingguan — cocok', created_at: ts(tglCek) });
  return tables;
}
