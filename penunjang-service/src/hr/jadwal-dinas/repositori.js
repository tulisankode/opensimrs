import { galat, periksaVersi } from "./bersama.js";

// Dependensi disuntikkan agar pengujian tidak memuat konfigurasi atau membuka database.
export const buatRepositori = (db, audit) => {
  const { query, satu, sisipkan, ubah, sekarang } = db;
  const ambil = async (k, f, tabel, uuid, kunci = false) => {
    const r = await satu(`SELECT * FROM ${tabel} WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`, [uuid, f], k);
    if (!r) throw galat(404, "Data tidak ditemukan dalam faskes aktif");
    return r;
  };
  const transaksi = async (f, fn) => {
    try {
      return await db.transaksi(async (k) => {
        await k.query("SET LOCAL lock_timeout = '5s'");
        await k.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`sdm-jadwal:${f}`]);
        return fn(k);
      });
    } catch (e) {
      if (["55P03", "40P01", "23505", "40001"].includes(e.code)) throw galat(409, "Data sedang berubah; muat ulang dan tinjau kembali");
      throw e;
    }
  };
  const versi = async (k, f, uuid, kunci = false) => {
    const v = await ambil(k, f, "hr_jadwal_versi", uuid, kunci);
    const j = await ambil(k, f, "hr_jadwal_dinas", v.jadwal_uuid, kunci);
    return { ...v, unit_uuid: j.unit_uuid, periode_mulai: Number(j.periode_mulai), versi_aktif_uuid: j.versi_aktif_uuid };
  };
  const penempatan = (k, f, uuid) => query(`SELECT * FROM hr_penempatan_shift WHERE faskes_uuid = $1 AND versi_uuid = $2 AND deleted_at IS NULL ORDER BY tanggal_kerja, kepegawaian_uuid`, [f, uuid], k);
  const aturan = async (k, f, unit) => {
    const a = await satu(`SELECT * FROM hr_aturan_jadwal WHERE faskes_uuid = $1 AND unit_uuid = $2 AND deleted_at IS NULL`, [f, unit], k);
    const kebutuhan = a ? await query(`SELECT * FROM hr_kebutuhan_shift WHERE faskes_uuid = $1 AND aturan_uuid = $2 AND deleted_at IS NULL`, [f, a.uuid], k) : [];
    return { aturan: a, kebutuhan };
  };
  const lainnya = (k, f, keluarga, mulai, selesai) => query(`SELECT p.*, v.jadwal_uuid, v.status FROM hr_penempatan_shift p
    JOIN hr_jadwal_versi v ON v.uuid = p.versi_uuid AND v.faskes_uuid = p.faskes_uuid AND v.deleted_at IS NULL
    JOIN hr_jadwal_dinas j ON j.uuid = v.jadwal_uuid AND j.faskes_uuid = v.faskes_uuid AND j.deleted_at IS NULL
    WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND NOT (j.uuid = ANY($2::varchar[]))
      AND (v.uuid = j.versi_aktif_uuid OR v.status IN ('draf','diajukan','disetujui'))
      AND p.mulai_epoch < $4 AND p.selesai_epoch > $3`, [f, [].concat(keluarga), mulai, selesai], k);
  const catatPeristiwa = async (k, req, jenis, data = {}) => {
    const { jadwal_uuid, versi_uuid, tukar_uuid, status_sebelum, status_sesudah, alasan, ...ringkasan } = data;
    const r = await sisipkan("hr_peristiwa_jadwal", { faskes_uuid: req.author.faskesUuid, jenis, pelaku: req.author.username,
      jadwal_uuid, versi_uuid, tukar_uuid, status_sebelum, status_sesudah, alasan, ringkasan }, k);
    await audit(k, { faskesUuid: req.author.faskesUuid, aksi: ["ekspor", "cetak"].includes(jenis) ? "baca" : "ubah", entitas: "hr_jadwal_dinas", entitasUuid: versi_uuid ?? tukar_uuid ?? r.uuid, ringkasan: { jenis, ...data }, pengguna: req.author.username });
    return r;
  };
  const naikkan = (k, f, v, data = {}) => ubah("hr_jadwal_versi", v.uuid, f, { ...data, versi_kunci: Number(v.versi_kunci) + 1 }, k);
  const versiBaru = async (k, req, j, asal = null, alasan = null, status = "draf") => {
    const f = req.author.faskesUuid;
    const kerja = await satu(`SELECT uuid FROM hr_jadwal_versi WHERE faskes_uuid = $1 AND jadwal_uuid = $2 AND deleted_at IS NULL AND status IN ('draf','diajukan','disetujui')`, [f, j.uuid], k);
    if (kerja) throw galat(409, "Masih ada versi kerja pada jadwal ini");
    const nomor = await satu(`SELECT COALESCE(MAX(nomor_versi),0)+1 AS nomor FROM hr_jadwal_versi WHERE faskes_uuid = $1 AND jadwal_uuid = $2`, [f, j.uuid], k);
    const v = await sisipkan("hr_jadwal_versi", { faskes_uuid: f, jadwal_uuid: j.uuid, nomor_versi: Number(nomor.nomor), versi_asal_uuid: asal?.uuid ?? null,
      status, versi_kunci: 1, alasan_revisi: alasan, dibuat_oleh: req.author.username, potret_aturan: asal?.potret_aturan ?? null,
      diterbitkan_pada: status === "terbit" ? sekarang() : null }, k);
    if (asal) for (const p of await penempatan(k, f, asal.uuid)) {
      const { uuid, created_at, updated_at, deleted_at, ...data } = p;
      await sisipkan("hr_penempatan_shift", { ...data, versi_uuid: v.uuid }, k);
    }
    return { ...v, unit_uuid: j.unit_uuid, periode_mulai: Number(j.periode_mulai) };
  };
  return { ...db, ambil, transaksi, versi, penempatan, aturan, lainnya, catatPeristiwa, naikkan, versiBaru, periksaVersi };
};
