import { query, satu } from "../db.js";
import { panggilLayanan } from "../umum/layanan.js";
import { tidakDitemukan } from "../umum/respons.js";
import config from "../config.js";

// Episode rawat inap aktif (status_ri: 1 dirawat, 2 pindah diajukan, 3 pindah selesai; 4 = pulang, 0 = batal),
// berikut lokasi (bangsal/lokasi_uuid) & kamar (ruangan via room_monitorings) terkini. Dibaca langsung dari tabel
// rawat_inaps/lokasi/ruangan/room_monitorings milik rawat-inap-service (database bersama), tanpa menulis ke sana.
const PILIH_RI = `ri.uuid, ri.faskes_uuid, ri.no_rm, ri.no_reg, ri.name AS nama_pasien, ri.gender, ri.patient_uuid,
  ri.tanggal_dirawat, ri.discharge_date AS tanggal_pulang, ri.status_ri, ri.rekam_medis_uuid, ri.practitioner_uuid, ri.lokasi_uuid,
  l.name AS nama_bangsal, rm.no_bed, rg.name AS nama_kamar,
  TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama_dpjp`;
const DARI_RI = `rawat_inaps ri
  LEFT JOIN lokasi l ON l.uuid = ri.lokasi_uuid
  LEFT JOIN room_monitorings rm ON rm.uuid = ri.monitoring_room_uuid
  LEFT JOIN ruangan rg ON rg.uuid = rm.room_uuid
  LEFT JOIN practitioner pr ON pr.uuid = ri.practitioner_uuid
  LEFT JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid`;

const STATUS_AKTIF = "1, 2, 3";
const STATUS_AKTIF_PULANG = "1, 2, 3, 4";

// Episode untuk ditulisi (skrining/asesmen/order baru): hanya episode aktif. Untuk BACA riwayat (GET order diet/asesmen)
// pakai { termasukPulang: true } agar episode yang sudah pulang (status_ri 4) tetap dapat dibuka; batal (0) tetap ditolak.
export const episodeAktif = async (faskesUuid, admissionRiUuid, { termasukPulang = false } = {}) => {
  const r = await satu(
    `SELECT ${PILIH_RI} FROM ${DARI_RI}
      WHERE ri.uuid = $1 AND ri.faskes_uuid = $2 AND ri.deleted_at IS NULL
        AND ri.status_ri IN (${termasukPulang ? STATUS_AKTIF_PULANG : STATUS_AKTIF})`,
    [admissionRiUuid, faskesUuid],
  );
  if (!r) throw tidakDitemukan(termasukPulang ? "Episode rawat inap" : "Episode rawat inap aktif");
  return r;
};

// Daftar episode rawat inap aktif, opsional difilter ruangan (lokasi_uuid) & pencarian nama/no. RM.
// termasukPulang: ikut episode yang sudah pulang (untuk membuka riwayat gizi), dibatasi 100 episode terbaru.
export const daftarAktif = async (faskesUuid, { ruanganUuid, cari, termasukPulang = false } = {}) => {
  const p = [faskesUuid];
  let w = `ri.faskes_uuid = $1 AND ri.deleted_at IS NULL AND ri.status_ri IN (${termasukPulang ? STATUS_AKTIF_PULANG : STATUS_AKTIF})`;
  if (ruanganUuid) {
    p.push(ruanganUuid);
    w += ` AND ri.lokasi_uuid = $${p.length}`;
  }
  if (cari) {
    p.push(`%${cari}%`);
    w += ` AND (ri.name ILIKE $${p.length} OR ri.no_rm ILIKE $${p.length})`;
  }
  if (termasukPulang) {
    return query(
      `SELECT ${PILIH_RI} FROM ${DARI_RI} WHERE ${w}
        ORDER BY (ri.status_ri = 4), ri.tanggal_dirawat DESC NULLS LAST, ri.name LIMIT 100`,
      p,
    );
  }
  return query(`SELECT ${PILIH_RI} FROM ${DARI_RI} WHERE ${w} ORDER BY l.name NULLS LAST, rg.name NULLS LAST, ri.name`, p);
};

// Ruangan (bangsal/lokasi) yang sedang memiliki pasien rawat inap aktif — untuk dropdown Distribusi/Skrining.
export const ruanganAktif = (faskesUuid) =>
  query(
    `SELECT DISTINCT l.uuid, l.name AS nama FROM rawat_inaps ri JOIN lokasi l ON l.uuid = ri.lokasi_uuid
      WHERE ri.faskes_uuid = $1 AND ri.deleted_at IS NULL AND ri.status_ri IN (1, 2, 3) AND l.deleted_at IS NULL
      ORDER BY l.name`,
    [faskesUuid],
  );

// Alergi tercatat pada asesmen RME (bagian Alergi, field teks bebas — bukan master alergi baku), dibaca read-only
// dari rekamedis-service lewat rekam_medis_uuid. Kosong/tidak dapat dibaca → "belum tercatat/perlu konfirmasi",
// TIDAK ditafsirkan sebagai "tidak ada alergi" (lihat PRD/Use Case STD-0007).
export const ambilAlergi = async (rekamMedisUuid, token) => {
  if (!rekamMedisUuid) return { tercatat: false, teks: null };
  try {
    const r = await panggilLayanan(`${config.rmeUrl}/patient?rekam_medis_uuid=${encodeURIComponent(rekamMedisUuid)}`, {
      token,
      nama: "Rekam Medis",
    });
    const nama = String(r?.payload?.summary?.nama_alergi ?? "").trim();
    if (!nama || nama === "-") return { tercatat: false, teks: null };
    return { tercatat: true, teks: nama };
  } catch {
    // RME belum punya sesi/alergi, atau layanan tidak dapat dihubungi — tetap tampilkan "perlu konfirmasi", bukan galat.
    return { tercatat: false, teks: null };
  }
};
