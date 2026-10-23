import { state } from '../store.js';
import { bulanan, amplop, stokSekarang, stokBulan, ringkasPO, peringatan, transaksiTerbaru, seriHarian, pelangganNama, mulaiSisih, saldoKas } from '../calc.js';
import { rp, num, rak, esc, icon, today, ym, ymAdd, fmtLong, fmtShort, fmtMonth, relDays, parseISO, diffDays, addDays, sum } from '../util.js';
import { chart, COLORS, basketSVG, eggArt, boxArt, barsArt, envelopeArt, sparkSVG, empty } from '../ui.js';
import { formProduksi, formPenjualan, formPO } from '../actions.js';

let bulan = ym(today());

const delta = (now, prev, invert = false) => {
  if (!prev) return `<span class="faint">bulan lalu belum ada data</span>`;
  const d = (now - prev) / Math.abs(prev);
  const up = d >= 0;
  const good = invert ? !up : up;
  return `<span class="${good ? 'trend-up' : 'trend-down'}">${up ? '↑' : '↓'} ${Math.abs(d * 100).toFixed(1).replace('.', ',')}%</span> vs bulan lalu`;
};

export function render(el, { go, user }) {
  const k = bulan;
  const b = bulanan(state, k);
  const lalu = bulanan(state, ymAdd(k, -1));
  const amp = amplop(state, k);
  const stok = stokSekarang(state);
  const po = ringkasPO(state);
  const alerts = peringatan(state);
  const isNow = k === ym(today());
  const hariAkhir = isNow ? today() : addDays(ymAdd(k, 1) + '-01', -1);
  const nHari = parseISO(hariAkhir).getDate();
  const seri = seriHarian(state, nHari, hariAkhir);
  const hariIni = seriHarian(state, 8, today());
  const nama = (user?.nama || 'Pengelola').split(' ')[0];
  const set = state.pengaturan;
  const target = Number(set.target_bulanan) || 0;
  const s = stokBulan(state, k);

  el.innerHTML = `
  <div class="page-head" style="position:relative">
    <div><h1>Selamat datang, ${esc(nama)} 👋</h1><p>Ringkasan usaha telur ${isNow ? 'bulan ini' : fmtMonth(k)} · ${fmtLong(today())}</p></div>
    <div class="tools"><input type="month" class="input" id="dashMonth" value="${k}" max="${ym(today())}" aria-label="Pilih bulan">
      <button class="btn" id="qProd">${icon('egg')}Telur hari ini</button></div>
  </div>
  ${alerts.length ? `<div class="alerts">${alerts.slice(0, 4).map((a) => `<div class="alert ${a.level}">${icon(a.level === 'info' ? 'info' : 'alert')}<span>${esc(a.teks)}</span>${a.aksi ? `<button class="link-btn" data-go="${a.aksi}">Buka →</button>` : ''}</div>`).join('')}</div>` : ''}
  <div class="kpis six">
    <div class="kpi green"><div class="k-top"><span class="k-ic">${icon('coins')}</span>Pendapatan</div><div class="k-val num">${rp(b.pendapatan)}</div>${sparkSVG(seri.map((x) => x.pendapatan))}<div class="k-sub">${delta(b.pendapatan, lalu.pendapatan)}</div></div>
    <div class="kpi yolk"><div class="k-top"><span class="k-ic">${icon('egg')}</span>Telur terjual</div><div class="k-val num">${num(b.terjual)} <small style="font-size:14px;font-weight:600">butir</small></div>${eggArt()}<div class="k-sub">≈ ${rak(b.terjual)} rak · ${delta(b.terjual, lalu.terjual)}</div></div>
    <div class="kpi cream"><div class="k-top"><span class="k-ic">${icon('box')}</span>Stok telur</div><div class="k-val num">${num(stok)} <small style="font-size:14px;font-weight:600">butir</small></div>${boxArt()}<div class="k-sub">Ada di rumah sekarang · ≈ ${rak(stok)} rak</div></div>
    <div class="kpi red"><div class="k-top"><span class="k-ic">${icon('wallet')}</span>Pengeluaran</div><div class="k-val num">${rp(b.totalPengeluaran)}</div>${barsArt()}<div class="k-sub">${delta(b.totalPengeluaran, lalu.totalPengeluaran, true)}</div></div>
    <div class="kpi dark"><div class="k-top"><span class="k-ic">${icon('chart')}</span>Laba bersih</div><div class="k-val num">${rp(b.labaBersih)}</div>${barsArt('#9BE3A0')}<div class="k-sub">HPP ${rp(b.hpp)}/butir${isNow ? ' · sementara' : ''}</div></div>
    <div class="kpi amplop" data-go="kas" style="cursor:pointer"><div class="k-top"><span class="k-ic">${icon('wallet')}</span>Uang di amplop</div><div class="k-val num">${rp(isNow ? saldoKas(state) : amp.akhir)}</div>${envelopeArt()}<div class="k-sub">Cocokkan dengan uang fisik →</div></div>
  </div>

  <div class="grid g-main" style="margin-bottom:18px">
    <div class="card"><div class="card-head"><h3>Grafik penjualan ${isNow ? 'bulan ini' : fmtMonth(k)}</h3>
      <span class="muted" style="font-size:12.5px"><span style="color:${COLORS.green}">●</span> Penjualan (Rp) &nbsp; <span style="color:${COLORS.yolk}">●</span> Telur terjual (butir)</span></div>
      <div class="chart-box"><canvas id="cSales"></canvas></div></div>
    <div class="card"><div class="card-head"><h3>Ke mana telur ${isNow ? 'bulan ini' : ''}?</h3><span class="badge">${num(s.bagus + s.rusak)} butir diproduksi</span></div>
      <div class="donut-wrap"><div class="chart-box sm"><canvas id="cEgg"></canvas></div><div class="legend" id="lgEgg"></div></div></div>
  </div>

  <div class="grid g-main">
    <div class="card"><div class="card-head"><h3>Transaksi terbaru</h3><button class="link-btn" data-go="penjualan">Lihat semua →</button></div>
      <div class="tbl-wrap" id="recent"></div></div>
    <div class="grid" style="align-content:start">
      <div class="card"><div class="card-head"><h3>${icon('calendar')} Pre-order akan datang</h3><button class="link-btn" id="qPO">+ PO</button></div>
        ${po.aktif.length ? po.aktif.slice(0, 4).map((p) => {
          const d = parseISO(p.tanggal_kirim);
          const mulai = mulaiSisih(state, p);
          return `<div class="mini-po"><div class="date"><b>${d.getDate()}</b><small>${fmtShort(p.tanggal_kirim).split(' ')[1]}</small></div>
            <div style="flex:1;min-width:0"><b>${esc(pelangganNama(state, p.pelanggan_id) || '–')}</b> · ${num(p.jumlah)} butir<br>
            <small class="muted">${esc(p.no_po)} · sisihkan mulai ${fmtShort(mulai)}${mulai <= today() ? ' <b style="color:var(--warn)">(sekarang)</b>' : ''}</small></div>
            <span class="badge ${diffDays(p.tanggal_kirim, today()) <= 1 ? 'warn' : 'info'}">${relDays(p.tanggal_kirim)}</span></div>`;
        }).join('') : empty('Belum ada pre-order aktif.', 'calendar')}
        ${po.aktif.length ? `<div class="calc-line" style="margin-top:10px"><span>Harus disimpan sekarang <b>${num(po.perluSisih)}</b> · stok <b>${num(po.stok)}</b></span><span class="badge ${po.cukup ? 'ok' : 'bad'}">${po.cukup ? 'Stok cukup' : 'Stok kurang'}</span></div>` : ''}
      </div>
      <div class="card"><div class="card-head"><h3>${icon('target')} Penjualan hari ini</h3></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px">
          <div><div style="font-size:26px;font-weight:800" class="num">${rp(hariIni[hariIni.length - 1].pendapatan)}</div>
          <div class="muted" style="font-size:13px">${num(hariIni[hariIni.length - 1].terjual)} butir · kemarin ${rp(hariIni[hariIni.length - 2].pendapatan)}</div></div>
          <div style="position:relative;width:110px;height:50px">${sparkSVG(hariIni.map((x) => x.pendapatan)).replace('class="k-art"', 'style="width:110px;height:50px"')}</div></div>
        ${target ? `<div style="margin-top:16px;padding:14px;border-radius:12px;background:var(--green-50)">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px"><span>Target ${fmtMonth(k)}: <b>${rp(target)}</b></span><b>${Math.min(999, Math.round((b.pendapatan / target) * 100))}%</b></div>
            <div class="progress"><i style="width:${Math.min(100, (b.pendapatan / target) * 100)}%"></i></div></div>
            <div class="alert ${b.pendapatan >= target ? 'info' : 'warn'}" style="margin-top:12px">💡 <span>${b.pendapatan >= target ? 'Target bulan ini tercapai. Mantap!' : `Kurang ${rp(target - b.pendapatan)} lagi untuk mencapai target.`}</span></div>`
          : `<button class="btn ghost sm" style="margin-top:14px" data-go="pengaturan">${icon('target')}Atur target bulanan</button>`}
      </div>
    </div>
  </div>`;

  // aksi
  el.querySelector('#dashMonth').onchange = (e) => { bulan = e.target.value || ym(today()); render(el, { go, user }); };
  el.querySelector('#qProd').onclick = () => formProduksi();
  el.querySelector('#qPO').onclick = () => formPO();
  el.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));

  // transaksi terbaru
  const tx = transaksiTerbaru(state, 7);
  el.querySelector('#recent').innerHTML = tx.length ? `<table class="tbl stack"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th class="r">Jumlah</th><th>Status</th></tr></thead><tbody>
    ${tx.map((t) => `<tr><td data-l="Tanggal">${fmtShort(t.tanggal)}</td>
      <td data-l="Jenis"><span class="type ${t.warna}"><i>${icon(t.tipe === 'Pengeluaran' ? 'wallet' : t.tipe === 'Pre-order' ? 'calendar' : t.tipe === 'Modal' || t.tipe === 'Prive' ? 'coins' : 'cart')}</i>${esc(t.tipe)}</span></td>
      <td data-l="Keterangan">${esc(t.ket)}</td><td data-l="Jumlah" class="r num">${t.jumlah ? rp(t.jumlah) : '–'}</td>
      <td data-l="Status">${badge(t.status)}</td></tr>`).join('')}</tbody></table>` : empty('Belum ada transaksi.');

  // grafik penjualan
  chart(el.querySelector('#cSales'), {
    type: 'bar',
    data: {
      labels: seri.map((x) => fmtShort(x.tanggal)),
      datasets: [
        { type: 'bar', label: 'Penjualan (Rp)', data: seri.map((x) => x.pendapatan), backgroundColor: COLORS.green, borderRadius: 6, yAxisID: 'y', order: 2, maxBarThickness: 26 },
        { type: 'line', label: 'Telur terjual (butir)', data: seri.map((x) => x.terjual), borderColor: COLORS.yolk, backgroundColor: COLORS.yolk, tension: .35, cubicInterpolationMode: 'monotone', pointRadius: 3, yAxisID: 'y1', order: 1 },
      ],
    },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false },
      tooltip: { callbacks: { label: (c) => c.datasetIndex === 0 ? ' ' + rp(c.raw) : ` ${num(c.raw)} butir` } } },
      scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
        y: { beginAtZero: true, ticks: { callback: (v) => (v >= 1000 ? num(v / 1000) + 'rb' : v) } },
        y1: { beginAtZero: true, position: 'right', grid: { display: false } } } },
  });

  // donut ke mana telur
  const parts = [
    ['Dijual', s.per['Jual'] || 0, COLORS.green], ['Konsumsi sendiri', s.per['Konsumsi Sendiri'] || 0, COLORS.yolk],
    ['Untuk keluarga', s.per['Untuk Keluarga'] || 0, COLORS.cream], ['Untuk tetangga', s.per['Untuk Tetangga'] || 0, COLORS.info],
    ['Hadiah / sedekah', s.per['Hadiah / Sedekah'] || 0, COLORS.orange],
    ['Pecah / rusak', (s.per['Pecah / Rusak (dari stok)'] || 0) + s.rusak, COLORS.danger],
  ].filter((p) => p[1] > 0);
  const tot = sum(parts, (p) => p[1]);
  el.querySelector('#lgEgg').innerHTML = parts.length ? parts.map(([l, v, c]) => `<div><i style="background:${c}"></i><span>${l}</span><b class="num">${tot ? Math.round((v / tot) * 100) : 0}%</b><span class="muted num">${num(v)}</span></div>`).join('')
    + `<div><i style="background:var(--border)"></i><span>Sisa stok akhir</span><b></b><span class="muted num">${num(s.akhir)}</span></div>` : '<span class="muted">Belum ada telur keluar.</span>';
  if (parts.length)
    chart(el.querySelector('#cEgg'), {
      type: 'doughnut',
      data: { labels: parts.map((p) => p[0]), datasets: [{ data: parts.map((p) => p[1]), backgroundColor: parts.map((p) => p[2]), borderWidth: 3, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface') }] },
      options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${num(c.raw)} butir` } } } },
      plugins: [{ id: 'center', afterDraw(c) { const { ctx, chartArea: a } = c; ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text');
        ctx.font = '800 20px ' + getComputedStyle(document.documentElement).getPropertyValue('--font'); ctx.fillText(num(tot), (a.left + a.right) / 2, (a.top + a.bottom) / 2 + 4);
        ctx.font = '500 11px sans-serif'; ctx.fillStyle = '#8a978f'; ctx.fillText('butir', (a.left + a.right) / 2, (a.top + a.bottom) / 2 + 20); ctx.restore(); } }],
    });
}

export function badge(s) {
  const m = { LUNAS: 'ok', 'BELUM LUNAS': 'bad', Dipesan: 'info', Dikirim: 'ok', Batal: 'bad', 'Kas Usaha': 'warn', 'Uang Pribadi': '', Kas: 'info', '-': '' };
  const label = { 'Kas Usaha': 'Dari amplop', 'Uang Pribadi': 'Uang pribadi', '-': 'Non-jual' }[s] || s;
  return `<span class="badge ${m[s] ?? ''}">${esc(label)}</span>`;
}
