// Halaman catatan harian: Produksi, Telur keluar (penjualan), Pengeluaran
import { state } from '../store.js';
import { bulanan, penjTotal, penjStatus, penjSisa, pgTotal, kelompokOf, pelangganNama, UTANG, stokBulan } from '../calc.js';
import { rp, num, pct, esc, icon, today, ym, fmtDate, fmtMonth, sum } from '../util.js';
import { empty } from '../ui.js';
import { formProduksi, formPenjualan, formPengeluaran, lunasi, hapus } from '../actions.js';
import { badge } from './dashboard.js';

const filt = { produksi: ym(today()), penjualan: ym(today()), pengeluaran: ym(today()), tab: 'semua' };
const head = (title, sub, k, btn) => `<div class="page-head"><div><h1>${title}</h1><p>${sub}</p></div>
  <div class="tools"><input type="month" class="input" data-month value="${k}" aria-label="Pilih bulan">${btn}</div></div>`;
const mini = (items) => `<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${items.map(([l, v, c, s]) =>
  `<div class="kpi ${c}" style="min-height:0"><div class="k-top">${l}</div><div class="k-val num" style="font-size:22px">${v}</div>${s ? `<div class="k-sub">${s}</div>` : ''}</div>`).join('')}</div>`;
const actBtns = (extra = '') => `${extra}<button class="btn ghost sm icon" data-a="edit" title="Ubah">${icon('edit')}</button><button class="btn ghost sm icon" data-a="del" title="Hapus">${icon('trash')}</button>`;
function wire(el, key, rerender) {
  el.querySelector('[data-month]').onchange = (e) => { filt[key] = e.target.value || ym(today()); rerender(); };
}

// ---------------------------------------------------------------- Produksi
export function renderProduksi(el, ctx) {
  const k = filt.produksi;
  const b = bulanan(state, k);
  const rows = state.produksi.filter((r) => ym(r.tanggal) === k).sort((a, c) => (a.tanggal < c.tanggal ? 1 : a.tanggal > c.tanggal ? -1 : c.id - a.id));
  const hariCatat = new Set(rows.map((r) => r.tanggal)).size;
  el.innerHTML = head('Produksi telur', `Catatan telur harian ${fmtMonth(k)}`, k, `<button class="btn" data-new>${icon('plus')}Catat telur</button>`)
    + mini([['Telur bagus', num(b.telurBagus), 'green', `${hariCatat} hari tercatat`], ['HDP', pct(b.hdp), 'yolk', `Batas ${pct(state.pengaturan.batas_hdp)}`],
      ['Pecah / rusak', num(b.telurRusak), 'red', b.telurBagus ? pct(b.telurRusak / (b.telurBagus + b.telurRusak)) + ' dari produksi' : ''],
      ['Rata-rata / hari', num(hariCatat ? b.telurBagus / hariCatat : 0), 'cream', 'butir bagus']])
    + `<div class="card">${rows.length ? `<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Tanggal</th><th class="r">Ayam hidup</th><th class="r">Telur bagus</th><th class="r">Pecah</th><th class="r">HDP</th><th class="r">Ayam mati</th><th>Catatan</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr data-id="${r.id}"><td data-l="Tanggal">${fmtDate(r.tanggal)}</td><td data-l="Ayam hidup" class="r num">${num(r.ayam_hidup)}</td>
        <td data-l="Telur bagus" class="r num"><b>${num(r.telur_bagus)}</b></td><td data-l="Pecah" class="r num">${num(r.telur_rusak)}</td>
        <td data-l="HDP" class="r">${r.ayam_hidup ? pct((r.telur_bagus + r.telur_rusak) / r.ayam_hidup) : '–'}</td><td data-l="Ayam mati" class="r num">${num(r.ayam_mati)}</td>
        <td data-l="Catatan" class="muted">${esc(r.catatan || '')}</td><td class="acts">${actBtns()}</td></tr>`).join('')}</tbody></table></div>`
      : empty(`Belum ada catatan produksi di ${fmtMonth(k)}.`)}</div>`;
  wire(el, 'produksi', () => renderProduksi(el, ctx));
  el.querySelector('[data-new]').onclick = () => formProduksi();
  el.querySelectorAll('tr[data-id]').forEach((tr) => {
    const r = state.produksi.find((x) => x.id === Number(tr.dataset.id));
    tr.querySelector('[data-a=edit]').onclick = () => formProduksi(r);
    tr.querySelector('[data-a=del]').onclick = () => hapus('produksi', r, `catatan produksi ${fmtDate(r.tanggal)}`);
  });
}

// ---------------------------------------------------------------- Telur keluar
export function renderPenjualan(el, ctx) {
  const k = filt.penjualan;
  const b = bulanan(state, k);
  const st = stokBulan(state, k);
  let rows = state.penjualan.filter((p) => ym(p.tanggal) === k || (filt.tab === 'utang' && penjStatus(p) === 'BELUM LUNAS'));
  if (filt.tab === 'jual') rows = rows.filter((p) => p.jenis === 'Jual');
  if (filt.tab === 'nonjual') rows = rows.filter((p) => p.jenis !== 'Jual');
  if (filt.tab === 'utang') rows = rows.filter((p) => penjStatus(p) === 'BELUM LUNAS');
  rows.sort((a, c) => (a.tanggal < c.tanggal ? 1 : a.tanggal > c.tanggal ? -1 : c.id - a.id));
  const piutang = sum(state.penjualan.filter((p) => penjStatus(p) === 'BELUM LUNAS'), penjSisa);
  const notaOf = (p) => state.invoice.find((v) => v.penjualan_id === p.id && v.jenis === 'Nota');
  el.innerHTML = head('Telur keluar', 'Penjualan, konsumsi sendiri, untuk keluarga/tetangga, hadiah, dan telur pecah dari stok', k,
    `<button class="btn ghost" data-other>${icon('box')}Non-jual</button><button class="btn" data-new>${icon('cart')}Jual telur</button>`)
    + mini([['Pendapatan', rp(b.pendapatan), 'green', `${num(b.terjual)} butir terjual`], ['Telur non-jual', num(b.nonJual), 'yolk', `Nilai HPP ${rp(b.nilaiNonJual)}`],
      ['Stok akhir bulan', num(st.akhir), 'cream', `Awal ${num(st.awal)} + produksi ${num(st.bagus)}`], ['Piutang (semua)', rp(piutang), 'red', 'Belum dibayar pembeli']])
    + `<div class="card"><div class="toolbar"><div class="tabs">${[['semua', 'Semua'], ['jual', 'Penjualan'], ['nonjual', 'Non-jual'], ['utang', 'Belum lunas']]
      .map(([v, l]) => `<button data-tab="${v}" class="${filt.tab === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Pelanggan</th><th class="r">Butir</th><th class="r">Harga</th><th class="r">Total</th><th>Bayar</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.map((p) => `<tr data-id="${p.id}"><td data-l="Tanggal">${fmtDate(p.tanggal)}</td><td data-l="Jenis">${p.jenis === 'Jual' ? '<b>Jual</b>' : esc(p.jenis)}${p.po_id ? ' <span class="badge info">PO</span>' : ''}</td>
        <td data-l="Pelanggan">${esc(pelangganNama(state, p.pelanggan_id) || '–')}</td><td data-l="Butir" class="r num">${num(p.jumlah)}</td>
        <td data-l="Harga" class="r num">${p.jenis === 'Jual' ? rp(p.harga) : '–'}</td><td data-l="Total" class="r num"><b>${p.jenis === 'Jual' ? rp(penjTotal(p)) : '–'}</b>${Number(p.dp_terpakai) ? `<br><small class="muted">DP ${rp(p.dp_terpakai)}</small>` : ''}</td>
        <td data-l="Bayar">${esc(p.metode === UTANG ? 'Utang' : p.metode || '–')}${p.tanggal_bayar ? `<br><small class="muted">lunas ${fmtDate(p.tanggal_bayar)}</small>` : ''}</td>
        <td data-l="Status">${badge(penjStatus(p))}</td>
        <td class="acts">${actBtns(`${penjStatus(p) === 'BELUM LUNAS' ? `<button class="btn sm" data-a="lunas">${icon('check')}Lunas</button>` : ''}${notaOf(p) ? `<button class="btn ghost sm icon" data-a="nota" title="Nota">${icon('receipt')}</button>` : ''}`)}</td></tr>`).join('')}
      </tbody></table></div>` : empty('Belum ada data untuk filter ini.')}</div>`;
  wire(el, 'penjualan', () => renderPenjualan(el, ctx));
  el.querySelector('[data-new]').onclick = () => formPenjualan(null, 'Jual');
  el.querySelector('[data-other]').onclick = () => formPenjualan(null, 'Konsumsi Sendiri');
  el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { filt.tab = b.dataset.tab; renderPenjualan(el, ctx); }));
  el.querySelectorAll('tr[data-id]').forEach((tr) => {
    const p = state.penjualan.find((x) => x.id === Number(tr.dataset.id));
    tr.querySelector('[data-a=edit]').onclick = () => formPenjualan(p);
    tr.querySelector('[data-a=del]').onclick = () => hapus('penjualan', p, `${p.jenis.toLowerCase()} ${num(p.jumlah)} butir (${fmtDate(p.tanggal)})${p.po_id ? '. PO terkait TIDAK otomatis kembali ke status Dipesan' : ''}`);
    const l = tr.querySelector('[data-a=lunas]'); if (l) l.onclick = () => lunasi(p);
    const n = tr.querySelector('[data-a=nota]'); if (n) n.onclick = () => ctx.go('invoice/' + notaOf(p).id);
  });
}

// ---------------------------------------------------------------- Pengeluaran
export function renderPengeluaran(el, ctx) {
  const k = filt.pengeluaran;
  const b = bulanan(state, k);
  const rows = state.pengeluaran.filter((e) => ym(e.tanggal) === k).sort((a, c) => (a.tanggal < c.tanggal ? 1 : a.tanggal > c.tanggal ? -1 : c.id - a.id));
  const amplop = sum(rows.filter((e) => e.sumber_dana === 'Kas Usaha'), pgTotal);
  el.innerHTML = head('Pengeluaran', `Belanja usaha ${fmtMonth(k)}. Pembelian ayam/kandang/alat dicatat di menu Aset.`, k, `<button class="btn" data-new>${icon('plus')}Catat belanja</button>`)
    + mini([['Biaya produksi (HPP)', rp(b.biayaProduksi), 'green', 'Pakan, vitamin, listrik kandang…'], ['Beban penjualan', rp(b.bebanPenjualan), 'yolk', 'Kemasan, bensin, promosi'],
      ['Beban lain-lain', rp(b.bebanLain), 'cream', ''], ['Dibayar dari amplop', rp(amplop), 'red', `Uang pribadi ${rp(b.totalPengeluaran - amplop)}`]])
    + `<div class="card">${rows.length ? `<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th class="r">Jumlah</th><th class="r">Harga satuan</th><th class="r">Total</th><th>Dibayar dari</th><th></th></tr></thead><tbody>
      ${rows.map((e) => `<tr data-id="${e.id}"><td data-l="Tanggal">${fmtDate(e.tanggal)}</td><td data-l="Kategori"><b>${esc(e.kategori)}</b><br><small class="muted">${esc(kelompokOf(state, e.kategori))}</small></td>
        <td data-l="Keterangan">${esc(e.keterangan || '')}</td><td data-l="Jumlah" class="r num">${num(e.qty)} ${esc(e.satuan || '')}</td><td data-l="Harga satuan" class="r num">${rp(e.harga_satuan)}</td>
        <td data-l="Total" class="r num"><b>${rp(pgTotal(e))}</b></td><td data-l="Dibayar dari">${badge(e.sumber_dana)}</td><td class="acts">${actBtns()}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="5">Total ${fmtMonth(k)}</td><td class="r num">${rp(sum(rows, pgTotal))}</td><td colspan="2"></td></tr></tfoot></table></div>` : empty(`Belum ada pengeluaran di ${fmtMonth(k)}.`, 'wallet')}</div>`;
  wire(el, 'pengeluaran', () => renderPengeluaran(el, ctx));
  el.querySelector('[data-new]').onclick = () => formPengeluaran();
  el.querySelectorAll('tr[data-id]').forEach((tr) => {
    const e = state.pengeluaran.find((x) => x.id === Number(tr.dataset.id));
    tr.querySelector('[data-a=edit]').onclick = () => formPengeluaran(e);
    tr.querySelector('[data-a=del]').onclick = () => hapus('pengeluaran', e, `pengeluaran ${e.kategori} ${rp(pgTotal(e))}`);
  });
}
