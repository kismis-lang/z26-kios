import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { KODE, tglWIB } from './util.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const S = { user: null, prof: null, produk: [], set: {}, petani: [], pen: [], stok: [], lk: [], lkm: [], vstok: [], loaded: false };

export const isMgr = () => S.prof && S.prof.status === 'approved' && (S.prof.role === 'admin' || S.prof.role === 'owner');
export const isAdmin = () => S.prof && S.prof.status === 'approved' && S.prof.role === 'admin';

// PostgREST membatasi 1000 baris per permintaan, jadi ambil bertahap.
export async function all(table, select = '*', mod) {
  const out = []; const step = 1000;
  for (let from = 0; ; from += step) {
    let q = sb.from(table).select(select).range(from, from + step - 1);
    if (mod) q = mod(q);
    const { data, error } = await q;
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
  const [produk, set, petani, pen, stok, lk, lkm, vstok] = await Promise.all([
    all('produk', '*', q => q.order('id')),
    all('pengaturan'),
    all('v_petani_status', '*', q => q.order('id_data')),
    all('v_penjualan_status', '*', q => q.order('tanggal_waktu', { ascending: false })),
    all('stok', '*', q => q.order('tanggal_input', { ascending: false })),
    all('detail_lk'), all('dlk_masuk'),
    all('v_stok_produk', '*', q => q.order('id')),
  ]);
  S.produk = produk; S.set = Object.fromEntries(set.map(r => [r.kunci, r.nilai]));
  S.petani = petani; S.pen = pen; S.stok = stok; S.lk = lk; S.lkm = lkm; S.vstok = vstok;
  S.byKode = Object.fromEntries(produk.map(p => [p.kode, p]));
  S.byId = Object.fromEntries(produk.map(p => [p.id, p]));
  S.pid = Object.fromEntries(petani.map(p => [p.id_data, p]));
  S.loaded = true;
}
export async function reloadTx() { // setelah transaksi: muat ulang ringkasan
  const [petani, pen, vstok] = await Promise.all([
    all('v_petani_status', '*', q => q.order('id_data')),
    all('v_penjualan_status', '*', q => q.order('tanggal_waktu', { ascending: false })),
    all('v_stok_produk', '*', q => q.order('id')),
  ]);
  S.petani = petani; S.pen = pen; S.vstok = vstok; S.pid = Object.fromEntries(petani.map(p => [p.id_data, p]));
}

// ===== ringkasan untuk beranda =====
export function ringkasHariIni() {
  const t = tglWIB(new Date());
  const list = S.pen.filter(p => tglWIB(p.tanggal_waktu) === t);
  return { n: list.length, omzet: list.reduce((a, b) => a + Number(b.total_harga), 0), kg: list.reduce((a, b) => a + Number(b.rencana), 0), list };
}
export function totalBelum() {
  let kgBd = 0, nBd = 0, kgBf = 0, nBf = 0;
  for (const p of S.petani) {
    const bd = KODE.reduce((a, k) => a + Math.max(0, p['bd_' + k]), 0);
    const bf = KODE.reduce((a, k) => a + Math.max(0, p['bf_' + k]), 0);
    if (bd > 0) { kgBd += bd; nBd++; }
    if (bf > 0) { kgBf += bf; nBf++; }
  }
  return { kgBd, nBd, kgBf, nBf };
}
export function stokProduk() {
  return S.vstok.map(v => {
    const lkOut = S.lk.filter(r => r.id_produk === v.id).reduce((a, b) => a + Number(b.jumlah), 0);
    const lkIn = S.lkm.filter(r => r.id_produk === v.id).reduce((a, b) => a + Number(b.jumlah), 0);
    const belum = Number(v.terjual) - Number(v.diambil);
    return { ...v, lkOut, lkIn, belum, fisik: Number(v.sisa_stok) + belum - lkOut + lkIn };
  });
}
export function perPoktan() {
  const m = {};
  for (const p of S.petani) {
    const o = m[p.poktan || '-'] ||= { nama: p.poktan || '-', petani: 0, ...Object.fromEntries(KODE.flatMap(k => [['k_' + k, 0], ['t_' + k, 0]])) };
    o.petani++;
    for (const k of KODE) { o['k_' + k] += Number(p['kuota_' + k]); o['t_' + k] += Number(p['t_' + k]); }
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
