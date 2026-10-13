import { $, $$, esc, n, KODE, NAMA, I, debounce, sak, ini } from './util.js';
import { S } from './data.js';

export const hooks = { refresh: () => { }, openNik: () => { } };
export const nav = { eid: '', scroll: {} };

// ===== laci samping (tombol kembali di HP menutup laci dulu) =====
let drawerOpen = false;
export const isDrawerOpen = () => drawerOpen;
export function openDrawer(html, { title = '', footer = '', onOpen } = {}) {
  const d = $('#drawer');
  d.innerHTML = `<div class="hd"><h2 style="flex:1">${title}</h2><button class="x" data-close>${I.x}</button></div><div class="bd">${html}</div>${footer ? `<div class="ft">${footer}</div>` : ''}`;
  d.classList.add('on'); $('#veil').classList.add('on');
  if (!drawerOpen) { drawerOpen = true; history.pushState({ ...(history.state || {}), drawer: true }, '', location.href); }
  $$('[data-close]', d).forEach(b => b.onclick = () => closeDrawer());
  onOpen && onOpen(d);
  return d;
}
export function closeDrawer(fromPop) {
  if (!drawerOpen) return;
  drawerOpen = false; $('#drawer').classList.remove('on'); $('#veil').classList.remove('on');
  if (!fromPop && history.state && history.state.drawer) history.back();
}
$('#veil').onclick = () => closeDrawer();

// ===== bar progres berlapis: kuota > input > rencana > diambil =====
export const lbar = (q, inp, rc, ak, kode) => {
  const base = Math.max(q, inp, 1);
  const w = v => Math.min(100, v / base * 100).toFixed(1);
  return `<div class="lb c-${kode}"><i class="l1" style="width:${w(inp)}%"></i><i class="l2" style="width:${w(rc)}%"></i><i class="l3" style="width:${w(ak)}%"></i></div>`;
};
export const barHtml = (val, tot, kode, label, extra = '') => {
  const over = val > tot && tot > 0;
  const p = tot > 0 ? Math.min(100, val / tot * 100) : 0;
  return `<div class="prow c-${kode}"><div class="h"><span><i class="dot"></i>${label}</span><span class="mut">${n(val)} / ${n(tot)} kg ${extra}</span></div>
  <div class="pg"><i class="${over ? 'o' : ''}" style="width:${p}%"></i></div></div>`;
};
export const berat = k => Number(S.byKode?.[k]?.berat_sak) || 50;
export const kgSak = (kg, k) => `${n(kg)} kg <span class="mut">(${n(sak(kg, berat(k)))} sak)</span>`;

// ===== pemilih petani (cari nama / NIK, hasil per data: poktan + komoditas) =====
export function pickerHtml(id = 'pk') {
  return `<div class="search" style="max-width:none"><span>${I.search}</span><input id="${id}" placeholder="Ketik nama / NIK petani…" autocomplete="off"><div class="sres hide" id="${id}R"></div></div>`;
}
export function wirePicker(root, id, onPick) {
  const inp = $('#' + id, root), res = $('#' + id + 'R', root); if (!inp) return;
  inp.focus();
  inp.oninput = debounce(() => {
    const q = inp.value.trim().toLowerCase(); if (q.length < 2) return res.classList.add('hide');
    const r = S.petani.filter(p => (p.nama || '').toLowerCase().includes(q) || (p.nik || '').includes(q)).slice(0, 30);
    res.innerHTML = r.map(p => `<div class="it" data-id="${p.id_data}"><b>${esc(p.nama)}</b> <span class="mut sm">${esc(p.poktan)} · ${esc(p.komoditas)} · ${esc(p.nik)}</span></div>`).join('') || '<div class="it mut">Tidak ditemukan</div>';
    res.classList.remove('hide');
    $$('.it[data-id]', res).forEach(e => e.onclick = () => onPick(S.pid[e.dataset.id]));
  });
}
export const ringkasPetani = p => `<div class="card" style="display:flex;gap:10px;align-items:center;padding:9px"><div class="av">${esc(ini(p.nama))}</div><div class="grow"><div class="b">${esc(p.nama)}</div><div class="mut sm">${esc(p.poktan)} · ${esc(p.komoditas)} · NIK ${esc(p.nik)}</div></div></div>`;
