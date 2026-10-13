import { $, $$, esc, n, rp, KODE, NAMA, tgl, tglJam, ini, pct, uid, toast, I, lsGet, lsSet, debounce, tglWIB } from './util.js';
import { sb, S, loadProfile, loadAll, reloadTx, isMgr, isAdmin, all, ringkasHariIni, totalBelum, stokProduk, perPoktan, penjualan14Hari } from './data.js';
import { hooks, openDrawer, closeDrawer, openPetani, openJual, openHitung, cetakNota, barHtml } from './drawers.js';

// ===== tema =====
const root = document.documentElement;
function applyTheme() {
  root.dataset.theme = lsGet('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.dataset.accent = lsGet('accent', 'hijau');
}
applyTheme();

let view = (location.hash || '#/beranda').slice(2) || 'beranda';
const F = { q: '', poktan: '', kom: '', st: '', lim: 80, pq: '', pr: '7' };

const MENU = [
  ['beranda', 'Beranda', I.home], ['petani', 'Petani', I.users], ['penjualan', 'Penjualan', I.cart], ['belum', 'Belum diambil / difoto', I.alert],
  ['gudang', 'Gudang', I.box], ['luar', 'Luar kelompok', I.out], ['poktan', 'Poktan & kuota', I.map], ['keuangan', 'Keuangan', I.money], ['pengaturan', 'Pengaturan', I.gear],
];
const BNAV = ['beranda', 'petani', 'penjualan', 'gudang', 'lainnya'];

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
  $('#lRe').onclick = boot; $('#lOut').onclick = async () => { await sb.auth.signOut(); boot(); };
}

// ===== kerangka =====
function shell() {
  $('#root').innerHTML = `<div id="app"><aside id="side"><div class="brand"><div class="lg">z26</div><div><b>Kios Misfalah</b><span>${esc(S.prof.nama || S.prof.email)} · ${esc(S.prof.role)}</span></div></div>
    ${MENU.map(m => `<button class="nav" data-v="${m[0]}">${m[2]}<span>${m[1]}</span></button>`).join('')}<div class="sp"></div>
    <button class="nav" id="nHit">${I.calc}<span>Hitung cepat</span></button><button class="nav" id="nOut">${I.out}<span>Keluar</span></button></aside>
    <main><div class="top"><div class="search"><span>${I.search}</span><input id="gq" placeholder="Cari nama atau NIK petani…" autocomplete="off"><div class="sres hide" id="gres"></div></div>
      <button class="btn" id="bHit">${I.calc}<span class="hidem">Hitung</span></button></div><div id="page"></div></main></div>
    <nav id="bnav">${BNAV.map(k => `<button class="nav" data-v="${k}">${{ beranda: I.home, petani: I.users, penjualan: I.cart, gudang: I.box, lainnya: I.more }[k]}<span>${{ beranda: 'Beranda', petani: 'Petani', penjualan: 'Jual', gudang: 'Gudang', lainnya: 'Lainnya' }[k]}</span></button>`).join('')}</nav>
    <button class="fab" id="fab" title="Tambah penjualan">${I.plus}</button>`;
  $$('[data-v]').forEach(b => b.onclick = () => go(b.dataset.v));
  $('#fab').onclick = () => openJual(); $('#nHit').onclick = $('#bHit').onclick = openHitung;
  $('#nOut').onclick = async () => { await sb.auth.signOut(); boot(); };
  const gq = $('#gq'), res = $('#gres');
  gq.oninput = debounce(() => {
    const q = gq.value.trim().toLowerCase(); if (q.length < 2) return res.classList.add('hide');
    const r = S.petani.filter(p => (p.nama || '').toLowerCase().includes(q) || (p.nik || '').includes(q)).slice(0, 30);
    res.innerHTML = r.map(p => `<div class="it" data-id="${p.id_data}"><b>${esc(p.nama)}</b> <span class="mut sm">${esc(p.poktan)} · ${esc(p.komoditas)}</span><div class="sm mut">NIK ${esc(p.nik)}</div></div>`).join('') || '<div class="it mut">Tidak ditemukan</div>';
    res.classList.remove('hide'); $$('.it[data-id]', res).forEach(e => e.onclick = () => { res.classList.add('hide'); gq.value = ''; openPetani(Number(e.dataset.id)); });
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) res.classList.add('hide'); });
  hooks.refresh = render;
}
function go(v) { view = v; location.hash = '#/' + v; $$('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === (BNAV.includes(v) ? v : 'lainnya') || b.dataset.v === v)); render(); window.scrollTo(0, 0); }
function render() {
  $$('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === view || (b.closest('#bnav') && b.dataset.v === 'lainnya' && !BNAV.includes(view))));
  const P = { beranda, petani, penjualan, belum, gudang, luar, poktan, keuangan, pengaturan, lainnya }[view] || beranda;
  P($('#page'));
}

// ===== beranda =====
function kpi(l, v, ic, sub = '', go = '') { return `<div class="card kpi ${go ? 'click' : ''}" ${go ? `data-go="${go}"` : ''}><div class="l"><span class="ic">${ic}</span>${l}</div><div class="v">${v}</div><div class="mut sm">${sub}</div></div>`; }
function beranda(el) {
  const h = ringkasHariIni(), b = totalBelum(), st = stokProduk(), batas = Number(S.set.batas_stok_menipis) || 2000, pk = perPoktan(), hr = penjualan14Hari();
  const maxO = Math.max(1, ...hr.map(x => x.omzet));
  const menipis = st.filter(x => x.id !== undefined && Number(x.sisa_stok) < batas && Number(x.total_masuk) > 0);
  el.innerHTML = `
  <div class="grid g4">
    ${kpi('Penjualan hari ini', rp(h.omzet), I.cart, `${h.n} transaksi · ${n(h.kg)} kg`, 'penjualan')}
    ${kpi('Belum diambil', n(b.kgBd) + ' kg', I.truck, `${b.nBd} petani`, 'belum')}
    ${kpi('Belum difoto/dicatat', n(b.kgBf) + ' kg', I.camera, `${b.nBf} petani`, 'belum:foto')}
    ${kpi('Stok menipis', menipis.length ? menipis.map(x => NAMA[x.kode]).join(', ') : 'Aman', I.alert, `batas ${n(batas)} kg`, 'gudang')}
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><div class="sec" style="margin-top:0"><h3>Stok gudang</h3><span class="mut sm">sisa / total masuk</span></div>
      ${st.map(x => barHtml(Number(x.sisa_stok), Number(x.total_masuk), x.kode, NAMA[x.kode])).join('')}</div>
    <div class="card"><div class="sec" style="margin-top:0"><h3>Penjualan 14 hari</h3><span class="mut sm">total ${rp(hr.reduce((a, b) => a + b.omzet, 0))}</span></div>
      <div class="hbar" style="margin-bottom:16px">${hr.map(x => `<div style="height:${Math.max(2, x.omzet / maxO * 100)}%" title="${x.k}: ${rp(x.omzet)}"><span>${x.label}</span></div>`).join('')}</div></div>
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><div class="sec" style="margin-top:0"><h3>Penyaluran per poktan</h3><span class="mut sm">tersalur / kuota</span></div>
      ${pk.map(o => { const k = KODE.reduce((a, c) => a + o['k_' + c], 0), t = KODE.reduce((a, c) => a + o['t_' + c], 0); return `<div class="prow"><div class="h"><span>${esc(o.nama)} <span class="mut sm">${o.petani} petani</span></span><span class="mut">${pct(t, k).toFixed(1)}%</span></div><div class="pg"><i style="width:${pct(t, k)}%"></i></div></div>`; }).join('')}</div>
    <div class="card"><div class="sec" style="margin-top:0"><h3>Transaksi terbaru</h3><button class="btn sm" data-go="penjualan">Semua</button></div><div class="list">
      ${S.pen.slice(0, 7).map(x => `<div class="li" data-no="${esc(x.no_pesanan)}"><div class="av">${esc(ini(x.nama_petani))}</div><div class="grow"><div class="t b">${esc(x.nama_petani)}</div><div class="mut sm">${tglJam(x.tanggal_waktu)} · ${esc(x.nama_poktan)}</div></div><div class="r"><div class="b">${rp(x.total_harga)}</div></div></div>`).join('')}</div></div>
  </div>`;
  wireCommon(el);
}
function wireCommon(el) {
  $$('[data-go]', el).forEach(c => c.onclick = () => { const [v, s] = c.dataset.go.split(':'); if (s) F.bs = s; go(v); });
  $$('.li[data-no]', el).forEach(c => c.onclick = () => detailJual(c.dataset.no));
  $$('[data-pid]', el).forEach(c => c.onclick = () => openPetani(Number(c.dataset.pid)));
}

// ===== petani =====
function petani(el) {
  const poktans = [...new Set(S.petani.map(p => p.poktan).filter(Boolean))].sort(), koms = [...new Set(S.petani.map(p => p.komoditas).filter(Boolean))].sort();
  const q = F.q.toLowerCase();
  let r = S.petani.filter(p => (!q || (p.nama || '').toLowerCase().includes(q) || (p.nik || '').includes(q)) && (!F.poktan || p.poktan === F.poktan) && (!F.kom || p.komoditas === F.kom));
  const sumk = (p, pre) => KODE.reduce((a, k) => a + Math.max(0, Number(p[pre + k])), 0);
  if (F.st === 'bd') r = r.filter(p => sumk(p, 'bd_') > 0);
  if (F.st === 'bf') r = r.filter(p => sumk(p, 'bf_') > 0);
  if (F.st === 'sisa') r = r.filter(p => sumk(p, 'sisa_') > 0);
  if (F.st === 'belum') r = r.filter(p => Number(p.total_rp) === 0);
  el.innerHTML = `<div class="bar"><h2 style="flex:1">Petani <span class="mut sm">${n(r.length)} dari ${n(S.petani.length)}</span></h2></div>
    <div class="bar"><input class="in" style="max-width:240px" id="fq" placeholder="Filter nama / NIK" value="${esc(F.q)}">
      <select class="in" style="width:auto" id="fp"><option value="">Semua poktan</option>${poktans.map(x => `<option ${x === F.poktan ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
      <select class="in" style="width:auto" id="fk"><option value="">Semua komoditas</option>${koms.map(x => `<option ${x === F.kom ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
    <div class="bar">${[['', 'Semua'], ['bd', 'Belum diambil'], ['bf', 'Belum difoto'], ['sisa', 'Masih ada kuota'], ['belum', 'Belum menebus']].map(([k, l]) => `<span class="chip ${F.st === k ? 'on' : ''}" data-st="${k}">${l}</span>`).join('')}</div>
    <div class="card list">${r.slice(0, F.lim).map(p => {
    const bd = sumk(p, 'bd_'), bf = sumk(p, 'bf_'), sisa = sumk(p, 'sisa_');
    return `<div class="li" data-pid="${p.id_data}"><div class="av">${esc(ini(p.nama))}</div><div class="grow"><div class="t b">${esc(p.nama)}</div><div class="mut sm t">${esc(p.poktan)} · ${esc(p.komoditas)} · ${n(p.luas_lahan)} ha</div></div>
      <div class="r">${bd > 0 ? `<span class="tag warn">belum ambil ${n(bd)}</span> ` : ''}${bf > 0 ? `<span class="tag bad">belum foto ${n(bf)}</span> ` : ''}<div class="mut sm">sisa kuota ${n(sisa)} kg</div></div></div>`;
  }).join('') || '<span class="mut">Tidak ada data</span>'}
    ${r.length > F.lim ? `<div class="c" style="padding:10px"><button class="btn" id="more">Tampilkan lebih banyak</button></div>` : ''}</div>`;
  $('#fq').oninput = debounce(e => { F.q = e.target.value; F.lim = 80; petani(el); $('#fq').focus(); $('#fq').setSelectionRange(F.q.length, F.q.length); });
  $('#fp').onchange = e => { F.poktan = e.target.value; F.lim = 80; petani(el); }; $('#fk').onchange = e => { F.kom = e.target.value; F.lim = 80; petani(el); };
  $$('[data-st]', el).forEach(c => c.onclick = () => { F.st = c.dataset.st; F.lim = 80; petani(el); });
  const m = $('#more'); if (m) m.onclick = () => { F.lim += 120; petani(el); };
  wireCommon(el);
}

// ===== penjualan =====
function penjualan(el) {
  const q = F.pq.toLowerCase(), days = F.pr;
  const lim = days === 'all' ? '' : tglWIB(new Date(Date.now() - (Number(days) - 1) * 864e5));
  const r = S.pen.filter(x => (!q || (x.nama_petani || '').toLowerCase().includes(q) || (x.nik || '').includes(q)) && (!lim || tglWIB(x.tanggal_waktu) >= lim));
  const tot = r.reduce((a, b) => a + Number(b.total_harga), 0);
  el.innerHTML = `<div class="bar"><h2 style="flex:1">Penjualan</h2><button class="btn pri" id="add">${I.plus} Tambah</button></div>
    <div class="bar"><input class="in" style="max-width:220px" id="pq" placeholder="Cari nama / NIK" value="${esc(F.pq)}">${[['1', 'Hari ini'], ['7', '7 hari'], ['30', '30 hari'], ['all', 'Semua']].map(([k, l]) => `<span class="chip ${days === k ? 'on' : ''}" data-d="${k}">${l}</span>`).join('')}</div>
    <div class="grid g4" style="margin-bottom:12px">${kpi('Transaksi', n(r.length), I.cart)}${kpi('Omzet', rp(tot), I.money)}${kpi('Volume', n(r.reduce((a, b) => a + Number(b.rencana), 0)) + ' kg', I.box)}</div>
    <div class="card list">${r.slice(0, 150).map(x => `<div class="li" data-no="${esc(x.no_pesanan)}"><div class="av">${esc(ini(x.nama_petani))}</div><div class="grow"><div class="t b">${esc(x.nama_petani)}</div><div class="mut sm t">${tglJam(x.tanggal_waktu)} · ${esc(x.nama_poktan)} · ${n(x.rencana)} kg</div></div>
      <div class="r"><div class="b">${rp(x.total_harga)}</div>${x.rencana > x.diambil ? '<span class="tag warn">belum ambil</span>' : x.diambil > x.tercatat ? '<span class="tag bad">belum foto</span>' : '<span class="tag ok">selesai</span>'}</div></div>`).join('') || '<span class="mut">Tidak ada penjualan</span>'}
      ${r.length > 150 ? `<div class="mut sm c" style="padding:8px">Menampilkan 150 terbaru dari ${n(r.length)}. Persempit dengan filter.</div>` : ''}</div>`;
  $('#add').onclick = () => openJual();
  $('#pq').oninput = debounce(e => { F.pq = e.target.value; penjualan(el); $('#pq').focus(); $('#pq').setSelectionRange(F.pq.length, F.pq.length); });
  $$('[data-d]', el).forEach(c => c.onclick = () => { F.pr = c.dataset.d; penjualan(el); });
  wireCommon(el);
}
async function detailJual(no) {
  const [{ data: pj }, { data: dt }, { data: am }, { data: kg }] = await Promise.all([
    sb.from('penjualan').select('*').eq('no_pesanan', no).maybeSingle(), sb.from('detail').select('*').eq('no_pesanan', no).order('nomor_urut'),
    sb.from('diambil').select('*').eq('no_pesanan', no), sb.from('keluar_gudang').select('*').eq('no_pesanan', no)]);
  if (!pj) return toast('Tidak ditemukan');
  const ambil = Object.fromEntries((am || []).map(r => [r.id_produk, 0])); (am || []).forEach(r => ambil[r.id_produk] += Number(r.jumlah));
  openDrawer(`<div class="card"><div class="b">${esc(pj.nama_petani)}</div><div class="mut sm">${esc(pj.nama_poktan)} · ${esc(pj.komoditas)} · NIK ${esc(pj.nik)}</div><div class="mut sm">${tglJam(pj.tanggal_waktu)} · No ${esc(pj.no_pesanan)}</div></div>
    <div class="card" style="margin-top:10px"><table><tr><th>Pupuk</th><th class="num">Salur</th><th class="num">Diambil</th><th class="num">Subtotal</th></tr>
    ${(dt || []).map(r => `<tr><td>${esc(r.nama_produk)}<div class="mut sm">@ ${n(r.harga_satuan)}</div></td><td class="num">${n(r.jumlah)}</td><td class="num">${n(ambil[r.id_produk] || 0)}</td><td class="num">${n(r.subtotal)}</td></tr>`).join('')}
    <tr><td colspan="3" class="b">Total</td><td class="num b">${rp(pj.total_harga)}</td></tr></table></div>
    <div class="card" style="margin-top:10px"><b>Tercatat di aplikasi resmi:</b> ${(kg || []).length ? kg.map(r => KODE.filter(k => r[k] > 0).map(k => `${NAMA[k]} ${n(r[k])}`).join(', ')).join(' | ') : '<span class="bad">belum</span>'}</div>
    ${pj.keterangan ? `<div class="card" style="margin-top:10px">${esc(pj.keterangan)}</div>` : ''}`,
    {
      title: 'Detail penjualan', footer: `${isMgr() ? '<button class="btn bad" id="dDel">Hapus</button>' : ''}<button class="btn" id="dPet">Data petani</button><button class="btn pri" id="dPrint">${I.print} Cetak nota</button>`,
      onOpen: d => {
        $('#dPrint', d).onclick = () => cetakNota(no); $('#dPet', d).onclick = () => openPetani(pj.id_data);
        const del = $('#dDel', d); if (del) del.onclick = async () => {
          if (!confirm('Hapus penjualan ini beserta rincian ambil dan catatan keluar gudang? Tidak bisa dibatalkan.')) return;
          for (const t of ['keluar_gudang', 'diambil', 'detail', 'penjualan']) { const { error } = await sb.from(t).delete().eq('no_pesanan', no); if (error) return toast(error.message); }
          toast('Dihapus'); closeDrawer(); await reloadTx(); render();
        };
      }
    });
}

// ===== belum diambil / difoto =====
function belum(el) {
  const tab = F.bs || 'bd'; F.bs = tab;
  const key = tab === 'bd' ? 'bd_' : 'bf_';
  const r = S.petani.filter(p => KODE.some(k => p[key + k] > 0)).sort((a, b) => KODE.reduce((s, k) => s + Math.max(0, b[key + k]), 0) - KODE.reduce((s, k) => s + Math.max(0, a[key + k]), 0));
  el.innerHTML = `<div class="bar"><h2 style="flex:1">Belum diambil / difoto</h2></div>
    <div class="bar"><span class="chip ${tab === 'bd' ? 'on' : ''}" data-t="bd">Belum diambil (disalurkan − diambil)</span><span class="chip ${tab === 'foto' ? 'on' : ''}" data-t="foto">Belum difoto (diambil − tercatat)</span></div>
    <p class="mut sm">${tab === 'bd' ? 'Barang sudah ditebus/dicatat tetapi belum diambil petani.' : 'Barang sudah diambil petani tetapi belum difoto/dicatat di aplikasi pupuk resmi.'}</p>
    <div class="card list">${r.map(p => `<div class="li" data-pid="${p.id_data}"><div class="av">${esc(ini(p.nama))}</div><div class="grow"><div class="t b">${esc(p.nama)}</div><div class="mut sm t">${esc(p.poktan)} · ${esc(p.komoditas)}</div></div>
      <div class="r">${KODE.filter(k => p[key + k] > 0).map(k => `<span class="tag mut c-${k}"><i class="dot"></i>${NAMA[k]} ${n(p[key + k])}</span>`).join(' ')}</div></div>`).join('') || '<span class="ok">Tidak ada, semuanya beres 🎉</span>'}</div>`;
  $$('[data-t]', el).forEach(c => c.onclick = () => { F.bs = c.dataset.t; belum(el); });
  wireCommon(el);
}

// ===== gudang =====
function gudang(el) {
  const st = stokProduk(), batas = Number(S.set.batas_stok_menipis) || 2000;
  el.innerHTML = `<div class="bar"><h2 style="flex:1">Gudang</h2>${isMgr() ? `<button class="btn pri" id="terima">${I.plus} Terima barang</button>` : ''}</div>
    <div class="grid g2">${st.map(x => `<div class="card c-${x.kode}"><div style="display:flex;justify-content:space-between"><b><i class="dot"></i>${esc(x.nama)}</b>${x.sisa_stok < batas && x.total_masuk > 0 ? '<span class="tag bad">menipis</span>' : ''}</div>
      ${barHtml(Number(x.sisa_stok), Number(x.total_masuk), x.kode, 'Stok sistem')}
      <table style="font-size:12px"><tr><td>Total masuk (termasuk stok awal)</td><td class="num">${n(x.total_masuk)}</td></tr><tr><td>Disalurkan (tebus)</td><td class="num">${n(x.terjual)}</td></tr><tr><td>Sudah diambil petani</td><td class="num">${n(x.diambil)}</td></tr>
      <tr><td>Belum diambil petani</td><td class="num warn">${n(x.belum)}</td></tr><tr><td>Keluar luar kelompok / masuk LK</td><td class="num">${n(x.lkOut)} / ${n(x.lkIn)}</td></tr>
      <tr><td class="b">Stok sistem saat ini</td><td class="num b">${n(x.sisa_stok)} kg</td></tr><tr><td class="b">Perkiraan fisik di gudang</td><td class="num b">${n(x.fisik)} kg</td></tr></table></div>`).join('')}</div>
    <div class="sec"><h3>Riwayat barang masuk</h3></div><div class="card"><div class="tw"><table><tr><th>Tanggal</th><th>Produk</th><th class="num">Masuk (kg)</th><th class="num">Harga beli</th><th>Ket</th></tr>
    ${S.stok.map(s => `<tr><td>${tgl(s.tanggal_input)}</td><td>${esc(S.byId[s.id_produk]?.nama || '')}</td><td class="num">${n(s.jumlah_masuk)}</td><td class="num">${rp(s.harga_beli_total)}</td><td class="mut sm">${esc(s.id_stok)}${s.keterangan ? ' · ' + esc(s.keterangan) : ''}</td></tr>`).join('')}</table></div></div>`;
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
  const [lk, dl, lkm, dlm] = await Promise.all([all('luar_kelompok', '*', q => q.order('tanggal_waktu', { ascending: false })), all('detail_lk'), all('lk_masuk', '*', q => q.order('tanggal_waktu', { ascending: false })), all('dlk_masuk')]);
  const ket = (det, idk, id) => det.filter(d => d[idk] === id).map(d => `${NAMA[S.byId[d.id_produk]?.kode] || ''} ${n(d.jumlah)}`).join(', ');
  const blok = (jud, hdr, det, idk, nm, ttl) => `<div class="sec"><h3>${jud}</h3></div><div class="card"><div class="tw"><table><tr><th>Tanggal</th><th>${nm === 'pembeli' ? 'Pembeli' : 'Dari'}</th><th>Barang (kg)</th><th class="num">Total</th></tr>
    ${hdr.map(h => `<tr><td>${tgl(h.tanggal_waktu)}</td><td>${esc(h[nm])}</td><td>${ket(det, idk, h[idk])}</td><td class="num">${rp(h.total_harga)}</td></tr>`).join('')}</table></div></div>`;
  el.innerHTML = `<div class="bar"><h2 style="flex:1">Luar kelompok</h2><button class="btn pri" id="lkJ">${I.plus} Jual luar</button>${isMgr() ? `<button class="btn" id="lkM">${I.plus} Terima dari luar</button>` : ''}</div>
    <div class="grid g4">${kpi('Penjualan luar', rp(dl.reduce((a, b) => a + Number(b.subtotal), 0)), I.out, n(lk.length) + ' transaksi')}${kpi('Barang masuk dari luar', rp(dlm.reduce((a, b) => a + Number(b.subtotal), 0)), I.truck, n(lkm.length) + ' transaksi')}</div>
    ${blok('Penjualan luar kelompok', lk, dl, 'id_lk', 'pembeli')}${blok('Barang masuk dari luar', lkm, dlm, 'id_lkm', 'dari')}`;
  $('#lkJ').onclick = () => formLK(true); const m = $('#lkM'); if (m) m.onclick = () => formLK(false);
}
function formLK(keluar) {
  const prods = KODE.map(k => S.byKode[k]);
  openDrawer(`<div class="fld"><label>${keluar ? 'Pembeli' : 'Dari'}</label><input class="in" id="lN"></div>
    ${prods.map(p => `<div class="card c-${p.kode}" style="margin-bottom:8px" data-p="${p.id}"><b><i class="dot"></i>${NAMA[p.kode]}</b><div class="row2"><div class="fld"><label>Jumlah (kg)</label><input class="in" type="number" inputmode="decimal" data-f="j"></div><div class="fld"><label>Harga /kg</label><input class="in" type="number" inputmode="decimal" data-f="h" value="${keluar ? p.harga_luar : (p.hlm || '')}"></div></div></div>`).join('')}
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
  el.innerHTML = `<div class="bar"><h2>Poktan & kuota</h2></div><div class="grid g2">${perPoktan().map(o => `<div class="card"><div style="display:flex;justify-content:space-between"><b>${esc(o.nama)}</b><span class="mut sm">${o.petani} petani</span></div>
    ${KODE.filter(k => o['k_' + k] > 0).map(k => barHtml(o['t_' + k], o['k_' + k], k, NAMA[k], `· ${pct(o['t_' + k], o['k_' + k]).toFixed(1)}%`)).join('')}</div>`).join('')}</div>`;
}

// ===== keuangan =====
async function keuangan(el) {
  el.innerHTML = '<span class="mut">Menghitung…</span>';
  const [dl, dlm] = await Promise.all([all('detail_lk'), all('dlk_masuk')]);
  const tebus = S.stok.reduce((a, s) => a + Number(s.harga_beli_total || 0) - Number(s.harga_total_pengembalian || 0), 0);
  const jual = S.pen.reduce((a, b) => a + Number(b.total_harga), 0);
  const lkJual = dl.reduce((a, b) => a + Number(b.subtotal), 0), lkBeli = dlm.reduce((a, b) => a + Number(b.subtotal), 0);
  const st = stokProduk(), nilai = st.reduce((a, x) => a + Math.max(0, x.fisik) * Number(S.byId[x.id].harga_beli_kg), 0);
  const laba = jual + lkJual + nilai - tebus - lkBeli;
  el.innerHTML = `<div class="bar"><h2>Keuangan</h2></div><div class="grid g4">
    ${kpi('Penebusan (modal)', rp(tebus), I.truck, 'dari pemasok')}${kpi('Penebusan luar', rp(lkBeli), I.out, 'barang masuk dari luar')}
    ${kpi('Total penjualan', rp(jual), I.cart, n(S.pen.length) + ' transaksi')}${kpi('Penjualan luar', rp(lkJual), I.out)}
    ${kpi('Nilai sisa gudang', rp(nilai), I.box, 'perkiraan fisik × harga beli')}${kpi('Perkiraan selisih / laba', rp(laba), I.money, 'penjualan + luar + sisa − modal')}</div>
    <div class="sec"><h3>Penjualan per hari</h3></div><div class="card"><div class="tw"><table><tr><th>Tanggal</th><th class="num">Transaksi</th><th class="num">Omzet</th></tr>
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
    <div class="bar">${[['hijau', '#16a34a'], ['biru', '#2563eb'], ['oranye', '#ea580c']].map(([k, c]) => `<span class="chip ${ac === k ? 'on' : ''}" data-ac="${k}"><i class="dot" style="--c:${c}"></i>${k}</span>`).join('')}</div></div>
  <div class="card"><h3>Akun</h3><p class="mut">${esc(S.user.email)} · ${esc(S.prof.role)}</p><div class="fld"><label>Ganti kata sandi</label><input class="in" type="password" id="np" minlength="6" placeholder="kata sandi baru"></div><button class="btn" id="npS">Simpan kata sandi</button></div>
  ${isMgr() ? `<div class="card"><h3>Harga & nota</h3><div id="hargaF"></div></div>` : ''}
  ${isAdmin() ? `<div class="card"><h3>Pengguna</h3><div id="usr" class="list"><span class="mut">Memuat…</span></div></div>
  <div class="card"><h3>Impor data lama</h3><p class="mut sm">Pilih file <b>import_z26.json</b> hasil migrasi dari AppSheet. Aman diulang (data yang sama ditimpa, tidak dobel).</p><input type="file" id="imp" accept=".json"><div id="impLog" class="sm mut" style="margin-top:8px;white-space:pre-line"></div></div>` : ''}</div>`;
  $$('[data-th]', el).forEach(c => c.onclick = () => { lsSet('theme', c.dataset.th); applyTheme(); pengaturan(el); });
  $$('[data-ac]', el).forEach(c => c.onclick = () => { lsSet('accent', c.dataset.ac); applyTheme(); pengaturan(el); });
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
    if (!$('#page')) shell();
    render();
  } catch (e) { console.error(e); $('#root').innerHTML = `<div class="c bad" style="padding:40px">Gagal memuat: ${esc(e.message)}<br><button class="btn" onclick="location.reload()">Coba lagi</button></div>`; }
  finally { booting = false; }
}
sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_IN' && !S.loaded) boot(); if (ev === 'SIGNED_OUT') { S.loaded = false; boot(); } });
addEventListener('hashchange', () => { const v = (location.hash || '#/beranda').slice(2); if (v !== view && $('#page')) { view = v; render(); } });
boot();
