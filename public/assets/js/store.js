// Lapisan data: Supabase (mode asli) atau localStorage (mode demo).
// Kedua mode punya API yang sama: loadAll, insert, update, remove, rpc.
import { CONFIG } from './config.js';
import { today, ym } from './util.js';
import { penjTotal, penjStatus, pgTotal, asetTotal, poTotal } from './calc.js';
import { buatDataDemo } from './demo-data.js';

export const TABLES = ['pengaturan', 'kategori_pengeluaran', 'pelanggan', 'produksi', 'po', 'penjualan', 'pengeluaran', 'aset', 'modal_prive', 'kas_opname', 'invoice', 'app_users', 'sistem_status'];
const STATE_KEY = { kategori_pengeluaran: 'kategori' };
const key = (t) => STATE_KEY[t] || t;

export const state = { ready: false };
export const isDemo = () => mode === 'demo';
let mode = 'demo';
let sb = null;

// ---------------------------------------------------------------- Supabase
export function initSupabase() {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY || !window.supabase) return null;
  sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  mode = 'supabase';
  return sb;
}
export const client = () => sb;

async function fetchAll(table) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').order(table === 'pengaturan' ? 'id' : table === 'app_users' ? 'email' : table === 'sistem_status' ? 'kunci' : 'id').range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const NUMERIC = ['jumlah', 'harga', 'total', 'dp', 'dp_terpakai', 'qty', 'harga_satuan', 'nilai_sisa', 'saldo_fisik', 'saldo_catatan', 'selisih',
  'harga_default', 'batas_hdp', 'produksi_harian', 'target_bulanan', 'telur_bagus', 'telur_rusak', 'ayam_hidup', 'ayam_mati', 'umur_bulan', 'jumlah_ayam_awal'];
const norm = (r) => {
  for (const f of NUMERIC) if (r[f] != null && typeof r[f] === 'string') r[f] = Number(r[f]);
  return r;
};

export async function loadAll() {
  if (mode === 'demo') return loadDemo();
  const res = await Promise.all(TABLES.map((t) => fetchAll(t).catch((e) => (t === 'sistem_status' || t === 'app_users' ? [] : Promise.reject(e)))));
  TABLES.forEach((t, i) => {
    const rows = res[i].map(norm);
    if (t === 'pengaturan') state.pengaturan = rows[0] || {};
    else state[key(t)] = rows;
  });
  state.ready = true;
  return state;
}

const humanError = (e) => {
  const m = e?.message || String(e);
  if (/row-level security|permission denied/i.test(m)) return 'Akses ditolak. Email kamu belum terdaftar sebagai pengelola.';
  if (/violates foreign key/i.test(m)) return 'Data ini masih dipakai di catatan lain, jadi belum bisa dihapus.';
  if (/duplicate key/i.test(m)) return 'Data dengan nama/nomor yang sama sudah ada.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Tidak ada koneksi internet. Coba lagi.';
  return m;
};

export async function insert(table, row) {
  if (mode === 'demo') return demoInsert(table, row);
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) throw new Error(humanError(error));
  await loadAll();
  return data;
}
export async function update(table, id, patch) {
  if (mode === 'demo') return demoUpdate(table, id, patch);
  const q = sb.from(table).update(patch);
  const { error } = await (table === 'pengaturan' ? q.eq('id', 1) : q.eq('id', id));
  if (error) throw new Error(humanError(error));
  await loadAll();
}
export async function remove(table, id) {
  if (mode === 'demo') return demoRemove(table, id);
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw new Error(humanError(error));
  await loadAll();
}
export async function rpc(fn, args) {
  if (mode === 'demo') return demoRpc(fn, args);
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(humanError(error));
  await loadAll();
  return data;
}

// ---------------------------------------------------------------- Mode demo
const LS = 'telurkita_demo_v1';
let db = null;
const save = () => {
  try { localStorage.setItem(LS, JSON.stringify(db)); } catch (_) { /* penyimpanan tidak tersedia */ }
};
function loadDemo() {
  if (!db) {
    try { db = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (_) { db = null; }
    if (!db || !db.tables) { db = { tables: buatDataDemo(), seq: {} }; derivedAll(); save(); }
  }
  for (const t of TABLES) {
    const rows = (db.tables[t] || []).map((r) => ({ ...r }));
    if (t === 'pengaturan') state.pengaturan = rows[0] || {};
    else state[key(t)] = rows;
  }
  state.ready = true;
  return state;
}
export function resetDemo() {
  try { localStorage.removeItem(LS); } catch (_) {}
  db = null;
  return loadDemo();
}
const nextId = (t) => {
  const rows = db.tables[t] || [];
  return rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
};
const harga0 = () => Number(db.tables.pengaturan[0]?.harga_default) || 3000;

function derived(t, r, old) {
  if (t === 'invoice') { r.jenis ||= 'Nota'; r.tanggal ||= today(); }
  if (t === 'pengeluaran') r.sumber_dana ||= 'Kas Usaha';
  if (t === 'aset') { r.sumber_dana ||= 'Uang Pribadi'; r.nilai_sisa = Number(r.nilai_sisa) || 0; }
  if (t === 'penjualan') {
    r.jenis ||= 'Jual';
    if (r.jenis === 'Jual') {
      if (r.harga == null || r.harga === '') r.harga = harga0();
      if (!r.metode) r.metode = 'Tunai';
    } else { r.harga = null; r.metode = null; r.tanggal_bayar = null; r.dp_terpakai = 0; }
    r.dp_terpakai = Number(r.dp_terpakai) || 0;
    r.total = penjTotal(r); r.status = penjStatus(r);
  }
  if (t === 'pengeluaran') r.total = pgTotal(r);
  if (t === 'aset') r.total = asetTotal(r);
  if (t === 'kas_opname') r.selisih = Number(r.saldo_fisik) - Number(r.saldo_catatan);
  if (t === 'po') {
    if (!r.status) r.status = 'Dipesan';
    r.dp = Number(r.dp) || 0;
    if (r.harga == null || r.harga === '') r.harga = harga0();
    r.total = poTotal(r);
    if (!r.no_po) r.no_po = 'PO-' + String(r.id).padStart(4, '0');
    if (['Dikirim', 'Batal', 'Ditolak'].includes(r.status) && !r.tanggal_selesai) r.tanggal_selesai = today();
    if (r.status === 'Dipesan' || r.status === 'Menunggu') r.tanggal_selesai = null;
    if (r.dp_dikembalikan == null) r.dp_dikembalikan = true;
    if (!old || ['tanggal_pesan', 'pelanggan_id', 'tanggal_kirim', 'jumlah', 'harga', 'dp', 'status', 'catatan'].some((f) => old[f] !== r[f])) r.updated_at = new Date().toISOString();
  }
  if (t === 'invoice' && !r.no_invoice) {
    const per = ym(r.tanggal).replace('-', '');
    const maxAda = (db.tables.invoice || []).reduce((m, v) => {
      const x = String(v.no_invoice || '').match(new RegExp(`^INV/${per}/(\\d+)$`));
      return x ? Math.max(m, Number(x[1])) : m;
    }, 0);
    db.seq['inv' + per] = Math.max(db.seq['inv' + per] || 0, maxAda) + 1;
    r.no_invoice = `INV/${per}/${String(db.seq['inv' + per]).padStart(3, '0')}`;
  }
  return r;
}
function derivedAll() {
  for (const t of Object.keys(db.tables)) db.tables[t] = db.tables[t].map((r) => derived(t, r));
}
function autoNota(p) {
  if (p.jenis === 'Jual' && p.pelanggan_id) {
    const inv = derived('invoice', { id: nextId('invoice'), jenis: 'Nota', tanggal: p.tanggal, pelanggan_id: p.pelanggan_id, penjualan_id: p.id, periode_dari: p.tanggal, periode_sampai: p.tanggal, created_at: new Date().toISOString() });
    db.tables.invoice.push(inv);
  }
}
async function demoInsert(t, row) {
  loadDemo();
  const r = derived(t, { id: nextId(t), created_at: new Date().toISOString(), created_by: 'sinta@contoh.id', ...row });
  db.tables[t].push(r);
  if (t === 'penjualan') autoNota(r);
  save(); loadDemo();
  return r;
}
async function demoUpdate(t, id, patch) {
  loadDemo();
  if (t === 'pengaturan') { Object.assign(db.tables.pengaturan[0], patch); save(); loadDemo(); return; }
  const i = db.tables[t].findIndex((r) => r.id === id);
  if (i < 0) throw new Error('Data tidak ditemukan');
  const old = { ...db.tables[t][i] };
  db.tables[t][i] = derived(t, { ...old, ...patch }, old);
  if (t === 'penjualan') {
    const p = db.tables[t][i];
    const nota = db.tables.invoice.find((v) => v.penjualan_id === id && v.jenis === 'Nota');
    if (p.jenis !== 'Jual' || !p.pelanggan_id) db.tables.invoice = db.tables.invoice.filter((v) => v !== nota);
    else if (!nota) autoNota(p);
    else Object.assign(nota, { pelanggan_id: p.pelanggan_id, periode_dari: p.tanggal, periode_sampai: p.tanggal });
  }
  save(); loadDemo();
}
async function demoRemove(t, id) {
  loadDemo();
  if (t === 'pelanggan' && (db.tables.penjualan.some((p) => p.pelanggan_id === id) || db.tables.po.some((p) => p.pelanggan_id === id)))
    throw new Error('Pelanggan ini masih punya transaksi, jadi belum bisa dihapus.');
  if (t === 'kategori_pengeluaran') {
    const k = db.tables[t].find((r) => r.id === id);
    if (k && db.tables.pengeluaran.some((e) => e.kategori === k.nama)) throw new Error('Kategori ini masih dipakai di pengeluaran.');
  }
  db.tables[t] = db.tables[t].filter((r) => r.id !== id);
  if (t === 'penjualan') db.tables.invoice = db.tables.invoice.filter((v) => v.penjualan_id !== id);
  if (t === 'po') db.tables.penjualan.forEach((p) => { if (p.po_id === id) p.po_id = null; });
  save(); loadDemo();
}
async function demoRpc(fn, args) {
  loadDemo();
  if (fn === 'kirim_po') {
    const po = db.tables.po.find((p) => p.id === args.p_po_id);
    if (!po) throw new Error('PO tidak ditemukan');
    if (po.status !== 'Dipesan') throw new Error(`PO ${po.no_po} sudah ${po.status}`);
    const tgl = args.p_tanggal || today();
    const p = await demoInsert('penjualan', { tanggal: tgl, jenis: 'Jual', pelanggan_id: po.pelanggan_id, jumlah: po.jumlah, harga: po.harga, metode: args.p_metode || 'Tunai', po_id: po.id, dp_terpakai: Math.min(Number(po.dp) || 0, poTotal(po)), catatan: po.no_po });
    await demoUpdate('po', po.id, { status: 'Dikirim', tanggal_selesai: tgl });
    return p.id;
  }
  throw new Error('Fungsi tidak dikenal: ' + fn);
}
