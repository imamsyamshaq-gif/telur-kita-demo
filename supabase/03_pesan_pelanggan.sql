-- =====================================================================
--  TELUR KITA — Halaman pesan untuk pelanggan (tanpa login)
--  Jalankan SEKALI setelah 01_schema.sql & 02_data_awal.sql
--  (aman dijalankan ulang).
--
--  Pelanggan tidak bisa membaca tabel apa pun. Yang bisa mereka lakukan
--  hanya 2 hal lewat fungsi khusus:
--    info_toko()   → nama usaha, harga, status stok (Tersedia/Terbatas/Habis),
--                    rekening, QRIS, nomor WA. TANPA angka stok.
--    pesan_telur() → kirim pesanan → masuk Pre-order status "Menunggu".
-- =====================================================================

-- 1. Pengaturan toko --------------------------------------------------
alter table public.pengaturan add column if not exists wa_pesanan     text;
alter table public.pengaturan add column if not exists rekening       jsonb not null default '[]'::jsonb;
alter table public.pengaturan add column if not exists qris_aktif     boolean not null default true;
alter table public.pengaturan add column if not exists qris_nama      text;
alter table public.pengaturan add column if not exists qris_gambar    text;      -- gambar QRIS hasil upload (data URL); kosong = pakai gambar bawaan
alter table public.pengaturan add column if not exists min_pesan      int not null default 5;
alter table public.pengaturan add column if not exists batas_terbatas int not null default 20;  -- di bawah ini = Terbatas
alter table public.pengaturan add column if not exists batas_habis    int not null default 5;   -- di bawah ini = Habis
alter table public.pengaturan add column if not exists toko_buka      boolean not null default true;

-- Isi awal (hanya kalau masih kosong)
update public.pengaturan set
  wa_pesanan = coalesce(wa_pesanan, '081200000000'),
  rekening = case when rekening = '[]'::jsonb then '[
      {"bank":"Bank Contoh","nomor":"1234567890","nama":"Nama Pemilik"}]'::jsonb else rekening end,
  qris_nama = coalesce(qris_nama, 'Nama di QRIS')
where id = 1;

-- 2. PO: status baru "Menunggu" (pesanan pelanggan) & "Ditolak" ----------
alter table public.po alter column tanggal_kirim drop not null;
alter table public.po drop constraint if exists po_status_check;
alter table public.po add constraint po_status_check check (status in ('Menunggu','Dipesan','Dikirim','Batal','Ditolak'));
alter table public.po drop constraint if exists po_tanggal_kirim_wajib;
alter table public.po add constraint po_tanggal_kirim_wajib check (status in ('Menunggu','Ditolak') or tanggal_kirim is not null);
alter table public.po add column if not exists sumber       text not null default 'Admin';   -- Admin | Pelanggan
alter table public.po add column if not exists nama_pemesan text;
alter table public.po add column if not exists wa_pemesan   text;
alter table public.po add column if not exists sudah_bayar  text;                            -- nama bank / QRIS kalau pelanggan bilang sudah bayar
create index if not exists po_wa_pemesan_idx on public.po (wa_pemesan, tanggal_pesan);

-- Ditolak juga dapat tanggal_selesai
create or replace function public.trg_po_before()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.no_po is null then new.no_po := 'PO-' || lpad(new.id::text, 4, '0'); end if;
  end if;
  if new.harga is null then
    select harga_default into new.harga from public.pengaturan where id = 1;
  end if;
  if new.status in ('Dikirim','Batal','Ditolak') and new.tanggal_selesai is null then
    new.tanggal_selesai := public.hari_ini();
  elsif new.status in ('Dipesan','Menunggu') then
    new.tanggal_selesai := null;
  end if;
  if tg_op = 'UPDATE' and
     (new.tanggal_pesan, new.pelanggan_id, new.tanggal_kirim, new.jumlah, new.harga, new.dp, new.status, new.catatan)
     is distinct from
     (old.tanggal_pesan, old.pelanggan_id, old.tanggal_kirim, old.jumlah, old.harga, old.dp, old.status, old.catatan) then
    new.updated_at := now();
  end if;
  return new;
end $$;

-- view v_po dibuat ulang supaya ikut kolom baru
drop view if exists public.v_po;
create view public.v_po with (security_invoker = true) as
  select p.*, c.nama as pelanggan,
         p.tanggal_kirim - ceil(p.jumlah / greatest((select produksi_harian from public.pengaturan where id = 1), 1))::int as mulai_sisihkan
  from public.po p left join public.pelanggan c on c.id = p.pelanggan_id;
grant select on public.v_po to authenticated, service_role;

-- 3. Status stok untuk pelanggan (tanpa angka) ------------------------------
create or replace function public.status_stok_()
returns text language sql stable security definer set search_path = public as $$
  with s as (
    select (select coalesce(sum(telur_bagus), 0) from public.produksi)
         - (select coalesce(sum(jumlah), 0) from public.penjualan)
         - (select coalesce(sum(jumlah), 0) from public.v_po
             where status = 'Dipesan' and mulai_sisihkan <= public.hari_ini()) as bebas
  ), b as (select coalesce(batas_terbatas, 20) t, coalesce(batas_habis, 5) h, toko_buka from public.pengaturan where id = 1)
  select case when not b.toko_buka or s.bebas < b.h then 'Habis'
              when s.bebas < b.t then 'Terbatas'
              else 'Tersedia' end
  from s, b;
$$;

create or replace function public.info_toko()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'nama_usaha',  p.nama_usaha,
    'harga',       p.harga_default,
    'min_pesan',   p.min_pesan,
    'stok',        public.status_stok_(),
    'wa',          p.wa_pesanan,
    'rekening',    p.rekening,
    'qris_aktif',  p.qris_aktif,
    'qris_nama',   p.qris_nama,
    'qris_gambar', p.qris_gambar,
    'hari_ini',    public.hari_ini())
  from public.pengaturan p where p.id = 1;
$$;

-- 4. Kirim pesanan -----------------------------------------------------------
create or replace function public.pesan_telur(p_nama text, p_wa text, p_jumlah int,
  p_tanggal date default null, p_catatan text default null, p_bayar text default null, p_sudah_bayar boolean default false)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  v_set   public.pengaturan;
  v_nama  text := btrim(coalesce(p_nama, ''));
  v_wa    text := regexp_replace(coalesce(p_wa, ''), '[^0-9]', '', 'g');
  v_cat   text := nullif(btrim(coalesce(p_catatan, '')), '');
  v_bayar text := nullif(btrim(coalesce(p_bayar, '')), '');
  v_po    public.po;
begin
  select * into v_set from public.pengaturan where id = 1;
  if not v_set.toko_buka then raise exception 'Maaf, pemesanan sedang ditutup sementara.'; end if;
  if length(v_nama) < 2 or length(v_nama) > 60 then raise exception 'Nama harus diisi (2–60 huruf).'; end if;
  if v_wa like '62%' then v_wa := '0' || substr(v_wa, 3); end if;
  if v_wa !~ '^0[0-9]{8,13}$' then raise exception 'Nomor WhatsApp tidak valid.'; end if;
  if p_jumlah is null or p_jumlah < coalesce(v_set.min_pesan, 5) then
    raise exception 'Minimal pemesanan % butir.', coalesce(v_set.min_pesan, 5); end if;
  if p_jumlah > 1000 then raise exception 'Untuk pesanan di atas 1.000 butir, silakan chat langsung.'; end if;
  if p_tanggal is not null and (p_tanggal < public.hari_ini() or p_tanggal > public.hari_ini() + 90) then
    raise exception 'Tanggal kirim tidak valid.'; end if;
  if length(coalesce(v_cat, '')) > 300 then raise exception 'Catatan terlalu panjang (maks. 300 huruf).'; end if;
  if v_bayar is not null and v_bayar <> 'QRIS'
     and not exists (select 1 from jsonb_array_elements(v_set.rekening) r where r ->> 'bank' = v_bayar) then
    raise exception 'Metode pembayaran tidak dikenal.'; end if;
  if public.status_stok_() = 'Habis' then raise exception 'Maaf, stok telur sedang habis.'; end if;
  -- anti pesanan iseng
  if (select count(*) from public.po where wa_pemesan = v_wa and tanggal_pesan = public.hari_ini() and sumber = 'Pelanggan') >= 2 then
    raise exception 'Nomor ini sudah membuat 2 pesanan hari ini. Silakan chat langsung lewat WhatsApp.'; end if;
  if (select count(*) from public.po where sumber = 'Pelanggan' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Sedang banyak pesanan. Coba lagi sebentar atau chat langsung lewat WhatsApp.'; end if;

  insert into public.po (tanggal_pesan, tanggal_kirim, jumlah, harga, dp, status, sumber, nama_pemesan, wa_pemesan, sudah_bayar, catatan, created_by)
  values (public.hari_ini(), p_tanggal, p_jumlah, v_set.harga_default, 0, 'Menunggu', 'Pelanggan', v_nama, v_wa,
          case when p_sudah_bayar then coalesce(v_bayar, 'Ya') end,
          concat_ws(' · ', v_cat, case when v_bayar is not null then 'Bayar: ' || v_bayar end), 'pelanggan')
  returning * into v_po;
  return json_build_object('no_po', v_po.no_po, 'jumlah', v_po.jumlah, 'harga', v_po.harga, 'total', v_po.total);
end $$;

revoke all on function public.status_stok_() from public, anon, authenticated;
revoke all on function public.info_toko() from public;
revoke all on function public.pesan_telur(text, text, int, date, text, text, boolean) from public;
grant execute on function public.info_toko() to anon, authenticated, service_role;
grant execute on function public.pesan_telur(text, text, int, date, text, text, boolean) to anon, authenticated, service_role;
