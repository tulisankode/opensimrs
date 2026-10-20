import { bulan, hari, pilihan, tanggalBulan, wajib } from "./bersama.js";

export const buatKeluaran = (r, a) => {
  const terbit = async (k, req, unit, mulai, selesai, pegawai = null, versi = null) => r.query(`SELECT p.uuid, p.kepegawaian_uuid, p.tanggal_kerja,
    p.mulai_epoch, p.selesai_epoch, p.libur, p.potret_shift, v.uuid AS versi_uuid, v.nomor_versi, j.unit_uuid, g.name AS nama
    FROM hr_penempatan_shift p
    JOIN hr_jadwal_versi v ON v.uuid = p.versi_uuid AND v.faskes_uuid = p.faskes_uuid AND v.deleted_at IS NULL AND v.status = 'terbit'
    JOIN hr_jadwal_dinas j ON j.uuid = v.jadwal_uuid AND j.faskes_uuid = v.faskes_uuid AND j.deleted_at IS NULL AND j.versi_aktif_uuid = v.uuid
    JOIN hr_kepegawaian h ON h.uuid = p.kepegawaian_uuid AND h.faskes_uuid = p.faskes_uuid AND h.deleted_at IS NULL
    JOIN pegawai g ON g.uuid = h.pegawai_uuid AND g.faskes_uuid = h.faskes_uuid AND g.deleted_at IS NULL
    WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND ($2::varchar IS NULL OR j.unit_uuid = $2)
    AND p.tanggal_kerja >= $3 AND p.tanggal_kerja < $4 AND ($5::varchar IS NULL OR p.kepegawaian_uuid = $5)
    AND ($6::varchar IS NULL OR v.uuid = $6) ORDER BY p.tanggal_kerja, g.name`, [a.faskes(req), unit, mulai, selesai, pegawai, versi], k);
  const baca = async (req, sendiri = false) => {
    await a.hak(req, sendiri ? "Jadwal Saya" : "Jadwal Dinas", "READ");
    const q = req.query, mulai = hari(q.mulai), selesai = hari(q.selesai);
    wajib(selesai > mulai && selesai - mulai <= 366 * 86400, "Rentang pembacaan harus 1–366 hari");
    let pegawai = null;
    if (sendiri) pegawai = await a.sendiri(null, req);
    else { wajib(q.unit_uuid, "Unit wajib diisi"); await a.unit(null, req, q.unit_uuid); }
    return terbit(null, req, sendiri ? null : q.unit_uuid, mulai, selesai, pegawai);
  };
  const keluaran = async (req) => {
    const b = req.body, jenis = pilihan(b.jenis, ["ekspor", "cetak"], "Jenis keluaran");
    await a.hak(req, "Jadwal Dinas", jenis === "ekspor" ? "EKSPOR" : "CETAK");
    const f = a.faskes(req), periode = bulan(b.periode_mulai);
    return r.transaksi(f, async (k) => {
      await a.unit(k, req, b.unit_uuid);
      const v = await r.versi(k, f, b.versi_uuid, true);
      wajib(v.unit_uuid === b.unit_uuid && v.periode_mulai === periode && v.status === "terbit" && v.versi_aktif_uuid === v.uuid, "Keluaran hanya untuk versi terbit efektif unit dan periode terkait", 409);
      const data = await terbit(k, req, b.unit_uuid, periode, tanggalBulan(periode).at(-1) + 86400, null, v.uuid);
      await r.catatPeristiwa(k, req, jenis, { jadwal_uuid: v.jadwal_uuid, versi_uuid: v.uuid, jumlah: data.length });
      return { judul: "Jadwal Dinas", zona_waktu: "Asia/Jakarta", dibuat_pada: r.sekarang(), versi: v, penempatan: data };
    });
  };
  return { baca, keluaran };
};
