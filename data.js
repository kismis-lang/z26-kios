import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { KODE, tglWIB } from './util.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const S = { user: null, prof: null, produk: [], set: {}, petani: [], pen: [], stok: [], loaded: false };

export const isMgr = () => S.prof && S.prof.status === 'approved' && (S.prof.role === 'admin' || S.prof.role === 'owner');
export const isAdmin = () => S.prof && S.prof.status === 'approved' && S.prof.role === 'admin';
export const z = () => ({ urea: 0, phonska: 0, organik: 0, za: 0 });
export const sum = o => KODE.reduce((a, k) => a + (Number(o[k]) || 0), 0);

// PostgREST membatasi 1000 baris per permintaan, jadi ambil bertahap (dengan urutan tetap).
export async function all(table, select = '*', ord, mod) {
  const out = []; const step = 1000;
  for (let from = 0; ; from += step) {
    let q = sb.from(table).select(select);
    if (mod) q = mod(q);
    if (ord) q = q.order(ord);
    const { data, error } = await q.range(from, from + step - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < step) break;
  }
  return out;
}

export async function loadProfile() {
  const { data: { session } } = await sb.auth.getSession();
  S.user = session?.user || null;
  if (!S.user) { S.prof = null; return; }
  const { data } = await sb.from('profiles').select('*').eq('id', S.user.id).maybeSingle();
  S.prof = data;
}

export async function loadAll() {
  const [produk, set, petani, pen, det, amb, kg, bf, stok, dlk, dlm, lk, lkm] = await Promise.all([
    all('produk', '*', 'id'), all('pengaturan', '*', 'kunci'),
    all('petani', '*', 'id_data'),
    all('penjualan', '*', 'no_pesanan'),
    all('detail', 'id_detail,no_pesanan,id_produk,id_data,jumlah,harga_satuan,subtotal', 'id_detail'),
    all('diambil', 'id_diambil,no_pesanan,id_produk,id_data,jumlah', 'id_diambil'),
    all('keluar_gudang', 'id_kg,no_pesanan,tanggal_waktu,id_data,urea,phonska,organik,za', 'id_kg'),
    all('blum_foto', '*', 'id_blmfoto'),
    all('stok', '*', 'id_stok'),
    all('detail_lk', '*', 'id_dlk'), all('dlk_masuk', '*', 'id_dlkm'),
    all('luar_kelompok', '*', 'id_lk'), all('lk_masuk', '*', 'id_lkm'),
  ]);
  Object.assign(S, { produk, petaniRaw: petani, penRaw: pen, det, amb, kg, bf, stok, dlk, dlm, lk, lkm });
  S.set = Object.fromEntries(set.map(r => [r.kunci, r.nilai]));
  S.byKode = Object.fromEntries(produk.map(p => [p.kode, p]));
  S.byId = Object.fromEntries(produk.map(p => [p.id, p]));
  compute(); S.loaded = true;
}

// muat ulang tabel transaksi saja (setelah simpan/ubah)
export async function reloadTx() {
  const [petani, pen, det, amb, kg, bf] = await Promise.all([
    all('petani', '*', 'id_data'), all('penjualan', '*', 'no_pesanan'),
    all('detail', 'id_detail,no_pesanan,id_produk,id_data,jumlah,harga_satuan,subtotal', 'id_detail'),
    all('diambil', 'id_diambil,no_pesanan,id_produk,id_data,jumlah', 'id_diambil'),
    all('keluar_gudang', 'id_kg,no_pesanan,tanggal_waktu,id_data,urea,phonska,organik,za', 'id_kg'),
    all('blum_foto', '*', 'id_blmfoto'),
  ]);
  Object.assign(S, { petaniRaw: petani, penRaw: pen, det, amb, kg, bf }); compute();
}
export async function reloadAllData() { await loadAll(); }

// ===== hitung semua angka (aturan sama dengan AppSheet lama) =====
// input    = Detail         : jumlah yang diinput dari aplikasi resmi (dasar total harga & sisa kuota)
// rencana  = Diambil        : yang direncanakan diberikan ke petani (input - rencana = milik kios)
// ambil    = KeluarGudang   : yang benar-benar sudah diambil (bisa beberapa kali, beda tanggal/jam)
// belum ambil = rencana - ambil;  belum input = Blum Foto (diambil sebelum diinput)
export function compute() {
  const P = {}, SL = {};
  for (const r of S.petaniRaw) {
    P[r.id_data] = { ...r, q: { urea: +r.kuota_urea, phonska: +r.kuota_phonska, organik: +r.kuota_organik, za: +r.kuota_za }, in: z(), rc: z(), ak: z(), bi: z(), ba: z(), sisa: z(), kios: z(), total: 0, n: 0, last: null };
  }
  for (const r of S.penRaw) SL[r.no_pesanan] = { ...r, in: z(), rc: z(), ak: z(), ba: z(), picks: [] };
  const kd = id => S.byId[id]?.kode;
  for (const r of S.det) {
    const k = kd(r.id_produk); if (!k) continue; const v = +r.jumlah;
    const s = SL[r.no_pesanan]; if (s) s.in[k] += v;
    const p = P[r.id_data]; if (p) { p.in[k] += v; p.total += +r.subtotal; }
  }
  for (const r of S.amb) {
    const k = kd(r.id_produk); if (!k) continue; const v = +r.jumlah;
    const s = SL[r.no_pesanan]; if (s) s.rc[k] += v;
    const p = P[r.id_data]; if (p) p.rc[k] += v;
  }
  for (const r of S.kg) {
    const s = SL[r.no_pesanan]; if (s) s.picks.push(r);
    for (const k of KODE) { const v = +r[k] || 0; if (s) s.ak[k] += v; const p = P[r.id_data]; if (p) p.ak[k] += v; }
  }
  for (const r of S.bf) { const p = P[r.id_data]; if (p) for (const k of KODE) p.bi[k] += +r[k] || 0; }
  for (const s of Object.values(SL)) {
    for (const k of KODE) s.ba[k] = Math.max(0, s.rc[k] - s.ak[k]);
    const p = P[s.id_data]; if (p) { p.n++; for (const k of KODE) p.ba[k] += s.ba[k]; if (!p.last || s.tanggal_waktu > p.last) p.last = s.tanggal_waktu; }
    s.picks.sort((a, b) => String(a.tanggal_waktu).localeCompare(String(b.tanggal_waktu)));
  }
  for (const p of Object.values(P)) for (const k of KODE) { p.sisa[k] = p.q[k] - p.in[k]; p.kios[k] = Math.max(0, p.in[k] - p.rc[k]); }
  S.pid = P; S.sale = SL;
  S.petani = Object.values(P);
  S.pen = Object.values(SL).sort((a, b) => String(b.tanggal_waktu).localeCompare(String(a.tanggal_waktu)));
  S.byNik = {};
  for (const p of S.petani) (S.byNik[p.nik || 'id' + p.id_data] ||= []).push(p);
}

// ===== ringkasan =====
export function ringkasHariIni() {
  const t = tglWIB(new Date());
  const list = S.pen.filter(p => tglWIB(p.tanggal_waktu) === t);
  return { n: list.length, omzet: list.reduce((a, b) => a + Number(b.total_harga), 0), in: list.reduce((a, b) => a + sum(b.in), 0), list };
}
export function totalBelum() {
  const ba = z(), bi = z(); let nBa = 0, nBi = 0;
  for (const s of S.pen) { const t = sum(s.ba); if (t > 0) nBa++; for (const k of KODE) ba[k] += s.ba[k]; }
  for (const p of S.petani) { if (sum(p.bi) > 0) nBi++; for (const k of KODE) bi[k] += p.bi[k]; }
  return { ba, bi, nBa, nBi };
}
// stok gudang: aturan sama dengan sheet Gudang
export function stokProduk() {
  return S.produk.map(pr => {
    const k = pr.kode, id = pr.id;
    const masuk = S.stok.filter(r => r.id_produk === id).reduce((a, r) => a + Number(r.jumlah_masuk) - Number(r.jumlah_kembali || 0), 0);
    const lkOut = S.dlk.filter(r => r.id_produk === id).reduce((a, r) => a + Number(r.jumlah), 0);
    const lkIn = S.dlm.filter(r => r.id_produk === id).reduce((a, r) => a + Number(r.jumlah), 0);
    let input = 0, rencana = 0, ambil = 0, bi = 0, ba = 0;
    for (const p of S.petani) { input += p.in[k]; rencana += p.rc[k]; ambil += p.ak[k]; bi += p.bi[k]; }
    for (const s of S.pen) ba += s.ba[k];
    const awal = Number(pr.gudang_stok_awal), keluar = ambil + bi;
    const fisik = awal + masuk - keluar - lkOut + lkIn;           // stok nyata di gudang
    const sistem = Number(pr.stok_awal) + masuk - input;          // stok menurut input aplikasi resmi
    return { pr, k, id, awal, masuk, input, rencana, ambil, bi, ba, kios: input - rencana, lkOut, lkIn, keluar, fisik, sistem, selisih: fisik - sistem, belakang: Number(pr.gudang_belakang) };
  });
}
export function perPoktan() {
  const m = {};
  for (const p of S.petani) {
    const o = m[p.poktan || '-'] ||= { nama: p.poktan || '-', niks: new Set(), q: z(), in: z(), rc: z(), ak: z() };
    o.niks.add(p.nik || p.id_data);
    for (const k of KODE) { o.q[k] += p.q[k]; o.in[k] += p.in[k]; o.rc[k] += p.rc[k]; o.ak[k] += p.ak[k]; }
  }
  return Object.values(m).sort((a, b) => a.nama.localeCompare(b.nama));
}
export function penjualan14Hari() {
  const out = []; const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 864e5), k = tglWIB(d);
    out.push({ k, label: k.slice(8), omzet: S.pen.filter(p => tglWIB(p.tanggal_waktu) === k).reduce((a, b) => a + Number(b.total_harga), 0) });
  }
  return out;
}
