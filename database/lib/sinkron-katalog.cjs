'use strict';

// Menyinkronkan database/data/katalog-modul.json ke tabel ref_* & preset_segmen_* (idempoten).
// Dipakai migrasi: setiap perubahan katalog = ubah JSON + migrasi baru yang memanggil fungsi ini.
// Baris katalog yang dihapus dari JSON ikut terhapus; override faskes yang merujuknya terhapus (ON DELETE CASCADE).
const katalog = require('../data/katalog-modul.json');

const ON = (v) => (v ? 'true' : 'false');

async function sinkronKatalog(queryInterface, transaction) {
  const q = (sql, replacements = {}) => queryInterface.sequelize.query(sql, { replacements, transaction });
  const { jenis_poli: jenisPoli, segmen, modul, fitur, bagian, preset } = katalog;

  // 1) Tabel referensi (upsert)
  for (const j of jenisPoli) {
    await q(`INSERT INTO ref_jenis_poli (kode, nama, urutan) VALUES (:kode, :nama, :urutan)
             ON CONFLICT (kode) DO UPDATE SET nama = EXCLUDED.nama, urutan = EXCLUDED.urutan`, j);
  }
  for (const s of segmen) {
    await q(`INSERT INTO ref_segmen (kode, nama, urutan, ringkas) VALUES (:kode, :nama, :urutan, :ringkas)
             ON CONFLICT (kode) DO UPDATE SET nama = EXCLUDED.nama, urutan = EXCLUDED.urutan, ringkas = EXCLUDED.ringkas`, s);
  }
  for (const m of modul) {
    await q(`INSERT INTO ref_modul (kode, nama, kelompok, deskripsi, inti, tersedia, urutan)
             VALUES (:kode, :nama, :kelompok, :deskripsi, ${ON(m.inti)}, ${ON(m.tersedia)}, :urutan)
             ON CONFLICT (kode) DO UPDATE SET nama = EXCLUDED.nama, kelompok = EXCLUDED.kelompok, deskripsi = EXCLUDED.deskripsi,
               inti = EXCLUDED.inti, tersedia = EXCLUDED.tersedia, urutan = EXCLUDED.urutan`, m);
  }
  // ref_fitur.modul_syarat ditambahkan migrasi 20261014130000; migrasi sebelumnya memanggil fungsi ini sebelum kolom ada.
  const [kolom] = await q(`SELECT 1 FROM information_schema.columns WHERE table_name = 'ref_fitur' AND column_name = 'modul_syarat'`);
  const adaSyarat = kolom.length > 0;
  for (const f of fitur) {
    await q(`INSERT INTO ref_fitur (kode, modul_kode, nama, deskripsi, wajib, tersedia, urutan${adaSyarat ? ', modul_syarat' : ''})
             VALUES (:kode, :modul, :nama, :deskripsi, ${ON(f.wajib)}, ${ON(f.tersedia)}, :urutan${adaSyarat ? ', :modul_syarat' : ''})
             ON CONFLICT (kode) DO UPDATE SET modul_kode = EXCLUDED.modul_kode, nama = EXCLUDED.nama, deskripsi = EXCLUDED.deskripsi,
               wajib = EXCLUDED.wajib, tersedia = EXCLUDED.tersedia, urutan = EXCLUDED.urutan${adaSyarat ? ', modul_syarat = EXCLUDED.modul_syarat' : ''}`,
      { ...f, modul_syarat: f.modul_syarat ?? null });
  }
  for (const b of bagian) {
    await q(`INSERT INTO ref_bagian (kode, fitur_kode, label, nama, wajib, modul_syarat, urutan)
             VALUES (:kode, :fitur, :label, :nama, ${ON(b.wajib)}, :modul_syarat, :urutan)
             ON CONFLICT (kode) DO UPDATE SET fitur_kode = EXCLUDED.fitur_kode, label = EXCLUDED.label, nama = EXCLUDED.nama,
               wajib = EXCLUDED.wajib, modul_syarat = EXCLUDED.modul_syarat, urutan = EXCLUDED.urutan`, b);
  }

  // 2) Relasi turunan: dibangun ulang dari JSON
  await q(`DELETE FROM ref_modul_menu`);
  for (const m of modul) for (const judul of m.menu) await q(`INSERT INTO ref_modul_menu (modul_kode, judul) VALUES (:kode, :judul)`, { kode: m.kode, judul });
  await q(`DELETE FROM ref_rute`);
  for (const m of modul) for (const rute of m.rute) await q(`INSERT INTO ref_rute (modul_kode, rute) VALUES (:kode, :rute)`, { kode: m.kode, rute });
  for (const f of fitur) for (const rute of f.rute) await q(`INSERT INTO ref_rute (fitur_kode, rute) VALUES (:kode, :rute)`, { kode: f.kode, rute });
  await q(`DELETE FROM ref_bagian_poli`);
  for (const b of bagian) for (const jp of b.poli) await q(`INSERT INTO ref_bagian_poli (bagian_kode, jenis_poli) VALUES (:kode, :jp)`, { kode: b.kode, jp });

  await q(`DELETE FROM preset_segmen_modul`);
  for (const [seg, daftar] of Object.entries(preset.segmen_modul)) {
    for (const kode of daftar) await q(`INSERT INTO preset_segmen_modul (segmen_kode, modul_kode) VALUES (:seg, :kode)`, { seg, kode });
  }
  await q(`DELETE FROM preset_segmen_fitur_mati`);
  for (const [seg, daftar] of Object.entries(preset.fitur_mati)) {
    for (const kode of daftar) await q(`INSERT INTO preset_segmen_fitur_mati (segmen_kode, fitur_kode) VALUES (:seg, :kode)`, { seg, kode });
  }
  await q(`DELETE FROM preset_segmen_bagian_mati`);
  for (const [seg, daftar] of Object.entries(preset.bagian_mati)) {
    for (const kode of daftar) await q(`INSERT INTO preset_segmen_bagian_mati (segmen_kode, bagian_kode) VALUES (:seg, :kode)`, { seg, kode });
  }

  // 3) Hapus baris katalog yang tidak lagi ada di JSON (urutan: anak → induk)
  const daftar = (arr) => arr.map((x) => x.kode);
  await q(`DELETE FROM ref_bagian WHERE kode NOT IN (:kode)`, { kode: daftar(bagian) });
  await q(`DELETE FROM ref_fitur WHERE kode NOT IN (:kode)`, { kode: daftar(fitur) });
  await q(`DELETE FROM ref_modul WHERE kode NOT IN (:kode)`, { kode: daftar(modul) });
  await q(`DELETE FROM ref_segmen WHERE kode NOT IN (:kode)`, { kode: daftar(segmen) });
}

module.exports = { sinkronKatalog };
