'use strict';

// Master data demo modul Bank Darah RS / BDRS (penunjang-service), dipanggil seed-demo.cjs & isi-master-penunjang.cjs
// per faskes yang modulnya aktif (RS kelas B & A — lihat preset_segmen_modul). ctx: { ins(tabel, baris) → uuid,
// satu(sql, params), db, F, fUuid, base ({ faskes_uuid, created_at, updated_at }), punya(kodeModul) }.
//
// Isi: komponen darah bawaan (PRC/WB/TC/FFP — PRD KF-14). Faskes dapat menambah komponen lain lewat Datamaster.
// Pengaturan BDRS (ambang kedaluwarsa & tarif) TIDAK diseed di sini: dibuat otomatis dengan nilai bawaan saat
// pertama kali diakses (lihat penunjang-service/src/bank-darah/pengaturan.js, ambilPengaturan). IDEMPOTEN: komponen
// yang kode-nya sudah ada dilewati.

const KOMPONEN = [
  ['PRC', 'Packed Red Cells (PRC)'],
  ['WB', 'Whole Blood (WB)'],
  ['TC', 'Thrombocyte Concentrate (TC)'],
  ['FFP', 'Fresh Frozen Plasma (FFP)'],
];

const baris = async (ctx, sql, p) => (ctx.db ? (await ctx.db.query(sql, p)).rows : [await ctx.satu(sql, p)].filter(Boolean));

async function seed(ctx) {
  const { ins, base } = ctx;
  const fUuid = base.faskes_uuid;

  const ada = new Set((await baris(ctx, `SELECT kode FROM bdrs_komponen_darah WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => r.kode));
  let baru = 0;
  for (const [kode, nama] of KOMPONEN) {
    if (ada.has(kode)) continue;
    await ins('bdrs_komponen_darah', { ...base, kode, nama, status: true });
    baru++;
  }
  return `bank darah: +${baru} komponen darah`;
}

module.exports = { seed };
