import { $, $$, esc, n, rp, KODE, NAMA, tgl, tglJam, jam, ini, pct, uid, toast, I, debounce } from './util.js';
import { sb, S, reloadTx, isMgr } from './data.js';

export const hooks = { refresh: () => { } };

// ===== laci samping =====
export function openDrawer(html, { title = '', footer = '', onOpen } = {}) {
  const d = $('#drawer');
  d.innerHTML = `<div class="hd"><h2 style="flex:1">${title}</h2><button class="x" data-close>${I.x}</button></div><div class="bd">${html}</div>${footer ? `<div class="ft">${footer}</div>` : ''}`;
  d.classList.add('on'); $('#veil').classList.add('on');
  $$('[data-close]', d).forEach(b => b.onclick = closeDrawer);
  onOpen && onOpen(d);
  return d;
}
export function closeDrawer() { $('#drawer').classList.remove('on'); $('#veil').classList.remove('on'); }
$('#veil').onclick = closeDrawer;

export const barHtml = (val, tot, kode, label, extra = '') => {
  const over = val > tot && tot > 0;
  return `<div class="prow c-${kode}"><div class="h"><span><i class="dot"></i>${label}</span><span class="mut">${n(val)} / ${n(tot)} kg ${extra}</span></div>
  <div class="pg"><i class="${over ? 'o' : ''}" style="width:${pct(val, tot)}%"></i></div></div>`;
};

async function rows(table, id_data) {
  const { data, error } = await sb.from(table).select('*').eq('id_data', id_data).order('tanggal_waktu', { ascending: false });
  if (error) { toast(error.message); return []; }
  return data;
}

// ===== panel petani =====
export async function openPetani(id) {
  const p = S.pid[id]; if (!p) return;
  const body = () => {
    const bd = KODE.map(k => [k, p['bd_' + k]]).filter(x => x[1] > 0);
    const bf = KODE.map(k => [k, p['bf_' + k]]).filter(x => x[1] > 0);
    return `
    <div class="card" style="display:flex;gap:10px;align-items:center"><div class="av">${esc(ini(p.nama))}</div>
      <div class="grow"><div class="b">${esc(p.nama)}</div><div class="mut sm">${esc(p.poktan || '')} · ${esc(p.komoditas || '')} · ${n(p.luas_lahan)} ha</div><div class="mut sm">NIK ${esc(p.nik || '-')}</div><div class="mut sm">${esc(p.alamat || '')}</div></div></div>
    <div class="sec"><h3>Kuota & tersalur</h3><span class="mut sm">Total ${rp(p.total_rp)}</span></div>
    <div class="card">${KODE.filter(k => p['kuota_' + k] > 0 || p['t_' + k] > 0).map(k => barHtml(p['t_' + k], p['kuota_' + k], k, NAMA[k], `· sisa <b>${n(p['sisa_' + k])}</b>`)).join('') || '<span class="mut">Tidak ada kuota</span>'}</div>
    <div class="grid g2" style="margin-top:12px;grid-template-columns:1fr 1fr">
      <div class="card"><h3>Belum diambil</h3>${bd.length ? bd.map(([k, v]) => `<div class="c-${k}"><i class="dot"></i>${NAMA[k]} <b>${n(v)}</b> kg</div>`).join('') : '<span class="ok">Semua sudah diambil</span>'}
        ${bd.length && !'' ? '' : ''}${bd.length ? `<button class="btn sm" style="margin-top:8px" id="pDiambil">${I.truck} Tandai diambil</button>` : ''}</div>
      <div class="card"><h3>Belum difoto/dicatat</h3>${bf.length ? bf.map(([k, v]) => `<div class="c-${k}"><i class="dot"></i>${NAMA[k]} <b>${n(v)}</b> kg</div>`).join('') : '<span class="ok">Semua sudah tercatat</span>'}
        ${bf.length ? `<button class="btn sm" style="margin-top:8px" id="pFoto">${I.camera} Tandai tercatat</button>` : ''}</div></div>
    <div class="sec"><h3>Riwayat tebus</h3></div><div class="card list" id="pRiw"><span class="mut">Memuat…</span></div>
    ${p.keterangan ? `<div class="sec"><h3>Catatan</h3></div><div class="card">${esc(p.keterangan)}</div>` : ''}`;
  };
  const d = openDrawer(body(), {
    title: 'Data petani',
    footer: `<button class="btn" data-close>Tutup</button><button class="btn pri" id="pJual">${I.plus} Tambah penjualan</button>`,
    onOpen: async d => {
      $('#pJual', d).onclick = () => openJual(id);
      const bind = () => {
        const a = $('#pDiambil', d), b = $('#pFoto', d);
        if (a) a.onclick = () => catat(id, 'diambil');
        if (b) b.onclick = () => catat(id, 'foto');
      }; bind();
      const pen = S.pen.filter(x => x.id_data === id);
      $('#pRiw', d).innerHTML = pen.length ? pen.map(x => `<div class="li" data-no="${esc(x.no_pesanan)}"><div class="grow"><div class="t b">${rp(x.total_harga)}</div><div class="mut sm">${tglJam(x.tanggal_waktu)} · ${n(x.rencana)} kg</div></div>
        ${x.rencana > x.diambil ? '<span class="tag warn">belum diambil</span>' : x.diambil > x.tercatat ? '<span class="tag bad">belum difoto</span>' : '<span class="tag ok">selesai</span>'}
        <button class="btn sm" data-print="${esc(x.no_pesanan)}">${I.print}</button></div>`).join('') : '<span class="mut">Belum ada penjualan</span>';
      $$('[data-print]', d).forEach(b => b.onclick = e => { e.stopPropagation(); cetakNota(b.dataset.print); });
    },
  });
}

// ===== tandai diambil / tercatat (per petani) =====
async function catat(id_data, jenis) {
  const p = S.pid[id_data];
  const last = S.pen.find(x => x.id_data === id_data); // paling baru
  if (!last) return toast('Belum ada penjualan untuk petani ini');
  const key = jenis === 'diambil' ? 'bd_' : 'bf_';
  const items = KODE.map(k => [k, p[key + k]]).filter(x => x[1] > 0);
  if (!items.length) return;
  const now = new Date().toISOString();
  let error;
  if (jenis === 'diambil') {
    const recs = items.map(([k, v], i) => { const pr = S.byKode[k]; return { id_diambil: uid() + i, no_pesanan: last.no_pesanan, id_produk: pr.id, id_data, nomor_urut: String(i + 1), tanggal_waktu: now, nama_petani: p.nama, nik: p.nik, nama_poktan: p.poktan, komoditas: p.komoditas, nama_produk: pr.nama, jumlah: v, harga_satuan: pr.harga_jual, subtotal: v * pr.harga_jual }; });
    ({ error } = await sb.from('diambil').insert(recs));
  } else {
    const rec = { id_kg: uid(), no_pesanan: last.no_pesanan, tanggal_waktu: now, id_data, nama_petani: p.nama, nik: p.nik, nama_poktan: p.poktan, komoditas: p.komoditas, urea: 0, phonska: 0, organik: 0, za: 0 };
    items.forEach(([k, v]) => rec[k] = v);
    ({ error } = await sb.from('keluar_gudang').insert(rec));
  }
  if (error) return toast('Gagal: ' + error.message);
  toast(jenis === 'diambil' ? 'Tercatat sudah diambil' : 'Tercatat sudah difoto');
  await reloadTx(); hooks.refresh(); openPetani(id_data);
}

// ===== laci tambah penjualan =====
export function openJual(preId) {
  let pet = preId ? S.pid[preId] : null;
  const prods = KODE.map(k => S.byKode[k]).filter(Boolean);
  const html = () => `
    <div class="fld"><label>Petani</label>
      ${pet ? `<div class="card" style="display:flex;gap:10px;align-items:center"><div class="av">${esc(ini(pet.nama))}</div><div class="grow"><div class="b">${esc(pet.nama)}</div><div class="mut sm">${esc(pet.poktan)} · ${esc(pet.komoditas)} · NIK ${esc(pet.nik)}</div></div><button class="btn sm" id="jGanti">Ganti</button></div>`
        : `<div class="search" style="max-width:none"><span>${I.search}</span><input id="jCari" placeholder="Ketik nama / NIK petani…" autocomplete="off"><div class="sres hide" id="jRes"></div></div>`}</div>
    ${pet ? `<div id="jRows">${prods.map(pr => {
          const k = pr.kode, kuota = Number(pet['kuota_' + k]), sisa = Number(pet['sisa_' + k]);
          if (kuota <= 0 && Number(pet['t_' + k]) <= 0) return '';
          return `<div class="card c-${k}" style="margin-bottom:9px" data-k="${k}">
          <div style="display:flex;justify-content:space-between"><b><i class="dot"></i>${NAMA[k]}</b><span class="mut sm">@ ${n(pr.harga_jual)} · sisa kuota <b>${n(sisa)}</b> kg</span></div>
          <div class="pg" style="margin:6px 0"><i style="width:${pct(pet['t_' + k], kuota)}%"></i></div>
          <div class="row2"><div class="fld"><label>Disalurkan (kg)</label><input class="in" type="number" inputmode="decimal" min="0" data-f="jumlah"></div>
            <div class="fld"><label>Diambil sekarang (kg)</label><input class="in" type="number" inputmode="decimal" min="0" data-f="diambil"></div></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-q="sisa">Sisa kuota</button><button class="btn sm" data-q="+sak">+1 sak (${pr.berat_sak})</button><button class="btn sm" data-q="samakan">Diambil = disalurkan</button><button class="btn sm" data-q="nol">0</button></div>
          <div class="sm mut" style="margin-top:5px" data-sub>Subtotal: Rp 0</div></div>`;
        }).join('')}</div>
      <div class="card" style="display:flex;justify-content:space-between;align-items:center"><span class="mut">Total</span><b style="font-size:17px" id="jTot">Rp 0</b></div>
      <label style="display:flex;gap:7px;align-items:center;margin:10px 2px"><input type="checkbox" id="jFoto"> Sudah difoto/dicatat di aplikasi pupuk resmi</label>
      <div class="fld"><label>Keterangan</label><input class="in" id="jKet" placeholder="opsional"></div>
      <div class="fld"><label>Tanda tangan petani (opsional) <button class="btn sm" id="sigClr" style="margin-left:6px">Hapus</button></label><canvas class="sig" id="sig"></canvas></div>` : ''}`;
  const render = () => {
    const d = $('#drawer'); $('.bd', d).innerHTML = html();
    $('#jSave') && ($('#jSave').disabled = !pet); $('#jSavePrint') && ($('#jSavePrint').disabled = !pet);
    wire();
  };
  const wire = () => {
    const d = $('#drawer');
    if (!pet) {
      const inp = $('#jCari', d), res = $('#jRes', d);
      inp.focus();
      inp.oninput = debounce(() => {
        const q = inp.value.trim().toLowerCase(); if (q.length < 2) return res.classList.add('hide');
        const r = S.petani.filter(p => (p.nama || '').toLowerCase().includes(q) || (p.nik || '').includes(q)).slice(0, 25);
        res.innerHTML = r.map(p => `<div class="it" data-id="${p.id_data}"><b>${esc(p.nama)}</b> <span class="mut sm">${esc(p.poktan)} · ${esc(p.komoditas)} · ${esc(p.nik)}</span></div>`).join('') || '<div class="it mut">Tidak ditemukan</div>';
        res.classList.remove('hide');
        $$('.it[data-id]', res).forEach(e => e.onclick = () => { pet = S.pid[e.dataset.id]; render(); });
      });
      return;
    }
    $('#jGanti', d).onclick = () => { pet = null; render(); };
    const calc = () => {
      let tot = 0;
      $$('[data-k]', d).forEach(c => {
        const pr = S.byKode[c.dataset.k], j = Number($('[data-f=jumlah]', c).value) || 0, sub = j * pr.harga_jual;
        tot += sub; $('[data-sub]', c).textContent = 'Subtotal: ' + rp(sub);
        const sisa = Number(pet['sisa_' + c.dataset.k]); $('[data-sub]', c).classList.toggle('bad', j > sisa);
      });
      $('#jTot', d).textContent = rp(tot);
    };
    $$('[data-k]', d).forEach(c => {
      const k = c.dataset.k, pr = S.byKode[k], J = $('[data-f=jumlah]', c), A = $('[data-f=diambil]', c);
      $$('[data-q]', c).forEach(b => b.onclick = () => {
        const q = b.dataset.q;
        if (q === 'sisa') J.value = Math.max(0, Number(pet['sisa_' + k]));
        if (q === '+sak') J.value = (Number(J.value) || 0) + Number(pr.berat_sak);
        if (q === 'samakan') A.value = J.value;
        if (q === 'nol') { J.value = ''; A.value = ''; }
        calc();
      });
      J.oninput = calc;
    });
    // tanda tangan
    const cv = $('#sig', d), r = cv.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    cv.width = r.width * ratio; cv.height = r.height * ratio;
    const g = cv.getContext('2d'); g.scale(ratio, ratio); g.lineWidth = 2; g.lineCap = 'round'; g.strokeStyle = '#111';
    let down = false, drew = false;
    const pos = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.onpointerdown = e => { down = true; drew = true; cv.dataset.d = 1; g.beginPath(); g.moveTo(...pos(e)); cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = e => { if (down) { g.lineTo(...pos(e)); g.stroke(); } };
    cv.onpointerup = () => down = false;
    $('#sigClr', d).onclick = () => { g.clearRect(0, 0, cv.width, cv.height); delete cv.dataset.d; };
  };
  const save = async (cetak) => {
    const d = $('#drawer'); if (!pet) return;
    const items = [], fotoRec = { urea: 0, phonska: 0, organik: 0, za: 0 };
    $$('[data-k]', d).forEach(c => {
      const k = c.dataset.k, j = Number($('[data-f=jumlah]', c).value) || 0, a = Number($('[data-f=diambil]', c).value) || 0;
      if (j > 0 || a > 0) { items.push({ id_produk: S.byKode[k].id, jumlah: j, diambil: a }); fotoRec[k] = a; }
    });
    if (!items.length) return toast('Isi jumlah dulu');
    $('#jSave').disabled = $('#jSavePrint').disabled = true;
    let ttd = null; const cv = $('#sig', d);
    if (cv && cv.dataset.d) {
      const blob = await new Promise(r => cv.toBlob(r, 'image/png')); const path = `${uid()}${uid()}.png`;
      const up = await sb.storage.from('ttd').upload(path, blob, { contentType: 'image/png' });
      if (!up.error) ttd = path;
    }
    const { data: no, error } = await sb.rpc('simpan_penjualan', { p_id_data: pet.id_data, p_items: items, p_ttd: ttd, p_ket: $('#jKet', d).value || null });
    if (error) { toast('Gagal: ' + error.message); $('#jSave').disabled = $('#jSavePrint').disabled = false; return; }
    if ($('#jFoto', d).checked && KODE.some(k => fotoRec[k] > 0)) {
      await sb.from('keluar_gudang').insert({ id_kg: uid(), no_pesanan: no, tanggal_waktu: new Date().toISOString(), id_data: pet.id_data, nama_petani: pet.nama, nik: pet.nik, nama_poktan: pet.poktan, komoditas: pet.komoditas, ...fotoRec });
    }
    toast('Penjualan tersimpan'); closeDrawer(); await reloadTx(); hooks.refresh();
    if (cetak) cetakNota(no);
  };
  openDrawer(html(), {
    title: 'Tambah penjualan',
    footer: `<button class="btn" data-close>Batal</button><button class="btn" id="jSave" disabled>Simpan</button><button class="btn pri" id="jSavePrint" disabled>${I.print} Simpan & cetak</button>`,
    onOpen: d => { $('#jSave', d).onclick = () => save(false); $('#jSavePrint', d).onclick = () => save(true); if (pet) { $('#jSave').disabled = $('#jSavePrint').disabled = false; } wire(); },
  });
}

// ===== nota 58 mm =====
export async function cetakNota(no) {
  const [{ data: pj }, { data: dt }] = await Promise.all([
    sb.from('penjualan').select('*').eq('no_pesanan', no).maybeSingle(),
    sb.from('detail').select('*').eq('no_pesanan', no).order('nomor_urut'),
  ]);
  if (!pj) return toast('Penjualan tidak ditemukan');
  let ttdUrl = '';
  if (pj.ttd_path) { const r = await sb.storage.from('ttd').createSignedUrl(pj.ttd_path, 600); ttdUrl = r.data?.signedUrl || ''; }
  const s = S.set, d = new Date(pj.tanggal_waktu);
  const tg = `${String(d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric' }))} ${jam(pj.tanggal_waktu)}`;
  const info = (a, b) => `<tr><td style="width:40%">${a}</td><td style="width:2%;text-align:center">:</td><td style="padding-left:1ch">${esc(b)}</td></tr>`;
  $('#nota').innerHTML = `
  <img src="logo.png" style="width:200px;height:auto;display:block;margin:auto" alt="">
  <p class="center">${esc(s.judul_nota_1 || '')}</p><p class="center">${esc(s.judul_nota_2 || '')}</p>
  <p class="center">${esc(s.nama_kios || '')}</p><p class="center">${esc(s.kode_kios || '')}</p><p class="center">${esc(s.alamat_kios || '')}</p>
  <p style="height:20px"></p>
  <table>${info('No Pesanan', pj.no_pesanan)}</table><br>
  <table>${info('Nama Petani', pj.nama_petani)}${info('NIK', pj.nik)}${info('Nama Poktan', pj.nama_poktan)}${info('Komoditas', pj.komoditas)}</table><br>
  <table><tr><td>Penyaluran Pupuk</td></tr></table><br>
  <table><tr><td>No.</td><td>Jenis pupuk<br>harga x volume</td><td style="text-align:right">Jumlah</td></tr></table><div class="garis"></div>
  ${(dt || []).map(r => `<table><tr><td colspan="2">${esc(r.nama_produk)}</td></tr><tr><td style="width:60%;padding-left:1em">${n(r.harga_satuan)} x ${n(r.jumlah)} kg</td><td style="text-align:right;width:40%">${n(r.subtotal)}</td></tr></table>`).join('')}
  <div style="height:5px"></div>
  <table><tr><td>Subtotal</td><td style="text-align:right">Rp. ${n(pj.total_harga)}</td></tr></table>
  <p style="text-align:right;margin-top:6px">${tg}</p><div style="height:5px"></div>
  <p class="center" style="margin-top:6px">Petani</p><br>
  ${ttdUrl ? `<div class="center"><img src="${ttdUrl}" style="height:40px;margin:auto" alt=""></div>` : ''}
  <p class="center" style="margin-top:30px">${esc(pj.nama_petani)}</p><p style="height:30px"></p>`;
  const imgs = $$('#nota img'); await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500);
}

// ===== hitung cepat =====
export function openHitung() {
  const s = S.set, koli = Number(s.koli_per_sak) || 0;
  const hs = { urea: Number(s.harga_sak_urea) || 0, phonska: Number(s.harga_sak_phonska) || 0, organik: Number(s.harga_sak_organik) || 0, za: Number(s.harga_sak_za) || 0 };
  openDrawer(`
    <p class="mut">Masukkan jumlah sak. Harga per sak diatur di Pengaturan.</p>
    ${KODE.map(k => `<div class="card c-${k}" style="margin-bottom:9px;display:flex;align-items:center;gap:10px"><div class="grow"><b><i class="dot"></i>${NAMA[k]}</b><div class="mut sm">${rp(hs[k])} /sak + koli ${rp(koli)}</div></div>
      <input class="in" style="width:80px" type="number" inputmode="numeric" min="0" placeholder="sak" data-h="${k}"><b style="width:92px;text-align:right" data-o="${k}">Rp 0</b></div>`).join('')}
    <div class="card" style="display:flex;justify-content:space-between"><span class="mut">Total <span id="hSak">0</span> sak</span><b style="font-size:19px" id="hTot">Rp 0</b></div>
    <div class="fld"><label>Uang diterima</label><input class="in" id="hBayar" type="number" inputmode="numeric" placeholder="Rp"></div>
    <div class="card" style="display:flex;justify-content:space-between"><span class="mut">Kembalian</span><b id="hKem">Rp 0</b></div>`,
    {
      title: 'Hitung cepat', footer: '<button class="btn" id="hReset">Reset</button><button class="btn pri" data-close>Selesai</button>', onOpen: d => {
        const calc = () => {
          let tot = 0, sak = 0;
          KODE.forEach(k => { const q = Number($(`[data-h=${k}]`, d).value) || 0, v = q * (hs[k] + koli); tot += v; sak += q; $(`[data-o=${k}]`, d).textContent = rp(v); });
          $('#hSak', d).textContent = sak; $('#hTot', d).textContent = rp(tot);
          const b = Number($('#hBayar', d).value) || 0; $('#hKem', d).textContent = rp(Math.max(0, b - tot));
        };
        $$('input', d).forEach(i => i.oninput = calc);
        $('#hReset', d).onclick = () => { $$('input', d).forEach(i => i.value = ''); calc(); };
        $('[data-h]', d).focus();
      }
    });
}
