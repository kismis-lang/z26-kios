import { $, $$, esc, n, rp, KODE, NAMA, tglJam, jam, ini, uid, toast, I, sak, kgsak, dtLocal, fromLocal } from './util.js';
import { sb, S, reloadTx, isMgr, sum, z } from './data.js';
import { hooks, openDrawer, closeDrawer, pickerHtml, wirePicker, ringkasPetani, berat } from './ui.js';

const done = async () => { await reloadTx(); hooks.refresh(); };

// ===== tambah / ubah penjualan =====
export function openJual(rec, edit) {
  let cur = rec || null;
  const prods = () => KODE.map(k => S.byKode[k]).filter(Boolean);
  const sale = edit || null;
  const body = () => {
    if (!cur) return `<div class="fld"><label>Petani</label>${pickerHtml('jPk')}</div><p class="mut sm">Pilih petani dulu. Satu NIK bisa punya beberapa data (komoditas / poktan); pilih yang sesuai.</p>`;
    const bi = sum(cur.bi);
    return `${ringkasPetani(cur)}
    <div class="row2"><div class="fld"><label>No. pesanan (dari aplikasi pupuk resmi)</label><input class="in b" id="jNo" placeholder="mis. S0CFJ1\\7002OW" value="${esc(sale?.no_pesanan || '')}" ${sale ? 'readonly' : ''} autocomplete="off"></div>
    <div class="fld"><label>Tanggal & jam</label><input class="in" id="jTg" type="datetime-local" value="${dtLocal(sale?.tanggal_waktu || new Date())}"></div></div>
    ${!sale && bi > 0 ? `<label class="card" style="display:flex;gap:8px;align-items:flex-start;margin:8px 0;padding:9px"><input type="checkbox" id="jBi" checked><span><b>Sudah mengambil sebelum diinput</b><br><span class="sm">${KODE.filter(k => cur.bi[k] > 0).map(k => `${NAMA[k]} ${n(cur.bi[k])} kg`).join(' · ')} — dimasukkan sebagai "diambil" di penjualan ini, lalu dihapus dari daftar Belum input.</span></span></label>` : ''}
    ${prods().filter(p => cur.q[p.kode] > 0 || cur.in[p.kode] > 0).map(p => {
      const k = p.kode, sisa = cur.q[k] - cur.in[k] + (sale ? sale.in[k] : 0);
      const v = sale ? { inp: sale.in[k] || '', rc: sale.rc[k] || '' } : { inp: '', rc: '' };
      const am = !sale && bi > 0 ? cur.bi[k] || '' : '';
      return `<div class="card c-${k}" style="margin-bottom:8px;padding:9px" data-k="${k}">
        <div style="display:flex;justify-content:space-between"><b><i class="dot"></i>${NAMA[k]}</b><span class="mut sm">kuota ${n(cur.q[k])} · <b>sisa ${n(sisa)} kg (${n(sak(sisa, p.berat_sak))} sak)</b></span></div>
        <div class="row3"><div class="fld"><label>Input (kg)</label><input class="in" type="number" inputmode="decimal" min="0" data-f="inp" value="${v.inp}"></div>
          <div class="fld"><label>Rencana diberikan</label><input class="in" type="number" inputmode="decimal" min="0" data-f="rc" value="${v.rc}"></div>
          ${sale ? '' : `<div class="fld"><label>Diambil sekarang</label><input class="in" type="number" inputmode="decimal" min="0" data-f="am" value="${am}"></div>`}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center"><button class="btn sm" data-q="sisa">Sisa kuota</button><button class="btn sm" data-q="+sak">+1 sak</button>${sale ? '' : '<button class="btn sm" data-q="ambil">Ambil = rencana</button>'}<button class="btn sm" data-q="nol">0</button>
          <span class="sm mut" data-info style="margin-left:auto"></span></div></div>`;
    }).join('') || '<p class="mut">Petani ini belum punya kuota.</p>'}
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:9px"><span class="mut">Total harga (dari input)</span><b style="font-size:17px" id="jTot">Rp 0</b></div>
    <div class="fld"><label>Keterangan</label><input class="in" id="jKet" placeholder="opsional" value="${esc(sale?.keterangan || '')}"></div>
    ${sale ? '' : `<div class="fld"><label>Tanda tangan petani (opsional) <button class="btn sm" id="sigClr" style="margin-left:6px">Hapus</button></label><canvas class="sig" id="sig"></canvas></div>`}`;
  };
  const read = c => ({ inp: Number($('[data-f=inp]', c).value) || 0, rc: Number($('[data-f=rc]', c)?.value) || 0, am: Number($('[data-f=am]', c)?.value) || 0 });
  const wire = () => {
    const d = $('#drawer');
    if (!cur) return wirePicker(d, 'jPk', p => { cur = p; render(); });
    const calc = () => {
      let tot = 0;
      $$('[data-k]', d).forEach(c => {
        const k = c.dataset.k, pr = S.byKode[k], v = read(c), sisa = cur.q[k] - cur.in[k] + (sale ? sale.in[k] : 0);
        tot += v.inp * pr.harga_jual;
        const kios = Math.max(0, v.inp - v.rc), warn = [];
        if (v.inp > sisa) warn.push('input > sisa kuota'); if (v.rc > v.inp) warn.push('rencana > input'); if (v.am > v.rc) warn.push('ambil > rencana');
        $('[data-info]', c).innerHTML = (warn.length ? `<span class="bad">${warn.join(', ')}</span> · ` : '') + `milik kios ${n(kios)} kg · ${n(sak(v.inp, pr.berat_sak))} sak`;
      });
      $('#jTot', d).textContent = rp(tot);
    };
    $$('[data-k]', d).forEach(c => {
      const k = c.dataset.k, pr = S.byKode[k], I_ = $('[data-f=inp]', c), R = $('[data-f=rc]', c), A = $('[data-f=am]', c);
      let touched = !!R.value && R.value !== I_.value;
      R.oninput = () => { touched = true; calc(); };
      I_.oninput = () => { if (!touched) R.value = I_.value; calc(); };
      $$('[data-q]', c).forEach(b => b.onclick = () => {
        const q = b.dataset.q;
        if (q === 'sisa') { I_.value = Math.max(0, cur.q[k] - cur.in[k] + (sale ? sale.in[k] : 0)); if (!touched) R.value = I_.value; }
        if (q === '+sak') { I_.value = (Number(I_.value) || 0) + Number(pr.berat_sak); if (!touched) R.value = I_.value; }
        if (q === 'ambil' && A) A.value = R.value || I_.value;
        if (q === 'nol') { I_.value = ''; R.value = ''; if (A) A.value = ''; touched = false; }
        calc();
      });
      if (A) A.oninput = calc;
    });
    const bi = $('#jBi', d); if (bi) bi.onchange = () => $$('[data-k]', d).forEach(c => { const A = $('[data-f=am]', c); if (A) A.value = bi.checked ? (cur.bi[c.dataset.k] || '') : ''; calc(); });
    calc();
    const cv = $('#sig', d); if (!cv) return;
    const r = cv.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    cv.width = r.width * ratio; cv.height = r.height * ratio;
    const g = cv.getContext('2d'); g.scale(ratio, ratio); g.lineWidth = 2; g.lineCap = 'round'; g.strokeStyle = '#111';
    let down = false; const pos = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.onpointerdown = e => { down = true; cv.dataset.d = 1; g.beginPath(); g.moveTo(...pos(e)); cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = e => { if (down) { g.lineTo(...pos(e)); g.stroke(); } }; cv.onpointerup = () => down = false;
    $('#sigClr', d).onclick = () => { g.clearRect(0, 0, cv.width, cv.height); delete cv.dataset.d; };
  };
  const render = () => {
    const d = $('#drawer'); $('.bd', d).innerHTML = body();
    $$('#jSave,#jSavePrint').forEach(b => b.disabled = !cur); wire();
  };
  const save = async cetak => {
    const d = $('#drawer'); if (!cur) return;
    const no = ($('#jNo', d).value || '').trim();
    if (!no) return toast('Isi no. pesanan dari aplikasi pupuk resmi');
    if (!sale && S.sale[no]) return toast('No. pesanan ini sudah ada');
    const items = [];
    $$('[data-k]', d).forEach(c => { const v = read(c); if (v.inp > 0 || v.rc > 0 || v.am > 0) items.push({ id_produk: S.byKode[c.dataset.k].id, ...v }); });
    if (!items.length) return toast('Isi jumlah dulu');
    $$('#jSave,#jSavePrint').forEach(b => b.disabled = true);
    let ttd = null; const cv = $('#sig', d);
    if (cv && cv.dataset.d) {
      const blob = await new Promise(r => cv.toBlob(r, 'image/png')); const path = `${uid()}${uid()}.png`;
      const up = await sb.storage.from('ttd').upload(path, blob, { contentType: 'image/png' }); if (!up.error) ttd = path;
    }
    const p = { no, tanggal: fromLocal($('#jTg', d).value), id_data: cur.id_data, ttd, ket: $('#jKet', d).value || null, items, hapus_bi: !!($('#jBi', d) && $('#jBi', d).checked) };
    const { error } = await sb.rpc(sale ? 'ubah_penjualan2' : 'simpan_penjualan2', { p });
    if (error) { toast('Gagal: ' + error.message); $$('#jSave,#jSavePrint').forEach(b => b.disabled = false); return; }
    toast('Tersimpan'); closeDrawer(); await done(); if (cetak) cetakNota(no);
  };
  openDrawer(body(), {
    title: sale ? 'Ubah penjualan' : 'Tambah penjualan',
    footer: `<button class="btn" data-close>Batal</button><button class="btn" id="jSave">Simpan</button><button class="btn pri" id="jSavePrint">${I.print} Simpan & cetak</button>`,
    onOpen: d => { $('#jSave', d).onclick = () => save(false); $('#jSavePrint', d).onclick = () => save(true); $$('#jSave,#jSavePrint', d).forEach(b => b.disabled = !cur); wire(); },
  });
}

// ===== detail penjualan =====
export function openSale(no) {
  const s = S.sale[no]; if (!s) return toast('Penjualan tidak ditemukan');
  const rows = KODE.filter(k => s.in[k] || s.rc[k] || s.ak[k]);
  const st = sum(s.ba) > 0 ? '<span class="tag warn">belum ambil</span>' : '<span class="tag ok">selesai</span>';
  openDrawer(`<div class="card" style="padding:10px"><div style="display:flex;align-items:center;gap:6px"><span class="mut sm">No. pesanan</span><button class="btn sm" id="cpNo">${I.copy}</button></div><div class="b" style="font-size:16px;word-break:break-all">${esc(s.no_pesanan)}</div>
      <div class="mut sm" style="margin-top:4px">${tglJam(s.tanggal_waktu)} · ${esc(s.nama_petani)} · ${esc(s.nama_poktan)} · ${esc(s.komoditas)}</div><div class="mut sm">NIK ${esc(s.nik)}</div><div style="margin-top:5px">${st} <b>${rp(s.total_harga)}</b></div></div>
    <div class="card" style="margin-top:9px;padding:6px"><table class="dn"><tr><th>Pupuk</th><th class="num">Input</th><th class="num">Rencana</th><th class="num">Diambil</th><th class="num">Belum</th></tr>
    ${rows.map(k => `<tr class="c-${k}"><td><i class="dot"></i>${NAMA[k]}</td><td class="num">${n(s.in[k])}</td><td class="num">${n(s.rc[k])}</td><td class="num">${n(s.ak[k])}</td><td class="num ${s.ba[k] > 0 ? 'warn b' : ''}">${n(s.ba[k])}</td></tr>`).join('')}</table>
    <div class="sm mut" style="padding:4px 6px">Milik kios (input − rencana): ${KODE.filter(k => s.in[k] - s.rc[k] > 0).map(k => `${NAMA[k]} ${n(s.in[k] - s.rc[k])}`).join(' · ') || '-'}</div></div>
    <div class="sec"><h3>Riwayat pengambilan</h3></div><div class="card list" style="padding:6px">${s.picks.length ? s.picks.map(r => `<div class="li" style="cursor:default"><div class="grow"><div class="sm b">${tglJam(r.tanggal_waktu)}</div><div class="sm mut">${KODE.filter(k => r[k] > 0).map(k => `${NAMA[k]} ${n(r[k])} kg`).join(' · ')}</div></div>${isMgr() ? `<button class="btn sm bad" data-delpick="${esc(r.id_kg)}">${I.trash}</button>` : ''}</div>`).join('') : '<span class="mut sm">Belum ada pengambilan</span>'}</div>
    ${s.keterangan ? `<div class="card" style="margin-top:9px;padding:9px">${esc(s.keterangan)}</div>` : ''}`,
    {
      title: 'Detail penjualan', footer: `${isMgr() ? '<button class="btn bad" id="dDel">Hapus</button>' : ''}<button class="btn" id="dEdit">${I.edit} Ubah</button><button class="btn" id="dPrint">${I.print} Nota</button><button class="btn pri" id="dAmbil">${I.truck} Catat ambil</button>`,
      onOpen: d => {
        $('#cpNo', d).onclick = () => { navigator.clipboard?.writeText(s.no_pesanan); toast('No. pesanan disalin'); };
        $('#dPrint', d).onclick = () => cetakNota(no); $('#dEdit', d).onclick = () => openJual(S.pid[s.id_data], s); $('#dAmbil', d).onclick = () => openAmbil(no);
        const del = $('#dDel', d); if (del) del.onclick = async () => {
          if (!confirm('Hapus penjualan ini beserta rencana dan catatan pengambilan? Tidak bisa dibatalkan.')) return;
          for (const t of ['keluar_gudang', 'diambil', 'detail', 'penjualan']) { const { error } = await sb.from(t).delete().eq('no_pesanan', no); if (error) return toast(error.message); }
          toast('Dihapus'); closeDrawer(); await done();
        };
        $$('[data-delpick]', d).forEach(b => b.onclick = async () => {
          if (!confirm('Hapus catatan pengambilan ini?')) return;
          const { error } = await sb.from('keluar_gudang').delete().eq('id_kg', b.dataset.delpick); if (error) return toast(error.message);
          await done(); openSale(no);
        });
      },
    });
}

// ===== catat pengambilan (bisa berkali-kali, beda tanggal/jam) =====
export function openAmbil(no) {
  const s = S.sale[no]; if (!s) return; const p = S.pid[s.id_data];
  openDrawer(`<div class="card" style="padding:9px"><div class="b">${esc(s.nama_petani)} <span class="mut sm">· ${esc(s.komoditas)}</span></div><div class="mut sm">No. pesanan ${esc(s.no_pesanan)}</div></div>
    <div class="fld"><label>Tanggal & jam pengambilan</label><input class="in" id="aTg" type="datetime-local" value="${dtLocal()}"></div>
    ${KODE.filter(k => s.rc[k] > 0 || s.ak[k] > 0).map(k => `<div class="card c-${k}" style="margin-bottom:8px;padding:9px" data-k="${k}"><div style="display:flex;justify-content:space-between"><b><i class="dot"></i>${NAMA[k]}</b><span class="sm mut">rencana ${n(s.rc[k])} · diambil ${n(s.ak[k])} · <b>belum ${n(s.ba[k])} kg (${n(sak(s.ba[k], berat(k)))} sak)</b></span></div>
      <div class="fld"><label>Diambil sekarang (kg)</label><input class="in" type="number" inputmode="decimal" min="0" value="" data-f="am"></div><div style="display:flex;gap:5px"><button class="btn sm" data-q="sisa">Semua sisa</button><button class="btn sm" data-q="+sak">+1 sak</button><button class="btn sm" data-q="nol">0</button></div></div>`).join('') || '<p class="mut">Penjualan ini tidak punya rencana pemberian.</p>'}`,
    {
      title: 'Catat pengambilan', footer: '<button class="btn" data-close>Batal</button><button class="btn pri" id="aS">Simpan</button>',
      onOpen: d => {
        $$('[data-k]', d).forEach(c => { const k = c.dataset.k, A = $('[data-f=am]', c); $$('[data-q]', c).forEach(b => b.onclick = () => { const q = b.dataset.q; if (q === 'sisa') A.value = s.ba[k]; if (q === '+sak') A.value = (Number(A.value) || 0) + berat(k); if (q === 'nol') A.value = ''; }); });
        $('#aS', d).onclick = async () => {
          const rec = { id_kg: uid() + uid().slice(0, 2), no_pesanan: no, tanggal_waktu: fromLocal($('#aTg', d).value), id_data: s.id_data, nama_petani: s.nama_petani, nik: s.nik, nama_poktan: s.nama_poktan, komoditas: s.komoditas, ...z() };
          let any = false; $$('[data-k]', d).forEach(c => { const v = Number($('[data-f=am]', c).value) || 0; rec[c.dataset.k] = v; if (v > 0) any = true; });
          if (!any) return toast('Isi jumlah yang diambil');
          const { error } = await sb.from('keluar_gudang').insert(rec); if (error) return toast('Gagal: ' + error.message);
          toast('Pengambilan tercatat'); await reloadTx(); hooks.refresh(); openSale(no);
        };
      },
    });
}

// ===== ambil sebelum diinput (Blum Foto) =====
export function openBelumInput(rec) {
  let cur = rec || null;
  const body = () => !cur ? `<div class="fld"><label>Petani</label>${pickerHtml('bPk')}</div>` : `${ringkasPetani(cur)}
    <div class="fld"><label>Tanggal & jam</label><input class="in" id="bTg" type="datetime-local" value="${dtLocal()}"></div>
    <div class="row2">${KODE.map(k => `<div class="fld c-${k}"><label><i class="dot"></i>${NAMA[k]} (kg)</label><input class="in" type="number" inputmode="decimal" min="0" data-b="${k}"></div>`).join('')}</div>
    <div class="fld"><label>Keterangan</label><input class="in" id="bKet"></div>`;
  const wire = d => { if (!cur) wirePicker(d, 'bPk', p => { cur = p; $('.bd', d).innerHTML = body(); wire(d); $('#bS', d).disabled = false; }); };
  openDrawer(body(), {
    title: 'Ambil sebelum input', footer: '<button class="btn" data-close>Batal</button><button class="btn pri" id="bS">Simpan</button>',
    onOpen: d => {
      wire(d); $('#bS', d).disabled = !cur;
      $('#bS', d).onclick = async () => {
        const r = { id_blmfoto: uid() + uid().slice(0, 2), tanggal_waktu: fromLocal($('#bTg', d).value), id_data: cur.id_data, nama_petani: cur.nama, nik: cur.nik, nama_poktan: cur.poktan, komoditas: cur.komoditas, keterangan: $('#bKet', d).value || null, ...z() };
        let any = false; $$('[data-b]', d).forEach(i => { const v = Number(i.value) || 0; r[i.dataset.b] = v; if (v > 0) any = true; });
        if (!any) return toast('Isi jumlah');
        const { error } = await sb.from('blum_foto').insert(r); if (error) return toast('Gagal: ' + error.message);
        toast('Tercatat'); closeDrawer(); await done();
      };
    },
  });
}

// ===== tambah / ubah data petani =====
export function openPetaniForm(rec, nikPreset, person) {
  const ids = person ? (S.byNik[person] || []).map(x => x.id_data) : [];
  if (person) rec = S.byNik[person][0];
  const src = rec || (nikPreset ? { ...(S.byNik[nikPreset]?.[0] || {}), id_data: null, poktan: '', komoditas: '', luas_lahan: '', q: z(), kuota_urea: '', kuota_phonska: '', kuota_organik: '', kuota_za: '', keterangan: '' } : { nama: '', nik: '', alamat: '', tempat_lahir: '', tanggal_lahir: '', komoditas: '', poktan: '', luas_lahan: '', kuota_urea: '', kuota_phonska: '', kuota_organik: '', kuota_za: '', keterangan: '', dpt: '' });
  const poktans = [...new Set(S.petani.map(p => p.poktan).filter(Boolean))].sort(), koms = [...new Set(S.petani.map(p => p.komoditas).filter(Boolean))].sort();
  const f = (id, lab, val, type = 'text', extra = '') => `<div class="fld"><label>${lab}</label><input class="in" id="${id}" type="${type}" value="${esc(val ?? '')}" ${extra}></div>`;
  openDrawer(`${f('pNama', 'Nama petani', src.nama)}${f('pNik', 'NIK', src.nik, 'text', 'inputmode="numeric" maxlength="16"')}${f('pAlamat', 'Alamat', src.alamat)}
    <div class="row2">${f('pTmp', 'Tempat lahir', src.tempat_lahir)}${f('pTgl', 'Tanggal lahir', src.tanggal_lahir, 'date')}</div>
    ${person ? '<p class="mut sm">Perubahan nama, NIK, alamat, dan TTL berlaku untuk semua data petani ini (semua poktan & komoditas). Ubah kuota/poktan lewat ikon pensil di dalam komoditasnya.</p>' : `    <div class="row2"><div class="fld"><label>Kelompok tani (poktan)</label><input class="in" id="pPok" list="dlPok" value="${esc(src.poktan || '')}"><datalist id="dlPok">${poktans.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="fld"><label>Komoditas</label><input class="in" id="pKom" list="dlKom" value="${esc(src.komoditas || '')}"><datalist id="dlKom">${koms.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div></div>
    ${f('pLuas', 'Luas lahan (ha)', src.luas_lahan, 'number', 'step="0.01"')}
    <div class="row2">${KODE.map(k => f('pK_' + k, `Kuota ${NAMA[k]} (kg)`, src['kuota_' + k], 'number')).join('')}</div>
    ${f('pKet', 'Keterangan', src.keterangan)}`}
    ${rec ? '' : '<p class="mut sm">Tips: kalau NIK ini sudah punya data di komoditas/poktan lain, tambahkan sebagai data baru dengan NIK yang sama.</p>'}`,
    {
      title: person ? 'Ubah data petani' : rec ? 'Ubah komoditas / kuota' : 'Tambah petani', footer: (person && isMgr() ? '<button class="btn bad" id="pDel">Hapus petani</button><span class="sp"></span>' : '') + '<button class="btn" data-close>Batal</button><button class="btn pri" id="pS">Simpan</button>',
      onOpen: d => {
        const dl = $('#pDel', d);
        if (dl) dl.onclick = async () => {
          const nm = rec.nama, np = (S.penRaw || []).filter(x => ids.includes(x.id_data)).length;
          if (!confirm(`Hapus petani "${nm}"?\n\nSemua data petani ini akan terhapus: ${ids.length} data kuota, ${np} penjualan beserta pengambilan dan catatan "belum input". Tindakan ini tidak bisa dibatalkan.\n\nYa = hapus, Batal = jangan hapus`)) return;
          for (const t of ['keluar_gudang', 'diambil', 'detail', 'penjualan', 'blum_foto', 'petani']) { const { error } = await sb.from(t).delete().in('id_data', ids); if (error) return toast('Gagal hapus ' + t + ': ' + error.message); }
          toast('Petani dihapus'); closeDrawer(); await done();
        };
        $('#pS', d).onclick = async () => {
          const v = id => $('#' + id, d).value.trim();
          if (!v('pNama')) return toast('Isi nama');
          if (v('pNik') && !/^\d{16}$/.test(v('pNik')) && !confirm('NIK bukan 16 digit. Tetap simpan?')) return;
          if (person) {
            const id = { nama: v('pNama'), nik: v('pNik') || null, alamat: v('pAlamat') || null, tempat_lahir: v('pTmp') || null, tanggal_lahir: v('pTgl') || null };
            let { error } = await sb.from('petani').update(id).in('id_data', ids); if (error) return toast('Gagal: ' + error.message);
            const pj = { nama_petani: id.nama, nik: id.nik };
            for (const t of ['penjualan']) await sb.from(t).update(pj).in('id_data', ids);
            for (const t of ['detail', 'diambil', 'keluar_gudang', 'blum_foto']) await sb.from(t).update({ nama_petani: id.nama, nik: id.nik }).in('id_data', ids);
            toast('Tersimpan'); closeDrawer(); await done(); return;
          }
          const row = { nama: v('pNama'), nik: v('pNik') || null, alamat: v('pAlamat') || null, tempat_lahir: v('pTmp') || null, tanggal_lahir: v('pTgl') || null, poktan: v('pPok') || null, komoditas: v('pKom') || null, luas_lahan: v('pLuas') === '' ? null : Number(v('pLuas')), keterangan: v('pKet') || null };
          KODE.forEach(k => row['kuota_' + k] = Number(v('pK_' + k)) || 0);
          let error;
          if (rec) ({ error } = await sb.from('petani').update(row).eq('id_data', rec.id_data));
          else { const id = Math.max(0, ...S.petani.map(p => p.id_data)) + 1; ({ error } = await sb.from('petani').insert({ id_data: id, ...row })); }
          if (error) return toast('Gagal: ' + error.message);
          toast('Tersimpan'); closeDrawer(); await done();
        };
      },
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
  const tg = `${d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric' })} ${jam(pj.tanggal_waktu)}`;
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
          let tot = 0, sk = 0;
          KODE.forEach(k => { const q = Number($(`[data-h=${k}]`, d).value) || 0, v = q * (hs[k] + koli); tot += v; sk += q; $(`[data-o=${k}]`, d).textContent = rp(v); });
          $('#hSak', d).textContent = sk; $('#hTot', d).textContent = rp(tot);
          const b = Number($('#hBayar', d).value) || 0; $('#hKem', d).textContent = rp(Math.max(0, b - tot));
        };
        $$('input', d).forEach(i => i.oninput = calc);
        $('#hReset', d).onclick = () => { $$('input', d).forEach(i => i.value = ''); calc(); };
        $('[data-h]', d).focus();
      }
    });
}
