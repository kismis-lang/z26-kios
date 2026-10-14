import { $, $$, esc, n, rp, KODE, NAMA, tgl, tglJam, ini, pct, uid, toast, I, lsGet, lsSet, debounce, tglWIB, sak } from './util.js';
import { sb, S, loadProfile, loadAll, reloadTx, loadTahun, isMgr, isAdmin, all, ringkasHariIni, totalBelum, stokProduk, perPoktan, penjualan14Hari, sum, z } from './data.js';
import { hooks, nav, openDrawer, closeDrawer, isDrawerOpen, barHtml, lbar, berat, kgSak } from './ui.js';
import { openJual, openSale, openAmbil, openBelumInput, openPetaniForm, openDptForm, cetakNota, openHitung } from './forms.js';
import { exportPetani, exportPenjualan, openImportPetani } from './xls.js';
import { openImporBerkas, bukaBerkas, unggahStok } from './berkas.js';

// ===== tema =====
const root = document.documentElement;
function applyTheme() {
  root.dataset.theme = lsGet('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.dataset.accent = lsGet('accent', 'hijau');
  // warna bilah status HP (jam, baterai, sinyal) = warna latar, bukan warna tema
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim() || (root.dataset.theme === 'dark' ? '#12161d' : '#eef1f5');
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
  const m = document.createElement('meta'); m.name = 'theme-color'; m.content = bg; document.head.appendChild(m);
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
      <select class="in sm-in yrsel" id="yr" title="Tahun data"></select>
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
  $('#yr').onchange = async e => {
    const v = e.target.value; if (v === 'new') { yrFill(); return openTahunBaru(); }
    S.tahun = Number(v); lsSet('tahun', v); F.open.clear(); await boot(true);
  };
  hooks.refresh = () => render(true);
  hooks.openNik = nik => {
    F.q = ''; F.poktan = ''; F.kom = ''; F.st = '';
    for (const o of [...F.open]) if (S.byNik[o]) F.open.delete(o);       // hanya 1 petani terbuka
    F.open.add(nik); F.focus = nik;
    const keys = Object.entries(S.byNik).sort((a, b) => a[1][0].nama.localeCompare(b[1][0].nama)).map(x => x[0]);
    F.lim = Math.max(60, keys.indexOf(nik) + 30);                        // pastikan barisnya ikut tampil
    if (view === 'petani') render(); else go('petani', { force: true });
  };
}
function yrFill() {
  const e = $('#yr'); if (!e) return;
  e.innerHTML = S.tahunList.map(t => `<option value="${t}" ${t === S.tahun ? 'selected' : ''}>${t}</option>`).join('') + (isMgr() ? '<option value="new">+ Tahun baru…</option>' : '');
}
function render(keepScroll) {
  const y = window.scrollY; yrFill();
  $$('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === view || (b.closest('#bnav') && b.dataset.v === 'lainnya' && !BNAV.includes(view))));
  const P = { beranda, petani, penjualan, belum, gudang, luar, poktan, keuangan, pengaturan, lainnya }[view] || beranda;
  P($('#page'));
  if (keepScroll) restoreScroll(y);
}

// ===== kartu =====
const kpi = (l, v, ic, sub = '', go = '') => `<div class="card kpi ${go ? 'click' : ''}" ${go ? `data-go="${go}"` : ''}><div class="l"><span class="ic">${ic}</span>${l}</div><div class="v">${v}</div><div class="mut sm">${sub}</div></div>`;
const kpiLines = (l, ic, o, sub, go) => `<div class="card kpi click" data-go="${go}"><div class="l"><span class="ic">${ic}</span>${l}</div><div class="kls">${KODE.map(k => `<div class="kl c-${k}"><i class="dot"></i>${NAMA[k]} <b>${n(o[k])}</b> kg <span class="mut">(${n(sak(o[k], berat(k)))} sak)</span></div>`).join('')}</div><div class="mut sm">${sub}</div></div>`;

// ===== beranda =====
const ks = (v, k) => `<b>${n(v)}</b> kg <span class="mut">(${n(sak(v, berat(k)))} sak)</span>`;
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function beranda(el) {
  const h = ringkasHariIni(), b = totalBelum(), st = stokProduk(), batas = Number(S.set.batas_stok_menipis) || 2000, pk = perPoktan(), hr = penjualan14Hari();
  const AK = KODE.filter(k => S.petani.some(p => p.q[k] > 0 || p.in[k] > 0) || st.some(x => x.k === k && (x.masuk || x.fisik)));
  const today = tglWIB(new Date()), now = new Date();
  const ambilHr = z(), biHr = z(), inHr = z();
  S.kg.filter(x => tglWIB(x.tanggal_waktu) === today).forEach(x => KODE.forEach(k => ambilHr[k] += +x[k] || 0));
  S.bf.filter(x => tglWIB(x.tanggal_waktu) === today).forEach(x => KODE.forEach(k => biHr[k] += +x[k] || 0));
  h.list.forEach(s => KODE.forEach(k => inHr[k] += s.in[k]));
  const tot = { q: z(), in: z(), rc: z(), ak: z() };
  S.petani.forEach(p => KODE.forEach(k => { tot.q[k] += p.q[k]; tot.in[k] += p.in[k]; tot.rc[k] += p.rc[k]; tot.ak[k] += p.ak[k]; }));
  const maxO = Math.max(1, ...hr.map(x => x.omzet));
  const lines = (o, empty = '-') => { const L = AK.filter(k => o[k]); return L.length ? L.map(k => `<div class="kl c-${k}"><i class="dot"></i>${NAMA[k]} ${ks(o[k], k)}</div>`).join('') : `<div class="mut sm">${empty}</div>`; };
  // daftar petani per NIK (gabung komoditas)
  const perNik = f => { const m = {}; S.petani.forEach(p => { const v = f(p); if (!sum(v)) return; const key = p.nik || 'id' + p.id_data; const o = m[key] ||= { key, nama: p.nama, pok: new Set(), v: z() }; o.pok.add(p.poktan); KODE.forEach(k => o.v[k] += v[k]); }); return Object.values(m).sort((a, b) => sum(b.v) - sum(a.v)); };
  const baL = perNik(p => p.ba), biL = perNik(p => p.bi);
  const pList = (L, go) => L.slice(0, 6).map(o => `<div class="bl" data-nik="${esc(o.key)}"><span class="grow t"><b>${esc(o.nama)}</b> <span class="mut sm">${esc([...o.pok].join(', '))}</span></span><span class="sm r">${AK.filter(k => o.v[k]).map(k => `<span class="c-${k}"><i class="dot"></i>${n(sak(o.v[k], berat(k)))}</span>`).join(' ')} <span class="mut">sak</span></span></div>`).join('') + (L.length > 6 ? `<div class="r"><button class="btn sm" data-go="${go}">Semua ${L.length} petani ›</button></div>` : '');
  const sel = st.filter(x => AK.includes(x.k));
  el.innerHTML = `
  <div class="hello"><div><b>${HARI[now.getDay()]}, ${tgl(now)}</b><div class="mut sm">Data tahun ${S.tahun} · ${n(Object.keys(S.byNik).length)} petani · ${n(S.pen.length)} transaksi</div></div></div>

  <div class="card"><div class="sec" style="margin-top:0"><h3>Hari ini</h3><button class="btn sm" data-go="penjualan">Penjualan ›</button></div>
    <div class="grid g3">
      <div class="mini"><div class="mut sm">Penjualan</div><div class="big">${rp(h.omzet)}</div><div class="sm">${h.n} transaksi</div></div>
      <div class="mini"><div class="mut sm">Diinput (aplikasi resmi)</div>${lines(inHr, 'belum ada')}</div>
      <div class="mini"><div class="mut sm">Diambil dari gudang</div>${lines(Object.fromEntries(KODE.map(k => [k, ambilHr[k] + biHr[k]])), 'belum ada')}${sum(biHr) ? `<div class="sm bad">termasuk belum input: ${AK.filter(k => biHr[k]).map(k => NAMA[k] + ' ' + n(biHr[k]) + ' kg').join(', ')}</div>` : ''}</div>
    </div>
    ${h.list.length ? `<div class="list" style="margin-top:6px">${h.list.slice(0, 6).map(saleRow).join('')}</div>` : ''}</div>

  <div class="grid g2" style="margin-top:12px">
    <div class="card"><div class="sec" style="margin-top:0"><h3><span class="warn">●</span> Belum ambil <span class="mut sm">titipan petani di gudang</span></h3><button class="btn sm" data-go="belum:ba">${b.nBa} nota ›</button></div>
      <div class="kls">${lines(b.ba, 'tidak ada')}</div>${baL.length ? `<div class="bls">${pList(baL, 'belum:ba')}</div>` : ''}</div>
    <div class="card"><div class="sec" style="margin-top:0"><h3><span class="bad">●</span> Belum input <span class="mut sm">sudah diambil, belum diinput</span></h3><button class="btn sm" data-go="belum:bi">${b.nBi} petani ›</button></div>
      <div class="kls">${lines(b.bi, 'tidak ada')}</div>${biL.length ? `<div class="bls">${pList(biL, 'belum:bi')}</div>` : ''}</div>
  </div>

  <div class="card" style="margin-top:12px"><div class="sec" style="margin-top:0"><h3>Stok</h3><button class="btn sm" data-go="gudang">Gudang ›</button></div>
    <div class="tw"><table class="dn bt"><tr><th>Pupuk</th><th class="num">Gudang</th><th class="num">i-pubers</th><th class="num">Blm ambil</th><th class="num">Lebih/kurang</th></tr>
    ${sel.map(x => `<tr class="c-${x.k}"><td><i class="dot"></i>${NAMA[x.k]}${x.fisik < batas && x.masuk > 0 ? ' <span class="tag bad">menipis</span>' : ''}</td><td class="num">${n(x.fisik)}<div class="mut">${n(sak(x.fisik, berat(x.k)))} sak</div></td><td class="num">${n(x.sistem)}<div class="mut">${n(sak(x.sistem, berat(x.k)))} sak</div></td><td class="num">${n(x.titip)}<div class="mut">${n(sak(x.titip, berat(x.k)))} sak</div></td><td class="num b ${x.lebih < 0 ? 'bad' : 'ok'}">${n(x.lebih)}<div class="mut">${n(sak(x.lebih, berat(x.k)))} sak</div></td></tr>`).join('')}</table></div>
    <div class="mut sm">kg; lebih/kurang = gudang − i-pubers − belum ambil</div></div>

  <div class="card" style="margin-top:12px"><div class="sec" style="margin-top:0"><h3>Penyaluran kuota ${S.tahun}</h3><button class="btn sm" data-go="poktan">Poktan ›</button></div>
    ${AK.filter(k => tot.q[k] || tot.in[k]).map(k => `<div class="prow c-${k}"><div class="h"><span><i class="dot"></i><b>${NAMA[k]}</b></span><span><b>${n(tot.in[k])}</b> / ${n(tot.q[k])} kg <span class="mut">(${pct(tot.in[k], tot.q[k]).toFixed(1)}%)</span></span></div><div class="pg"><i style="width:${pct(tot.in[k], tot.q[k])}%"></i></div>
      <div class="sm mut pr3"><span>sisa kuota <b>${n(tot.q[k] - tot.in[k])}</b></span><span>rencana <b>${n(tot.rc[k])}</b></span><span>diambil <b>${n(tot.ak[k])}</b></span><span>milik kios <b>${n(tot.in[k] - tot.rc[k])}</b></span></div></div>`).join('')}</div>

  <div class="card" style="margin-top:12px"><div class="sec" style="margin-top:0"><h3>Per poktan</h3><span class="mut sm">input / kuota (sak)</span></div>
    <div class="tw"><table class="dn bt"><tr><th>Poktan</th>${AK.filter(k => tot.q[k]).map(k => `<th class="num c-${k}"><i class="dot"></i>${NAMA[k].replace('Pupuk ', '')}</th>`).join('')}<th class="num">%</th></tr>
    ${pk.map(o => `<tr data-pok="${esc(o.nama)}" class="click"><td><b>${esc(o.nama)}</b><div class="mut">${o.niks.size} petani</div></td>${AK.filter(k => tot.q[k]).map(k => `<td class="num">${n(Math.round(o.in[k] / berat(k)))}<span class="mut">/${n(Math.round(o.q[k] / berat(k)))}</span></td>`).join('')}<td class="num b">${pct(sum(o.in), sum(o.q)).toFixed(0)}%</td></tr>`).join('')}</table></div></div>

  <div class="grid g2" style="margin-top:12px">
    <div class="card"><div class="sec" style="margin-top:0"><h3>Penjualan 14 hari</h3><span class="mut sm">total ${rp(hr.reduce((a, b) => a + b.omzet, 0))}</span></div>
      <div class="hbar" style="margin-bottom:16px">${hr.map(x => `<div style="height:${Math.max(2, x.omzet / maxO * 100)}%" title="${x.k}: ${rp(x.omzet)}"><span>${x.label}</span></div>`).join('')}</div></div>
    <div class="card"><div class="sec" style="margin-top:0"><h3>Transaksi terbaru</h3><button class="btn sm" data-go="penjualan">Semua ›</button></div><div class="list">
      ${S.pen.slice(0, 6).map(saleRow).join('')}</div></div>
  </div>`;
  wireCommon(el);
  $$('[data-nik]', el).forEach(c => c.onclick = () => hooks.openNik(c.dataset.nik));
  $$('[data-pok]', el).forEach(c => c.onclick = () => { F.q = ''; F.kom = ''; F.st = ''; F.poktan = c.dataset.pok; F.lim = 60; go('petani', { force: true }); });
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
    <span class="pbar"><span class="ph"><span><b>${n(r.in[k])}</b> / ${n(r.q[k])} kg</span><span>sisa <b>${n(r.sisa[k])}</b> kg</span></span>${barHtml1(r.in[k], r.q[k], k)}</span></div>`).join('') || '<div class="mut">Tidak ada kuota</div>';
}
const barHtml1 = (v, t, k) => `<div class="pg s"><i class="${v > t && t > 0 ? 'o' : ''}" style="width:${pct(v, t)}%"></i></div>`;
const tblRows = (rows) => rows.map(d => `<div class="sdr2"><span class="nm">${esc(d.nama)}</span><span class="r">${rpk(d.q, d.h)}<b>${rp(d.sub)}</b></span></div>`).join('');
const sakTxt = (o, only) => KODE.filter(k => (only ? only(k) : o[k]) && Math.abs(o[k]) > 0).map(k => `${KET[k]} ${String(Math.round(o[k] / berat(k) * 10) / 10).replace('.', ',')}`).join(' ');
const KET = { urea: 'urea', phonska: 'poska', organik: 'organik', za: 'za' };
function ketOtomatis(r) {
  // jumlah yang sudah dibawa petani = sudah diambil + diambil sebelum input; dalam sak
  const tot = {}; KODE.forEach(k => tot[k] = (r.ak[k] || 0) + (r.bi[k] || 0));
  const ambil = sakTxt(tot);
  const nb = KODE.filter(k => r.bi[k] > 0).map(k => `(${KET[k]} ${sakS(r.bi[k], k)} blm input)`);
  const na = KODE.filter(k => r.ba[k] > 0).map(k => `(${KET[k]} ${sakS(r.ba[k], k)} sudah input blm ambil)`);
  if (!ambil && !na.length) return '';
  const habis = KODE.every(k => r.sisa[k] <= 0 || !r.q[k]) && !sum(r.ba) && !sum(r.bi);
  return [ambil ? 'ambil ' + ambil : '', [...nb, ...na].join(', ')].filter(Boolean).join(' ') + (habis ? ' (habis)' : '');
}
const sakS = (kg, k) => String(Math.round(kg / berat(k) * 10) / 10).replace('.', ',');
const bfList = id => S.bf.filter(x => x.id_data === id).sort((a, b) => String(a.tanggal_waktu).localeCompare(String(b.tanggal_waktu)));
const biBlock = r => { const L = bfList(r.id_data); if (!L.length) return '';
  return `<div class="nb bad"><b>Belum input</b> <span class="mut">(sudah diambil, belum diinput di aplikasi resmi)</span>${L.map(x => `<div class="pick"><span><b>${tglJam(x.tanggal_waktu)}</b> · ${KODE.filter(k => +x[k]).map(k => NAMA[k] + ' ' + n(x[k]) + ' kg').join(', ')}</span></div>`).join('')}</div>`; };
const baBlock = (o, note) => { const ba = KODE.filter(k => o[k] > 0).map(k => `${NAMA[k]} ${n(o[k])} kg (${n(sak(o[k], berat(k)))} sak)`); return ba.length ? `<div class="nb warn"><b>Belum diambil</b>: ${esc(ba.join(', '))}${note ? `<div class="mut">${note}</div>` : ''}</div>` : ''; };
function saleDetail(no, r) {
  const s = S.sale[no]; if (!s) return '';
  const hj = id => Number(S.byId[id]?.harga_jual) || 0;
  const inp = S.det.filter(d => d.no_pesanan === no).map(d => ({ nama: S.byId[d.id_produk]?.nama || '', q: d.jumlah, h: d.harga_satuan, sub: d.subtotal }));
  const rcR = S.amb.filter(d => d.no_pesanan === no).map(d => ({ nama: S.byId[d.id_produk]?.nama || '', q: d.jumlah, h: hj(d.id_produk), sub: d.jumlah * hj(d.id_produk) }));
  const rcTot = rcR.reduce((a, b) => a + b.sub, 0);
  const kios = KODE.map(k => [k, s.in[k] - s.rc[k]]).filter(([k, v]) => v !== 0).map(([k, v]) => `${KET[k]} ${n(v)} kg`);
  const o1 = F.open.has('t:' + no), o2 = F.open.has('u:' + no);
  const picks = s.picks.map(x => `<div class="pick"><span><b>${tglJam(x.tanggal_waktu)}</b> · ${KODE.filter(k => +x[k]).map(k => NAMA[k] + ' ' + n(x[k]) + ' kg').join(', ')}</span><button class="btn xs" data-cetak="${esc(no)}|ambil|${esc(x.id_kg)}" title="Cetak pengambilan">${I.print}</button></div>`).join('');
  const adaBa = sum(s.ba) > 0;
  const ambilBox = `<div class="lv lv5 ${o2 ? 'open' : ''}"><div class="tap tot" data-tog="u:${esc(no)}"><span class="chev">›</span><b>Total Harga</b><span class="sp"></span><b>${rp(rcTot)}</b></div>
      ${o2 ? `<div class="lvb"><div class="slh2"><b>Sudah diambil</b><span class="sp"></span>${adaBa ? `<button class="btn xs pri" data-ambil="${esc(no)}" title="Catat pengambilan">${I.plus}</button>` : ''}</div>${picks || '<div class="mut">Belum ada pengambilan</div>'}
        ${adaBa ? baBlock(s.ba, 'titipan petani di gudang (bukan milik kios)') : '<div class="ok">Semua rencana sudah diambil.</div>'}</div>` : ''}</div>`;
  return `<div class="lvb">${tblRows(inp)}
    <div class="lv lv4 ${o1 ? 'open' : ''}"><div class="tap tot" data-tog="t:${esc(no)}"><span class="chev">›</span><b>Total Harga</b><span class="sp"></span><b>${rp(s.total_harga)}</b></div>
    ${o1 ? `<div class="lvb"><div class="slh2"><b>Rencana</b>${kios.length ? ` <span class="mut">(${esc(kios.join(', '))})</span>` : ''}<span class="sp"></span>${rcR.length ? `<button class="btn xs" data-cetak="${esc(no)}|rencana" title="Cetak rencana">${I.print}</button>` : ''}</div>
      ${rcR.length ? tblRows(rcR) + ambilBox : `<div class="mut">Tidak ada rencana: semua milik kios.</div>`}</div>` : ''}</div></div>`;
}
function komHtml(r) {
  const open = F.open.has('r:' + r.id_data);
  const sales = S.pen.filter(s => s.id_data === r.id_data);
  const bi = sum(r.bi) > 0;
  let body = '';
  if (open) {
    const ket = ketOtomatis(r);
    body = `<div class="lvb">${pupukRows(r)}
      <div class="sub"><b>Riwayat</b>${sales.length ? '' : ' <span class="mut">belum ada penjualan</span>'}</div>
      ${sales.map((s, i) => { const o = F.open.has('s:' + s.no_pesanan); return `<div class="lv lv3 ${o ? 'open' : ''}"><div class="tap" data-tog="s:${esc(s.no_pesanan)}"><span class="chev">›</span><span class="mut">${sales.length - i}.</span><span class="nop"><b>${esc(s.no_pesanan)}</b><span class="mut">${tgl(s.tanggal_waktu)}</span></span><span class="sp"></span>${sum(s.ba) > 0 ? '<span class="tag warn">blm ambil</span>' : ''}<button class="btn xs" data-esale="${esc(s.no_pesanan)}" title="Ubah input / rencana / pengambilan">${I.edit}</button><button class="btn xs" data-cetak="${esc(s.no_pesanan)}|input" title="Cetak nota">${I.print}</button></div>${o ? saleDetail(s.no_pesanan, r) : ''}</div>`; }).join('')}
      ${biBlock(r)}
      ${ket || r.keterangan ? `<div class="ket"><b>Keterangan:</b> ${esc(ket || r.keterangan)}</div>` : ''}
      <div class="rl"><button class="btn sm pri" data-jual="${r.id_data}">${I.plus} Jual</button><button class="btn sm" data-bi="${r.id_data}">${I.camera} Ambil sebelum input</button><button class="btn xs" data-edit="${r.id_data}" title="Ubah kuota / luas">${I.edit}</button></div></div>`;
  }
  return `<div class="lv lv2 ${open ? 'open' : ''}"><div class="tap" data-tog="r:${r.id_data}"><span class="chev">›</span><b>${esc(r.komoditas || '-')}</b> <span class="kk">(${sakArr(r.ak).join(',')})</span><span class="mut">${luas(r.luas_lahan)} Ha</span><span class="sp"></span>${bi ? '<span class="tag bad">blm input</span>' : ''}${sum(r.ba) > 0 ? '<span class="tag warn">blm ambil</span>' : ''}</div>${body}</div>`;
}
const luas = v => String(Math.round((+v || 0) * 100) / 100).replace('.', ',');
const rnd1 = v => Math.round(v * 10) / 10;
const sakArr = (o) => ['urea', 'phonska', 'organik'].map(k => rnd1((o[k] || 0) / berat(k)));
const parseDpt = t => (t || '').split(/[,;\s]+/).filter(x => x !== '').map(Number).filter(x => !isNaN(x));
function dptInfo(rs) {
  const dpt = parseDpt([...new Set(rs.map(r => r.dpt).filter(Boolean))][0]);
  if (!dpt.length) return null;
  const sum3 = rs.reduce((a, r) => a.map((v, i) => v + sakArr(r.ak)[i]), [0, 0, 0]).map(rnd1);
  const manual = parseDpt(rs.map(r => r.dpt_realisasi).find(Boolean));
  const real = manual.length ? manual : sum3;
  const up = rnd1((dpt[0] || 0) + (dpt[1] || 0) - (real[0] || 0) - (real[1] || 0)), og = rnd1((dpt[2] || 0) - (real[2] || 0));
  const sisa = [up, og]; if (dpt.length > 3) sisa.push(rnd1(dpt[3] - (real[3] || 0)));
  return `(${dpt.join(',')} → ${real.join(',')} = ${sisa.join(',')})`;
}
function groupHtml(key, recs) {
  const open = F.open.has(key), p0 = recs[0];
  const pok = [...byPok(recs)];
  const flags = (recs.some(r => sum(r.ba) > 0) ? '<span class="tag warn">belum ambil</span> ' : '') + (recs.some(r => sum(r.bi) > 0) ? '<span class="tag bad">belum input</span> ' : '');
  const line2 = `${esc(p0.nik || '-')} – ${pok.map(([nm]) => esc(nm)).join(' – ')}`;
  const line3 = [ttl(p0), p0.alamat].filter(Boolean).map(esc).join(' – ');
  let body = '';
  if (open) {
    body = `<div class="gd">${pok.map(([nm, rs]) => {
      const di = dptInfo(rs);
      return `<div class="pr open"><div class="prh"><b>${esc(nm)}</b>${di ? ` <span class="mut">${esc(di)}</span>` : ''}<span class="mut sm">${rs.length} komoditas</span><button class="btn xs" data-dpt="${esc(key)}|${esc(nm)}" title="Ubah DPT">${I.edit}</button></div><div class="pb">${rs.map(komHtml).join('')}</div></div>`;
    }).join('')}</div>`;
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
  if (F.focus) { const t = $(`[data-key="${CSS.escape(F.focus)}"]`, el); F.focus = null; if (t) { const f = () => window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 70); setTimeout(f, 40); setTimeout(f, 250); } }
}
function wireGroups(el) {
  const list = $('#glist', el); if (!list || list._w) return; list._w = true;
  list.addEventListener('click', e => {
    const t = e.target, B = s => t.closest(s);
    let b;
    if ((b = B('[data-addrec]'))) return openPetaniForm(null, b.dataset.addrec);
    if ((b = B('[data-dpt]'))) { const [k, pk] = b.dataset.dpt.split('|'); return openDptForm(k, pk); }
    if ((b = B('[data-person]'))) return openPetaniForm(null, null, b.dataset.person);
    if ((b = B('[data-jual]'))) return openJual(S.pid[b.dataset.jual]);
    if ((b = B('[data-bi]'))) return openBelumInput(S.pid[b.dataset.bi]);
    if ((b = B('[data-edit]'))) return openPetaniForm(S.pid[b.dataset.edit]);
    if ((b = B('[data-ambil]'))) return openAmbil(b.dataset.ambil);
    if ((b = B('[data-esale]'))) { const sl = S.sale[b.dataset.esale]; return sl && openJual(S.pid[sl.id_data], sl); }
    if ((b = B('[data-nota]'))) return cetakNota(b.dataset.nota);
    if ((b = B('[data-cetak]'))) { const [no, md, pid] = b.dataset.cetak.split('|'); return cetakNota(no, md, pid || null); }
    if ((b = B('button[data-no]'))) return openSale(b.dataset.no);
    if ((b = B('[data-tog]'))) {
      const k = b.dataset.tog, g = b.closest('.gr'), key = g.dataset.key, top0 = g.getBoundingClientRect().top;
      if (F.open.has(k)) F.open.delete(k);
      else {
        F.open.add(k);
        if (k === key) for (const o of [...F.open]) if (o !== key && S.byNik[o]) {   // buka 1 petani -> petani lain tertutup
          F.open.delete(o); const og = list.querySelector(`.gr[data-key="${CSS.escape(o)}"]`); if (og) og.outerHTML = groupHtml(o, S.byNik[o]);
        }
      }
      const ng = list.querySelector(`.gr[data-key="${CSS.escape(key)}"]`); ng.outerHTML = groupHtml(key, S.byNik[key]);
      const g2 = list.querySelector(`.gr[data-key="${CSS.escape(key)}"]`); if (g2) window.scrollBy(0, g2.getBoundingClientRect().top - top0);
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
const docBtn = (s, k, lab) => { const p = s[k + '_path']; return (p ? `<button class="btn xs2" data-dopen="${esc(p)}">${I.file} ${lab}</button>` : '')
  + (isAdmin() ? `<label class="btn xs2 ${p ? '' : 'mutb'}" title="${p ? 'Ganti' : 'Unggah'} ${lab}">${p ? I.edit : I.upload + ' ' + lab}<input type="file" hidden accept="image/*,application/pdf" data-dup="${esc(s.id_stok)}|${k}"></label>` : ''); };
function gudang(el) {
  const st = stokProduk(), batas = Number(S.set.batas_stok_menipis) || 2000;
  const row = (l, v, k, cls = '') => `<tr><td>${l}</td><td class="num ${cls}">${n(v)} kg</td><td class="num mut">${n(sak(v, berat(k)))} sak</td></tr>`;
  el.innerHTML = `<div class="bar"><h2 style="flex:1">Gudang</h2>${isMgr() ? `<button class="btn pri" id="terima">${I.plus} Terima barang</button>` : ''}</div>
    <div class="grid g2">${st.map(x => { const R = (l, v, c = '', ind = 0) => `<tr><td style="padding-left:${ind * 10}px">${l}</td><td class="num ${c}">${n(v)} kg</td><td class="num mut">${n(sak(v, berat(x.k)))} sak</td></tr>`, H = t => `<tr><td colspan="3" class="b" style="padding-top:8px;color:var(--ac)">${t}</td></tr>`;
      return `<div class="card c-${x.k}"><div style="display:flex;justify-content:space-between"><b><i class="dot"></i>${esc(x.pr.nama)}</b>${x.fisik < batas && x.masuk > 0 ? '<span class="tag bad">menipis</span>' : ''}</div>
      <table class="dn" style="margin-top:4px">${H('STOK AWAL')}${R('Gudang', x.awal, '', 1)}${R('i-pubers', x.awalIp, '', 1)}${R('Selisih (gudang − i-pubers)', x.awal - x.awalIp, x.awal - x.awalIp < 0 ? 'bad' : '', 1)}
      ${H('MASUK')}${R('Dari distributor', x.masuk, '', 1)}${R('Dari luar', x.lkIn, '', 1)}${R('Jumlah masuk', x.masuk + x.lkIn, 'b', 1)}
      ${H('KELUAR')}${R('Ke petani — sudah foto', x.ambil, '', 1)}${R('Ke petani — belum foto', x.bi, '', 1)}${R('Jumlah ke petani', x.ambil + x.bi, '', 1)}${R('Ke luar', x.lkOut, '', 1)}${R('Jumlah keluar', x.ambil + x.bi + x.lkOut, 'b', 1)}
      ${H('STOK SAAT INI')}${R('Stok i-pubers', x.sistem, '', 1)}${R('Gudang depan', x.depan, '', 1)}${R('Gudang belakang', x.belakang, '', 1)}${R('Jumlah stok gudang', x.fisik, 'b', 1)}${R('Selisih (gudang − i-pubers)', x.selisih, x.selisih < 0 ? 'bad' : '', 1)}${R('Sdh foto blm ambil', x.titip, x.titip > 0 ? 'warn' : '', 1)}${R('Lebih / kurang', x.lebih, x.lebih < 0 ? 'bad b' : 'b', 1)}
      ${H('KETERANGAN LAIN')}${R('Sisa lebih', x.sisaLebih, '', 1)}${R('Keluar tahun lalu', x.thnLalu, '', 2)}${R('Keluar tahun ini', x.lkOut, '', 2)}${R('Total keluar', x.thnLalu + x.lkOut, '', 2)}${R('Masih di gudang', x.lebih, x.lebih < 0 ? 'bad b' : 'b', 1)}</table>
      <div class="sm mut" style="margin-top:6px">Milik kios (input − rencana): ${n(x.kios)} kg · Rencana ke petani: ${n(x.rencana)} kg</div></div>`; }).join('')}</div>
    <div class="sec"><h3>Riwayat barang masuk</h3></div><div class="card"><div class="tw"><table class="dn"><tr><th>Tanggal</th><th>Produk</th><th class="num">Masuk (kg)</th><th class="num">Harga beli</th><th>Dokumen</th></tr>
    ${[...S.stok].sort((a, b) => String(b.tanggal_input).localeCompare(String(a.tanggal_input))).map(s => `<tr><td>${tgl(s.tanggal_input)}</td><td>${esc(S.byId[s.id_produk]?.nama || '')}</td><td class="num">${n(s.jumlah_masuk)}</td><td class="num">${rp(s.harga_beli_total)}</td><td class="mut sm">${esc(s.id_stok)}${s.keterangan ? ' · ' + esc(s.keterangan) : ''}
      <div class="dokb">${docBtn(s, 'bast', 'BAST')}${docBtn(s, 'nota', 'Nota')}</div></td></tr>`).join('')}</table></div></div>`;
  const t = $('#terima'); if (t) t.onclick = terimaBarang;
  $$('[data-dopen]', el).forEach(b => b.onclick = () => bukaBerkas(b.dataset.dopen));
  $$('input[data-dup]', el).forEach(i => i.onchange = async () => { const [id, k] = i.dataset.dup.split('|'); if (!i.files[0]) return; toast('Mengunggah…'); try { await unggahStok(id, k, i.files[0]); toast('Tersimpan'); gudang(el); } catch (e) { toast('Gagal: ' + (e.message || e)); } });
}
function terimaBarang() {
  openDrawer(`<div class="fld"><label>Produk</label><select class="in" id="tP">${KODE.map(k => S.byKode[k]).map(p => `<option value="${p.id}">${esc(p.nama)}</option>`).join('')}</select></div>
    <div class="fld"><label>No. dokumen / BAST (opsional)</label><input class="in" id="tN" placeholder="PKP…"></div>
    <div class="row2"><div class="fld"><label>Jumlah masuk (kg)</label><input class="in" id="tJ" type="number" inputmode="decimal"></div><div class="fld"><label>Harga beli total (Rp)</label><input class="in" id="tH" type="number" inputmode="decimal"></div></div>
    <div class="fld"><label>Keterangan</label><input class="in" id="tK"></div><div class="mut sm" id="tKg"></div>
    ${isAdmin() ? `<div class="row2"><div class="fld"><label>File BAST (foto/PDF)</label><input class="in" id="tFb" type="file" accept="image/*,application/pdf"></div><div class="fld"><label>File nota penebusan</label><input class="in" id="tFn" type="file" accept="image/*,application/pdf"></div></div>` : ''}`,
    {
      title: 'Terima barang', footer: '<button class="btn" data-close>Batal</button><button class="btn pri" id="tS">Simpan</button>', onOpen: d => {
        const u = () => { const j = Number($('#tJ', d).value), h = Number($('#tH', d).value); $('#tKg', d).textContent = j > 0 && h > 0 ? 'Harga beli per kg: ' + rp(h / j) : ''; }; $('#tJ', d).oninput = $('#tH', d).oninput = u;
        $('#tS', d).onclick = async () => {
          const j = Number($('#tJ', d).value), h = Number($('#tH', d).value) || null; if (!(j > 0)) return toast('Isi jumlah');
          const pr = S.byId[$('#tP', d).value];
          const idS = $('#tN', d).value.trim() || 'M' + uid();
          const { error } = await sb.from('stok').insert({ id_stok: idS, id_produk: pr.id, tahun: S.tahun, tanggal_input: new Date().toISOString(), jumlah_masuk: j, harga_beli_total: h, harga_beli_kg: h ? h / j : null, keterangan: $('#tK', d).value || null, berat_sak: pr.berat_sak });
          if (error) return toast(error.message);
          for (const [sel, k] of [['#tFb', 'bast'], ['#tFn', 'nota']]) { const f = $(sel, d)?.files?.[0]; if (f) { S.stok.push({ id_stok: idS }); try { await unggahStok(idS, k, f); } catch (e) { toast('Berkas ' + k + ' gagal: ' + (e.message || e)); } } }
          toast('Tersimpan'); closeDrawer(); await boot(true);
        };
      }
    });
}

// ===== luar kelompok =====
async function luar(el) {
  el.innerHTML = '<span class="mut">Memuat…</span>';
  const ket = (det, idk, id) => det.filter(d => d[idk] === id).map(d => `${NAMA[S.byId[d.id_produk]?.kode] || ''} ${n(d.jumlah)}`).join(', ');
  const [lk, lkm] = [[...S.lkRaw || []], []];
  const lkH = [...S.lk], lkmH = [...S.lkm];
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
          const hd = keluar ? { id_lk: id, tahun: S.tahun, pembeli: nm, total_harga: tot, keterangan: $('#lK', d).value || null } : { id_lkm: id, tahun: S.tahun, dari: nm, total_harga: tot, keterangan: $('#lK', d).value || null };
          let r = await sb.from(keluar ? 'luar_kelompok' : 'lk_masuk').insert(hd); if (r.error) return toast(r.error.message);
          r = await sb.from(keluar ? 'detail_lk' : 'dlk_masuk').insert(det.map((x, i) => keluar ? { id_dlk: id + i, tahun: S.tahun, id_lk: id, pembeli: nm, ...x } : { id_dlkm: id + i, tahun: S.tahun, id_lkm: id, dari: nm, ...x }));
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
  ${isAdmin() ? `<div class="card"><h3>Berkas lama (AppSheet)</h3><p class="mut sm">Unggah tanda tangan (Data_Images) serta BAST & nota penebusan (z26/BAST, z26/Nota_penebusan). File dikenali otomatis dari namanya.</p><button class="btn pri" id="ibOpen">${I.upload} Impor berkas lama</button></div>` : ''}
  ${isAdmin() ? `<div class="card"><h3>Pengguna</h3><div id="usr" class="list"><span class="mut">Memuat…</span></div></div>
  <div class="card"><h3>Impor data lama (JSON migrasi)</h3><p class="mut sm">Pilih file <b>import_z26.json</b> hasil migrasi dari AppSheet. Aman diulang (data yang sama ditimpa, tidak dobel).</p><input type="file" id="imp" accept=".json"><div id="impLog" class="sm mut" style="margin-top:8px;white-space:pre-line"></div></div>` : ''}</div>`;
  $$('[data-th]', el).forEach(c => c.onclick = () => { lsSet('theme', c.dataset.th); applyTheme(); pengaturan(el); });
  $$('[data-ac]', el).forEach(c => c.onclick = () => { lsSet('accent', c.dataset.ac); applyTheme(); pengaturan(el); });
  const si = $('#sInst'); if (si) si.onclick = pasang;
  const ib = $('#ibOpen'); if (ib) ib.onclick = openImporBerkas;
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

// ===== tahun baru / tahun sebelumnya =====
function openTahunBaru() {
  const sumber = S.tahunList;
  openDrawer(`<p class="mut sm">Setiap tahun punya data petani, kuota, penjualan, dan gudang sendiri. Buat tahun baru untuk musim berikutnya, atau tahun lama untuk memasukkan riwayat sebelumnya.</p>
    <div class="fld"><label>Tahun</label><input class="in" id="tY" type="number" value="${Math.max(...S.tahunList) + 1}" min="2000" max="2100"></div>
    <div class="fld"><label>Isi awal</label><select class="in" id="tS"><option value="">Kosong (impor Excel / tambah manual nanti)</option>${sumber.map(t => `<option value="${t}" ${t === S.tahun ? 'selected' : ''}>Salin data petani dari ${t} (kuota 0)</option>`).join('')}</select></div>
    <p class="mut sm">Salin hanya membawa identitas petani, poktan, komoditas, dan luas lahan. Kuota, DPT, dan transaksi dimulai dari nol.</p>`,
    {
      title: 'Tahun baru', footer: '<button class="btn" data-close>Batal</button><button class="btn pri" id="tGo">Buat tahun</button>', onOpen: d => {
        $('#tGo', d).onclick = async () => {
          const y = Number($('#tY', d).value), src = Number($('#tS', d).value) || null;
          if (!(y >= 2000 && y <= 2100)) return toast('Tahun tidak valid');
          if (S.tahunList.includes(y)) { S.tahun = y; lsSet('tahun', y); closeDrawer(); await boot(true); return; }
          $('#tGo', d).disabled = true;
          if (src) {
            const rows = await all('petani', '*', 'id_data', q => q.eq('tahun', src));
            const out = rows.map(r => ({ id_data: ++S.maxId, tahun: y, nama: r.nama, nik: r.nik, alamat: r.alamat, tempat_lahir: r.tempat_lahir, tanggal_lahir: r.tanggal_lahir, poktan: r.poktan, komoditas: r.komoditas, luas_lahan: r.luas_lahan, kuota_urea: 0, kuota_phonska: 0, kuota_organik: 0, kuota_za: 0 }));
            for (let i = 0; i < out.length; i += 300) { const { error } = await sb.from('petani').insert(out.slice(i, i + 300)); if (error) { $('#tGo', d).disabled = false; return toast('Gagal: ' + error.message); } }
            toast(`${out.length} data petani disalin ke ${y}`);
          } else toast('Tahun ' + y + ' dibuat (kosong)');
          S.tahun = y; lsSet('tahun', y); S.tahunList = [...new Set([...S.tahunList, y])].sort((a, b) => b - a); closeDrawer(); await boot(true);
        };
      }
    });
}
