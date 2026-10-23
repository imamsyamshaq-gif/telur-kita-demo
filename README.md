# 🥚 Telur Kita — Website Keuangan & Penjualan Telur (versi demo portofolio)

> Versi demo: `config.js` sengaja kosong, jadi website berjalan dengan **data fiktif** yang tersimpan di browser. Tidak ada data klien asli di repo ini.

Website pencatatan usaha telur ayam: produksi harian, penjualan (telur keluar), pre-order + DP,
invoice/nota otomatis, pengeluaran, aset & penyusutan, uang di amplop (kas usaha), dan laporan laba rugi.

- **Tampilan**: Cloudflare Pages (gratis), enak dibuka di HP dan laptop, ada animasi pembuka.
- **Database**: Supabase. Hanya email Google yang didaftarkan yang bisa masuk.
- **Backup**: otomatis tiap 5 menit ke Google Spreadsheet (lewat Apps Script).
- **Pre-order → Google Calendar**: jadwal "mulai sisihkan telur" & "kirim PO" otomatis masuk kalender.
- **Pengingat harian** jam 06.00 lewat email (opsional WhatsApp via Fonnte).
- **Invoice**: nota otomatis dibuat setiap penjualan ke pelanggan; tagihan per periode tinggal klik; kirim ke WA/cetak PDF.

---

## Isi folder

```
telur-kita-web/
├─ public/                  ← INI yang di-upload ke Cloudflare Pages
│  ├─ index.html           ← halaman pesan pelanggan
│  ├─ admin/index.html     ← pembukuan (login Google)
│  ├─ assets/js/config.js   ← isi URL & anon key Supabase di sini
│  └─ ...
├─ supabase/
│  ├─ 01_schema.sql         ← struktur database + keamanan (jalankan pertama)
│  └─ 03_pesan_pelanggan.sql ← halaman pesan pelanggan (jalankan ketiga)
└─ apps-script/
   ├─ Code.gs               ← backup 5 menit + Google Calendar + pengingat
   └─ appsscript.json
```

> **Belum disambungkan ke Supabase?** Website tetap bisa dibuka dalam **mode demo** (data contoh
> fiktif, tersimpan di browser). Cocok untuk dicoba atau dipakai sebagai portofolio.

---

## Langkah 1 — Buat project Supabase

1. Masuk ke https://supabase.com dengan **email Google pemilik usaha** (supaya akunnya milik dia).
   Imam bisa diundang sebagai anggota tim: *Organization → Team → Invite*.
2. **New project** → nama `telur-kita` → region **Southeast Asia (Singapore)** → buat password database (simpan).
   Pilihan keamanan biarkan bawaan (Data API aktif, skema `public`). Kotak *Automatically expose new
   tables* boleh dicentang atau tidak — izin tabel sudah ditulis di `01_schema.sql`.
3. Tunggu ±2 menit sampai project siap.

> Paket gratis Supabase hanya boleh 2 project aktif per akun, dan project yang tidak dipakai
> seminggu akan di-*pause*. Karena Apps Script backup mengakses database tiap 5 menit, project
> ini **tidak akan ter-pause**.

## Langkah 2 — Jalankan SQL

Supabase → **SQL Editor** → **New query**:

1. Tempel seluruh isi `supabase/01_schema.sql` → **Run**.
2. New query → tempel isi `supabase/03_pesan_pelanggan.sql` → **Run** (halaman pesan pelanggan).
   Untuk klien sungguhan, data dari spreadsheet lama bisa diimpor dengan file SQL tambahan.
3. New query → daftarkan email yang boleh masuk (ganti dengan email Google aslinya):

```sql
insert into public.app_users (email, nama) values
  ('email.pemilik@gmail.com', 'Pemilik'),
  ('email.pengelola@gmail.com', 'Pengelola');
```

## Langkah 3 — Aktifkan login Google

Kalau sudah pernah membuat OAuth Client untuk project lain (mis. Tasreh), boleh buat client baru
supaya terpisah.

1. **Google Cloud Console** (console.cloud.google.com) → buat project `telur-kita` → menu
   **Google Auth Platform** (dulu *OAuth consent screen*) → **Get started**: nama aplikasi "Telur Kita",
   email dukungan, *Audience* **External** → selesai. Lalu **Audience → Publish app**.
2. **Clients → Create client** → *Web application*.
   - **Authorized JavaScript origins**: `https://telurkita.pages.dev`
   - **Authorized redirect URIs**: `https://<ID-PROJECT>.supabase.co/auth/v1/callback`
     (lihat di Supabase → Authentication → Sign In / Providers → Google, ada tulisan *Callback URL*).
3. Salin **Client ID** dan **Client secret**.
4. Supabase → **Authentication → Sign In / Providers → Google** → Enable → tempel Client ID & secret → Save.
5. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: alamat website nanti, mis. `https://telurkita.pages.dev`
   - **Redirect URLs**: tambahkan `https://telurkita.pages.dev/**` (dan domain sendiri kalau ada).

## Langkah 4 — Isi `config.js`

Supabase → tombol **Connect** di bagian atas (atau **Project Settings → API Keys**). Salin
**Project URL** dan **Publishable key** (`sb_publishable_...`; project lama: *anon key* `eyJ...`),
lalu buka `public/assets/js/config.js`:

```js
export const CONFIG = {
  SUPABASE_URL: 'https://abcdefgh.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_xxxxxxxxxxxx',
};
```

> ✅ *Publishable key* aman ditaruh di website karena semua tabel dikunci Row Level Security.
> ❌ **Jangan pernah** menaruh *secret key* / *service_role key* di mana pun — website maupun Apps Script.

## Langkah 5 — Upload ke Cloudflare Pages

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → tab **Pages** →
   **Upload assets**.
2. Nama project: `telurkita` (alamatnya jadi `telurkita.pages.dev`).
3. Seret folder **`public`** (isinya, bukan folder induknya) → **Deploy**.
4. Buka alamatnya → animasi pembuka → **Masuk dengan Google**.

Kalau mau update nanti: Cloudflare → project `telurkita` → **Create deployment** → upload ulang folder `public`.
(Alternatif: hubungkan ke GitHub, *build command* dikosongkan, *output directory* = `public`.)

> Domain sendiri (mis. `telurkita.my.id`): Cloudflare → project → **Custom domains**. Jangan lupa
> tambahkan juga ke Redirect URLs Supabase (Langkah 3.5).

## Langkah 6 — Backup otomatis & Google Calendar (Apps Script)

Lakukan dengan **akun Google pemilik usaha**, karena jadwal PO akan masuk ke kalender akun ini dan
undangannya dikirim ke pengelola lain.

0. Supabase → **SQL Editor** → jalankan `select public.buat_token_script();` → salin teks 64 karakter
   yang muncul (ini **SCRIPT_TOKEN**; hanya tampil sekali — kalau hilang, jalankan lagi untuk membuat
   token baru, token lama otomatis tidak berlaku).
1. Buat Google Spreadsheet baru: **"Backup Telur Kita"** (ini pengganti spreadsheet lama; isinya
   ditimpa otomatis, jangan diedit manual).
2. **Ekstensi → Apps Script**. Hapus isi `Code.gs`, tempel isi `apps-script/Code.gs`.
3. ⚙️ **Project Settings**:
   - Centang **Show "appsscript.json" manifest file** → buka file itu → ganti isinya dengan
     `apps-script/appsscript.json` (zona waktu Asia/Jakarta).
   - **Script Properties → Add**:

| Property | Isi |
|---|---|
| `SUPABASE_URL` | Project URL Supabase |
| `SUPABASE_KEY` | **Publishable key** — sama dengan yang di `config.js` |
| `SCRIPT_TOKEN` | token dari langkah 0 |
| `CALENDAR_ID` | *(opsional)* ID kalender khusus, mis. kalender "PO Telur" yang dibagikan ke istri |
| `FONNTE_TOKEN` | *(opsional)* token dari fonnte.com untuk kirim pengingat via WhatsApp |
| `WA_PENGINGAT` | *(opsional)* nomor WA tujuan, pisahkan koma |

4. Kembali ke editor → pilih fungsi **`tesKoneksi`** → **Run** → izinkan akses (Google akan minta
   izin Spreadsheet, Calendar, Gmail, koneksi luar). Muncul notifikasi "Tersambung ke Supabase".
5. Pilih fungsi **`pasangPemicu`** → **Run**. Selesai: backup + sinkron kalender jalan tiap 5 menit,
   pengingat dikirim tiap jam 06.00.
6. Cek di website → **Pengaturan → Backup & kalender**: muncul "Backup terakhir: x menit lalu".

Di spreadsheet backup juga ada menu **🥚 Telur Kita** untuk menjalankan backup/pengingat secara manual.

**Cara kerja kalender untuk setiap PO berstatus Dipesan:**
- 📦 *Mulai sisihkan telur* — jam 06.00 di tanggal mulai sisih (pengingat 30 menit sebelumnya)
- 🥚 *Kirim PO* — jam 07.00 di tanggal kirim (pengingat H-1 dan 1 jam sebelumnya)
- PO diubah → jadwal ikut berubah · PO dikirim → judul jadi "✅ Terkirim" · PO batal → jadwal dihapus · PO dihapus → jadwalnya ikut dibersihkan
- Pengelola lain (email di `app_users`) diundang ke jadwal, jadi notifikasinya muncul di HP mereka.

> 🔒 Siapa pun yang memegang `SCRIPT_TOKEN` bisa membaca seluruh data usaha. Jangan bagikan akses
> **edit** spreadsheet backup ke orang lain. Kalau token bocor: jalankan lagi `buat_token_script()`
> dan ganti isi `SCRIPT_TOKEN`.
>
> Kenapa tidak memakai *secret key*? Supabase menolak *secret key* dari Apps Script (dianggap
> browser), dan *service_role key* model lama sedang dihentikan akhir 2026. Jadi Apps Script memakai
> kunci publik + token, lewat fungsi khusus `script_ambil`, `script_simpan_kalender`, dan
> `script_tanda_backup` di database.

---

## Halaman pesan pelanggan (tambahan Okt 2026)

- `https://telur-kita.pages.dev/` → **halaman pelanggan** (tanpa login): status stok *Tersedia / Terbatas / Habis*
  (tanpa angka), harga per butir, form pesan, pilihan bayar (rekening + QRIS), lalu tombol **Pesan via WhatsApp**.
- `https://telur-kita.pages.dev/admin/` → **pembukuan** (login Google, sama seperti sebelumnya).
- Pesanan pelanggan masuk ke **Pre-order → Pesanan baru dari pelanggan** (status *Menunggu*). Klik **Terima**
  (isi tanggal kirim & DP) atau **Tolak**. Pesanan belum mengurangi stok sebelum diterima.
- Atur nomor WA, rekening, QRIS, minimal pesanan, dan batas Terbatas/Habis di **Pengaturan → Halaman pesan pelanggan**.
  Harga diatur di **Pengaturan → Data usaha**.
- Pemasangan: `supabase/03_pesan_pelanggan.sql` (sudah termasuk di Langkah 2), lalu upload file baru ke GitHub.
- Keamanan: pelanggan tidak bisa membaca tabel apa pun; hanya fungsi `info_toko()` dan `pesan_telur()`.
  Maksimal 2 pesanan per nomor WA per hari, dan 30 pesanan per jam untuk semua pelanggan.

---

## Menambah / menghapus pengelola

Supabase → SQL Editor:

```sql
-- tambah
insert into public.app_users (email, nama) values ('email.baru@gmail.com', 'Nama');
-- hapus
delete from public.app_users where email = 'email.lama@gmail.com';
```

Semua pengelola punya hak yang sama: mencatat, mengubah, dan menghapus semua data.

---

## Cara pakai singkat (untuk pengelola)

| Kapan | Menu | Isi |
|---|---|---|
| Tiap sore | **Produksi telur** (atau tombol ➕ di HP) | jumlah ayam, telur bagus, telur pecah |
| Tiap ada telur keluar | **Telur keluar** | jual / konsumsi sendiri / keluarga / tetangga / hadiah / pecah dari stok |
| Tiap belanja | **Pengeluaran** | pakan, vitamin, plastik, bensin… pilih dibayar dari amplop atau uang pribadi |
| Ada pesanan | **Pre-order** | tanggal kirim, jumlah, DP → klik **Kirim** saat telur diantar |
| Pelanggan bayar utang | **Telur keluar → Belum lunas → Lunas** | |
| Seminggu sekali | **Kas & modal → Cocokkan amplop** | hitung uang fisik, harus **COCOK ✔** |
| Akhir bulan | **Laporan keuangan** | laba bersih, HPP per butir, untung per butir |

**Aturan uang (sama seperti spreadsheet):**
- Hasil jual masuk amplop. Belanja dari amplop pilih *Amplop usaha*, belanja pakai uang sendiri pilih *Uang pribadi* (otomatis dihitung modal).
- Ambil uang amplop untuk keperluan rumah → **Kas & modal → Ambil uang (prive)**.
- DP pre-order masuk amplop saat pesan, tapi baru jadi pendapatan saat telur dikirim. PO batal → DP dianggap dikembalikan (kecuali dicentang hangus).
- HPP per butir = (biaya produksi + penyusutan) ÷ telur bagus bulan itu. Di tengah bulan angkanya masih sementara.

---

## Catatan teknis

- Tanpa *build step*: HTML + CSS + JavaScript modul biasa. Library (supabase-js 2.45.4, Chart.js 4.4.1) sudah disertakan di `public/assets/vendor`.
- Nomor PO (`PO-0001`) dan invoice (`INV/202610/001`, urut per bulan) dibuat oleh database.
- Fungsi `kirim_po` membuat penjualan + menandai PO terkirim dalam satu transaksi.
- Izin tabel ditulis eksplisit (`grant ... to authenticated`) karena project Supabase baru sejak Mei 2026
  tidak lagi memberi izin otomatis. Pengunjung yang belum login (`anon`) tidak punya akses tabel sama sekali.
- Pelanggan yang masih punya transaksi tidak bisa dihapus (dikunci database).
- Data dibaca ulang otomatis saat aplikasi dibuka kembali dan tiap 2 menit, jadi catatan satu pengelola langsung terlihat di HP pengelola lain.
