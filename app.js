import { $, $$, esc, n, rp, KODE, NAMA, tgl, tglJam, ini, pct, uid, toast, I, lsGet, lsSet, debounce, tglWIB, sak } from './util.js';
import { sb, S, loadProfile, loadAll, reloadTx, isMgr, isAdmin, all, ringkasHariIni, totalBelum, stokProduk, perPoktan, penjualan14Hari, sum, z } from './data.js';
import { hooks, nav, openDrawer, closeDrawer, isDrawerOpen, barHtml, lbar, berat, kgSak } from './ui.js';
import { openJual, openSale, openAmbil, openBelumInput, openPetaniForm, cetakNota, openHitung } from './forms.js';
import { exportPetani, exportPenjualan, openImportPetani } from './xls.js';

// ===== tema =====
const root = document.documentElement;
function applyTheme() {
  root.dataset.theme = lsGet('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.dataset.accent = lsGet('accent', 'hijau');
}
applyTheme();

const MENU = [
  ['beranda', 'Beranda', I.home], ['petani', 'Petani', I.users], ['penjualan', 'Penjualan', I.cart], ['belum', 'Belum ambil / input', I.alert],
  ['gudang', 'Gudang', I.box], ['luar', 'Luar kelompok', I.out], ['poktan', 'Poktan & kuota', I.map], ['keuangan', 'Keuangan', I.money], ['pengaturan', 'Pengaturan', I.gear],
];
const BNAV = ['beranda', 'petani', 'penjualan', 'gudang', 'lainnya'];
const VIEWS = [...MENU.map(m => m[0]), 'lainnya'];
let view = 'beranda';
const F = { q: '', poktan: '', kom: '', st: '', lim: 60, open: new Set(), pq: '', pr: '7', bs: 'ba' };

// ===== riwayat (tombol kembali di HP) + posisi gulir =====
history.scrollRestoration = 'manual';
const hashView = () => { const v = (location.hash || '').replace(/^#\/?/, '').split('?')[0]; return VIEWS.includes(v) ? v : 'beranda'; };
function saveScroll() { if (nav.eid && !isDrawerOpen()) nav.scroll[nav.eid] = window.scrollY; try { sessionStorage.setItem('z26scroll', JSON.stringify(nav.scroll)); } catch { } }
function restoreScroll(y, tries = 0) { window.scrollTo(0, y); if (tries < 8 && Math.abs(window.scrollY - y) > 4) setTimeout(() => restoreScroll(y, tries + 1), 80); }
addEventListener('scroll', debounce(saveScroll, 120), { passive: true });
function go(v, opts = {}) {
  if (v === view && !opts.force) { window.scrollTo(0, 0); return; }
  saveScroll(); closeDrawerQuiet();
  view = v; nav.eid = uid(); history.pushState({ id: nav.eid }, '', '#/' + v);
  render(); window.scrollTo(0, 0);
}
function closeDrawerQuiet() { if (isDrawerOpen()) { $('#drawer').classList.remove('on'); $('#veil').classList.remove('on'); closeDrawer(true); } }
addEventListener('popstate', e => {
  const st = e.state || {};
  if (isDrawerOpen() && !st.drawer) { closeDrawer(true); return; }       // kembali = tutup laci
  if (st.id && st.id === nav.eid) return;                                // masih halaman yang sama
  if (!$('#page')) return;
  nav.eid = st.id || uid(); view = hashView(); render();
  restoreScroll(nav.scroll[nav.eid] || 0);
});

// ===== layar masuk =====
function loginScreen(msg = '') {
  $('#root').innerHTML = `<div id="login"><div class="card"><div class="brand" style="padding-bottom:10px"><div class="lg">z26</div><div><b>Kios Misfalah</b><span>Penjualan & gudang pupuk</span></div></div>
    <div class="tabs"><span class="chip on" data-m="in">Masuk</span><span class="chip" data-m="up">Daftar</span><span class="chip" data-m="link">Link email</span></div>
    <form id="lf"><div class="fld"><label>Email</label><input class="in" type="email" id="lEm" required autocomplete="email"></div>
    <div class="fld" id="fPw"><label>Kata sandi</label><input class="in" type="password" id="lPw" autocomplete="current-password" minlength="6"></div>
    <div class="fld hide" id="fNm"><label>Nama</label><input class="in" id="lNm"></div>
    <button class="btn pri" style="width:100%;justify-content:center;margin-top:8px" id="lGo">Masuk</button></form>
    <p class="sm mut c" style="margin:10px 0 0"><a href="#" id="lLupa">Lupa kata sandi?</a></p>
    <p class="sm ${msg.startsWith('!') ? 'bad' : 'ok'} c" id="lMsg">${esc(msg.replace(/^!/, ''))}</p></div></div>`;
  let mode = 'in';
  const upd = () => {
    $$('[data-m]').forEach(c => c.classList.toggle('on', c.dataset.m === mode));
    $('#fPw').classList.toggle('hide', mode === 'link'); $('#fNm').classList.toggle('hide', mode !== 'up');
    $('#lGo').textContent = { in: 'Masuk', up: 'Daftar', link: 'Kirim link masuk' }[mode];
  };
  $$('[data-m]').forEach(c => c.onclick = () => { mode = c.dataset.m; upd(); });
  const say = (t, bad) => { $('#lMsg').className = 'sm c ' + (bad ? 'bad' : 'ok'); $('#lMsg').textContent = t; };
  const back = location.origin + location.pathname;
  $('#lf').onsubmit = async e => {
    e.preventDefault(); const em = $('#lEm').value.trim(), pw = $('#lPw').value; $('#lGo').disabled = true;
    let r;
    if (mode === 'in') r = await sb.auth.signInWithPassword({ email: em, password: pw });
    else if (mode === 'up') r = await sb.auth.signUp({ email: em, password: pw, options: { data: { nama: $('#lNm').value.trim() }, emailRedirectTo: back } });
    else r = await sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: back } });
    $('#lGo').disabled = false;
    if (r.error) return say(r.error.message, true);
    if (mode === 'link') return say('Link masuk dikirim ke email. Buka link tersebut.');
    if (mode === 'up' && !r.data.session) return say('Pendaftaran berhasil. Cek email untuk konfirmasi, lalu tunggu persetujuan admin.');
    boot();
  };
  $('#lLupa').onclick = async e => {
    e.preventDefault(); const em = $('#lEm').value.trim(); if (!em) return say('Isi email dulu', true);
    const r = await sb.auth.resetPasswordForEmail(em, { redirectTo: back }); say(r.error ? r.error.message : 'Link atur ulang kata sandi dikirim ke email', !!r.error);
  };
}
function pendingScreen() {
  const st = S.prof?.status;
  $('#root').innerHTML = `<div id="login"><div class="card c"><h2>${st === 'rejected' ? 'Akses ditolak' : 'Menunggu persetujuan'}</h2>
    <p class="mut">${st === 'rejected' ? 'Admin menolak akun ini.' : 'Akun <b>' + esc(S.user.email) + '</b> sudah terdaftar. Minta admin menyetujui akun Anda, lalu muat ulang.'}</p>
    <button class="btn" id="lRe">Muat ulang</button> <button class="btn" id="lOut">Keluar</button></div></div>`;
  $('#lRe').onclick = () => boot(); $('#lOut').onclick = async () => { await sb.auth.signOut(); boot(); };
}

// ===== pasang aplikasi (PWA) =====
let deferred = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
addEventListener('appinstalled', () => { deferred = null; $('#bInst')?.classList.add('hide'); toast('Aplikasi terpasang'); });
async function pasang() {
  if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  openDrawer(`<p>${ios ? 'Di iPhone/iPad: buka lewat <b>Safari</b>, ketuk tombol <b>Bagikan</b>, lalu pilih <b>Tambah ke Layar Utama</b>.' : 'Di Chrome: ketuk menu <b>⋮</b> di pojok kanan atas, lalu pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.'}</p>
    <p class="mut sm">Setelah terpasang, aplikasi terbuka layar penuh seperti aplikasi biasa.</p>`, { title: 'Pasang aplikasi' });
}

// ===== kerangka =====
function shell() {
  $('#root').innerHTML = `<div id="app"><aside id="side"><div class="brand"><div class="lg">z26</div><div><b>Kios Misfalah</b><span>${esc(S.prof.nama || S.prof.email)} · ${esc(S.prof.role)}</span></div></div>
    ${MENU.map(m => `<button class="nav" data-v="${m[0]}">${m[2]}<span>${m[1]}</span></button>`).join('')}<div class="sp"></div>
    <button class="nav" id="nHit">${I.calc}<span>Hitung cepat</span></button><button class="nav" id="nOut">${I.out}<span>Keluar</span></button></aside>
    <main><div class="top"><div class="search"><span>${I.search}</span><input id="gq" placeholder="Cari nama, NIK, atau no. pesanan…" autocomplete="off"><div class="sres hide" id="gres"></div></div>
      <button class="btn ic ${standalone() ? 'hide' : ''}" id="bInst" title="Pasang aplikasi">${I.install}</button>
      <button class="btn ic" id="bHit" title="Hitung cepat">${I.calc}</button></div><div id="page"></div></main></div>
    <nav id="bnav">${BNAV.map(k => `<button class="nav" data-v="${k}">${{ beranda: I.home, petani: I.users, penjualan: I.cart, gudang: I.box, lainnya: I.more }[k]}<span>${{ beranda: 'Beranda', petani: 'Petani', penjualan: 'Jual', gudang: 'Gudang', lainnya: 'Lainnya' }[k]}</span></button>`).join('')}</nav>
    <button class="fab" id="fab" title="Tambah penjualan">${I.plus}</button>`;
  $$('[data-v]').forEach(b => b.onclick = () => go(b.dataset.v));
  $('#fab').onclick = () => openJual(); $('#nHit').onclick = $('#bHit').onclick = openHitung; $('#bInst').onclick = pasang;
  $('#nOut').onclick = async () => { await sb.auth.signOut(); boot(); };
  const gq = $('#gq'), res = $('#gres');
  gq.oninput = debounce(() => {
    const q = gq.value.trim().toLowerCase(); if (q.length < 2) return res.classList.add('hide');
    const byNik = {}; S.petani.filter(p => (p.nama || '').toLowerCase().includes(q) || (p.nik || '').includes(q)).forEach(p => (byNik[p.nik || 'id' + p.id_data] ||= []).push(p));
    const pet = Object.entries(byNik).slice(0, 20), ps = S.pen.filter(s => s.no_pesanan.toLowerCase().includes(q)).slice(0, 8);
    res.innerHTML = ps.map(s => `<div class="it" data-no="${esc(s.no_pesanan)}"><b>${esc(s.no_pesanan)}</b> <span class="mut sm">${esc(s.nama_petani)} · ${tgl(s.tanggal_waktu)} · ${rp(s.total_harga)}</span></div>`).join('')
      + pet.map(([k, r]) => `<div class="it" data-nik="${esc(k)}"><b>${esc(r[0].nama)}</b> <span class="mut sm">${r.map(x => esc(x.komoditas) + ' ' + esc(x.poktan)).join(' · ')}</span><div class="sm mut">NIK ${esc(r[0].nik)}</div></div>`).join('') || '<div class="it mut">Tidak ditemukan</div>';
    res.classList.remove('hide');
    $$('.it[data-nik]', res).forEach(e => e.onclick = () => { res.classList.add('hide'); gq.value = ''; hooks.openNik(e.dataset.nik); });
    $$('.it[data-no]', res).forEach(e => e.onclick = () => { res.classList.add('hide'); gq.value = ''; openSale(e.dataset.no); });
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) res.classList.add('hide'); });
  hooks.refresh = () => render(true);
  hooks.openNik = nik => { F.q = ''; F.poktan = ''; F.kom = ''; F.st = ''; F.open.add(nik); F.focus = nik; if (view === 'petani') render(true); else go('petani'); };
}
function render(keepScroll) {
  const y = window.scrollY;
  $$('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === view || (b.closest('#bnav') && b.dataset.v === 'lainnya' && !BNAV.includes(view))));
  const P = { beranda, petani, penjualan, belum, gudang, luar, poktan, keuangan, pengaturan, lainnya }[view] || beranda;
  P($('#page'));
  if (keepScroll) restoreScroll(y);
}

// ===== kartu =====
const kpi = (l, v, ic, sub = '', go = '') => `<div class="card kpi ${go ? 'click' : ''}" ${go ? `data-go="${go}"` : ''}><div class="l"><span class="ic">${ic}</span>${l}</div><div class="v">${v}</div><div class="mut sm">${sub}</div></div>`;
const kpiLines = (l, ic, o, sub, go) => `<div class="card kpi click" data-go="${go}"><div class="l"><span class="ic">${ic}</span>${l}</div><div class="kls">${KODE.map(k => `<div class="kl c-${k}"><i class="dot"></i>${NAMA[k]} <b>${n(o[k])}</b> kg <span class="mut">(${n(sak(o[k], berat(k)))} sak)</span></div>`).join('')}</div><div class="mut sm">${sub}</div></div>`;

// ===== beranda =====
function beranda(el) {
  const h = ringkasHariIni(), b = totalBelum(), st = stokProduk(), batas = Number(S.set.batas_stok_menipis) || 2000, pk = perPoktan(), hr = penjualan14Hari();
  const maxO = Math.max(1, ...hr.map(x => x.omzet));
  const fis = Object.fromEntries(st.map(x => [x.k, x.fisik]));
  el.innerHTML = `
  <div class="grid g4">
    ${kpi('Penjualan hari ini', rp(h.omzet), I.cart, `${h.n} transaksi · input ${n(h.in)} kg`, 'penjualan')}
    ${kpiLines('Belum ambil', I.truck, b.ba, `${b.nBa} penjualan, rencana belum diambil petani`, 'belum:ba')}
    ${kpiLines('Belum input', I.camera, b.bi, `${b.nBi} petani sudah ambil, belum diinput`, 'belum:bi')}
    ${kpiLines('Stok di gudang', I.box, fis, st.filter(x => x.fisik < batas && (x.masuk > 0)).map(x => `<span class="bad">${NAMA[x.k]} menipis</span>`).join(' ') || 'semua aman', 'gudang')}
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><div class="sec" style="margin-top:0"><h3>Penjualan 14 hari</h3><span class="mut sm">total ${rp(hr.reduce((a, b) => a + b.omzet, 0))}</span></div>
      <div class="hbar" style="margin-bottom:16px">${hr.map(x => `<div style="height:${Math.max(2, x.omzet / maxO * 100)}%" title="${x.k}: ${rp(x.omzet)}"><span>${x.label}</span></div>`).join('')}</div></div>
    <div class="card"><div class="sec" style="margin-top:0"><h3>Penyaluran per poktan</h3><span class="mut sm">input / kuota</span></div>
      ${pk.map(o => { const k = sum(o.q), t = sum(o.in); return `<div class="prow"><div class="h"><span>${esc(o.nama)} <span class="mut sm">${o.niks.size} petani</span></span><span class="mut">${pct(t, k).toFixed(1)}%</span></div><div class="pg"><i style="width:${pct(t, k)}%"></i></div></div>`; }).join('')}</div>
  </div>
  <div class="card" style="margin-top:12px"><div class="sec" style="margin-top:0"><h3>Transaksi terbaru</h3><button class="btn sm" data-go="penjualan">Semua</button></div><div class="list">
    ${S.pen.slice(0, 8).map(saleRow).join('')}</div></div>`;
  wireCommon(el);
}
const saleRow = x => `<div class="li" data-no="${esc(x.no_pesanan)}"><div class="av">${esc(ini(x.nama_petani))}</div><div class="grow"><div class="t b">${esc(x.nama_petani)} <span class="mut sm">· ${esc(x.komoditas)}</span></div><div class="mut sm t">${esc(x.no_pesanan)} · ${tglJam(x.tanggal_waktu)}</div></div>
  <div class="r"><div class="b">${rp(x.total_harga)}</div>${sum(x.ba) > 0 ? '<span class="tag warn">belum ambil</span>' : '<span class="tag ok">selesai</span>'}</div></div>`;
function wireCommon(el) {
  $$('[data-go]', el).forEach(c => c.onclick = () => { const [v, s] = c.dataset.go.split(':'); if (s) F.bs = s; go(v, { force: true }); });
  $$('.li[data-no]', el).forEach(c => c.onclick = () => openSale(c.dataset.no));
}

// ===== petani (1 NIK = 1 baris; klik > poktan > komoditas > pupuk, semuanya terbuka ke bawah) =====
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const ttl = p => { const d = p.tanggal_lahir ? String(p.tanggal_lahir).slice(0, 10).split('-') : null; const t = d ? `${+d[2]} ${BLN[+d[1] - 1]} ${d[0]}` : ''; return [p.tempat_lahir && (p.tempat_lahir + (t ? ', ' : '')) + t || t].filter(Boolean).join('') };
const ha = v => v === null || v === '' || v === undefined || !(+v) ? '' : ` (${String(Math.round(+v * 100) / 100).replace('.', ',')} Ha)`;
const byPok = recs => { const m = new Map(); recs.forEach(r => { const k = r.poktan || '-'; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; };
const rpk = (jml, h) => `${n(jml)} kg x ${rp(h)}`;
function pupukRows(r) {
  return KODE.filter(k => r.q[k] > 0 || r.in[k] > 0).map(k => `<div class="pk c-${k}"><span class="pn"><i class="dot"></i>${NAMA[k]}</span>
    <span class="pbar"><span class="ph"><span><b>${n(r.in[k])}</b> / ${n(r.q[k])} kg</span><span>sisa <b>${n(r.sisa[k])}</b></span></span>${barHtml1(r.in[k], r.q[k], k)}</span></div>`).join('') || '<div class="mut">Tidak ada kuota</div>';
}
const barHtml1 = (v, t, k) => `<div class="pg s"><i class="${v > t && t > 0 ? 'o' : ''}" style="width:${pct(v, t)}%"></i></div>`;
const tblRows = (rows) => rows.map(d => `<div class="sdr"><span>${esc(d.nama)}</span><span>${rpk(d.q, d.h)} = ${rp(d.sub)}</span></div>`).join('');
const sakTxt = (o, only) => KODE.filter(k => (only ? only(k) : o[k]) && Math.abs(o[k]) > 0).map(k => `${KET[k]} ${String(Math.round(o[k] / berat(k) * 10) / 10).replace('.', ',')}`).join(' ');
const KET = { urea: 'urea', phonska: 'poska', organik: 'organik', za: 'za' };
function ketOtomatis(r) {
  const parts = [];
  const ak = sakTxt(r.ak), bi = sakTxt(r.bi), ba = sakTxt(r.ba);
  if (ak) parts.push('ambil ' + ak); if (bi) parts.push('blm foto ' + bi); if (ba) parts.push('blm ambil ' + ba);
  if (!parts.length) return '';
  const habis = KODE.every(k => r.sisa[k] <= 0 || !r.q[k]) && !sum(r.ba) && !sum(r.bi);
  return parts.join(', ') + (habis ? ' (habis)' : '');
}
function saleDetail(no) {
  const s = S.sale[no]; if (!s) return '';
  const hj = id => Number(S.byId[id]?.harga_jual) || 0;
  const inp = S.det.filter(d => d.no_pesanan === no).map(d => ({ nama: S.byId[d.id_produk]?.nama || '', q: d.jumlah, h: d.harga_satuan, sub: d.subtotal }));
  const rcR = S.amb.filter(d => d.no_pesanan === no).map(d => ({ nama: S.byId[d.id_produk]?.nama || '', q: d.jumlah, h: hj(d.id_produk), sub: d.jumlah * hj(d.id_produk) }));
  const rcTot = rcR.reduce((a, b) => a + b.sub, 0);
  const kios = KODE.map(k => [k, s.in[k] - s.rc[k]]).filter(([k, v]) => v !== 0).map(([k, v]) => `${NAMA[k]} ${n(v)} kg`);
  const o1 = F.open.has('t:' + no), o2 = F.open.has('u:' + no);
  const picks = s.picks.map(x => `<div class="pick"><span><b>${tglJam(x.tanggal_waktu)}</b> · ${KODE.filter(k => +x[k]).map(k => NAMA[k] + ' ' + n(x[k]) + ' kg').join(', ')}</span><button class="btn xs" data-cetak="${esc(no)}|ambil|${esc(x.id_kg)}" title="Cetak pengambilan">${I.print}</button></div>`).join('');
  const ba = KODE.filter(k => s.ba[k] > 0).map(k => `${NAMA[k]} ${n(s.ba[k])} kg (${n(sak(s.ba[k], berat(k)))} sak)`);
  return `<div class="sd"><div class="sdt">Transaksi (input aplikasi resmi — mengurangi stok resmi)</div>${tblRows(inp)}
    <div class="sdr tot" data-tog="t:${esc(no)}"><b>Total Harga</b><b>${rp(s.total_harga)} <span class="chev ${o1 ? 'dn' : ''}">›</span></b></div>
    ${o1 ? `<div class="sdx"><div class="sdt">Rencana${kios.length ? ` <span class="mut">(milik kios: ${esc(kios.join(', '))})</span>` : ''}</div>
      ${rcR.length ? `${tblRows(rcR)}<div class="sdr tot" data-tog="u:${esc(no)}"><b>Total Harga</b><b>${rp(rcTot)} <span class="chev ${o2 ? 'dn' : ''}">›</span></b></div>` : `<div class="mut">Tidak ada rencana: semua milik kios.</div>`}
      <div class="rl"><button class="btn sm" data-cetak="${esc(no)}|rencana">${I.print} Cetak rencana</button></div>
      ${o2 && rcR.length ? `<div class="sdx"><div class="sdt">Sudah diambil (mengurangi stok gudang)</div>${picks || '<div class="mut">Belum ada pengambilan</div>'}
        ${ba.length ? `<div class="warn" style="margin-top:3px"><b>Belum diambil</b>: ${esc(ba.join(', '))}<div class="mut">= barang petani yang dititipkan di gudang (bukan milik kios).</div></div>` : '<div class="ok">Semua rencana sudah diambil.</div>'}
        <div class="rl">${ba.length ? `<button class="btn sm pri" data-ambil="${esc(no)}">${I.plus} Ambil sekarang</button>` : ''}<button class="btn sm" data-cetak="${esc(no)}|ambil">${I.print} Cetak semua</button></div></div>` : ''}</div>` : ''}
    <div class="rl"><button class="btn sm" data-no="${esc(no)}">Detail / ubah</button></div></div>`;
}
function komHtml(r) {
  const open = F.open.has('r:' + r.id_data);
  const sales = S.pen.filter(s => s.id_data === r.id_data);
  const bi = sum(r.bi) > 0;
  let body = '';
  if (open) {
    const ket = ketOtomatis(r);
    body = `<div class="kb">${pupukRows(r)}
      ${ket || r.keterangan ? `<div class="ket"><b>Keterangan:</b> ${esc(ket || r.keterangan)}</div>` : ''}
      <div class="sub"><b>Riwayat</b>${sales.length ? '' : ' <span class="mut">belum ada penjualan</span>'}</div>
      ${sales.map((s, i) => `<div class="sl"><div class="slh" data-tog="s:${esc(s.no_pesanan)}"><span class="mut">${sales.length - i}.</span> <b>${esc(s.no_pesanan)}</b> <span class="mut">${tgl(s.tanggal_waktu)}</span><span class="sp"></span>${sum(s.ba) > 0 ? '<span class="tag warn">belum ambil</span>' : ''}<button class="btn xs" data-cetak="${esc(s.no_pesanan)}|input" title="Cetak nota">${I.print}</button><span class="chev">›</span></div>${F.open.has('s:' + s.no_pesanan) ? saleDetail(s.no_pesanan) : ''}</div>`).join('')}
      <div class="rl"><button class="btn sm pri" data-jual="${r.id_data}">${I.plus} Jual</button><button class="btn sm" data-bi="${r.id_data}">${I.camera} Ambil sebelum input</button><button class="btn sm" data-edit="${r.id_data}" title="Ubah kuota / luas">${I.edit}</button></div></div>`;
  }
  return `<div class="kr ${open ? 'open' : ''}"><div class="krh" data-tog="r:${r.id_data}"><span class="chev">›</span><b>${esc(r.komoditas || '-')}</b><span class="mut">${luas(r.luas_lahan)} Ha</span>${bi ? '<span class="tag bad">belum input</span>' : ''}${sum(r.ba) > 0 ? '<span class="tag warn">belum ambil</span>' : ''}</div>${body}</div>`;
}
const luas = v => String(Math.round((+v || 0) * 100) / 100).replace('.', ',');
function groupHtml(key, recs) {
  const open = F.open.has(key), p0 = recs[0];
  const pok = [...byPok(recs)];
  const flags = (recs.some(r => sum(r.ba) > 0) ? '<span class="tag warn">belum ambil</span> ' : '') + (recs.some(r => sum(r.bi) > 0) ? '<span class="tag bad">belum input</span> ' : '');
  const line2 = `${esc(p0.nik || '-')} – ${pok.map(([nm]) => esc(nm)).join(' – ')}`;
  const line3 = [ttl(p0), p0.alamat].filter(Boolean).map(esc).join(' – ');
  let body = '';
  if (open) {
    body = `<div class="gd">${pok.map(([nm, rs]) => {
      const dpt = [...new Set(rs.map(r => r.dpt).filter(Boolean))].join(' / ');
      return `<div class="pr open"><div class="prh"><b>${esc(nm)}</b>${dpt ? ` <span class="mut">(${esc(dpt)})</span>` : ''}<span class="mut sm">${rs.length} komoditas</span></div><div class="pb">${rs.map(komHtml).join('')}</div></div>`;
    }).join('')}<div class="rl"><button class="btn sm" data-addrec="${esc(key)}">${I.plus} Poktan / komoditas lain</button></div></div>`;
  }
  return `<div class="gr ${open ? 'open' : ''}" data-key="${esc(key)}"><div class="gh" data-tog="${esc(key)}"><div class="grow"><div class="t"><b>${esc(p0.nama)}</b> ${flags}</div><div class="t sub1">${line2}</div>${line3 ? `<div class="t sub1">${line3}</div>` : ''}</div>
    <button class="btn ic xs" data-addrec="${esc(key)}" title="Tambah poktan / komoditas">${I.plus}</button><button class="btn ic xs" data-person="${esc(key)}" title="Ubah data petani">${I.edit}</button></div>${body}</div>`;
}
function petani(el) {
  const poktans = [...new Set(S.petani.map(p => p.poktan).filter(Boolean))].sort(), koms = [...new Set(S.petani.map(p => p.komoditas).filter(Boolean))].sort();
  const q = F.q.toLowerCase();
  let groups = Object.entries(S.byNik).filter(([k, rs]) => rs.some(p => (!q || (p.nama || '').toLowerCase().includes(q) || (p.nik || '').includes(q)) && (!F.poktan || p.poktan === F.poktan) && (!F.kom || p.komoditas === F.kom)));
  const stF = { ba: p => sum(p.ba) > 0, bi: p => sum(p.bi) > 0, sisa: p => KODE.some(k => p.sisa[k] > 0), belum: p => sum(p.in) === 0 }[F.st];
  if (stF) groups = groups.filter(([k, rs]) => rs.some(stF));
  groups.sort((a, b) => a[1][0].nama.localeCompare(b[1][0].nama));
  el.innerHTML = `<div class="bar"><h2 style="flex:1">Petani <span class="mut sm">${n(groups.length)} NIK</span></h2>
    <button class="btn sm" id="xImp">${I.upload} Impor</button><button class="btn sm" id="xExp">${I.download} Ekspor</button>${isMgr() ? `<button class="btn sm pri" id="pAdd">${I.plus} Tambah</button>` : ''}</div>
    <div class="bar"><input class="in sm-in" style="max-width:220px" id="fq" placeholder="Filter nama / NIK" value="${esc(F.q)}">
      <select class="in sm-in" style="width:auto" id="fp"><option value="">Semua poktan</option>${poktans.map(x => `<option ${x === F.poktan ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
      <select class="in sm-in" style="width:auto" id="fk"><option value="">Semua komoditas</option>${koms.map(x => `<option ${x === F.kom ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
    <div class="bar">${[['', 'Semua'], ['ba', 'Belum ambil'], ['bi', 'Belum input'], ['sisa', 'Masih ada kuota'], ['belum', 'Belum ada input']].map(([k, l]) => `<span class="chip ${F.st === k ? 'on' : ''}" data-st="${k}">${l}</span>`).join('')}</div>
    <div class="card list dense" id="glist" style="padding:4px 8px">${groups.slice(0, F.lim).map(([k, rs]) => groupHtml(k, rs)).join('') || '<span class="mut">Tidak ada data</span>'}
    ${groups.length > F.lim ? `<div class="c" style="padding:10px"><button class="btn" id="more">Tampilkan lebih banyak</button></div>` : ''}</div>`;
  $('#fq').oninput = debounce(e => { F.q = e.target.value; F.lim = 60; petani(el); const i = $('#fq'); i.focus(); i.setSelectionRange(F.q.length, F.q.length); });
  $('#fp').onchange = e => { F.poktan = e.target.value; F.lim = 60; petani(el); }; $('#fk').onchange = e => { F.kom = e.target.value; F.lim = 60; petani(el); };
  $$('[data-st]', el).forEach(c => c.onclick = () => { F.st = c.dataset.st; F.lim = 60; petani(el); });
  $('#xImp').onclick = openImportPetani; $('#xExp').onclick = exportPetani; const pa = $('#pAdd'); if (pa) pa.onclick = () => openPetaniForm();
  const m = $('#more'); if (m) m.onclick = () => { F.lim += 100; petani(el); };
  wireGroups(el);
  if (F.focus) { const t = $(`[data-key="${CSS.escape(F.focus)}"]`, el); F.focus = null; if (t) setTimeout(() => t.scrollIntoView({ block: 'start' }), 30); }
}
function wireGroups(el) {
  const list = $('#glist', el); if (!list || list._w) return; list._w = true;
  list.addEventListener('click', e => {
    const t = e.target, B = s => t.closest(s);
    let b;
    if ((b = B('[data-addrec]'))) return openPetaniForm(null, b.dataset.addrec);
    if ((b = B('[data-person]'))) return openPetaniForm(null, null, b.dataset.person);
    if ((b = B('[data-jual]'))) return openJual(S.pid[b.dataset.jual]);
    if ((b = B('[data-bi]'))) return openBelumInput(S.pid[b.dataset.bi]);
    if ((b = B('[data-edit]'))) return openPetaniForm(S.pid[b.dataset.edit]);
    if ((b = B('[data-ambil]'))) return openAmbil(b.dataset.ambil);
    if ((b = B('[data-nota]'))) return cetakNota(b.dataset.nota);
    if ((b = B('[data-cetak]'))) { const [no, md, pid] = b.dataset.cetak.split('|'); return cetakNota(no, md, pid || null); }
    if ((b = B('button[data-no]'))) return openSale(b.dataset.no);
    if ((b = B('[data-tog]'))) {
      const k = b.dataset.tog; if (F.open.has(k)) F.open.delete(k); else F.open.add(k);
      const g = b.closest('.gr'), key = g.dataset.key, y = window.scrollY;
      g.outerHTML = groupHtml(key, S.byNik[key]); window.scrollTo(0, y);
    }
  });
}

// ===== penjualan =====
function penjualan(el) {
  const q = F.pq.toLowerCase(), days = F.pr;
  const lim = days === 'all' ? '' : tglWIB(new Date(Date.now() - (Number(days) - 1) * 864e5));
  const r = S.pen.filter(x => (!q || (x.nama_petani || '').toLowerCase().includes(q) || (x.nik || '').includes(q) || x.no_pesanan.toLowerCase().includes(q)) && (!lim || tglWIB(x.tanggal_waktu) >= lim));
  const tot = r.reduce((a, b) => a + Number(b.total_harga), 0), inp = z(); r.forEach(s => KODE.forEach(k => inp[k] += s.in[k]));
  el.innerHTML = `<div class="bar"><h2 style="flex:1">Penjualan</h2><button class="btn sm" id="xEx">${I.download} Ekspor</button><button class="btn pri" id="add">${I.plus} Tambah</button></div>
    <div class="bar"><input class="in sm-in" style="max-width:240px" id="pq" placeholder="Cari nama / NIK / no. pesanan" value="${esc(F.pq)}">${[['1', 'Hari ini'], ['7', '7 hari'], ['30', '30 hari'], ['all', 'Semua']].map(([k, l]) => `<span class="chip ${days === k ? 'on' : ''}" data-d="${k}">${l}</span>`).join('')}</div>
    <div class="grid g4" style="margin-bottom:12px">${kpi('Transaksi', n(r.length), I.cart)}${kpi('Omzet (dari input)', rp(tot), I.money)}${kpiLines('Input', I.box, inp, '', 'penjualan').replace('click', '')}</div>
    <div class="card list">${r.slice(0, 150).map(saleRow).join('') || '<span class="mut">Tidak ada penjualan</span>'}
      ${r.length > 150 ? `<div class="mut sm c" style="padding:8px">Menampilkan 150 terbaru dari ${n(r.length)}. Persempit dengan filter.</div>` : ''}</div>`;
  $('#add').onclick = () => openJual(); $('#xEx').onclick = exportPenjualan;
  $('#pq').oninput = debounce(e => { F.pq = e.target.value; penjualan(el); const i = $('#pq'); i.focus(); i.setSelectionRange(F.pq.length, F.pq.length); });
  $$('[data-d]', el).forEach(c => c.onclick = () => { F.pr = c.dataset.d; penjualan(el); });
  wireCommon(el);
}

// ===== belum ambil / belum input =====
function belum(el) {
  const tab = F.bs || 'ba'; F.bs = tab;
  let body = '';
  if (tab === 'ba') {
    const r = S.pen.filter(s => sum(s.ba) > 0);
    body = `<p class="mut sm">Rencana yang diberikan ke petani dikurangi yang sudah diambil. Tambah pengambilan kapan saja (tanggal & jam berbeda).</p>
    <div class="card list">${r.map(s => `<div class="li" data-no="${esc(s.no_pesanan)}"><div class="av">${esc(ini(s.nama_petani))}</div><div class="grow"><div class="t b">${esc(s.nama_petani)} <span class="mut sm">· ${esc(s.komoditas)} · ${esc(s.nama_poktan)}</span></div><div class="mut sm t">${esc(s.no_pesanan)} · ${tgl(s.tanggal_waktu)}</div>
      <div class="sm">${KODE.filter(k => s.ba[k] > 0).map(k => `<span class="c-${k}"><i class="dot"></i>${NAMA[k]} <b>${n(s.ba[k])}</b> kg <span class="mut">(${n(sak(s.ba[k], berat(k)))} sak)</span></span>`).join(' &nbsp; ')}</div></div>
      <button class="btn sm pri" data-ambil="${esc(s.no_pesanan)}">${I.truck} Ambil</button></div>`).join('') || '<span class="ok">Tidak ada, semuanya sudah diambil.</span>'}</div>`;
  } else {
    const r = S.petani.filter(p => sum(p.bi) > 0);
    body = `<p class="mut sm">Petani yang sudah mengambil barang tetapi belum diinput di aplikasi pupuk resmi. Saat penjualannya diinput, centang "Sudah mengambil sebelum diinput" agar otomatis pindah.</p>
    <div class="bar"><button class="btn sm pri" id="biAdd">${I.plus} Catat ambil sebelum input</button></div>
    <div class="card list">${r.map(p => `<div class="li" data-pid="${p.id_data}"><div class="av">${esc(ini(p.nama))}</div><div class="grow"><div class="t b">${esc(p.nama)} <span class="mut sm">· ${esc(p.komoditas)} · ${esc(p.poktan)}</span></div>
      <div class="sm">${KODE.filter(k => p.bi[k] > 0).map(k => `<span class="c-${k}"><i class="dot"></i>${NAMA[k]} <b>${n(p.bi[k])}</b> kg <span class="mut">(${n(sak(p.bi[k], berat(k)))} sak)</span></span>`).join(' &nbsp; ')}</div></div>
      <button class="btn sm pri" data-jual="${p.id_data}">${I.plus} Input</button></div>`).join('') || '<span class="ok">Tidak ada, semuanya sudah diinput.</span>'}</div>`;
  }
  el.innerHTML = `<div class="bar"><h2 style="flex:1">Belum ambil / belum input</h2></div>
    <div class="bar"><span class="chip ${tab === 'ba' ? 'on' : ''}" data-t="ba">Belum ambil</span><span class="chip ${tab === 'bi' ? 'on' : ''}" data-t="bi">Belum input</span></div>${body}`;
  $$('[data-t]', el).forEach(c => c.onclick = () => { F.bs = c.dataset.t; belum(el); });
  $$('[data-ambil]', el).forEach(b => b.onclick = e => { e.stopPropagation(); openAmbil(b.dataset.ambil); });
  $$('[data-jual]', el).forEach(b => b.onclick = e => { e.stopPropagation(); openJual(S.pid[b.dataset.jual]); });
  $$('.li[data-pid]', el).forEach(c => c.onclick = () => hooks.openNik(S.pid[c.dataset.pid].nik || 'id' + c.dataset.pid));
  $$('.li[data-no]', el).forEach(c => c.onclick = () => openSale(c.dataset.no));
  const a = $('#biAdd'); if (a) a.onclick = () => openBelumInput();
}

// ===== gudang =====
function gudang(el) {
  const st = stokProduk(), batas = Number(S.set.batas_stok_menipis) || 2000;
  const row = (l, v, k, cls = '') => `<tr><td>${l}</td><td class="num ${cls}">${n(v)} kg</td><td class="num mut">${n(sak(v, berat(k)))} sak</td></tr>`;
  el.innerHTML = `<div class="bar"><h2 style="flex:1">Gudang</h2>${isMgr() ? `<button class="btn pri" id="terima">${I.plus} Terima barang</button>` : ''}</div>
    <div class="grid g2">${st.map(x => `<div class="card c-${x.k}"><div style="display:flex;justify-content:space-between"><b><i class="dot"></i>${esc(x.pr.nama)}</b>${x.fisik < batas && x.masuk > 0 ? '<span class="tag bad">menipis</span>' : ''}</div>
      <table class="dn" style="margin-top:6px">${row('Stok awal gudang', x.awal, x.k)}${row('Barang masuk (tebus)', x.masuk, x.k)}${row('Diambil petani', -x.ambil, x.k)}${row('Ambil sebelum input', -x.bi, x.k)}${row('Keluar luar kelompok', -x.lkOut, x.k)}${row('Masuk dari luar', x.lkIn, x.k)}
      <tr><td class="b">Stok di gudang</td><td class="num b">${n(x.fisik)} kg</td><td class="num b">${n(sak(x.fisik, berat(x.k)))} sak</td></tr></table>
      <div class="sm mut" style="margin:6px 0 2px">Menurut input aplikasi resmi</div>
      <table class="dn">${row('Input (tersalur)', x.input, x.k)}${row('Rencana diberikan ke petani', x.rencana, x.k)}${row('Milik kios (input − rencana)', x.kios, x.k)}${row('Belum diambil petani', x.ba, x.k, x.ba > 0 ? 'warn' : '')}${row('Stok menurut input', x.sistem, x.k)}${row('Selisih fisik − input', x.selisih, x.k, x.selisih < 0 ? 'bad' : '')}${x.belakang ? row('Gudang belakang', x.belakang, x.k) : ''}</table></div>`).join('')}</div>
    <div class="sec"><h3>Riwayat barang masuk</h3></div><div class="card"><div class="tw"><table class="dn"><tr><th>Tanggal</th><th>Produk</th><th class="num">Masuk (kg)</th><th class="num">Harga beli</th><th>Dokumen</th></tr>
    ${[...S.stok].sort((a, b) => String(b.tanggal_input).localeCompare(String(a.tanggal_input))).map(s => `<tr><td>${tgl(s.tanggal_input)}</td><td>${esc(S.byId[s.id_produk]?.nama || '')}</td><td class="num">${n(s.jumlah_masuk)}</td><td class="num">${rp(s.harga_beli_total)}</td><td class="mut sm">${esc(s.id_stok)}${s.keterangan ? ' · ' + esc(s.keterangan) : ''}</td></tr>`).join('')}</table></div></div>`;
  const t = $('#terima'); if (t) t.onclick = terimaBarang;
}
function terimaBarang() {
  openDrawer(`<div class="fld"><label>Produk</label><select class="in" id="tP">${KODE.map(k => S.byKode[k]).map(p => `<option value="${p.id}">${esc(p.nama)}</option>`).join('')}</select></div>
    <div class="fld"><label>No. dokumen / BAST (opsional)</label><input class="in" id="tN" placeholder="PKP…"></div>
    <div class="row2"><div class="fld"><label>Jumlah masuk (kg)</label><input class="in" id="tJ" type="number" inputmode="decimal"></div><div class="fld"><label>Harga beli total (Rp)</label><input class="in" id="tH" type="number" inputmode="decimal"></div></div>
    <div class="fld"><label>Keterangan</label><input class="in" id="tK"></div><div class="mut sm" id="tKg"></div>`,
    {
      title: 'Terima barang', footer: '<button class="btn" data-close>Batal</button><button class="btn pri" id="tS">Simpan</button>', onOpen: d => {
        const u = () => { const j = Number($('#tJ', d).value), h = Number($('#tH', d).value); $('#tKg', d).textContent = j > 0 && h > 0 ? 'Harga beli per kg: ' + rp(h / j) : ''; }; $('#tJ', d).oninput = $('#tH', d).oninput = u;
        $('#tS', d).onclick = async () => {
          const j = Number($('#tJ', d).value), h = Number($('#tH', d).value) || null; if (!(j > 0)) return toast('Isi jumlah');
          const pr = S.byId[$('#tP', d).value];
          const { error } = await sb.from('stok').insert({ id_stok: $('#tN', d).value.trim() || 'M' + uid(), id_produk: pr.id, tanggal_input: new Date().toISOString(), jumlah_masuk: j, harga_beli_total: h, harga_beli_kg: h ? h / j : null, keterangan: $('#tK', d).value || null, berat_sak: pr.berat_sak });
          if (error) return toast(error.message); toast('Tersimpan'); closeDrawer(); await boot(true);
        };
      }
    });
}

// ===== luar kelompok =====
async function luar(el) {
  el.innerHTML = '<span class="mut">Memuat…</span>';
  const ket = (det, idk, id) => det.filter(d => d[idk] === id).map(d => `${NAMA[S.byId[d.id_produk]?.kode] || ''} ${n(d.jumlah)}`).join(', ');
  const [lk, lkm] = [[...S.lkRaw || []], []];
  const lkH = await all('luar_kelompok', '*', 'id_lk'), lkmH = await all('lk_masuk', '*', 'id_lkm');
  lkH.sort((a, b) => String(b.tanggal_waktu).localeCompare(String(a.tanggal_waktu))); lkmH.sort((a, b) => String(b.tanggal_waktu).localeCompare(String(a.tanggal_waktu)));
  const blok = (jud, hdr, det, idk, nm) => `<div class="sec"><h3>${jud}</h3></div><div class="card"><div class="tw"><table class="dn"><tr><th>Tanggal</th><th>${nm === 'pembeli' ? 'Pembeli' : 'Dari'}</th><th>Barang (kg)</th><th class="num">Total</th></tr>
    ${hdr.map(h => `<tr><td>${tgl(h.tanggal_waktu)}</td><td>${esc(h[nm])}</td><td>${ket(det, idk, h[idk])}</td><td class="num">${rp(h.total_harga)}</td></tr>`).join('')}</table></div></div>`;
  el.innerHTML = `<div class="bar"><h2 style="flex:1">Luar kelompok</h2><button class="btn pri" id="lkJ">${I.plus} Jual luar</button>${isMgr() ? `<button class="btn" id="lkM">${I.plus} Terima dari luar</button>` : ''}</div>
    <div class="grid g4">${kpi('Penjualan luar', rp(S.dlk.reduce((a, b) => a + Number(b.subtotal), 0)), I.out, n(lkH.length) + ' transaksi')}${kpi('Barang masuk dari luar', rp(S.dlm.reduce((a, b) => a + Number(b.subtotal), 0)), I.truck, n(lkmH.length) + ' transaksi')}</div>
    ${blok('Penjualan luar kelompok', lkH, S.dlk, 'id_lk', 'pembeli')}${blok('Barang masuk dari luar', lkmH, S.dlm, 'id_lkm', 'dari')}`;
  $('#lkJ').onclick = () => formLK(true); const m = $('#lkM'); if (m) m.onclick = () => formLK(false);
}
function formLK(keluar) {
  const prods = KODE.map(k => S.byKode[k]);
  openDrawer(`<div class="fld"><label>${keluar ? 'Pembeli' : 'Dari'}</label><input class="in" id="lN"></div>
    ${prods.map(p => `<div class="card c-${p.kode}" style="margin-bottom:8px;padding:9px" data-p="${p.id}"><b><i class="dot"></i>${NAMA[p.kode]}</b><div class="row2"><div class="fld"><label>Jumlah (kg)</label><input class="in" type="number" inputmode="decimal" data-f="j"></div><div class="fld"><label>Harga /kg</label><input class="in" type="number" inputmode="decimal" data-f="h" value="${keluar ? p.harga_luar : (p.hlm || '')}"></div></div></div>`).join('')}
    <div class="fld"><label>Keterangan</label><input class="in" id="lK"></div><div class="card" style="display:flex;justify-content:space-between"><span class="mut">Total</span><b id="lT">Rp 0</b></div>`,
    {
      title: keluar ? 'Jual luar kelompok' : 'Terima dari luar', footer: '<button class="btn" data-close>Batal</button><button class="btn pri" id="lS">Simpan</button>', onOpen: d => {
        const calc = () => { let t = 0; $$('[data-p]', d).forEach(c => t += (Number($('[data-f=j]', c).value) || 0) * (Number($('[data-f=h]', c).value) || 0)); $('#lT', d).textContent = rp(t); return t; };
        $$('input', d).forEach(i => i.oninput = calc);
        $('#lS', d).onclick = async () => {
          const nm = $('#lN', d).value.trim(), id = uid(), det = [];
          $$('[data-p]', d).forEach(c => { const j = Number($('[data-f=j]', c).value) || 0, h = Number($('[data-f=h]', c).value) || 0, pr = S.byId[c.dataset.p]; if (j > 0) det.push({ id_produk: pr.id, nama_produk: pr.nama, jumlah: j, harga_satuan: h, subtotal: j * h, berat_sak: pr.berat_sak }); });
          if (!nm || !det.length) return toast('Isi nama dan jumlah');
          const tot = det.reduce((a, b) => a + b.subtotal, 0);
          const hd = keluar ? { id_lk: id, pembeli: nm, total_harga: tot, keterangan: $('#lK', d).value || null } : { id_lkm: id, dari: nm, total_harga: tot, keterangan: $('#lK', d).value || null };
          let r = await sb.from(keluar ? 'luar_kelompok' : 'lk_masuk').insert(hd); if (r.error) return toast(r.error.message);
          r = await sb.from(keluar ? 'detail_lk' : 'dlk_masuk').insert(det.map((x, i) => keluar ? { id_dlk: id + i, id_lk: id, pembeli: nm, ...x } : { id_dlkm: id + i, id_lkm: id, dari: nm, ...x }));
          if (r.error) return toast(r.error.message);
          toast('Tersimpan'); closeDrawer(); await boot(true);
        };
      }
    });
}

// ===== poktan =====
function poktan(el) {
  el.innerHTML = `<div class="bar"><h2>Poktan & kuota</h2></div><div class="grid g2">${perPoktan().map(o => `<div class="card"><div style="display:flex;justify-content:space-between"><b>${esc(o.nama)}</b><span class="mut sm">${o.niks.size} petani</span></div>
    ${KODE.filter(k => o.q[k] > 0).map(k => `<div class="pk c-${k}" style="margin-top:6px"><span class="pn"><i class="dot"></i>${NAMA[k]}</span>${lbar(o.q[k], o.in[k], o.rc[k], o.ak[k], k)}<span class="pt">kuota <b>${n(o.q[k])}</b> · input <b>${n(o.in[k])}</b> (${pct(o.in[k], o.q[k]).toFixed(1)}%) · rencana <b>${n(o.rc[k])}</b> · ambil <b>${n(o.ak[k])}</b> · sisa <b>${n(o.q[k] - o.in[k])}</b></span></div>`).join('')}</div>`).join('')}</div>`;
}

// ===== keuangan (rumus sheet Keu lama) =====
function keuangan(el) {
  const st = stokProduk(), s = S.set;
  const hsak = k => Number(s['harga_sak_' + k]) || 0;
  const tebus = st.reduce((a, x) => a + (Number(x.pr.stok_awal) + x.masuk + x.lkIn) * Number(x.pr.harga_beli_kg), 0);
  const tebusLuar = S.dlm.reduce((a, b) => a + Number(b.subtotal), 0);
  const jual = st.reduce((a, x) => a + ((x.ambil + x.bi) / berat(x.k)) * hsak(x.k), 0);
  const jualLuar = S.dlk.reduce((a, b) => a + Number(b.subtotal), 0);
  const lebih = jualLuar + jual - tebusLuar - tebus;
  const sisaGud = st.reduce((a, x) => a + x.fisik * Number(x.pr.harga_beli_kg), 0);
  el.innerHTML = `<div class="bar"><h2>Keuangan</h2></div><div class="grid g4">
    ${kpi('Penebusan (modal)', rp(tebus), I.truck, 'stok awal + masuk, x harga beli')}${kpi('Penebusan luar', rp(tebusLuar), I.out, 'barang masuk dari luar')}
    ${kpi('Penjualan', rp(jual), I.cart, 'pengambilan x harga per sak')}${kpi('Penjualan luar', rp(jualLuar), I.out)}
    ${kpi('Sisa lebih', rp(lebih), I.money, 'penjualan + luar − modal')}${kpi('Nilai sisa gudang', rp(sisaGud), I.box, 'stok gudang x harga beli')}${kpi('Total', rp(lebih + sisaGud), I.chart, 'sisa lebih + sisa gudang')}</div>
    <div class="sec"><h3>Total penjualan per hari (dari input)</h3></div><div class="card"><div class="tw"><table class="dn"><tr><th>Tanggal</th><th class="num">Transaksi</th><th class="num">Omzet</th></tr>
    ${Object.entries(S.pen.reduce((m, p) => { const k = tglWIB(p.tanggal_waktu); (m[k] ||= [0, 0]); m[k][0]++; m[k][1] += Number(p.total_harga); return m; }, {})).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 60).map(([k, v]) => `<tr><td>${tgl(k)}</td><td class="num">${v[0]}</td><td class="num">${rp(v[1])}</td></tr>`).join('')}</table></div></div>`;
}

// ===== lainnya (HP) =====
function lainnya(el) {
  el.innerHTML = `<div class="bar"><h2>Menu lain</h2></div><div class="grid g4">${MENU.filter(m => !BNAV.includes(m[0])).map(m => `<div class="card kpi click" data-go="${m[0]}"><div class="l"><span class="ic">${m[2]}</span>${m[1]}</div></div>`).join('')}
    <div class="card kpi click" id="mHit"><div class="l"><span class="ic">${I.calc}</span>Hitung cepat</div></div><div class="card kpi click" id="mOut"><div class="l"><span class="ic">${I.out}</span>Keluar</div></div></div>`;
  wireCommon(el); $('#mHit').onclick = openHitung; $('#mOut').onclick = async () => { await sb.auth.signOut(); boot(); };
}

// ===== pengaturan =====
async function pengaturan(el) {
  const th = lsGet('theme', 'light'), ac = lsGet('accent', 'hijau');
  el.innerHTML = `<div class="bar"><h2>Pengaturan</h2></div><div class="grid g2">
  <div class="card"><h3>Tampilan</h3><div class="bar" style="margin-top:8px"><span class="chip ${th === 'light' ? 'on' : ''}" data-th="light">Terang</span><span class="chip ${th === 'dark' ? 'on' : ''}" data-th="dark">Gelap</span></div>
    <div class="bar">${[['hijau', '#16a34a'], ['biru', '#2563eb'], ['oranye', '#ea580c']].map(([k, c]) => `<span class="chip ${ac === k ? 'on' : ''}" data-ac="${k}"><i class="dot" style="--c:${c}"></i>${k}</span>`).join('')}</div>
    ${standalone() ? '' : `<button class="btn sm" id="sInst">${I.install} Pasang aplikasi di perangkat ini</button>`}</div>
  <div class="card"><h3>Akun</h3><p class="mut">${esc(S.user.email)} · ${esc(S.prof.role)}</p><div class="fld"><label>Ganti kata sandi</label><input class="in" type="password" id="np" minlength="6" placeholder="kata sandi baru"></div><button class="btn" id="npS">Simpan kata sandi</button></div>
  ${isMgr() ? `<div class="card"><h3>Harga & nota</h3><div id="hargaF"></div></div>` : ''}
  ${isAdmin() ? `<div class="card"><h3>Pengguna</h3><div id="usr" class="list"><span class="mut">Memuat…</span></div></div>
  <div class="card"><h3>Impor data lama (JSON migrasi)</h3><p class="mut sm">Pilih file <b>import_z26.json</b> hasil migrasi dari AppSheet. Aman diulang (data yang sama ditimpa, tidak dobel).</p><input type="file" id="imp" accept=".json"><div id="impLog" class="sm mut" style="margin-top:8px;white-space:pre-line"></div></div>` : ''}</div>`;
  $$('[data-th]', el).forEach(c => c.onclick = () => { lsSet('theme', c.dataset.th); applyTheme(); pengaturan(el); });
  $$('[data-ac]', el).forEach(c => c.onclick = () => { lsSet('accent', c.dataset.ac); applyTheme(); pengaturan(el); });
  const si = $('#sInst'); if (si) si.onclick = pasang;
  $('#npS').onclick = async () => { const v = $('#np').value; if (v.length < 6) return toast('Minimal 6 karakter'); const { error } = await sb.auth.updateUser({ password: v }); toast(error ? error.message : 'Kata sandi diperbarui'); };
  if (isMgr()) {
    const keys = [['nama_kios', 'Nama kios'], ['kode_kios', 'Kode kios'], ['alamat_kios', 'Alamat'], ['judul_nota_1', 'Judul nota 1'], ['judul_nota_2', 'Judul nota 2'], ['koli_per_sak', 'Koli per sak'], ['harga_sak_urea', 'Harga/sak Urea'], ['harga_sak_phonska', 'Harga/sak Phonska'], ['harga_sak_organik', 'Harga/sak Organik'], ['harga_sak_za', 'Harga/sak ZA'], ['batas_stok_menipis', 'Batas stok menipis (kg)']];
    $('#hargaF').innerHTML = `<p class="sm mut">Harga jual per kg</p>${KODE.map(k => S.byKode[k]).map(p => `<div class="row2"><div class="fld"><label>${esc(p.nama)} jual /kg</label><input class="in" type="number" data-pj="${p.id}" value="${p.harga_jual}"></div><div class="fld"><label>Luar kelompok /kg</label><input class="in" type="number" data-pl="${p.id}" value="${p.harga_luar}"></div></div>`).join('')}
      ${keys.map(([k, l]) => `<div class="fld"><label>${l}</label><input class="in" data-set="${k}" value="${esc(S.set[k] ?? '')}"></div>`).join('')}<button class="btn pri" id="hS">Simpan</button>`;
    $('#hS').onclick = async () => {
      for (const p of S.produk) { const j = $(`[data-pj="${p.id}"]`), l = $(`[data-pl="${p.id}"]`); if (j) await sb.from('produk').update({ harga_jual: Number(j.value), harga_luar: Number(l.value) }).eq('id', p.id); }
      for (const i of $$('[data-set]')) await sb.from('pengaturan').upsert({ kunci: i.dataset.set, nilai: i.value });
      toast('Tersimpan'); await boot(true);
    };
  }
  if (isAdmin()) {
    const { data } = await sb.from('profiles').select('*').order('created_at');
    $('#usr').innerHTML = (data || []).map(u => `<div class="li" style="cursor:default"><div class="grow"><div class="t b">${esc(u.nama || u.email)}</div><div class="mut sm t">${esc(u.email)}</div></div>
      <select class="in" style="width:auto" data-r="${u.id}"><option ${u.role === 'karyawan' ? 'selected' : ''}>karyawan</option><option value="owner" ${u.role === 'owner' ? 'selected' : ''}>owner</option><option ${u.role === 'admin' ? 'selected' : ''}>admin</option></select>
      <select class="in" style="width:auto" data-s="${u.id}"><option value="pending" ${u.status === 'pending' ? 'selected' : ''}>menunggu</option><option value="approved" ${u.status === 'approved' ? 'selected' : ''}>disetujui</option><option value="rejected" ${u.status === 'rejected' ? 'selected' : ''}>ditolak</option></select></div>`).join('');
    const upd = async (id, patch) => { const { error } = await sb.from('profiles').update(patch).eq('id', id); toast(error ? error.message : 'Diperbarui'); };
    $$('[data-r]').forEach(s => s.onchange = () => upd(s.dataset.r, { role: s.value }));
    $$('[data-s]').forEach(s => s.onchange = () => upd(s.dataset.s, { status: s.value, ...(s.value === 'approved' ? { approved_at: new Date().toISOString(), approved_by: S.user.id } : {}) }));
    $('#imp').onchange = e => impor(e.target.files[0]);
  }
}
async function impor(file) {
  if (!file) return; const log = $('#impLog'); const say = t => log.textContent += t + '\n'; log.textContent = '';
  const D = JSON.parse(await file.text());
  const order = [['poktan', 'id'], ['kuota_ipuber', 'id'], ['petani', 'id_data'], ['stok', 'id_stok'], ['penjualan', 'no_pesanan'], ['detail', 'id_detail'], ['diambil', 'id_diambil'], ['keluar_gudang', 'id_kg'], ['blum_foto', 'id_blmfoto'], ['luar_kelompok', 'id_lk'], ['detail_lk', 'id_dlk'], ['lk_masuk', 'id_lkm'], ['dlk_masuk', 'id_dlkm']];
  for (const p of D.produk_update || []) await sb.from('produk').update(p).eq('id', p.id);
  say('Produk diperbarui');
  for (const [t, pk] of order) {
    const rows = D[t] || []; let ok = 0;
    for (let i = 0; i < rows.length; i += 400) {
      const { error } = await sb.from(t).upsert(rows.slice(i, i + 400), { onConflict: pk });
      if (error) { say(`✗ ${t}: ${error.message}`); break; } ok += Math.min(400, rows.length - i);
    }
    say(`${ok === rows.length ? '✓' : '!'} ${t}: ${ok}/${rows.length}`);
  }
  say('Selesai. Memuat ulang…'); await boot(true);
}

// ===== mulai =====
let booting = false;
async function boot(keep) {
  if (booting) return; booting = true;
  try {
    await loadProfile();
    if (!S.user) return loginScreen();
    if (!S.prof || S.prof.status !== 'approved') return pendingScreen();
    if (!keep || !$('#page')) { $('#root').innerHTML = '<div class="c mut" style="padding:40px">Memuat data…</div>'; }
    await loadAll();
    if (!$('#page')) {
      shell(); view = hashView();
      try { nav.scroll = JSON.parse(sessionStorage.getItem('z26scroll') || '{}'); } catch { }
      nav.eid = (history.state && history.state.id) || uid(); history.replaceState({ id: nav.eid }, '', '#/' + view);
    }
    render();
    if (nav.scroll[nav.eid]) restoreScroll(nav.scroll[nav.eid]);
  } catch (e) { console.error(e); $('#root').innerHTML = `<div class="c bad" style="padding:40px">Gagal memuat: ${esc(e.message)}<br><button class="btn" onclick="location.reload()">Coba lagi</button></div>`; }
  finally { booting = false; }
}
sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_IN' && !S.loaded) boot(); if (ev === 'SIGNED_OUT') { S.loaded = false; boot(); } });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
boot();
