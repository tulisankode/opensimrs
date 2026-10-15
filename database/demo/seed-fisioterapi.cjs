'use strict';

// Master data demo modul fisioterapi (penunjang-service), dipanggil seed-demo.cjs per faskes yang modulnya aktif
// dan oleh isi-master-penunjang.cjs untuk faskes yang sudah ada.
// ctx: { ins(tabel, baris) → uuid, satu(sql, params), db, F (spesifikasi faskes katalog-demo), fUuid, base
//        ({ faskes_uuid, created_at, updated_at }), punya(kodeModul), level (1 praktik … 3 RS), penjamin [{uuid,name}],
//        rupiah(n), NOW }. Kembalikan ringkasan singkat (string) untuk dicetak seeder.
//
// IDEMPOTEN: bed, tindakan & paket yang kodenya sudah ada di faskes dilewati (tidak diubah).

// [kode, nama, tarif dasar (sebelum × skala faskes), jenis_fisio (null = semua jenis), khusus RS?]
const TINDAKAN = [
  ['FIS-KONS', 'Konsultasi Fisioterapis', 75000, null],
  ['FIS-EXT', 'Exercise Therapy', 85000, null],
  ['FIS-IR', 'Infra Red', 45000, null],
  ['FIS-TENS', 'TENS (Transcutaneous Electrical Nerve Stimulation)', 60000, null],
  ['FIS-USD', 'Ultrasound Diathermy', 75000, null],
  ['FIS-SWD', 'Short Wave Diathermy', 70000, null],
  ['FIS-MWD', 'Microwave Diathermy', 75000, null],
  ['FIS-IFC', 'Interferential Current (IFC)', 70000, null],
  ['FIS-ES', 'Electrical Stimulation', 65000, null],
  ['FIS-LASER', 'Laser Therapy', 100000, null],
  ['FIS-HP', 'Hot Pack', 35000, null],
  ['FIS-CP', 'Cold Pack', 30000, 'sport'],
  ['FIS-PARAFIN', 'Parafin Bath', 50000, null],
  ['FIS-TRK', 'Traksi Lumbal / Cervical', 80000, 'orto'],
  ['FIS-MT', 'Manual Therapy (Mobilisasi Sendi)', 95000, 'orto'],
  ['FIS-MSG', 'Massage Therapy', 65000, null],
  ['FIS-KT', 'Kinesio Taping', 90000, 'sport'],
  ['FIS-NDT', 'Neuro Developmental Treatment (NDT)', 120000, 'anak'],
  ['FIS-PNF', 'Proprioceptive Neuromuscular Facilitation (PNF)', 100000, 'saraf'],
  ['FIS-BOBATH', 'Terapi Latihan Neuro (Bobath)', 110000, 'saraf'],
  ['FIS-GAIT', 'Gait Training (Latihan Berjalan)', 80000, null],
  ['FIS-GER', 'Latihan Keseimbangan & Pencegahan Jatuh', 80000, 'geriatri'],
  ['FIS-CPT', 'Chest Physiotherapy (Fisioterapi Dada)', 80000, null],
  ['FIS-BRT', 'Breathing Exercise (Latihan Pernapasan)', 60000, null],
  ['FIS-OT', 'Terapi Okupasi', 100000, null],
  ['FIS-ESWT', 'Extracorporeal Shock Wave Therapy (ESWT)', 250000, 'orto', true],
  ['FIS-HIDRO', 'Hydrotherapy', 150000, null, true],
  ['FIS-TW', 'Terapi Wicara', 100000, null, true],
  ['FIS-SI', 'Terapi Sensori Integrasi', 120000, 'anak', true],
];

// Paket: [kode, nama, jenis_fisio, jumlah sesi, faktor harga (× tarif satuan seluruh sesi), khusus RS?,
//         [[kode tindakan, qty per sesi], ...], deskripsi]. Tindakan yang tidak tersedia dilewati.
const PAKET = [
  ['PKT-FIS-STROKE', 'Paket Rehabilitasi Pasca Stroke', 'saraf', 10, 0.8, false,
    [['FIS-PNF', 1], ['FIS-BOBATH', 1], ['FIS-ES', 1], ['FIS-GAIT', 1]], 'Latihan neuromuskular, stimulasi listrik & latihan berjalan 10 sesi.'],
  ['PKT-FIS-LBP', 'Paket Low Back Pain', 'orto', 6, 0.85, false,
    [['FIS-IFC', 1], ['FIS-TRK', 1], ['FIS-EXT', 1]], 'Interferential current, traksi lumbal & latihan stabilisasi inti 6 sesi.'],
  ['PKT-FIS-FROZEN', 'Paket Frozen Shoulder', 'orto', 8, 0.85, false,
    [['FIS-USD', 1], ['FIS-MT', 1], ['FIS-EXT', 1]], 'Ultrasound, mobilisasi sendi bahu & latihan lingkup gerak 8 sesi.'],
  ['PKT-FIS-NECK', 'Paket Nyeri Leher (Cervical Syndrome)', 'orto', 6, 0.85, false,
    [['FIS-HP', 1], ['FIS-TRK', 1], ['FIS-MT', 1]], 'Hot pack, traksi cervical & manual therapy 6 sesi.'],
  ['PKT-FIS-OA', 'Paket Osteoartritis Lutut', 'orto', 8, 0.85, false,
    [['FIS-SWD', 1], ['FIS-LASER', 1], ['FIS-EXT', 1]], 'Diatermi, laser & penguatan otot quadriceps 8 sesi.'],
  ['PKT-FIS-ACL', 'Paket Cedera Olahraga / Pasca ACL', 'sport', 12, 0.8, false,
    [['FIS-EXT', 1], ['FIS-ES', 1], ['FIS-CP', 1], ['FIS-KT', 1]], 'Rehabilitasi pasca rekonstruksi ACL / cedera olahraga 12 sesi.'],
  ['PKT-FIS-ANAK', 'Paket Tumbuh Kembang Anak', 'anak', 8, 0.85, false,
    [['FIS-NDT', 1], ['FIS-OT', 1], ['FIS-SI', 1]], 'NDT, terapi okupasi (RS: + sensori integrasi) 8 sesi.'],
  ['PKT-FIS-GERI', 'Paket Geriatri Keseimbangan & Pencegahan Jatuh', 'geriatri', 8, 0.85, false,
    [['FIS-GER', 1], ['FIS-GAIT', 1], ['FIS-HP', 1]], 'Latihan keseimbangan, latihan berjalan & hot pack 8 sesi.'],
  // Belum ada jenis kardiorespirasi di jenis_fisio; dikelompokkan geriatri (mayoritas pasien lansia).
  ['PKT-FIS-DADA', 'Paket Fisioterapi Dada / Pasca COVID', 'geriatri', 6, 0.85, false,
    [['FIS-CPT', 1], ['FIS-BRT', 1], ['FIS-EXT', 1]], 'Fisioterapi dada, latihan pernapasan & latihan ketahanan 6 sesi.'],
  ['PKT-FIS-ESWT', 'Paket Plantar Fasciitis / Tendinopati (ESWT)', 'orto', 4, 0.85, true,
    [['FIS-ESWT', 1], ['FIS-EXT', 1]], 'Shock wave therapy & latihan peregangan 4 sesi.'],
  ['PKT-FIS-HIDRO', 'Paket Hidroterapi Pasca Cedera', 'sport', 6, 0.85, true,
    [['FIS-HIDRO', 1], ['FIS-EXT', 1]], 'Latihan dalam air & exercise therapy 6 sesi.'],
];

const baris = async (ctx, sql, p) => (ctx.db ? (await ctx.db.query(sql, p)).rows : [await ctx.satu(sql, p)].filter(Boolean));

async function seed(ctx) {
  const { ins, base, F, rupiah, level } = ctx;
  const skala = Number(F?.skala) || 1;
  const rs = String(F?.segmen ?? '').startsWith('rs_');
  const fUuid = base.faskes_uuid;

  // Praktik/klinik kecil 3 bed, klinik pratama/puskesmas 4, klinik utama & rumah sakit 6.
  const jumlahBed = level >= 3 ? 6 : level === 2 ? 4 : 3;
  const bedAda = new Set((await baris(ctx, `SELECT kode FROM fisio_bed WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => r.kode));
  let bedBaru = 0;
  for (let i = 1; i <= jumlahBed; i++) {
    const kode = `BED-${String(i).padStart(2, '0')}`;
    if (bedAda.has(kode)) continue;
    await ins('fisio_bed', { ...base, kode, nama: `Bed ${i}`, ruangan: 'Ruang Fisioterapi', keterangan: i === 1 ? 'Dekat pintu, akses kursi roda' : null, status: true });
    bedBaru++;
  }

  const ada = new Map(
    (await baris(ctx, `SELECT uuid, kode, harga::float8 AS harga FROM fisio_tindakan WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => [r.kode, r]),
  );
  let baru = 0;
  for (const [kode, nama, harga, jenis, khususRs] of TINDAKAN) {
    if ((khususRs && !rs) || ada.has(kode)) continue;
    const h = rupiah(harga * skala);
    const uuid = await ins('fisio_tindakan', { ...base, kode, nama, harga: h, jenis_fisio: jenis, status: true });
    ada.set(kode, { uuid, kode, harga: h });
    baru++;
  }

  const paketAda = new Set((await baris(ctx, `SELECT kode FROM fisio_paket WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => r.kode));
  let paketBaru = 0;
  for (const [kode, nama, jenis, sesi, faktor, khususRs, isiKode, deskripsi] of PAKET) {
    if ((khususRs && !rs) || paketAda.has(kode)) continue;
    const isi = isiKode.map(([k, qty]) => (ada.has(k) ? { ...ada.get(k), qty } : null)).filter(Boolean);
    if (!isi.length) continue;
    const total = isi.reduce((n, t) => n + Number(t.harga) * t.qty, 0) * sesi;
    const harga = Math.min(rupiah(total * faktor), total - 500);
    const paketUuid = await ins('fisio_paket', { ...base, kode, nama, jenis_fisio: jenis, jumlah_sesi: sesi, harga, deskripsi, status: true });
    for (const [n, t] of isi.entries()) {
      await ins('fisio_paket_tindakan', { ...base, paket_uuid: paketUuid, tindakan_uuid: t.uuid, qty: t.qty, urutan: n + 1 });
    }
    paketBaru++;
  }

  return `Fisioterapi: ${jumlahBed} bed (+${bedBaru}), ${ada.size} tindakan (+${baru}), +${paketBaru} paket`;
}

module.exports = { seed, TINDAKAN, PAKET };
