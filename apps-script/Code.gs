/**
 * =====================================================================
 *  TELUR KITA — Apps Script (dipasang di spreadsheet BACKUP)
 *
 *  1. backupDanSinkron()  → tiap 5 menit:
 *       a. salin semua tabel Supabase ke tab-tab spreadsheet ini
 *       b. sinkron Pre-order ke Google Calendar (buat / ubah / hapus jadwal)
 *  2. pengingatHarian()   → tiap pagi jam 6: ringkasan PO hari ini/besok,
 *       stok, piutang → email ke pengelola (+ WhatsApp kalau FONNTE_TOKEN diisi)
 *
 *  Cara pasang: lihat README bagian "Backup & Google Calendar".
 *  Script Properties yang WAJIB diisi:
 *    SUPABASE_URL          https://xxxx.supabase.co
 *    SUPABASE_KEY          publishable key (sb_publishable_...) — kunci publik yang sama
 *                          dengan di config.js website. JANGAN pakai secret key.
 *    SCRIPT_TOKEN          hasil  select public.buat_token_script();  di SQL Editor
 *                          (RAHASIA — inilah yang membuka akses backup)
 *  Opsional:
 *    CALENDAR_ID           ID kalender khusus (kosong = kalender utama akun ini)
 *    FONNTE_TOKEN          token api.fonnte.com untuk kirim pengingat WA
 *    WA_PENGINGAT          nomor WA tujuan, pisahkan koma (mis. 0812xxx,0813xxx)
 * =====================================================================
 */

const TZ = 'Asia/Jakarta';
// Nama tab diawali DB_ supaya tidak menimpa tab lama di spreadsheet pembukuan
const PREFIX = 'DB_';
const BACKUP = [
  // [nama tab, tabel/view Supabase]
  [PREFIX + 'PENGATURAN', 'pengaturan'],
  [PREFIX + 'KATEGORI', 'kategori_pengeluaran'],
  [PREFIX + 'PELANGGAN', 'pelanggan'],
  [PREFIX + 'PRODUKSI', 'produksi'],
  [PREFIX + 'PENJUALAN', 'v_penjualan'],
  [PREFIX + 'PO', 'v_po'],
  [PREFIX + 'PENGELUARAN', 'v_pengeluaran'],
  [PREFIX + 'ASET', 'aset'],
  [PREFIX + 'MODAL_PRIVE', 'modal_prive'],
  [PREFIX + 'CEK_AMPLOP', 'kas_opname'],
  [PREFIX + 'INVOICE', 'v_invoice'],
  [PREFIX + 'PENGELOLA', 'app_users'],
];

// ------------------------------------------------------------------ util
function cfg_() {
  const p = PropertiesService.getScriptProperties();
  const c = {
    url: (p.getProperty('SUPABASE_URL') || '').replace(/\/+$/, ''),
    key: (p.getProperty('SUPABASE_KEY') || '').trim(),
    token: (p.getProperty('SCRIPT_TOKEN') || '').trim(),
    cal: p.getProperty('CALENDAR_ID') || '',
    fonnte: p.getProperty('FONNTE_TOKEN') || '',
    wa: p.getProperty('WA_PENGINGAT') || '',
  };
  if (!c.url || !c.key || !c.token) throw new Error('Isi dulu Script Properties: SUPABASE_URL, SUPABASE_KEY, dan SCRIPT_TOKEN');
  if (/^sb_secret_/.test(c.key)) throw new Error('SUPABASE_KEY berisi secret key. Ganti dengan publishable key (sb_publishable_...).');
  return c;
}

// Semua akses lewat fungsi khusus di database (script_ambil, script_simpan_kalender,
// script_tanda_backup) yang hanya mau jalan kalau SCRIPT_TOKEN benar.
function rpc_(fn, args) {
  const c = cfg_();
  const headers = { apikey: c.key };
  if (/^eyJ/.test(c.key)) headers.Authorization = 'Bearer ' + c.key; // kunci model lama (anon JWT)
  const res = UrlFetchApp.fetch(c.url + '/rest/v1/rpc/' + fn, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(Object.assign({ p_token: c.token }, args || {})),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  const t = res.getContentText();
  if (code >= 300) throw new Error(fn + ' → HTTP ' + code + ': ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

function ambilSemua_(tabel) {
  let out = [];
  for (let from = 0; ; from += 1000) {
    const rows = rpc_('script_ambil', { p_tabel: tabel, p_offset: from, p_limit: 1000 }) || [];
    out = out.concat(rows);
    if (rows.length < 1000) break;
  }
  return out;
}

const hariIni_ = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
const tambahHari_ = (iso, n) => {
  const p = iso.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2] + n, 12);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
};
const keDate_ = (iso, jam, menit) => {
  const p = iso.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2], jam, menit || 0); // zona waktu proyek = Asia/Jakarta
};
const rp_ = (n) => 'Rp' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const tglIndo_ = (iso) => Utilities.formatDate(keDate_(iso, 12), TZ, 'd MMM yyyy');

// ------------------------------------------------------------------ 1a. Backup
function backupSekarang() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const ringkas = [];
  BACKUP.forEach(function (b) {
    const rows = ambilSemua_(b[1]);
    const json = JSON.stringify(rows);
    const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, json));
    ringkas.push([b[0], rows.length]);
    if (props.getProperty('hash_' + b[0]) === hash && ss.getSheetByName(b[0])) return; // tidak berubah
    let sh = ss.getSheetByName(b[0]) || ss.insertSheet(b[0]);
    sh.clearContents();
    if (!rows.length) { sh.getRange(1, 1).setValue('(belum ada data)'); }
    else {
      const head = Object.keys(rows[0]);
      const values = [head].concat(rows.map(function (r) {
        return head.map(function (k) { let v = r[k]; v = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : v;
          return typeof v === 'string' && v.length > 40000 ? '(data terlalu panjang, lihat di website)' : v; });
      }));
      sh.getRange(1, 1, values.length, head.length).setValues(values);
      sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#245B3A').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
    props.setProperty('hash_' + b[0], hash);
  });
  // tab INFO
  let info = ss.getSheetByName(PREFIX + 'INFO') || ss.insertSheet(PREFIX + 'INFO', ss.getSheets().length);
  info.clearContents();
  const now = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss');
  info.getRange(1, 1, 3, 2).setValues([['BACKUP OTOMATIS TELUR KITA', ''], ['Backup terakhir', now + ' WIB'], ['Sumber', cfg_().url]]);
  info.getRange(5, 1, ringkas.length + 1, 2).setValues([['Tab', 'Jumlah baris']].concat(ringkas));
  info.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  info.getRange(5, 1, 1, 2).setFontWeight('bold');
  info.getRange(ringkas.length + 7, 1).setValue('Tab DB_ adalah BACKUP otomatis dari website (diperbarui tiap 5 menit). Jangan diedit — perubahan dilakukan di website.');
  // tanda hidup → tampil di menu Pengaturan website
  rpc_('script_tanda_backup', {});
}

// ------------------------------------------------------------------ 1b. Google Calendar
function kalender_() {
  const id = cfg_().cal;
  const cal = id ? CalendarApp.getCalendarById(id) : CalendarApp.getDefaultCalendar();
  if (!cal) throw new Error('Kalender ' + id + ' tidak ditemukan / tidak bisa diakses');
  return cal;
}

function sinkronKalender() {
  const set = ambilSemua_('pengaturan')[0] || {};
  const prodHarian = Math.max(1, Number(set.produksi_harian) || 9);
  const usaha = set.nama_usaha || 'Telur Kita';
  const pelanggan = {};
  ambilSemua_('pelanggan').forEach(function (c) { pelanggan[c.id] = c; });
  const pemilik = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const tamu = ambilSemua_('app_users').map(function (u) { return u.email; })
    .filter(function (e) { return e && e.toLowerCase() !== pemilik; }).join(',');
  const cal = kalender_();
  const semua = ambilSemua_('po');
  const dipakai = {}; // ID jadwal yang masih punya PO
  const tandai = function (a, b) { if (a) dipakai[a] = 1; if (b) dipakai[b] = 1; };
  let jml = 0;

  semua.forEach(function (po) {
    // pesanan pelanggan yang belum diterima / ditolak tidak masuk kalender
    if (po.status === 'Menunggu' || (po.status === 'Ditolak' && !po.calendar_event_id && !po.calendar_sisih_event_id) || !po.tanggal_kirim) {
      tandai(po.calendar_event_id, po.calendar_sisih_event_id); return;
    }
    const perlu = !po.calendar_synced_at || new Date(po.updated_at) > new Date(po.calendar_synced_at);
    if (!perlu) { tandai(po.calendar_event_id, po.calendar_sisih_event_id); return; }
    const c = pelanggan[po.pelanggan_id] || {};
    const nama = c.nama || 'Pelanggan';
    const mulai = tambahHari_(po.tanggal_kirim, -Math.ceil(Number(po.jumlah) / prodHarian));
    const total = Number(po.jumlah) * Number(po.harga || 0);
    const desk = [usaha + ' — Pre-order ' + po.no_po, 'Pelanggan: ' + nama + (c.no_wa ? ' (WA ' + c.no_wa + ')' : ''),
      'Jumlah: ' + po.jumlah + ' butir', 'Total: ' + rp_(total) + ' · DP ' + rp_(po.dp) + ' · sisa ' + rp_(total - Number(po.dp || 0)),
      'Alamat: ' + (c.alamat || '-'), 'Mulai sisihkan telur: ' + tglIndo_(mulai), po.catatan ? 'Catatan: ' + po.catatan : ''].filter(String).join('\n');
    let idKirim = po.calendar_event_id, idSisih = po.calendar_sisih_event_id;
    const ambil = function (id) { try { return id ? cal.getEventById(id) : null; } catch (e) { return null; } };
    const hapus = function (id) { const ev = ambil(id); if (ev) ev.deleteEvent(); return null; };

    if (po.status === 'Dipesan') {
      const judulKirim = '🥚 Kirim ' + po.no_po + ': ' + po.jumlah + ' butir — ' + nama;
      let ev = ambil(idKirim);
      if (ev) { ev.setTitle(judulKirim); ev.setTime(keDate_(po.tanggal_kirim, 7), keDate_(po.tanggal_kirim, 8)); ev.setDescription(desk); }
      else {
        ev = cal.createEvent(judulKirim, keDate_(po.tanggal_kirim, 7), keDate_(po.tanggal_kirim, 8), { description: desk, guests: tamu, sendInvites: !!tamu });
        ev.removeAllReminders(); ev.addPopupReminder(24 * 60); ev.addPopupReminder(60);
        idKirim = ev.getId();
      }
      const judulSisih = '📦 Mulai sisihkan telur: ' + po.no_po + ' (' + po.jumlah + ' butir, ' + nama + ')';
      let ev2 = ambil(idSisih);
      if (mulai < hariIni_()) { idSisih = hapus(idSisih); }
      else if (ev2) { ev2.setTitle(judulSisih); ev2.setTime(keDate_(mulai, 6), keDate_(mulai, 6, 30)); ev2.setDescription(desk); }
      else {
        ev2 = cal.createEvent(judulSisih, keDate_(mulai, 6), keDate_(mulai, 6, 30), { description: desk, guests: tamu, sendInvites: !!tamu });
        ev2.removeAllReminders(); ev2.addPopupReminder(30);
        idSisih = ev2.getId();
      }
    } else if (po.status === 'Dikirim') {
      const ev = ambil(idKirim);
      if (ev && ev.getTitle().indexOf('✅') !== 0) ev.setTitle('✅ Terkirim — ' + ev.getTitle().replace(/^🥚\s*/, ''));
      idSisih = hapus(idSisih);
    } else if (po.status === 'Batal') {
      idKirim = hapus(idKirim);
      idSisih = hapus(idSisih);
    }
    rpc_('script_simpan_kalender', { p_po_id: po.id, p_event_kirim: idKirim || null, p_event_sisih: idSisih || null });
    tandai(idKirim, idSisih);
    jml++;
  });

  // PO yang dihapus dari website → jadwalnya ikut dihapus (riwayat "✅ Terkirim" dibiarkan)
  let yatim = 0;
  cal.getEvents(new Date(Date.now() - 7 * 864e5), new Date(Date.now() + 400 * 864e5)).forEach(function (ev) {
    if (/^(🥚 Kirim|📦 Mulai sisihkan telur:) PO-\d+/.test(ev.getTitle()) && !dipakai[ev.getId()]) { ev.deleteEvent(); yatim++; }
  });
  if (jml || yatim) console.log('Kalender: ' + jml + ' PO disinkron, ' + yatim + ' jadwal PO terhapus dibersihkan');
}

// ------------------------------------------------------------------ Dijalankan pemicu tiap 5 menit
function backupDanSinkron() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    try { sinkronKalender(); } catch (e) { console.error('Kalender gagal: ' + e.message); }
    try { backupSekarang(); } catch (e) { console.error('Backup gagal: ' + e.message); throw e; }
  } finally { lock.releaseLock(); }
}

// ------------------------------------------------------------------ 2. Pengingat harian
function pengingatHarian() {
  const t = hariIni_(), besok = tambahHari_(t, 1);
  const set = ambilSemua_('pengaturan')[0] || {};
  const prodHarian = Math.max(1, Number(set.produksi_harian) || 9);
  const pel = {};
  ambilSemua_('pelanggan').forEach(function (c) { pel[c.id] = c.nama; });
  const po = ambilSemua_('po').filter(function (p) { return p.status === 'Dipesan'; })
    .sort(function (a, b) { return a.tanggal_kirim < b.tanggal_kirim ? -1 : a.tanggal_kirim > b.tanggal_kirim ? 1 : 0; });
  const bagus = ambilSemua_('produksi').reduce(function (a, r) { return a + Number(r.telur_bagus || 0); }, 0);
  const pj = ambilSemua_('penjualan');
  const stok = bagus - pj.reduce(function (a, r) { return a + Number(r.jumlah || 0); }, 0);
  const piutang = pj.filter(function (r) { return r.status === 'BELUM LUNAS'; });
  const baris = [];
  po.forEach(function (p) {
    const mulai = tambahHari_(p.tanggal_kirim, -Math.ceil(Number(p.jumlah) / prodHarian));
    const nama = pel[p.pelanggan_id] || '';
    if (p.tanggal_kirim < t) baris.push('⚠️ ' + p.no_po + ' (' + nama + ') LEWAT tanggal kirim ' + tglIndo_(p.tanggal_kirim));
    else if (p.tanggal_kirim === t) baris.push('🚚 HARI INI kirim ' + p.no_po + ': ' + p.jumlah + ' butir ke ' + nama);
    else if (p.tanggal_kirim === besok) baris.push('📅 BESOK kirim ' + p.no_po + ': ' + p.jumlah + ' butir ke ' + nama);
    if (mulai === t) baris.push('📦 Mulai hari ini sisihkan telur untuk ' + p.no_po + ' (' + p.jumlah + ' butir)');
  });
  const perluSisih = po.filter(function (p) { return tambahHari_(p.tanggal_kirim, -Math.ceil(Number(p.jumlah) / prodHarian)) <= t; })
    .reduce(function (a, p) { return a + Number(p.jumlah); }, 0);
  if (perluSisih > stok) baris.push('❗ Stok ' + stok + ' butir, padahal ' + perluSisih + ' butir harus disimpan untuk PO.');
  if (piutang.length) baris.push('💰 ' + piutang.length + ' penjualan belum lunas, total ' + rp_(piutang.reduce(function (a, r) { return a + Number(r.total) - Number(r.dp_terpakai || 0); }, 0)));
  if (!baris.length) { console.log('Tidak ada pengingat hari ini'); return; }

  const judul = '🥚 ' + (set.nama_usaha || 'Telur Kita') + ' — pengingat ' + tglIndo_(t);
  const pesan = judul + '\n\n' + baris.join('\n') + '\n\nStok telur sekarang: ' + stok + ' butir.';
  const penerima = ambilSemua_('app_users').map(function (u) { return u.email; }).join(',');
  if (penerima) MailApp.sendEmail(penerima, judul, pesan);
  const c = cfg_();
  if (c.fonnte && c.wa) {
    UrlFetchApp.fetch('https://api.fonnte.com/send', { method: 'post', headers: { Authorization: c.fonnte },
      payload: { target: c.wa, message: pesan, countryCode: '62' }, muteHttpExceptions: true });
  }
}

// ------------------------------------------------------------------ Pemasangan (jalankan SEKALI)
function pasangPemicu() {
  ScriptApp.getProjectTriggers().forEach(function (tr) { ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger('backupDanSinkron').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('pengingatHarian').timeBased().atHour(6).everyDays(1).inTimezone(TZ).create();
  backupDanSinkron();
  SpreadsheetApp.getActiveSpreadsheet().toast('Backup tiap 5 menit & pengingat jam 6 pagi sudah aktif ✔', 'Telur Kita', 8);
}

function tesKoneksi() {
  const s = ambilSemua_('pengaturan')[0] || {};
  SpreadsheetApp.getActiveSpreadsheet().toast('Tersambung ke Supabase ✔ Usaha: ' + (s.nama_usaha || '-'), 'Telur Kita', 8);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🥚 Telur Kita')
    .addItem('Tes koneksi Supabase', 'tesKoneksi')
    .addItem('Backup & sinkron kalender sekarang', 'backupDanSinkron')
    .addItem('Kirim pengingat harian sekarang', 'pengingatHarian')
    .addSeparator()
    .addItem('Pasang jadwal otomatis (sekali saja)', 'pasangPemicu')
    .addToUi();
}
