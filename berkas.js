// ===== berkas: tanda tangan, KTP, KK, dokumen lain (per NIK) + BAST / nota penebusan (per barang masuk) =====
// Semua orang yang disetujui bisa MELIHAT; hanya ADMIN yang bisa unggah / ganti / hapus (dijaga juga oleh RLS di server).
import { $, $$, esc, toast, I } from './util.js';
import { sb, S, isAdmin, loadBerkas } from './data.js';
import { hooks, openDrawer, closeDrawer } from './ui.js';

const BK = 'berkas';
const JENIS = [['ttd', 'Tanda tangan'], ['ktp', 'Foto KTP'], ['kk', 'Foto KK'], ['lain', 'Dokumen pendukung lain']];
const cache = new Map();
const isImg = p => /\.(png|jpe?g|webp|gif)$/i.test(p || '');
const ext = n => ((n || '').match(/\.([a-z0-9]+)$/i)?.[1] || 'jpg').toLowerCase();

export async function signed(paths, bucket = BK) {
  const need = paths.filter(p => p && !(cache.get(bucket + p)?.t > Date.now()));
  if (need.length) {
    const { data } = await sb.storage.from(bucket).createSignedUrls(need, 3600);
    (data || []).forEach(d => d.signedUrl && cache.set(bucket + d.path, { u: d.signedUrl, t: Date.now() + 3300e3 }));
  }
  return Object.fromEntries(paths.map(p => [p, cache.get(bucket + p)?.u || '']));
}
export async function bukaBerkas(path, bucket = BK) {
  const w = window.open('', '_blank');
  const u = (await signed([path], bucket))[path];
  if (!u) { w && w.close(); return toast('Berkas belum ada di penyimpanan'); }
  if (w) w.location = u; else location.href = u;
}
// foto dari HP sering besar: perkecil ke maks 1600 px (JPEG)
async function kecilkan(file, max = 1600) {
  if (!/^image\/(jpe?g|png|webp)$/i.test(file.type) || file.size < 400e3) return file;
  try {
    const bmp = await createImageBitmap(file); const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise(res => c.toBlob(res, 'image/jpeg', .85));
    return b && b.size < file.size ? new File([b], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
export async function unggah(path, file, upsert = true) {
  const f = await kecilkan(file);
  const p = f !== file ? path.replace(/\.\w+$/, '.jpg') : path;
  const { error } = await sb.storage.from(BK).upload(p, f, { upsert, contentType: f.type || undefined });
  if (error) throw error; cache.delete(BK + p); return { path: p, file: f };
}

// ---------- tanda tangan untuk nota ----------
export const ttdPetani = nik => (S.bByNik?.[nik] || []).filter(b => b.jenis === 'ttd').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
export async function ttdUrl(nik) { const t = ttdPetani(nik); return t ? (await signed([t.path]))[t.path] : ''; }

// ---------- bagian "Berkas" di form data petani ----------
export function berkasHtml(nik) {
  if (!nik) return '';
  const L = S.bByNik?.[nik] || [];
  const adm = isAdmin();
  const item = b => `<div class="bk" data-bid="${b.id}">${isImg(b.path) ? `<img data-src="${esc(b.path)}" alt="">` : `<span class="bkpdf">${esc(ext(b.path).toUpperCase())}</span>`}
    <span class="bkn">${esc(b.nama || '')}</span><span class="bkb"><button class="btn xs" data-bopen="${esc(b.path)}" title="Buka">${I.eye || '↗'}</button>${adm ? `<button class="btn xs bad" data-bdel="${b.id}" title="Hapus">${I.trash || '✕'}</button>` : ''}</span></div>`;
  return `<div class="bkw" id="bkw"><div class="sec" style="margin:10px 0 4px"><h3>Berkas & dokumen</h3>${adm ? '' : '<span class="mut sm">hanya admin yang bisa mengubah</span>'}</div>
    ${JENIS.map(([j, lab]) => { const r = L.filter(b => b.jenis === j); return `<div class="bkr"><div class="bkh"><b>${lab}</b>${adm ? `<label class="btn sm">${I.upload || '+'} ${r.length && j !== 'lain' ? 'Ganti' : 'Unggah'}<input type="file" hidden data-bup="${j}" accept="${j === 'lain' ? 'image/*,application/pdf' : 'image/*'}" ${j === 'lain' ? 'multiple' : ''}></label>` : ''}</div>
      <div class="bkl">${r.map(item).join('') || '<span class="mut sm">belum ada</span>'}</div></div>`; }).join('')}
    <div class="sm mut" id="bkSt"></div></div>`;
}
export function wireBerkas(d, nik) {
  const box = $('#bkw', d); if (!box) return;
  const imgs = $$('img[data-src]', box);
  if (imgs.length) signed(imgs.map(i => i.dataset.src)).then(m => imgs.forEach(i => i.src = m[i.dataset.src] || ''));
  const rerender = () => { box.outerHTML = berkasHtml(nik); wireBerkas(d, nik); };
  $$('[data-bopen]', box).forEach(b => b.onclick = e => { e.preventDefault(); bukaBerkas(b.dataset.bopen); });
  $$('[data-bdel]', box).forEach(b => b.onclick = async e => {
    e.preventDefault(); const r = S.berkas.find(x => x.id === b.dataset.bdel); if (!r) return;
    if (!confirm(`Hapus berkas "${r.nama || r.jenis}"? Tidak bisa dibatalkan.`)) return;
    await sb.storage.from(BK).remove([r.path]);
    const { error } = await sb.from('berkas').delete().eq('id', r.id); if (error) return toast(error.message);
    await loadBerkas(); toast('Berkas dihapus'); rerender();
  });
  $$('input[data-bup]', box).forEach(inp => inp.onchange = async () => {
    const j = inp.dataset.bup, files = [...inp.files]; if (!files.length) return;
    const st = $('#bkSt', box); st.textContent = 'Mengunggah…';
    try {
      if (j !== 'lain') {                                     // ttd / KTP / KK: hanya satu, yang lama diganti
        const old = (S.bByNik[nik] || []).filter(b => b.jenis === j);
        const { path, file } = await unggah(`petani/${nik}/${j}-${Date.now()}.${ext(files[0].name)}`, files[0]);
        const { error } = await sb.from('berkas').insert({ nik, jenis: j, path, nama: JENIS.find(x => x[0] === j)[1], mime: file.type, ukuran: file.size }); if (error) throw error;
        if (old.length) { await sb.storage.from(BK).remove(old.map(o => o.path)); await sb.from('berkas').delete().in('id', old.map(o => o.id)); }
      } else for (const f0 of files) {
        const { path, file } = await unggah(`petani/${nik}/lain-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext(f0.name)}`, f0);
        const { error } = await sb.from('berkas').insert({ nik, jenis: 'lain', path, nama: f0.name, mime: file.type, ukuran: file.size }); if (error) throw error;
      }
      await loadBerkas(); toast('Berkas tersimpan'); rerender();
    } catch (e) { st.textContent = 'Gagal: ' + (e.message || e); }
  });
}

// ---------- BAST / nota penebusan barang masuk ----------
export async function unggahStok(id_stok, kind, file) {
  const kol = kind === 'nota' ? 'nota_path' : 'bast_path';
  const { path } = await unggah(`stok/${kind === 'nota' ? 'Nota' : 'BAST'}-${id_stok}-${Date.now()}.${ext(file.name)}`, file);
  const { error } = await sb.from('stok').update({ [kol]: path }).eq('id_stok', id_stok); if (error) throw error;
  const r = S.stok.find(x => x.id_stok === id_stok); if (r) r[kol] = path;
  return path;
}

// ---------- impor berkas lama dari AppSheet (Pengaturan, admin) ----------
// Nama file dikenali otomatis: "3508….png" (NIK) = tanda tangan; "BAST …pdf/jpg" & "Nota Penebusan …pdf" = berkas barang masuk.
export function openImporBerkas() {
  if (!isAdmin()) return toast('Hanya admin');
  openDrawer(`<p class="sm">Pilih banyak file sekaligus dari folder lama AppSheet:</p>
    <ul class="sm mut" style="margin:4px 0 8px 16px;padding:0"><li><b>Data_Images</b>: file bernama NIK (mis. 3508…png) → tanda tangan petani</li>
    <li><b>z26/BAST</b> dan <b>z26/Nota_penebusan</b> → BAST & nota di Gudang</li></ul>
    <label class="btn pri" style="cursor:pointer">${I.upload || '+'} Pilih file<input type="file" id="ibF" multiple hidden accept="image/*,application/pdf"></label>
    <div class="sm" id="ibSt" style="margin-top:8px"></div><div class="sm mut" id="ibLog" style="max-height:40vh;overflow:auto;margin-top:6px"></div>`,
    {
      title: 'Impor berkas lama', footer: '<button class="btn" data-close>Tutup</button>', onOpen: d => {
        $('#ibF', d).onchange = async e => {
          const files = [...e.target.files]; if (!files.length) return;
          const sudah = new Set(S.berkas.filter(b => b.jenis === 'ttd').map(b => b.nik));
          const stokPaths = new Set(S.stok.flatMap(s => [s.bast_path, s.nota_path]).filter(Boolean));
          const jobs = [], lewat = [];
          for (const f of files) {
            const m = f.name.match(/^(\d{16})\.(png|jpe?g)$/i);
            if (m) { if (sudah.has(m[1])) lewat.push(f.name + ' (sudah ada)'); else jobs.push({ f, ttd: m[1] }); continue; }
            if (/^(BAST|Nota Penebusan)/i.test(f.name)) { jobs.push({ f, stok: 'stok/' + f.name, ada: stokPaths.has('stok/' + f.name) }); continue; }
            lewat.push(f.name + ' (tidak dikenali)');
          }
          const st = $('#ibSt', d), log = $('#ibLog', d); let ok = 0, gagal = 0, i = 0;
          const add = t => log.insertAdjacentHTML('afterbegin', `<div>${esc(t)}</div>`);
          lewat.forEach(t => add('lewati: ' + t));
          const kerja = async () => {
            while (i < jobs.length) {
              const j = jobs[i++];
              try {
                if (j.ttd) {
                  const path = `petani/${j.ttd}/ttd-lama.${ext(j.f.name)}`;
                  const { error } = await sb.storage.from(BK).upload(path, j.f, { upsert: true, contentType: j.f.type || 'image/png' }); if (error) throw error;
                  const r = await sb.from('berkas').upsert({ nik: j.ttd, jenis: 'ttd', path, nama: 'Tanda tangan', mime: j.f.type, ukuran: j.f.size }, { onConflict: 'path' }); if (r.error) throw r.error;
                } else {
                  const { error } = await sb.storage.from(BK).upload(j.stok, j.f, { upsert: true, contentType: j.f.type || undefined }); if (error) throw error;
                  if (!j.ada) add('catatan: ' + j.f.name + ' terunggah tapi tidak tertaut ke barang masuk mana pun');
                }
                ok++;
              } catch (er) { gagal++; add('GAGAL ' + j.f.name + ': ' + (er.message || er)); }
              st.textContent = `Diproses ${ok + gagal} / ${jobs.length} · berhasil ${ok}${gagal ? ' · gagal ' + gagal : ''}${lewat.length ? ' · dilewati ' + lewat.length : ''}`;
            }
          };
          st.textContent = `Mengunggah ${jobs.length} file…`;
          await Promise.all([kerja(), kerja(), kerja(), kerja()]);
          await loadBerkas(); hooks.refresh();
          st.innerHTML = `<b>Selesai.</b> Berhasil ${ok}, gagal ${gagal}, dilewati ${lewat.length}.`;
        };
      },
    });
}
