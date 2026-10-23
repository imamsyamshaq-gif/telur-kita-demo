// Halaman Pre-order
import { state, isDemo } from '../store.js';
import { ringkasPO, mulaiSisih, pelangganNama, poTotal } from '../calc.js';
import { rp, num, esc, icon, today, fmtDate, fmtLong, relDays, diffDays, addDays, sum, waLink } from '../util.js';
import { empty } from '../ui.js';
import { formPO, kirimPO, batalPO, tolakPO, hapus } from '../actions.js';

let tab = 'Dipesan';
const gcal = (p) => {
  const nama = pelangganNama(state, p.pelanggan_id);
  const d = p.tanggal_kirim.replace(/-/g, '');
  const d2 = addDays(p.tanggal_kirim, 1).replace(/-/g, '');
  const txt = `Kirim ${p.no_po}: ${p.jumlah} butir — ${nama}`;
  const det = `Pre-order ${state.pengaturan.nama_usaha || ''}\nPelanggan: ${nama}\nJumlah: ${p.jumlah} butir\nTotal: ${rp(poTotal(p))} (DP ${rp(p.dp)})\nMulai sisihkan telur: ${fmtDate(mulaiSisih(state, p))}\n${p.catatan || ''}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(txt)}&dates=${d}/${d2}&details=${encodeURIComponent(det)}`;
};

export function render(el, ctx) {
  const r = ringkasPO(state);
  const key = (p) => p.tanggal_kirim || p.tanggal_pesan || '';
  const rows = state.po.filter((p) => p.status === tab).sort((a, b) => (tab === 'Dipesan' ? (key(a) < key(b) ? -1 : 1) : key(a) < key(b) ? 1 : -1));
  const baru = state.po.filter((p) => p.status === 'Menunggu').sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const count = (s) => state.po.filter((p) => p.status === s).length;
  el.innerHTML = `<div class="page-head"><div><h1>Pre-order</h1><p>Pesanan dengan tanggal kirim. Jadwal otomatis masuk Google Calendar (±5 menit setelah disimpan).</p></div>
    <div class="tools"><button class="btn" data-new>${icon('plus')}PO baru</button></div></div>
    <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
      <div class="kpi yolk" style="min-height:0"><div class="k-top">PO aktif</div><div class="k-val">${num(r.aktif.length)}</div><div class="k-sub">${num(r.totalDipesan)} butir dipesan</div></div>
      <div class="kpi ${r.cukup ? 'green' : 'red'}" style="min-height:0"><div class="k-top">Harus disimpan sekarang</div><div class="k-val">${num(r.perluSisih)} <small style="font-size:13px">butir</small></div><div class="k-sub">Stok ${num(r.stok)} · ${r.cukup ? 'cukup ✔' : 'kurang — tahan jualan biasa'}</div></div>
      <div class="kpi cream" style="min-height:0"><div class="k-top">DP dipegang</div><div class="k-val">${rp(r.dpDipegang)}</div><div class="k-sub">Uang titipan, belum pendapatan</div></div>
      <div class="kpi green" style="min-height:0"><div class="k-top">Produksi rata-rata</div><div class="k-val">${num(state.pengaturan.produksi_harian)} <small style="font-size:13px">/hari</small></div><div class="k-sub">Dasar hitung tanggal mulai sisihkan</div></div>
    </div>
    ${baru.length ? `<div class="card" style="margin-bottom:18px;border-color:var(--yolk);background:var(--yolk-50)">
      <div class="card-head"><h3>${icon('bell')} Pesanan baru dari pelanggan (${baru.length})</h3></div>
      <p class="muted" style="margin:-6px 0 12px;font-size:13px">Masuk dari halaman pesan pelanggan. Sepakati tanggal kirim lewat WhatsApp, lalu klik <b>Terima</b>. Pesanan belum mengurangi stok sebelum diterima.</p>
      <div class="po-grid">${baru.map((p) => cardBaru(p)).join('')}</div></div>` : ''}
    <div class="toolbar"><div class="tabs">${['Dipesan', 'Dikirim', 'Batal', 'Ditolak'].map((s) => `<button data-tab="${s}" class="${tab === s ? 'on' : ''}">${s === 'Dipesan' ? 'Aktif' : s} (${count(s)})</button>`).join('')}</div></div>
    ${rows.length ? `<div class="po-grid">${rows.map((p) => card(p)).join('')}</div>` : `<div class="card">${empty(tab === 'Dipesan' ? 'Belum ada pre-order aktif. Klik "PO baru" untuk mencatat pesanan.' : 'Belum ada data.', 'calendar')}</div>`}`;

  el.querySelector('[data-new]').onclick = () => formPO();
  el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(el, ctx); }));
  el.querySelectorAll('[data-po]').forEach((c) => {
    const p = state.po.find((x) => x.id === Number(c.dataset.po));
    const on = (a, f) => { const b = c.querySelector(`[data-a=${a}]`); if (b) b.onclick = f; };
    on('kirim', () => kirimPO(p)); on('edit', () => formPO(p)); on('batal', () => batalPO(p));
    on('terima', () => formPO(p, { terima: true })); on('tolak', () => tolakPO(p));
    on('del', () => hapus('po', p, `${p.no_po}`));
    on('nota', () => { const pj = state.penjualan.find((x) => x.po_id === p.id); const inv = pj && state.invoice.find((v) => v.penjualan_id === pj.id); if (inv) ctx.go('invoice/' + inv.id); });
  });
}

function cardBaru(p) {
  const total = Number(p.jumlah) * Number(p.harga || 0);
  const salam = `Halo ${p.nama_pemesan || ''}, terima kasih sudah memesan ${p.jumlah} butir telur (${p.no_po}) di ${state.pengaturan.nama_usaha || 'Telur Kita'}. `;
  return `<div class="po-card" data-po="${p.id}" style="background:var(--surface)">
    <div class="top"><div><small class="muted">${esc(p.no_po)} · ${fmtDate(p.tanggal_pesan)}</small><div style="font-weight:800;font-size:16px">${esc(p.nama_pemesan || '–')}</div>
      <small class="muted">${esc(p.wa_pemesan || '')}</small></div>
      ${p.sudah_bayar ? `<span class="badge ok">Bilang sudah bayar · ${esc(p.sudah_bayar)}</span>` : '<span class="badge warn">Menunggu konfirmasi</span>'}</div>
    <div style="font-size:22px;font-weight:800">${num(p.jumlah)} <small style="font-size:13px;font-weight:600" class="muted">butir · ${rp(total)}</small></div>
    <div class="meta"><span>${icon('calendar')} Kirim <b>${p.tanggal_kirim ? fmtLong(p.tanggal_kirim) : 'menyesuaikan'}</b></span></div>
    ${p.catatan ? `<div class="muted" style="font-size:13px">📝 ${esc(p.catatan)}</div>` : ''}
    <div class="acts" style="justify-content:flex-end;flex-wrap:wrap">
      ${p.wa_pemesan ? `<a class="btn ghost sm" href="${waLink(p.wa_pemesan, salam)}" target="_blank" rel="noopener">${icon('wa')}Chat</a>` : ''}
      <button class="btn ghost sm" data-a="tolak">Tolak</button><button class="btn sm" data-a="terima">${icon('check')}Terima</button></div>
  </div>`;
}

function card(p) {
  if (!p.tanggal_kirim) p = { ...p, tanggal_kirim: p.tanggal_pesan };
  const nama = pelangganNama(state, p.pelanggan_id) || p.nama_pemesan || '–';
  const mulai = mulaiSisih(state, p);
  const dKirim = diffDays(p.tanggal_kirim, today());
  const urg = p.status === 'Dipesan' && dKirim <= 1;
  const sync = isDemo() ? '' : p.calendar_event_id ? `<span class="badge ok">${icon('calendar')} Tersinkron</span>` : p.status === 'Dipesan' ? `<span class="badge">Menunggu sinkron kalender</span>` : '';
  return `<div class="po-card" data-po="${p.id}" style="${urg ? 'border-color:var(--yolk);box-shadow:0 0 0 3px rgba(255,200,61,.25)' : ''}">
    <div class="top"><div><small class="muted">${esc(p.no_po)}</small><div style="font-weight:800;font-size:16px">${esc(nama)}</div></div>
      <span class="badge ${p.status === 'Dipesan' ? (dKirim < 0 ? 'bad' : urg ? 'warn' : 'info') : p.status === 'Dikirim' ? 'ok' : 'bad'}">${p.status === 'Dipesan' ? relDays(p.tanggal_kirim) : p.status}</span></div>
    <div style="font-size:22px;font-weight:800">${num(p.jumlah)} <small style="font-size:13px;font-weight:600" class="muted">butir · ${rp(poTotal(p))}</small></div>
    <div class="meta"><span>${icon('calendar')} Kirim <b>${fmtLong(p.tanggal_kirim)}</b></span>
      ${p.status === 'Dipesan' ? `<span>${icon('box')} Sisihkan mulai <b>${fmtDate(mulai)}</b>${mulai <= today() ? ' <b style="color:var(--warn)">(sekarang)</b>' : ''}</span>` : ''}
      <span>DP <b>${rp(p.dp)}</b> · sisa ${rp(poTotal(p) - Number(p.dp || 0))}</span>
      ${p.status !== 'Dipesan' && p.tanggal_selesai ? `<span>${p.status} ${fmtDate(p.tanggal_selesai)}${p.status === 'Batal' && Number(p.dp) ? (p.dp_dikembalikan === false ? ' · DP hangus' : ' · DP dikembalikan') : ''}</span>` : ''}</div>
    ${p.catatan ? `<div class="muted" style="font-size:13px">📝 ${esc(p.catatan)}</div>` : ''}
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">${sync}
    <div class="acts">${p.status === 'Dipesan' ? `<button class="btn sm" data-a="kirim">${icon('send')}Kirim</button>
      <a class="btn ghost sm" href="${gcal(p)}" target="_blank" rel="noopener" title="Tambah manual ke Google Calendar">${icon('calendar')}</a>
      <button class="btn ghost sm icon" data-a="edit" title="Ubah">${icon('edit')}</button><button class="btn ghost sm" data-a="batal">Batal</button>`
      : p.status === 'Dikirim' ? `<button class="btn ghost sm" data-a="nota">${icon('receipt')}Nota</button>` : `<button class="btn ghost sm icon" data-a="del" title="Hapus">${icon('trash')}</button>`}</div></div>
  </div>`;
}
