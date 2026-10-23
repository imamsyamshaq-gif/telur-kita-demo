// Komponen tampilan: dialog form, konfirmasi, toast, grafik, ilustrasi
import { esc, icon } from './util.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------------------------------------------------------------- Toast
export function toast(msg, err = false) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.innerHTML = icon(err ? 'alert' : 'check') + `<span>${esc(msg)}</span>`;
  box.append(t);
  setTimeout(() => t.remove(), err ? 6000 : 3200);
}

// ---------------------------------------------------------------- Dialog dasar
export function dialog({ title, body, foot = '', wide = false, onOpen, cls = '' }) {
  const d = document.createElement('dialog');
  if (wide) d.style.width = 'min(900px, calc(100vw - 24px))';
  d.className = cls;
  d.innerHTML = `<div class="dlg-head"><h3>${esc(title)}</h3><button class="icon-btn" data-x aria-label="Tutup">${icon('x')}</button></div>
    <div class="dlg-body">${body}</div>${foot ? `<div class="dlg-foot">${foot}</div>` : ''}`;
  document.body.append(d);
  d.querySelector('[data-x]').onclick = () => d.close();
  d.addEventListener('close', () => setTimeout(() => d.remove(), 50));
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.showModal();
  onOpen && onOpen(d);
  return d;
}

export function confirmDlg(text, { ok = 'Ya, lanjutkan', danger = false, title = 'Konfirmasi' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const d = dialog({ title, body: `<p style="margin:0">${text}</p>`,
      foot: `<button class="btn ghost" data-no>Batal</button><button class="btn ${danger ? 'danger' : ''}" data-ok>${esc(ok)}</button>` });
    d.querySelector('[data-no]').onclick = () => d.close();
    d.querySelector('[data-ok]').onclick = () => { done = true; d.close(); resolve(true); };
    d.addEventListener('close', () => !done && resolve(false));
  });
}

// ---------------------------------------------------------------- Form
const optList = (o) => (o || []).map((x) => (typeof x === 'object' ? x : { value: x, label: x }));
function fieldHTML(f, v) {
  const id = 'f_' + f.name;
  const req = f.required ? 'required' : '';
  const val = v ?? f.default ?? '';
  let input = '';
  if (f.type === 'select')
    input = `<select id="${id}" name="${f.name}" ${req}>${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}${optList(f.options)
      .map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(val) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  else if (f.type === 'seg')
    input = `<div class="seg" role="radiogroup">${optList(f.options).map((o) =>
      `<label><input type="radio" name="${f.name}" value="${esc(o.value)}" ${String(o.value) === String(val) ? 'checked' : ''}><span>${esc(o.label)}</span></label>`).join('')}</div>`;
  else if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.name}" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
  else if (f.type === 'checkbox')
    input = `<label style="display:flex;gap:8px;align-items:center;font-weight:500"><input type="checkbox" name="${f.name}" ${val ? 'checked' : ''} style="width:18px;height:18px;min-height:0">${esc(f.text || '')}</label>`;
  else if (f.type === 'datalist')
    input = `<input id="${id}" name="${f.name}" list="${id}_l" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}" ${req} autocomplete="off"><datalist id="${id}_l">${optList(f.options).map((o) => `<option value="${esc(o.value)}">`).join('')}</datalist>`;
  else
    input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(val)}" ${req} ${f.min != null ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} placeholder="${esc(f.placeholder || '')}" ${f.type === 'number' ? 'inputmode="decimal"' : ''}>`;
  return `<div class="field ${f.full || f.type === 'textarea' || f.type === 'seg' ? 'full' : ''}" data-field="${f.name}">
    ${f.label ? `<label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>` : ''}${input}${f.help ? `<span class="help">${f.help}</span>` : ''}</div>`;
}
export function readForm(form, fields) {
  const v = {};
  for (const f of fields) {
    if (f.type === 'seg') v[f.name] = form.querySelector(`[name="${f.name}"]:checked`)?.value ?? null;
    else if (f.type === 'checkbox') v[f.name] = !!form.querySelector(`[name="${f.name}"]`)?.checked;
    else {
      const el = form.querySelector(`[name="${f.name}"]`);
      let x = el ? el.value.trim() : null;
      if (x === '') x = null;
      if (f.type === 'number' && x != null) x = Number(String(x).replace(',', '.'));
      v[f.name] = x;
    }
  }
  return v;
}

export function openForm({ title, fields, values = {}, submit = 'Simpan', onSubmit, onChange, note = '', wide = false }) {
  const body = `${note ? `<div class="alert info" style="margin-bottom:14px">${icon('info')}<span>${note}</span></div>` : ''}
    <form class="form" novalidate>${fields.map((f) => fieldHTML(f, values[f.name])).join('')}<div class="calc-line hide" data-calc></div></form>`;
  const d = dialog({ title, wide, body, foot: `<button class="btn ghost" data-no type="button">Batal</button><button class="btn" data-ok type="button">${icon('check')}${esc(submit)}</button>` });
  const form = d.querySelector('form');
  const refresh = () => {
    const v = readForm(form, fields);
    for (const f of fields) if (f.show) form.querySelector(`[data-field="${f.name}"]`).classList.toggle('hide', !f.show(v));
    if (onChange) {
      const out = onChange(v, form);
      const c = form.querySelector('[data-calc]');
      c.classList.toggle('hide', !out);
      if (out) c.innerHTML = out;
    }
  };
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  refresh();
  setTimeout(() => form.querySelector('input:not([type=radio]):not([type=checkbox]), select')?.focus(), 60);
  d.querySelector('[data-no]').onclick = () => d.close();
  const okBtn = d.querySelector('[data-ok]');
  const go = async () => {
    const v = readForm(form, fields);
    for (const f of fields) {
      const hidden = f.show && !f.show(v);
      if (f.required && !hidden && (v[f.name] == null || v[f.name] === '')) {
        toast(`"${f.label}" wajib diisi`, true);
        form.querySelector(`[name="${f.name}"]`)?.focus();
        return;
      }
      if (f.type === 'number' && v[f.name] != null && isNaN(v[f.name])) { toast(`"${f.label}" harus angka`, true); return; }
    }
    okBtn.disabled = true;
    try {
      await onSubmit(v);
      d.close();
    } catch (e) {
      toast(e.message || String(e), true);
    } finally { okBtn.disabled = false; }
  };
  okBtn.onclick = go;
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); go(); } });
  return d;
}

// ---------------------------------------------------------------- Kosong
export const empty = (text, ic = 'egg') => `<div class="empty">${icon(ic)}<div>${text}</div></div>`;

// ---------------------------------------------------------------- Grafik
const charts = [];
export function destroyCharts() { while (charts.length) charts.pop().destroy(); }
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export function chart(canvas, cfg) {
  if (!window.Chart || !canvas) return null;
  const C = window.Chart;
  C.defaults.font.family = cssVar('--font') || 'sans-serif';
  C.defaults.color = cssVar('--muted');
  C.defaults.borderColor = cssVar('--border');
  const c = new C(canvas, cfg);
  charts.push(c);
  return c;
}
export const COLORS = { green: '#4CAF50', dark: '#245B3A', yolk: '#FFC83D', cream: '#F3D58A', info: '#4A90A4', danger: '#E76F51', orange: '#E8A13A', grey: '#B9C4BC' };

// ---------------------------------------------------------------- Ilustrasi (SVG buatan sendiri)
export const basketSVG = (cls = '') => `<svg class="${cls}" viewBox="0 0 320 230" aria-hidden="true">
  <ellipse cx="160" cy="214" rx="132" ry="12" fill="#245B3A" opacity=".1"/>
  <path d="M40 150c-28-8-36-40-20-62 10 22 28 34 52 36" fill="#4CAF50"/><path d="M52 160c-30 4-48-18-46-42 16 16 34 22 58 18" fill="#3E9B43"/>
  <path d="M282 150c28-8 36-40 20-62-10 22-28 34-52 36" fill="#4CAF50"/><path d="M268 160c30 4 48-18 46-42-16 16-34 22-58 18" fill="#3E9B43"/>
  <ellipse cx="104" cy="104" rx="30" ry="38" fill="#F2C48D"/><ellipse cx="160" cy="92" rx="32" ry="40" fill="#F7D3A6"/><ellipse cx="216" cy="104" rx="30" ry="38" fill="#EDB97E"/>
  <ellipse cx="132" cy="118" rx="28" ry="35" fill="#FBE1BF"/><ellipse cx="190" cy="120" rx="28" ry="35" fill="#F4C995"/>
  <ellipse cx="150" cy="80" rx="7" ry="11" fill="#fff" opacity=".55"/><ellipse cx="96" cy="92" rx="6" ry="10" fill="#fff" opacity=".45"/>
  <path d="M58 132h204l-20 72a14 14 0 0 1-13 10H91a14 14 0 0 1-13-10Z" fill="#B7793E"/>
  <path d="M58 132h204l-3 12H61Z" fill="#8F5A28"/>
  <g stroke="#9A6430" stroke-width="3" opacity=".7"><path d="M70 160h180M76 182h168M84 202h152"/><path d="M100 140l8 70M140 140l3 72M180 140l-3 72M220 140l-8 70"/></g>
  <path d="M56 132c0-50 46-86 104-86s104 36 104 86" fill="none" stroke="#8F5A28" stroke-width="8" stroke-linecap="round"/>
</svg>`;

export const eggArt = () => `<svg viewBox="0 0 60 60" class="k-art" aria-hidden="true"><circle cx="30" cy="30" r="28" fill="#FFE7A0"/><path d="M30 12c-7 0-12 10-12 18a12 12 0 0 0 24 0c0-8-5-18-12-18Z" fill="#F3A93B"/><ellipse cx="25" cy="22" rx="3" ry="5" fill="#fff" opacity=".6"/></svg>`;
export const boxArt = () => `<svg viewBox="0 0 60 60" class="k-art" aria-hidden="true"><path d="M8 22 30 12l22 10v24L30 56 8 46Z" fill="#E8A13A"/><path d="M8 22l22 10 22-10M30 32v24" stroke="#C07B1F" stroke-width="2" fill="none"/><ellipse cx="22" cy="16" rx="5" ry="6" fill="#F7D3A6"/><ellipse cx="34" cy="14" rx="5" ry="6" fill="#FBE1BF"/></svg>`;
export const barsArt = (col = '#E76F51') => `<svg viewBox="0 0 60 60" class="k-art" aria-hidden="true"><rect x="8" y="34" width="10" height="20" rx="3" fill="${col}" opacity=".55"/><rect x="25" y="24" width="10" height="30" rx="3" fill="${col}" opacity=".75"/><rect x="42" y="14" width="10" height="40" rx="3" fill="${col}"/></svg>`;
export const envelopeArt = () => `<svg viewBox="0 0 60 60" class="k-art" aria-hidden="true"><rect x="6" y="16" width="48" height="32" rx="5" fill="#fff" opacity=".85"/><path d="M6 20l24 16 24-16" stroke="#C99400" stroke-width="3" fill="none"/><circle cx="46" cy="44" r="10" fill="#4CAF50"/><path d="M42 44l3 3 6-6" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;
export function sparkSVG(values, col = '#4CAF50') {
  const v = values.length ? values : [0];
  const max = Math.max(...v, 1), min = Math.min(...v, 0);
  const pts = v.map((x, i) => `${(i / Math.max(1, v.length - 1)) * 76 + 2},${46 - ((x - min) / (max - min || 1)) * 40}`).join(' ');
  return `<svg viewBox="0 0 80 50" class="k-art" style="width:80px;height:50px" aria-hidden="true"><polyline points="2,48 ${pts} 78,48" fill="${col}" opacity=".15"/><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}
