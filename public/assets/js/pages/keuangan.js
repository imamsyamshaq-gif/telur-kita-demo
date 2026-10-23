// Halaman Laporan, Kas & Modal, Aset
import { state } from '../store.js';
import { bulanan, amplop, stokBulan, daftarBulan, mutasiKas, saldoKas, asetPerBulan, asetTotal, nilaiBuku, penjTotal } from '../calc.js';
import { rp, num, pct, esc, icon, today, ym, ymAdd, ymIndex, fmtDate, fmtMonth, fmtMonthShort, sum } from '../util.js';
import { empty, chart, COLORS } from '../ui.js';
import { formModal, cekAmplop, formAset, hapus } from '../actions.js';

let bulan = ym(today());
const row = (l, v, cls = '') => `<div class="${cls}"><span>${l}</span><span class="num">${v}</span></div>`;

export function renderLaporan(el) {
  const k = bulan;
  const b = bulanan(state, k);
  const a = amplop(state, k);
  const s = stokBulan(state, k);
  const isNow = k === ym(today());
  const jual = state.penjualan.filter((p) => p.jenis === 'Jual' && ym(p.tanggal) === k);
  const hargaRata = b.terjual ? sum(jual, penjTotal) / b.terjual : 0;
  const impas = b.terjual ? b.hpp + (b.bebanPenjualan + b.bebanLain) / b.terjual : 0;
  const lastOp = [...state.kas_opname].sort((x, y) => (x.tanggal < y.tanggal ? 1 : -1))[0];
  const months = daftarBulan(state).slice(-12);
  const rows = months.map((m) => ({ m, b: bulanan(state, m), a: amplop(state, m) }));

  el.innerHTML = `<div class="page-head"><div><h1>Laporan keuangan</h1><p>${fmtMonth(k)}${isNow ? ' · bulan berjalan, angka HPP & laba masih sementara' : ''}</p></div>
    <div class="tools"><input type="month" class="input" data-month value="${k}" max="${ym(today())}"><button class="btn ghost" data-csv>${icon('file')}Unduh CSV</button></div></div>
  <div class="grid g-2" style="margin-bottom:18px">
    <div class="card"><div class="card-head"><h3>${icon('chart')} Laba rugi</h3><span class="badge ${b.labaBersih >= 0 ? 'ok' : 'bad'}">${b.labaBersih >= 0 ? 'Untung' : 'Rugi'}</span></div>
      <div class="stat-list">${row('Pendapatan penjualan', rp(b.pendapatan))}${row(`− Beban pokok penjualan <small class="muted">(${num(b.terjual)} × ${rp(b.hpp)})</small>`, rp(b.bpp), 'indent')}
        ${row('<b>Laba kotor</b>', `<b>${rp(b.labaKotor)}</b>`)}${row('− Beban penjualan', rp(b.bebanPenjualan), 'indent')}${row('− Beban lain-lain', rp(b.bebanLain), 'indent')}
        ${b.pendapatanLain ? row('+ Pendapatan lain (DP hangus)', rp(b.pendapatanLain), 'indent') : ''}
        ${row('Laba bersih', `<span style="color:${b.labaBersih >= 0 ? 'var(--green-600)' : 'var(--danger)'}">${rp(b.labaBersih)}</span>`, 'total')}</div>
      <div class="calc-line" style="margin-top:12px"><span>Margin laba bersih <b>${pct(b.margin)}</b></span><span>Belum dikurangi pajak</span></div></div>
    <div class="card"><div class="card-head"><h3>${icon('egg')} HPP & indikator</h3></div>
      <div class="stat-list">${row('Biaya produksi (pakan, vitamin, dll.)', rp(b.biayaProduksi))}${row('+ Penyusutan aset', rp(b.penyusutan))}
        ${row('÷ Telur bagus', num(b.telurBagus) + ' butir')}${row('<b>HPP per butir</b>', `<b>${rp(b.hpp)}</b>`, 'total')}
        ${row('Harga jual rata-rata', rp(hargaRata))}${row('Titik impas per butir <small class="muted">(HPP + beban jual)</small>', rp(impas))}
        ${row('Untung per butir', `<b style="color:${hargaRata - impas >= 0 ? 'var(--green-600)' : 'var(--danger)'}">${rp(hargaRata - impas)}</b>`)}
        ${row('HDP (produktivitas ayam)', pct(b.hdp))}${row('Telur non-jual (dinilai HPP)', `${num(b.nonJual)} butir · ${rp(b.nilaiNonJual)}`)}</div></div>
  </div>
  <div class="grid g-2" style="margin-bottom:18px">
    <div class="card"><div class="card-head"><h3>${icon('wallet')} Uang di amplop</h3><button class="btn sm yolk" data-cek>${icon('check')}Cocokkan</button></div>
      <div class="stat-list">${row('Saldo awal bulan', rp(a.awal))}${row('+ Modal dimasukkan', rp(a.modal), 'indent')}${row('+ Hasil jualan (tunai/transfer/QRIS)', rp(a.jual), 'indent')}
        ${row('+ Pelunasan utang pelanggan', rp(a.lunas), 'indent')}${row('+ DP pre-order diterima', rp(a.dpIn), 'indent')}${row('− Belanja dari amplop', rp(a.belanja), 'indent')}
        ${row('− Beli aset dari amplop', rp(a.aset), 'indent')}${row('− Diambil pribadi (prive)', rp(a.prive), 'indent')}${row('− DP dikembalikan (PO batal)', rp(a.dpOut), 'indent')}
        ${row('Saldo akhir menurut catatan', rp(a.akhir), 'total')}</div>
      <div class="calc-line" style="margin-top:12px"><span>${lastOp ? `Cek terakhir ${fmtDate(lastOp.tanggal)}: ${Math.abs(lastOp.selisih ?? lastOp.saldo_fisik - lastOp.saldo_catatan) < 1 ? '<b style="color:var(--green-600)">cocok ✔</b>' : `<b style="color:var(--danger)">selisih ${rp(lastOp.saldo_fisik - lastOp.saldo_catatan)}</b>`}` : 'Belum pernah dicocokkan'}</span><span>Laba ≠ uang di amplop</span></div></div>
    <div class="card"><div class="card-head"><h3>${icon('box')} Arus stok telur</h3></div>
      <div class="stat-list">${row('Stok awal bulan', num(s.awal) + ' butir')}${row('+ Telur bagus', num(s.bagus), 'indent')}
        ${Object.entries(s.per).filter(([, v]) => v).map(([j, v]) => row('− ' + (j === 'Jual' ? 'Dijual' : j), num(v), 'indent')).join('')}
        ${row('Sisa stok akhir', num(s.akhir) + ' butir', 'total')}${row('<span class="muted">Pecah saat produksi (tidak masuk stok)</span>', num(s.rusak))}</div></div>
  </div>
  <div class="card"><div class="card-head"><h3>Perkembangan per bulan</h3></div>
    <div class="chart-box sm" style="margin-bottom:14px"><canvas id="cMon"></canvas></div>
    <div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Bulan</th><th class="r">Telur bagus</th><th class="r">HDP</th><th class="r">Terjual</th><th class="r">Pendapatan</th><th class="r">HPP/butir</th><th class="r">Pengeluaran</th><th class="r">Laba bersih</th><th class="r">Amplop akhir</th></tr></thead><tbody>
    ${[...rows].reverse().map(({ m, b: x, a: y }) => `<tr><td data-l="Bulan"><b>${fmtMonth(m)}</b></td><td data-l="Telur bagus" class="r num">${num(x.telurBagus)}</td><td data-l="HDP" class="r">${pct(x.hdp)}</td>
      <td data-l="Terjual" class="r num">${num(x.terjual)}</td><td data-l="Pendapatan" class="r num">${rp(x.pendapatan)}</td><td data-l="HPP/butir" class="r num">${rp(x.hpp)}</td>
      <td data-l="Pengeluaran" class="r num">${rp(x.totalPengeluaran)}</td><td data-l="Laba bersih" class="r num" style="color:${x.labaBersih >= 0 ? 'var(--green-600)' : 'var(--danger)'}"><b>${rp(x.labaBersih)}</b></td>
      <td data-l="Amplop akhir" class="r num">${rp(y.akhir)}</td></tr>`).join('')}</tbody></table></div></div>`;

  el.querySelector('[data-month]').onchange = (e) => { bulan = e.target.value || ym(today()); renderLaporan(el); };
  el.querySelector('[data-cek]').onclick = () => cekAmplop();
  el.querySelector('[data-csv]').onclick = () => {
    const H = ['Bulan', 'Telur bagus', 'Telur rusak', 'HDP', 'Terjual', 'Non-jual', 'Pendapatan', 'Biaya produksi', 'Penyusutan', 'HPP per butir', 'Beban pokok penjualan', 'Laba kotor', 'Beban penjualan', 'Beban lain', 'Laba bersih', 'Amplop akhir'];
    const L = daftarBulan(state).map((m) => { const x = bulanan(state, m); return [m, x.telurBagus, x.telurRusak, x.hdp.toFixed(4), x.terjual, x.nonJual, x.pendapatan, x.biayaProduksi, Math.round(x.penyusutan), Math.round(x.hpp), Math.round(x.bpp), Math.round(x.labaKotor), x.bebanPenjualan, x.bebanLain, Math.round(x.labaBersih), Math.round(amplop(state, m).akhir)]; });
    const csv = [H, ...L].map((r) => r.join(';')).join('\n');
    const a2 = document.createElement('a');
    a2.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a2.download = `laporan-telur-${today()}.csv`; a2.click();
  };
  chart(el.querySelector('#cMon'), {
    type: 'bar',
    data: { labels: rows.map((r) => fmtMonthShort(r.m)), datasets: [
      { label: 'Pendapatan', data: rows.map((r) => r.b.pendapatan), backgroundColor: COLORS.green, borderRadius: 6, maxBarThickness: 34 },
      { label: 'Pengeluaran', data: rows.map((r) => r.b.totalPengeluaran), backgroundColor: COLORS.danger, borderRadius: 6, maxBarThickness: 34 },
      { type: 'line', label: 'Laba bersih', data: rows.map((r) => r.b.labaBersih), borderColor: COLORS.yolk, backgroundColor: COLORS.yolk, tension: .3, cubicInterpolationMode: 'monotone' } ] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${rp(c.raw)}` } } },
      scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => (Math.abs(v) >= 1000 ? num(v / 1000) + 'rb' : v) } } } },
  });
}

// ---------------------------------------------------------------- Kas & modal
let kasBulan = ym(today());
export function renderKas(el) {
  const saldo = saldoKas(state);
  const all = mutasiKas(state);
  let run = 0;
  const withRun = all.map((m) => ({ ...m, saldo: (run += m.jumlah) }));
  const rows = withRun.filter((m) => ym(m.tanggal) === kasBulan).reverse();
  const mp = [...state.modal_prive].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
  const op = [...state.kas_opname].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
  const modal = sum(state.modal_prive.filter((r) => r.jenis === 'Setoran Modal'), (r) => r.jumlah);
  const pribadi = sum(state.pengeluaran.filter((e) => e.sumber_dana === 'Uang Pribadi'), (e) => e.qty * e.harga_satuan) + sum(state.aset.filter((a) => a.sumber_dana === 'Uang Pribadi'), asetTotal);
  const prive = sum(state.modal_prive.filter((r) => r.jenis !== 'Setoran Modal'), (r) => r.jumlah);
  const label = { modal: 'Modal masuk', prive: 'Prive', jual: 'Penjualan', lunas: 'Pelunasan', dp_in: 'DP PO masuk', dp_out: 'DP dikembalikan', belanja: 'Belanja', aset: 'Beli aset' };
  el.innerHTML = `<div class="page-head"><div><h1>Kas & modal</h1><p>Uang usaha di amplop, modal yang ditanam, dan uang yang diambil pribadi.</p></div>
    <div class="tools"><button class="btn ghost" data-prive>${icon('logout')}Ambil uang</button><button class="btn ghost" data-modal>${icon('plus')}Tambah modal</button><button class="btn yolk" data-cek>${icon('check')}Cocokkan amplop</button></div></div>
    <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))"><div class="kpi amplop"><div class="k-top"><span class="k-ic">${icon('wallet')}</span>Uang di amplop</div><div class="k-val num">${rp(saldo)}</div><div class="k-sub">Harus sama dengan uang fisik</div></div>
      <div class="kpi green"><div class="k-top"><span class="k-ic">${icon('coins')}</span>Total modal ditanam</div><div class="k-val num">${rp(modal + pribadi)}</div><div class="k-sub">Setoran ${rp(modal)} + belanja/aset uang pribadi ${rp(pribadi)}</div></div>
      <div class="kpi red"><div class="k-top"><span class="k-ic">${icon('logout')}</span>Total prive</div><div class="k-val num">${rp(prive)}</div><div class="k-sub">Uang usaha yang dipakai pribadi</div></div></div>
    <div class="grid g-main">
      <div class="card"><div class="card-head"><h3>Mutasi amplop</h3><input type="month" class="input" data-month value="${kasBulan}" style="width:auto"></div>
        ${rows.length ? `<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th class="r">Masuk/keluar</th><th class="r">Saldo</th></tr></thead><tbody>
        ${rows.map((m) => `<tr><td data-l="Tanggal">${fmtDate(m.tanggal)}</td><td data-l="Jenis">${label[m.jenis] || m.jenis}</td><td data-l="Keterangan" class="muted">${esc(m.label)}</td>
          <td data-l="Jumlah" class="r num" style="color:${m.jumlah >= 0 ? 'var(--green-600)' : 'var(--danger)'}">${m.jumlah >= 0 ? '+' : ''}${rp(m.jumlah)}</td><td data-l="Saldo" class="r num"><b>${rp(m.saldo)}</b></td></tr>`).join('')}</tbody></table></div>` : empty('Tidak ada uang masuk/keluar amplop bulan ini.', 'wallet')}</div>
      <div class="grid" style="align-content:start">
        <div class="card"><div class="card-head"><h3>Modal & prive</h3></div>
          ${mp.length ? `<table class="tbl"><tbody>${mp.map((r) => `<tr data-id="${r.id}"><td>${fmtDate(r.tanggal)}<br><small class="muted">${esc(r.keterangan || '')}</small></td>
            <td class="r num" style="color:${r.jenis === 'Setoran Modal' ? 'var(--green-600)' : 'var(--danger)'}">${r.jenis === 'Setoran Modal' ? '+' : '−'}${rp(r.jumlah)}</td>
            <td class="acts"><button class="btn ghost sm icon" data-a="edit">${icon('edit')}</button><button class="btn ghost sm icon" data-a="del">${icon('trash')}</button></td></tr>`).join('')}</tbody></table>` : empty('Belum ada.', 'coins')}</div>
        <div class="card"><div class="card-head"><h3>Riwayat cek amplop</h3></div>
          ${op.length ? `<table class="tbl"><tbody>${op.slice(0, 8).map((r) => { const s = Number(r.saldo_fisik) - Number(r.saldo_catatan); return `<tr data-op="${r.id}"><td>${fmtDate(r.tanggal)}<br><small class="muted">${esc(r.catatan || '')}</small></td>
            <td class="r num">${rp(r.saldo_fisik)}</td><td>${Math.abs(s) < 1 ? '<span class="badge ok">Cocok</span>' : `<span class="badge bad">${rp(s)}</span>`}</td><td class="acts"><button class="btn ghost sm icon" data-a="del">${icon('trash')}</button></td></tr>`; }).join('')}</tbody></table>` : empty('Belum pernah dicek.', 'check')}</div>
      </div></div>`;
  el.querySelector('[data-month]').onchange = (e) => { kasBulan = e.target.value || ym(today()); renderKas(el); };
  el.querySelector('[data-modal]').onclick = () => formModal(null, 'Setoran Modal');
  el.querySelector('[data-prive]').onclick = () => formModal(null, 'Prive (Ambil Uang)');
  el.querySelector('[data-cek]').onclick = () => cekAmplop();
  el.querySelectorAll('tr[data-id]').forEach((tr) => {
    const r = state.modal_prive.find((x) => x.id === Number(tr.dataset.id));
    tr.querySelector('[data-a=edit]').onclick = () => formModal(r);
    tr.querySelector('[data-a=del]').onclick = () => hapus('modal_prive', r, `${r.jenis} ${rp(r.jumlah)}`);
  });
  el.querySelectorAll('tr[data-op]').forEach((tr) => {
    const r = state.kas_opname.find((x) => x.id === Number(tr.dataset.op));
    tr.querySelector('[data-a=del]').onclick = () => hapus('kas_opname', r, `hasil cek ${fmtDate(r.tanggal)}`);
  });
}

// ---------------------------------------------------------------- Aset
export function renderAset(el) {
  const now = ym(today());
  const rows = [...state.aset].sort((a, b) => (a.tanggal_beli < b.tanggal_beli ? 1 : -1));
  el.innerHTML = `<div class="page-head"><div><h1>Aset & penyusutan</h1><p>Ayam, kandang, dan peralatan. Penyusutan garis lurus mulai bulan pembelian, otomatis masuk HPP.</p></div>
    <div class="tools"><button class="btn" data-new>${icon('plus')}Tambah aset</button></div></div>
    <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      <div class="kpi green" style="min-height:0"><div class="k-top">Total investasi</div><div class="k-val num">${rp(sum(rows, asetTotal))}</div></div>
      <div class="kpi cream" style="min-height:0"><div class="k-top">Nilai buku sekarang</div><div class="k-val num">${rp(sum(rows, (a) => nilaiBuku(a, now)))}</div></div>
      <div class="kpi yolk" style="min-height:0"><div class="k-top">Penyusutan bulan ini</div><div class="k-val num">${rp(sum(rows.filter((a) => { const s = ymIndex(a.tanggal_beli.slice(0, 7)); const i = ymIndex(now); return i >= s && i < s + Number(a.umur_bulan); }), asetPerBulan))}</div></div></div>
    <div class="card">${rows.length ? `<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Aset</th><th>Tanggal beli</th><th class="r">Total harga</th><th class="r">Umur</th><th class="r">Nilai sisa</th><th class="r">Penyusutan/bln</th><th class="r">Nilai buku</th><th>Dari</th><th></th></tr></thead><tbody>
      ${rows.map((a) => { const jalan = Math.max(0, ymIndex(now) - ymIndex(a.tanggal_beli.slice(0, 7)) + 1); return `<tr data-id="${a.id}"><td data-l="Aset"><b>${esc(a.nama)}</b><br><small class="muted">${esc(a.kategori)} · ${num(a.qty)} × ${rp(a.harga_satuan)}</small></td>
        <td data-l="Tanggal beli">${fmtDate(a.tanggal_beli)}</td><td data-l="Total" class="r num">${rp(asetTotal(a))}</td><td data-l="Umur" class="r">${Math.min(jalan, a.umur_bulan)}/${num(a.umur_bulan)} bln</td>
        <td data-l="Nilai sisa" class="r num">${rp(a.nilai_sisa)}</td><td data-l="Penyusutan/bln" class="r num">${rp(asetPerBulan(a))}</td><td data-l="Nilai buku" class="r num"><b>${rp(nilaiBuku(a, now))}</b></td>
        <td data-l="Dari">${a.sumber_dana === 'Kas Usaha' ? 'Amplop' : 'Pribadi'}</td><td class="acts"><button class="btn ghost sm icon" data-a="edit">${icon('edit')}</button><button class="btn ghost sm icon" data-a="del">${icon('trash')}</button></td></tr>`; }).join('')}
      </tbody></table></div>` : empty('Belum ada aset. Tambahkan ayam, kandang, dan peralatan supaya HPP lengkap.', 'box')}</div>
    <div class="alert info" style="margin-top:14px">${icon('info')}<span>Mengubah angka aset akan ikut mengubah laporan bulan-bulan lalu (dihitung ulang). Kalau perlu revisi, tulis alasannya di catatan.</span></div>`;
  el.querySelector('[data-new]').onclick = () => formAset();
  el.querySelectorAll('tr[data-id]').forEach((tr) => {
    const a = state.aset.find((x) => x.id === Number(tr.dataset.id));
    tr.querySelector('[data-a=edit]').onclick = () => formAset(a);
    tr.querySelector('[data-a=del]').onclick = () => hapus('aset', a, `aset "${a.nama}"`);
  });
}
