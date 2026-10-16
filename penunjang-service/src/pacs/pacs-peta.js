import { query, satu, sekarang } from "../db.js";
import { permintaanSalah } from "../umum/respons.js";

// Mapping PACS — pola sama dengan lab-service/src/lis/lis-peta.js (Mapping LIS), diadaptasi untuk Radiologi:
// (a) Tindakan (rad_pemeriksaan) → kode prosedur & modalitas PACS;
// (b) Referensi (unit asal / dokter pengirim / penjamin) → kode PACS, opsional;
// (c) Ruang/alat → AE Title (disimpan langsung pada rad_ruang.ae_title, data referensi worklist).

// ── (a) Tindakan ────────────────────────────────────────────────────────────

export const daftarMappingTindakan = async (faskesUuid, { cari = "", belumDipetakan = false } = {}) => {
  const p = [faskesUuid];
  let w = "m.faskes_uuid = $1 AND m.deleted_at IS NULL";
  if (cari) {
    p.push(`%${cari}%`);
    w += ` AND (m.nama ILIKE $${p.length} OR m.kode ILIKE $${p.length})`;
  }
  if (belumDipetakan) w += " AND t.kode_prosedur_pacs IS NULL";
  return query(
    `SELECT m.uuid AS pemeriksaan_uuid, m.kode, m.nama, m.modalitas, m.status,
            t.kode_prosedur_pacs, t.modalitas_pacs, t.koneksi_uuid, t.updated_at
       FROM rad_pemeriksaan m
       LEFT JOIN rad_pacs_peta_tindakan t ON t.pemeriksaan_uuid = m.uuid AND t.faskes_uuid = m.faskes_uuid AND t.koneksi_uuid IS NULL
      WHERE ${w} ORDER BY m.nama`,
    p,
  );
};

export const simpanMappingTindakan = async (faskesUuid, pemeriksaanUuid, data) => {
  const master = await satu(`SELECT uuid FROM rad_pemeriksaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [pemeriksaanUuid, faskesUuid]);
  if (!master) throw permintaanSalah("Pemeriksaan radiologi tidak ditemukan");
  const kode = String(data?.kode_prosedur_pacs ?? "").trim().slice(0, 50);
  const modalitas = String(data?.modalitas_pacs ?? "").trim().slice(0, 20);
  if (!kode) {
    await query(`DELETE FROM rad_pacs_peta_tindakan WHERE faskes_uuid = $1 AND pemeriksaan_uuid = $2 AND koneksi_uuid IS NULL`, [faskesUuid, pemeriksaanUuid]);
    return (await daftarMappingTindakan(faskesUuid))?.find((x) => x.pemeriksaan_uuid === pemeriksaanUuid);
  }
  if (!modalitas) throw permintaanSalah("modalitas_pacs wajib diisi");
  await query(
    `INSERT INTO rad_pacs_peta_tindakan (uuid, faskes_uuid, pemeriksaan_uuid, koneksi_uuid, kode_prosedur_pacs, modalitas_pacs, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, NULL, $3, $4, $5)
     ON CONFLICT (faskes_uuid, pemeriksaan_uuid, COALESCE(koneksi_uuid, ''))
       DO UPDATE SET kode_prosedur_pacs = EXCLUDED.kode_prosedur_pacs, modalitas_pacs = EXCLUDED.modalitas_pacs, updated_at = EXCLUDED.updated_at`,
    [faskesUuid, pemeriksaanUuid, kode, modalitas, sekarang()],
  );
  return (await daftarMappingTindakan(faskesUuid)).find((x) => x.pemeriksaan_uuid === pemeriksaanUuid);
};

/** Mapping tindakan (null bila belum dipetakan) untuk satu pemeriksaan. */
export const mappingTindakan = (faskesUuid, pemeriksaanUuid) =>
  satu(
    `SELECT kode_prosedur_pacs, modalitas_pacs FROM rad_pacs_peta_tindakan
      WHERE faskes_uuid = $1 AND pemeriksaan_uuid = $2 AND koneksi_uuid IS NULL`,
    [faskesUuid, pemeriksaanUuid],
  );

// ── (b) Referensi: unit asal / dokter pengirim / penjamin ───────────────────

export const daftarMappingRef = async (faskesUuid) => {
  const peta = await query(`SELECT jenis, ref_uuid, kode_pacs, nama_pacs FROM rad_pacs_peta_ref WHERE faskes_uuid = $1`, [faskesUuid]);
  const cari = (jenis, uuid) => peta.find((p) => p.jenis === jenis && p.ref_uuid === uuid);
  const gabung = (jenis, rows) => rows.map((r) => ({ ...r, jenis, kode_pacs: cari(jenis, r.uuid)?.kode_pacs ?? null, nama_pacs: cari(jenis, r.uuid)?.nama_pacs ?? null }));
  const unit = await query(
    `SELECT uuid, code AS kode, name AS nama FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND (is_poli OR location_type IN ('Ward', 'Room')) ORDER BY is_poli DESC, name`,
    [faskesUuid],
  );
  const dokter = await query(
    `SELECT pr.uuid, pr.code_bpjs AS kode, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, pg.last_title)) AS nama
       FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
      WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.is_doctor ORDER BY pg.name`,
    [faskesUuid],
  );
  const penjamin = await query(`SELECT uuid, code AS kode, name AS nama FROM penjamin WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [faskesUuid]);
  return {
    unit: gabung("unit", unit),
    dokter: gabung("dokter", dokter),
    penjamin: gabung("penjamin", [{ uuid: "TUNAI", kode: "UMUM", nama: "Umum / Tunai (tanpa penjamin)" }, ...penjamin]),
  };
};

export const simpanMappingRef = async (faskesUuid, jenis, refUuid, data) => {
  if (!["unit", "dokter", "penjamin"].includes(jenis)) throw permintaanSalah("jenis harus unit, dokter, atau penjamin");
  const kode = String(data?.kode_pacs ?? "").trim().slice(0, 50);
  const nama = String(data?.nama_pacs ?? "").trim().slice(0, 200) || null;
  if (!kode) {
    await query(`DELETE FROM rad_pacs_peta_ref WHERE faskes_uuid = $1 AND jenis = $2 AND ref_uuid = $3`, [faskesUuid, jenis, refUuid]);
    return { jenis, ref_uuid: refUuid, kode_pacs: null, nama_pacs: null };
  }
  await query(
    `INSERT INTO rad_pacs_peta_ref (faskes_uuid, jenis, ref_uuid, kode_pacs, nama_pacs, updated_at) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (faskes_uuid, jenis, ref_uuid) DO UPDATE SET kode_pacs = EXCLUDED.kode_pacs, nama_pacs = EXCLUDED.nama_pacs, updated_at = EXCLUDED.updated_at`,
    [faskesUuid, jenis, refUuid, kode, nama, sekarang()],
  );
  return { jenis, ref_uuid: refUuid, kode_pacs: kode, nama_pacs: nama };
};

export const mappingRef = async (faskesUuid, jenis, refUuid) =>
  refUuid ? satu(`SELECT kode_pacs, nama_pacs FROM rad_pacs_peta_ref WHERE faskes_uuid = $1 AND jenis = $2 AND ref_uuid = $3`, [faskesUuid, jenis, refUuid]) : null;

// ── (c) Ruang/alat → AE Title (data referensi worklist, bukan endpoint DICOM MWL) ──

export const daftarMappingRuang = async (faskesUuid, { cari = "", belumDipetakan = false } = {}) => {
  const p = [faskesUuid];
  let w = "faskes_uuid = $1 AND deleted_at IS NULL";
  if (cari) {
    p.push(`%${cari}%`);
    w += ` AND (kode ILIKE $${p.length} OR nama ILIKE $${p.length})`;
  }
  if (belumDipetakan) w += " AND ae_title IS NULL";
  return query(`SELECT uuid, kode, nama, modalitas, nama_alat, ae_title, status FROM rad_ruang WHERE ${w} ORDER BY kode`, p);
};

export const simpanMappingRuang = async (faskesUuid, ruangUuid, aeTitle) => {
  const ruang = await satu(`SELECT uuid FROM rad_ruang WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [ruangUuid, faskesUuid]);
  if (!ruang) throw permintaanSalah("Ruang radiologi tidak ditemukan");
  const nilai = String(aeTitle ?? "").trim().slice(0, 100) || null;
  await query(`UPDATE rad_ruang SET ae_title = $1, updated_at = $2 WHERE uuid = $3 AND faskes_uuid = $4`, [nilai, sekarang(), ruangUuid, faskesUuid]);
  return satu(`SELECT uuid, kode, nama, ae_title FROM rad_ruang WHERE uuid = $1`, [ruangUuid]);
};

export const aeTitleRuang = (uuid) => (uuid ? satu(`SELECT ae_title FROM rad_ruang WHERE uuid = $1`, [uuid]).then((r) => r?.ae_title ?? null) : Promise.resolve(null));

// Dokter dari uuid (untuk payload PACS bila belum dipetakan: pakai kode BPJS/SATUSEHAT/nama).
export const dokterRingkas = (uuid) =>
  uuid
    ? satu(
        `SELECT pr.uuid, pr.code_bpjs, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, pg.last_title)) AS nama
           FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid WHERE pr.uuid = $1`,
        [uuid],
      )
    : null;
