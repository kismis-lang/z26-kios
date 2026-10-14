import { $, $$, esc, n, KODE, NAMA, toast, I, tglWIB } from './util.js';
import { sb, S, isMgr, sum, reloadTx } from './data.js';
import { openDrawer, closeDrawer, hooks } from './ui.js';

let loading;
const lib = () => loading ||= new Promise((res, rej) => {
  if (window.XLSX) return res(window.XLSX);
  const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  s.onload = () => res(window.XLSX); s.onerror = () => { loading = null; rej(new Error('Gagal memuat pustaka Excel (cek koneksi)')); }; document.head.appendChild(s);
});
const stamp = () => tglWIB(new Date());

export async function exportPetani() {
  try {
    const X = await lib();
    const rows = S.petani.map(p => {
      const r = { ID_Data: p.id_data, 'Nama Petani': p.nama, 'Nama Poktan': p.poktan, NIK: p.nik, 'Alamat Petani': p.alamat, 'Tempat Lahir': p.tempat_lahir, 'Tanggal Lahir': p.tanggal_lahir, Komoditas: p.komoditas, 'Luas Lahan': p.luas_lahan };
      KODE.forEach(k => r['Kuota ' + NAMA[k]] = p.q[k]);
      [['Input', 'in'], ['Rencana', 'rc'], ['Diambil', 'ak'], ['Sisa kuota', 'sisa'], ['Belum ambil', 'ba'], ['Belum input', 'bi']].forEach(([l, f]) => KODE.forEach(k => r[`${l} ${NAMA[k]}`] = p[f][k]));
      r.Keterangan = p.keterangan; r.DPT = p.dpt; return r;
    });
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows), 'Data');
    X.writeFile(wb, `data-petani-${S.tahun}-${stamp()}.xlsx`); toast('File Excel diunduh');
  } catch (e) { toast(e.message); }
}
export async function exportPenjualan() {
  try {
    const X = await lib();
    const rows = S.pen.map(s => {
      const r = { 'No Pesanan': s.no_pesanan, Tanggal: s.tanggal_waktu ? new Date(s.tanggal_waktu).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '', ID_Data: s.id_data, 'Nama Petani': s.nama_petani, NIK: s.nik, 'Nama Poktan': s.nama_poktan, Komoditas: s.komoditas, 'Total Harga': s.total_harga };
      [['Input', 'in'], ['Rencana', 'rc'], ['Diambil', 'ak'], ['Belum ambil', 'ba']].forEach(([l, f]) => KODE.forEach(k => r[`${l} ${NAMA[k]}`] = s[f][k]));
      r.Keterangan = s.keterangan; return r;
    });
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows), 'Penjualan');
    X.writeFile(wb, `penjualan-${S.tahun}-${stamp()}.xlsx`); toast('File Excel diunduh');
  } catch (e) { toast(e.message); }
}
export async function templatePetani() {
  try {
    const X = await lib();
    const r = { ID_Data: '', 'Nama Petani': 'Contoh Nama', 'Nama Poktan': 'Cengkok Rejo', NIK: '3508000000000000', 'Alamat Petani': 'RT 01 RW 01', 'Tempat Lahir': 'Lumajang', 'Tanggal Lahir': '1970-01-01', Komoditas: 'Padi', 'Luas Lahan': 0.5, 'Kuota Urea': 150, 'Kuota Phonska': 150, 'Kuota Organik': 0, 'Kuota ZA': 0, Keterangan: '', DPT: '' };
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.json_to_sheet([r]), 'Data');
    X.writeFile(wb, 'template-impor-petani.xlsx');
  } catch (e) { toast(e.message); }
}

const pick = (row, names) => { for (const k of names) if (row[k] !== undefined && row[k] !== '') return row[k]; return ''; };
const dateStr = v => { if (!v) return null; if (v instanceof Date) return v.toISOString().slice(0, 10); const s = String(v).trim(); const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null); };
const num = v => { const x = Number(String(v).replace(/[^\d.\-]/g, '')); return Number.isFinite(x) ? x : 0; };

export function openImportPetani() {
  openDrawer(`<p class="mut sm">Pilih file Excel (.xlsx). Kolom yang dikenali: ID_Data (opsional), Nama Petani, Nama Poktan, NIK, Alamat Petani, Tempat Lahir, Tanggal Lahir, Komoditas, Luas Lahan, Kuota Urea / Phonska / Organik / ZA (atau Pupuk Urea N 46%, Pupuk NPK Phonska, Pupuk Organik, Pupuk ZA), Keterangan, DPT.
    Data lama diperbarui bila ID_Data cocok, atau NIK + poktan + komoditas cocok; selain itu ditambahkan sebagai data baru.</p>
    <div class="bar"><button class="btn" id="xTpl">${I.download} Unduh template</button></div>
    <input type="file" id="xF" accept=".xlsx,.xls,.csv"><div id="xRes" style="margin-top:10px"></div>`,
    {
      title: 'Impor petani dari Excel', footer: '<button class="btn" data-close>Tutup</button><button class="btn pri" id="xGo" disabled>Proses impor</button>',
      onOpen: d => {
        $('#xTpl', d).onclick = templatePetani;
        if (!isMgr()) $('#xRes', d).innerHTML = '<p class="bad">Hanya admin / pemilik yang boleh mengimpor.</p>';
        let plan = null;
        $('#xF', d).onchange = async e => {
          const f = e.target.files[0]; if (!f) return;
          try {
            const X = await lib(); const wb = X.read(await f.arrayBuffer(), { cellDates: true });
            const ws = wb.Sheets.Data || wb.Sheets[wb.SheetNames[0]]; const rows = X.utils.sheet_to_json(ws, { defval: '' });
            let nextId = S.maxId + 1; const upd = [], add = [], bad = [];
            const key = (nik, pok, kom) => `${nik}|${pok}|${kom}`; const idx = {}; S.petani.forEach(p => idx[key(p.nik, p.poktan, p.komoditas)] = p);
            rows.forEach((r, i) => {
              const nama = String(pick(r, ['Nama Petani', 'Nama'])).trim(); if (!nama) return bad.push(i + 2);
              const nik = String(pick(r, ['NIK'])).replace(/\D/g, '') || null, pok = String(pick(r, ['Nama Poktan', 'Poktan'])).trim() || null, kom = String(pick(r, ['Komoditas'])).trim() || null;
              const row = { nama, nik, poktan: pok, komoditas: kom, alamat: String(pick(r, ['Alamat Petani', 'Alamat'])).trim() || null, tempat_lahir: String(pick(r, ['Tempat Lahir'])).trim() || null, tanggal_lahir: dateStr(pick(r, ['Tanggal Lahir'])), luas_lahan: pick(r, ['Luas Lahan']) === '' ? null : num(pick(r, ['Luas Lahan'])),
                kuota_urea: num(pick(r, ['Kuota Urea', 'Pupuk Urea N 46%', 'Urea'])), kuota_phonska: num(pick(r, ['Kuota Phonska', 'Pupuk NPK Phonska', 'Phonska'])), kuota_organik: num(pick(r, ['Kuota Organik', 'Pupuk Organik', 'Organik'])), kuota_za: num(pick(r, ['Kuota ZA', 'Pupuk ZA', 'ZA'])),
                keterangan: String(pick(r, ['Keterangan'])).trim() || null, dpt: String(pick(r, ['DPT'])).trim() || null };
              const idIn = Number(pick(r, ['ID_Data', 'ID'])); const ex = (idIn && S.pid[idIn]) || idx[key(nik, pok, kom)];
              if (ex) upd.push({ id_data: ex.id_data, ...row }); else add.push({ id_data: nextId++, tahun: S.tahun, ...row });
            });
            plan = [...upd, ...add];
            $('#xRes', d).innerHTML = `<div class="card" style="padding:10px"><b>${n(rows.length)}</b> baris dibaca<br>Diperbarui: <b>${n(upd.length)}</b> · Baru: <b>${n(add.length)}</b>${bad.length ? ` · Dilewati (tanpa nama): ${bad.length}` : ''}</div>`;
            $('#xGo', d).disabled = !isMgr() || !plan.length;
          } catch (er) { $('#xRes', d).innerHTML = `<p class="bad">${esc(er.message)}</p>`; }
        };
        $('#xGo', d).onclick = async () => {
          $('#xGo', d).disabled = true; let ok = 0;
          for (let i = 0; i < plan.length; i += 300) {
            const { error } = await sb.from('petani').upsert(plan.slice(i, i + 300), { onConflict: 'id_data' });
            if (error) { toast('Gagal: ' + error.message); return; } ok += Math.min(300, plan.length - i);
          }
          S.maxId = Math.max(S.maxId, ...plan.map(x => x.id_data)); toast(`${ok} data petani diproses`); closeDrawer(); await reloadTx(); hooks.refresh();
        };
      },
    });
}
