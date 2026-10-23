// Halaman Pelanggan, daftar Invoice, dan tampilan Invoice (cetak & kirim WA)
import { state, update, remove } from '../store.js';
import { invoiceTotals, penjTotal, penjStatus, penjSisa, piutangPelanggan, pelangganNama, UTANG } from '../calc.js';
import { rp, num, esc, icon, today, ym, fmtDate, fmtShort, fmtMonth, waLink, waNumber, sum, LOGO_SVG } from '../util.js';
import { empty, toast, confirmDlg } from '../ui.js';
import { formPelanggan, formTagihan, hapus, lunasi } from '../actions.js';
import { badge } from './dashboard.js';

let q = '';
export function renderPelanggan(el, ctx) {
  const stats = (c) => {
    const j = state.penjualan.filter((p) => p.pelanggan_id === c.id && p.jenis === 'Jual');
    return { total: sum(j, penjTotal), butir: sum(j, (p) => p.jumlah), last: j.map((p) => p.tanggal).sort().pop(), piutang: piutangPelanggan(state, c.id), kali: j.length,
      po: state.po.filter((p) => p.pelanggan_id === c.id && p.status === 'Dipesan').length };
  };
  const list = state.pelanggan.filter((c) => !q || c.nama.toLowerCase().includes(q.toLowerCase())).map((c) => ({ c, s: stats(c) })).sort((a, b) => b.s.total - a.s.total);
  el.innerHTML = `<div class="page-head"><div><h1>Pelanggan</h1><p>${num(state.pelanggan.length)} pelanggan · urut dari belanja terbanyak</p></div>
    <div class="tools"><input class="input" placeholder="Cari nama…" value="${esc(q)}" data-q style="min-width:200px"><button class="btn ghost" data-tagihan>${icon('file')}Buat tagihan</button><button class="btn" data-new>${icon('plus')}Pelanggan</button></div></div>
    ${list.length ? `<div class="cust-grid">${list.map(({ c, s }) => `<div class="card" data-id="${c.id}" style="display:grid;gap:10px">
      <div style="display:flex;gap:12px;align-items:center"><div class="avatar" style="background:linear-gradient(135deg,var(--yolk),#E8A13A);color:#3D2F00">${esc(c.nama.trim()[0] || '?').toUpperCase()}</div>
        <div style="min-width:0;flex:1"><b style="font-size:16px">${esc(c.nama)}</b><div class="muted" style="font-size:12.5px">${esc(c.alamat || 'Alamat belum diisi')}</div></div>
        ${c.no_wa ? `<a class="btn wa sm icon" href="${waLink(c.no_wa, `Halo ${c.nama}, `)}" target="_blank" rel="noopener" title="Chat WhatsApp">${icon('wa')}</a>` : ''}</div>
      <div class="stat-list"><div><span class="muted">Total belanja</span><b class="num">${rp(s.total)}</b></div>
        <div><span class="muted">Telur dibeli</span><span class="num">${num(s.butir)} butir · ${num(s.kali)}×</span></div>
        <div><span class="muted">Terakhir beli</span><span>${s.last ? fmtDate(s.last) : '–'}</span></div>
        <div><span class="muted">Piutang</span>${s.piutang ? `<b style="color:var(--danger)">${rp(s.piutang)}</b>` : '<span class="badge ok">Lunas</span>'}</div>
        ${s.po ? `<div><span class="muted">PO aktif</span><span class="badge info">${s.po} pesanan</span></div>` : ''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-a="tagihan">${icon('file')}Tagihan</button><button class="btn ghost sm" data-a="edit">${icon('edit')}Ubah</button><button class="btn ghost sm icon" data-a="del" title="Hapus">${icon('trash')}</button></div>
    </div>`).join('')}</div>` : `<div class="card">${empty(q ? 'Tidak ada pelanggan dengan nama itu.' : 'Belum ada pelanggan. Pelanggan otomatis ditambahkan saat mencatat penjualan.', 'users')}</div>`}`;
  const inp = el.querySelector('[data-q]');
  inp.oninput = () => { q = inp.value; renderPelanggan(el, ctx); const i2 = el.querySelector('[data-q]'); i2.focus(); i2.setSelectionRange(q.length, q.length); };
  el.querySelector('[data-new]').onclick = () => formPelanggan();
  el.querySelector('[data-tagihan]').onclick = () => formTagihan(null, ctx.go);
  el.querySelectorAll('[data-id]').forEach((card) => {
    const c = state.pelanggan.find((x) => x.id === Number(card.dataset.id));
    card.querySelector('[data-a=tagihan]').onclick = () => formTagihan(c.id, ctx.go);
    card.querySelector('[data-a=edit]').onclick = () => formPelanggan(c);
    card.querySelector('[data-a=del]').onclick = () => hapus('pelanggan', c, `pelanggan "${c.nama}"`);
  });
}

// ---------------------------------------------------------------- Daftar invoice
const filt = { jenis: 'Semua', bulan: ym(today()) };
export function renderInvoiceList(el, ctx) {
  const rows = state.invoice.filter((v) => (filt.jenis === 'Semua' || v.jenis === filt.jenis) && ym(v.tanggal) === filt.bulan)
    .sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : b.id - a.id));
  el.innerHTML = `<div class="page-head"><div><h1>Invoice</h1><p>Nota dibuat otomatis untuk setiap penjualan ke pelanggan. Tagihan = rekap per periode.</p></div>
    <div class="tools"><input type="month" class="input" data-month value="${filt.bulan}"><button class="btn" data-new>${icon('plus')}Buat tagihan</button></div></div>
    <div class="card"><div class="toolbar"><div class="tabs">${['Semua', 'Nota', 'Tagihan'].map((j) => `<button data-j="${j}" class="${filt.jenis === j ? 'on' : ''}">${j}</button>`).join('')}</div></div>
    ${rows.length ? `<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>No. invoice</th><th>Jenis</th><th>Tanggal</th><th>Pelanggan</th><th class="r">Total</th><th class="r">Sisa tagihan</th><th>Terkirim</th><th></th></tr></thead><tbody>
    ${rows.map((v) => { const t = invoiceTotals(state, v); return `<tr data-id="${v.id}" style="cursor:pointer"><td data-l="No."><b>${esc(v.no_invoice)}</b></td><td data-l="Jenis"><span class="badge ${v.jenis === 'Tagihan' ? 'warn' : 'info'}">${v.jenis}</span></td>
      <td data-l="Tanggal">${fmtDate(v.tanggal)}</td><td data-l="Pelanggan">${esc(pelangganNama(state, v.pelanggan_id))}</td><td data-l="Total" class="r num">${rp(t.total)}</td>
      <td data-l="Sisa" class="r num">${t.sisa > 0 ? `<b style="color:var(--danger)">${rp(t.sisa)}</b>` : '<span class="badge ok">Lunas</span>'}</td>
      <td data-l="Terkirim">${v.dikirim_at ? `<span class="badge ok">${esc(v.dikirim_via || 'Ya')}</span>` : '<span class="faint">–</span>'}</td>
      <td class="acts"><button class="btn ghost sm">${icon('receipt')}Lihat</button></td></tr>`; }).join('')}</tbody></table></div>` : empty(`Belum ada invoice di ${fmtMonth(filt.bulan)}.`, 'receipt')}</div>`;
  el.querySelector('[data-month]').onchange = (e) => { filt.bulan = e.target.value || ym(today()); renderInvoiceList(el, ctx); };
  el.querySelector('[data-new]').onclick = () => formTagihan(null, ctx.go);
  el.querySelectorAll('[data-j]').forEach((b) => (b.onclick = () => { filt.jenis = b.dataset.j; renderInvoiceList(el, ctx); }));
  el.querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = () => ctx.go('invoice/' + tr.dataset.id)));
}

// ---------------------------------------------------------------- Tampilan invoice
export function waText(v) {
  const t = invoiceTotals(state, v);
  const set = state.pengaturan;
  const c = state.pelanggan.find((x) => x.id === v.pelanggan_id) || {};
  const lines = t.items.slice(0, 12).map((p) => `• ${fmtShort(p.tanggal)} — ${num(p.jumlah)} butir × ${rp(p.harga)} = ${rp(penjTotal(p))}${penjStatus(p) === 'BELUM LUNAS' ? ' (belum dibayar)' : ''}`);
  if (t.items.length > 12) lines.push(`• …dan ${t.items.length - 12} transaksi lain`);
  return [`Halo ${c.nama || ''}, berikut ${v.jenis === 'Nota' ? 'nota pembelian' : 'tagihan'} dari *${set.nama_usaha || 'Telur Kita'}*.`, '',
    `No: ${v.no_invoice}`, v.jenis === 'Tagihan' ? `Periode: ${fmtDate(v.periode_dari)} – ${fmtDate(v.periode_sampai)}` : `Tanggal: ${fmtDate(v.tanggal)}`, '', ...lines, '',
    `Total: ${num(t.butir)} butir = *${rp(t.total)}*`, ...(t.dp ? [`DP: ${rp(t.dp)}`] : []), `Sudah dibayar: ${rp(t.dibayar)}`, `*Sisa tagihan: ${rp(t.sisa)}*`,
    ...(t.sisa > 0 && set.info_pembayaran ? ['', `Pembayaran: ${set.info_pembayaran}`] : []), '', 'Terima kasih 🙏'].join('\n');
}

export function renderInvoice(el, ctx, id) {
  const v = state.invoice.find((x) => x.id === Number(id));
  if (!v) { el.innerHTML = `<div class="card">${empty('Invoice tidak ditemukan.', 'receipt')}<div style="text-align:center"><button class="btn ghost" data-back>Kembali</button></div></div>`; el.querySelector('[data-back]').onclick = () => ctx.go('invoice'); return; }
  const t = invoiceTotals(state, v);
  const set = state.pengaturan;
  const c = state.pelanggan.find((x) => x.id === v.pelanggan_id) || {};
  const lunas = t.sisa <= 0;
  el.innerHTML = `<div class="inv-actions">
      <button class="btn ghost" data-back>← Kembali</button>
      <button class="btn ghost" data-print>${icon('print')}Cetak / PDF</button>
      <a class="btn wa" data-wa href="${c.no_wa ? waLink(c.no_wa, waText(v)) : 'https://wa.me/?text=' + encodeURIComponent(waText(v))}" target="_blank" rel="noopener">${icon('wa')}Kirim WhatsApp</a>
      ${!lunas && t.items.some((p) => penjStatus(p) === 'BELUM LUNAS') ? `<button class="btn" data-lunas>${icon('check')}Tandai lunas</button>` : ''}
      ${v.jenis === 'Tagihan' ? `<button class="btn ghost" data-del>${icon('trash')}Hapus</button>` : ''}
    </div>
    ${!c.no_wa ? `<div class="alert warn" style="max-width:820px;margin:0 auto 14px">${icon('info')}<span>No. WhatsApp ${esc(c.nama || 'pelanggan')} belum diisi — tombol WA akan meminta kamu memilih kontak.</span></div>` : ''}
    <div id="print-area"><div class="inv-paper">
      <div class="inv-head"><div class="brand">${LOGO_SVG}<div><b>${esc(set.nama_usaha || 'Telur Kita')}</b><small style="color:#66766D">${esc(set.nama_pemilik ? 'Pemilik: ' + set.nama_pemilik : 'Telur ayam segar')}</small></div></div>
        <div class="inv-title"><h2>${v.jenis === 'Nota' ? 'NOTA' : 'INVOICE'}</h2><div style="font-weight:700">${esc(v.no_invoice)}</div><div style="margin-top:8px"><span class="stamp ${lunas ? '' : 'unpaid'}">${lunas ? 'LUNAS' : 'BELUM LUNAS'}</span></div></div></div>
      <div class="inv-meta"><dl><dt>Kepada</dt><dd>${esc(c.nama || '–')}</dd><dt>No. WA</dt><dd>${esc(c.no_wa || '–')}</dd><dt>Alamat</dt><dd>${esc(c.alamat || '–')}</dd></dl>
        <dl><dt>Tanggal</dt><dd>${fmtDate(v.tanggal)}</dd>${v.jenis === 'Tagihan' ? `<dt>Periode</dt><dd>${fmtDate(v.periode_dari)} – ${fmtDate(v.periode_sampai)}</dd>` : ''}<dt>Jenis</dt><dd>${v.jenis === 'Nota' ? 'Nota penjualan' : 'Tagihan periode'}</dd></dl></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th class="xs-hide">No</th><th>Tanggal</th><th>Keterangan</th><th class="r">Butir</th><th class="r xs-hide">Harga</th><th class="r">Subtotal</th><th class="xs-hide">Status</th></tr></thead><tbody>
        ${t.items.length ? t.items.map((p, i) => `<tr><td class="xs-hide">${i + 1}</td><td>${fmtDate(p.tanggal)}</td><td>Telur ayam${p.po_id ? ' (pre-order)' : ''}${p.catatan ? ` <span style="color:#66766D">· ${esc(p.catatan)}</span>` : ''}</td>
          <td class="r num">${num(p.jumlah)}</td><td class="r num xs-hide">${rp(p.harga)}</td><td class="r num">${rp(penjTotal(p))}</td><td class="xs-hide">${penjStatus(p) === 'LUNAS' ? 'Lunas' : 'Belum'}</td></tr>`).join('')
          : `<tr><td colspan="7" style="text-align:center;color:#66766D;padding:24px">Tidak ada penjualan dalam periode ini.</td></tr>`}</tbody></table></div>
      <div class="inv-total"><div><span>Total (${num(t.butir)} butir)</span><b>${rp(t.total)}</b></div>${t.dp ? `<div><span>DP pre-order</span><span>−${rp(t.dp)}</span></div>` : ''}
        <div><span>Sudah dibayar</span><span>−${rp(t.dibayar)}</span></div><div class="due"><span>Sisa tagihan</span><span>${rp(t.sisa)}</span></div></div>
      <div class="inv-foot">${t.dpAktif ? `<p>Catatan: DP pre-order yang sudah diterima untuk pesanan yang belum dikirim: <b>${rp(t.dpAktif)}</b>.</p>` : ''}
        ${set.info_pembayaran ? `<p><b>Pembayaran:</b> ${esc(set.info_pembayaran)}</p>` : ''}<p style="color:#245B3A;font-style:italic">Terima kasih atas kepercayaan Anda 🙏</p></div>
    </div></div>`;
  el.querySelector('[data-back]').onclick = () => history.length > 1 ? history.back() : ctx.go('invoice');
  el.querySelector('[data-print]').onclick = () => window.print();
  el.querySelector('[data-wa]').addEventListener('click', () => { update('invoice', v.id, { dikirim_via: 'WhatsApp', dikirim_at: new Date().toISOString() }).catch(() => {}); });
  const l = el.querySelector('[data-lunas]');
  if (l) l.onclick = () => { const p = t.items.find((x) => penjStatus(x) === 'BELUM LUNAS'); if (p) lunasi(p); };
  const d = el.querySelector('[data-del]');
  if (d) d.onclick = async () => { if (await confirmDlg(`Hapus tagihan ${v.no_invoice}? Penjualannya tidak ikut terhapus.`, { ok: 'Hapus', danger: true })) { await remove('invoice', v.id); toast('Tagihan dihapus'); ctx.go('invoice'); } };
}
