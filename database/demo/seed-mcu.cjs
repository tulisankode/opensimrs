'use strict';

// Master data demo modul mcu (penunjang-service), dipanggil seed-demo.cjs per faskes yang modulnya aktif.
// ctx: { ins(tabel, baris) → uuid, satu(sql, params), db, F (spesifikasi faskes katalog-demo), fUuid, base
//        ({ faskes_uuid, created_at, updated_at }), punya(kodeModul), level (1 praktik … 3 RS), penjamin [{uuid,name}],
//        rupiah(n), NOW }. Kembalikan ringkasan singkat (string) untuk dicetak seeder.
//
// Isi: 3 perusahaan klien fiktif + 4 paket MCU (Dasar, Karyawan Standar, Eksekutif, Pra-Kerja) dengan stasiun & item.
// Item lab menunjuk master item_pemeriksaan faskes bila kodenya ada, atau pemeriksaan/tarif lab (mis. Urin Lengkap →
// T-UL) bila tersedia; selain itu teks bebas (diisi manual di stasiun MCU). Saat peserta didaftarkan, item lab dipetakan
// ke order Laboratorium (lab-service) otomatis. Item radiologi menunjuk
// rad_pemeriksaan Thorax PA (seed-radiologi dijalankan lebih dulu) — bila master tidak ada, item radiologi dilewati.

// Perusahaan fiktif (bukan merek nyata).
const PERUSAHAAN = [
  ['PT-SLN', 'PT Sinar Logistik Nusantara', 'Jl. Raya Industri No. 18, Kawasan Pergudangan Margomulyo', 'Rina Kartikasari (HRD)', '0317491220', 'hrd@sinarlogistik.co.id'],
  ['PT-BKM', 'PT Bumi Karya Mandiri', 'Jl. Ahmad Yani No. 211', 'Hendra Wijaya (GA)', '0318281450', 'ga@bumikaryamandiri.co.id'],
  ['CV-TAP', 'CV Tirta Abadi Pangan', 'Jl. Kenjeran No. 77', 'Yuliani (Personalia)', '0313765102', 'personalia@tirtaabadipangan.co.id'],
];

// [kode item_pemeriksaan, nama, satuan, nilai rujukan, kode tarif lab (pemeriksaan panel) opsional]
const LAB = {
  HB: ['HB', 'Hemoglobin', 'g/dL', 'L 13–17 / P 12–15'],
  LEU: ['LEU', 'Leukosit', 'ribu/uL', '4–10'],
  TRO: ['TRO', 'Trombosit', 'ribu/uL', '150–400'],
  HCT: ['HCT', 'Hematokrit', '%', 'L 40–50 / P 35–45'],
  GDP: ['GDP', 'Glukosa Darah Puasa', 'mg/dL', '70–100'],
  GDS: ['GDS', 'Glukosa Darah Sewaktu', 'mg/dL', '< 200'],
  CHOL: ['CHOL', 'Kolesterol Total', 'mg/dL', '< 200'],
  HDL: ['HDL', 'Kolesterol HDL', 'mg/dL', '> 40'],
  TG: ['TG', 'Trigliserida', 'mg/dL', '< 150'],
  UA: ['UA', 'Asam Urat', 'mg/dL', 'L 3,4–7 / P 2,4–5,7'],
  SGOT: ['SGOT', 'SGOT (AST)', 'U/L', '< 35'],
  SGPT: ['SGPT', 'SGPT (ALT)', 'U/L', '< 41'],
  CREA: ['CREA', 'Kreatinin', 'mg/dL', '0,6–1,2'],
  HBSAG: ['HBSAG', 'HBsAg', '', 'Non reaktif'],
  UL: [null, 'Urinalisis Lengkap', '', 'Normal', 'T-UL'],
  NAPZA: [null, 'Tes Narkoba 3 Parameter (Urin)', '', 'Negatif'],
};

// [kode, nama, deskripsi, harga dasar, jenis, stasiun, lab, radiologi Thorax PA?, tindakan]
const PAKET = [
  ['MCU-DSR', 'MCU Dasar', 'Pemeriksaan fisik, tanda vital, visus dan laboratorium dasar untuk keperluan umum / surat sehat.',
    250000, 'semua', ['anamnesis', 'tanda_vital', 'fisik', 'visus'], ['HB', 'LEU', 'GDS', 'UL'], false, []],
  ['MCU-KRY', 'MCU Karyawan Standar', 'Paket MCU berkala karyawan: fisik lengkap, laboratorium, rontgen thorax dan EKG.',
    550000, 'korporasi', ['anamnesis', 'tanda_vital', 'fisik', 'visus', 'ekg'], ['HB', 'LEU', 'TRO', 'HCT', 'GDP', 'CHOL', 'UA', 'SGPT', 'CREA', 'UL'], true,
    ['Elektrokardiografi (EKG) 12 lead']],
  ['MCU-EKS', 'MCU Eksekutif', 'Pemeriksaan menyeluruh untuk eksekutif: profil lipid, fungsi hati & ginjal, EKG, spirometri, audiometri dan gigi.',
    1650000, 'semua', ['anamnesis', 'tanda_vital', 'fisik', 'visus', 'audiometri', 'ekg', 'spirometri', 'gigi'],
    ['HB', 'LEU', 'TRO', 'HCT', 'GDP', 'CHOL', 'HDL', 'TG', 'UA', 'SGOT', 'SGPT', 'CREA', 'HBSAG', 'UL'], true,
    ['Elektrokardiografi (EKG) 12 lead', 'Spirometri', 'Audiometri', 'Pemeriksaan gigi & mulut']],
  ['MCU-PRA', 'MCU Pra-Kerja', 'Pemeriksaan kesehatan calon karyawan (pre-employment) termasuk rontgen thorax dan tes narkoba.',
    450000, 'semua', ['anamnesis', 'tanda_vital', 'fisik', 'visus'], ['HB', 'LEU', 'GDS', 'HBSAG', 'UL', 'NAPZA'], true, []],
];

async function seed(ctx) {
  const { ins, satu, F, fUuid, base, rupiah } = ctx;
  const skala = F.skala ?? 1;

  // Idempoten: perusahaan & paket yang kodenya sudah ada di faskes ini dilewati (runner isi-master-penunjang).
  const sudahAda = async (tabel, kode) =>
    Boolean(await satu(`SELECT 1 FROM ${tabel} WHERE faskes_uuid = $1 AND kode = $2 AND deleted_at IS NULL LIMIT 1`, [fUuid, kode]));
  let perusahaanBaru = 0;
  let paketBaru = 0;
  for (const [kode, nama, alamat, pic, telepon, email] of PERUSAHAAN) {
    if (await sudahAda('mcu_perusahaan', kode)) continue;
    await ins('mcu_perusahaan', { ...base, kode, nama, alamat, pic, telepon, email, status: true });
    perusahaanBaru++;
  }

  const thorax = await satu(
    `SELECT uuid, nama FROM rad_pemeriksaan WHERE faskes_uuid = $1 AND deleted_at IS NULL AND (kode = 'XR-THX-PA' OR nama ILIKE 'Thorax PA%')
      ORDER BY (kode = 'XR-THX-PA') DESC LIMIT 1`,
    [fUuid],
  );

  let jumlahItem = 0;
  for (const [kode, nama, deskripsi, harga, jenis, stasiunDasar, lab, pakaiRad, tindakan] of PAKET) {
    if (await sudahAda('mcu_paket', kode)) continue;
    paketBaru++;
    const items = [];
    for (const k of lab) {
      const [kodeMaster, namaLab, satuan, rujukan, kodeTarif] = LAB[k];
      const tarif = kodeTarif
        ? await satu(`SELECT uuid, name FROM tarif_lab WHERE faskes_uuid = $1 AND code = $2 AND deleted_at IS NULL LIMIT 1`, [fUuid, kodeTarif])
        : null;
      if (tarif) {
        items.push({ jenis: 'lab', ref_uuid: null, tarif_lab_uuid: tarif.uuid, nama: namaLab, satuan: null, nilai_rujukan: rujukan });
        continue;
      }
      const m = kodeMaster
        ? await satu(`SELECT uuid, name, satuan FROM item_pemeriksaan WHERE faskes_uuid = $1 AND code = $2 AND deleted_at IS NULL LIMIT 1`, [fUuid, kodeMaster])
        : null;
      items.push({ jenis: 'lab', ref_uuid: m?.uuid ?? null, nama: m?.name ?? namaLab, satuan: m?.satuan || satuan || null, nilai_rujukan: rujukan });
    }
    if (pakaiRad && thorax) items.push({ jenis: 'radiologi', ref_uuid: thorax.uuid, nama: thorax.nama, satuan: null, nilai_rujukan: null });
    for (const t of tindakan) items.push({ jenis: 'tindakan', ref_uuid: null, nama: t, satuan: null, nilai_rujukan: null });

    // Susunan stasiun mengikuti urutan alur baku (sama dengan penunjang-service/src/mcu/bersama.js).
    const URUT = ['anamnesis', 'tanda_vital', 'fisik', 'visus', 'audiometri', 'laboratorium', 'radiologi', 'ekg', 'spirometri', 'gigi', 'kesimpulan'];
    const set = new Set([...stasiunDasar, 'kesimpulan', ...(items.some((i) => i.jenis === 'lab') ? ['laboratorium'] : []),
      ...(items.some((i) => i.jenis === 'radiologi') ? ['radiologi'] : [])]);
    const stasiun = URUT.filter((s) => set.has(s));

    // `ins` tidak men-JSON-kan array → kirim string JSON untuk kolom JSONB.
    const paketUuid = await ins('mcu_paket', {
      ...base, kode, nama, deskripsi, harga: rupiah(harga * skala), jenis, stasiun: JSON.stringify(stasiun), status: true,
    });
    for (const [urutan, it] of items.entries()) {
      await ins('mcu_paket_item', { ...base, paket_uuid: paketUuid, ...it, urutan });
      jumlahItem++;
    }
  }

  // Paket lama (sebelum dukungan tarif lab): hubungkan item lab teks bebas ke tarif lab bila tersedia (idempoten).
  let itemTertaut = 0;
  for (const [kodeMaster, namaLab, , , kodeTarif] of Object.values(LAB)) {
    if (kodeMaster || !kodeTarif) continue;
    const r = await satu(
      `WITH t AS (SELECT uuid FROM tarif_lab WHERE faskes_uuid = $1 AND code = $2 AND deleted_at IS NULL LIMIT 1)
       UPDATE mcu_paket_item i SET tarif_lab_uuid = t.uuid FROM t
        WHERE i.faskes_uuid = $1 AND i.jenis = 'lab' AND i.nama = $3 AND i.ref_uuid IS NULL AND i.tarif_lab_uuid IS NULL AND i.deleted_at IS NULL
       RETURNING 1`,
      [fUuid, kodeTarif, namaLab],
    );
    if (r) itemTertaut++;
  }

  return `${perusahaanBaru} perusahaan MCU, ${paketBaru} paket MCU (${jumlahItem} item${thorax ? '' : ', tanpa radiologi'})${itemTertaut ? `, ${itemTertaut} jenis item lab ditautkan ke tarif lab` : ''}`;
}

module.exports = { seed };
