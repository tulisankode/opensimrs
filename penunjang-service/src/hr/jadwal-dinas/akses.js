import { galat, wajib } from "./bersama.js";

export const superAdmin = (req) => String(req.author?.role).toLowerCase() === "super admin";
export const buatAkses = (r, izin) => {
  const faskes = (req) => {
    wajib(req.author?.faskesUuid && req.author?.username, "Autentikasi dan faskes aktif diperlukan", 401);
    const terlarang = (v) => v && typeof v === "object" && Object.entries(v).some(([k, x]) => ["faskes_uuid", "faskesUuid"].includes(k) || terlarang(x));
    wajib(!terlarang(req.body) && !terlarang(req.query), "Faskes tidak boleh ditentukan oleh klien");
    return req.author.faskesUuid;
  };
  const hak = async (req, sub, aksi) => {
    faskes(req);
    wajib(await izin(req, "HR / SDM", sub, aksi), `Akses ditolak untuk ${sub}: ${aksi}`, 403);
  };
  const unit = async (k, req, uuid, kewenangan = "lihat") => {
    const f = faskes(req);
    await r.ambil(k, f, "lokasi", uuid);
    if (superAdmin(req) && kewenangan === "lihat") return;
    const ada = await r.satu(`SELECT uuid FROM hr_kewenangan_jadwal WHERE faskes_uuid = $1 AND unit_uuid = $2 AND username = $3
      AND kewenangan = $4 AND berlaku_mulai <= $5 AND (berlaku_sampai IS NULL OR berlaku_sampai > $5) AND deleted_at IS NULL`, [f, uuid, req.author.username, kewenangan, r.sekarang()], k);
    wajib(ada, "Tidak memiliki kewenangan unit untuk tindakan ini", 403);
  };
  const sendiri = async (k, req) => {
    const p = await r.satu(`SELECT h.uuid FROM hr_akun_pegawai a JOIN hr_kepegawaian h ON h.uuid = a.kepegawaian_uuid
      AND h.faskes_uuid = a.faskes_uuid AND h.deleted_at IS NULL
      JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid AND p.deleted_at IS NULL
      WHERE a.faskes_uuid = $1 AND a.username = $2 AND a.deleted_at IS NULL`, [faskes(req), req.author.username], k);
    wajib(p, "Akun belum tertaut ke Kepegawaian SDM", 403);
    return p.uuid;
  };
  const layak = async (k, req, pegawai, unitUuid, tanggal, selesai) => {
    const f = faskes(req);
    const p = await r.satu(`SELECT h.uuid FROM hr_kepegawaian h JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid
      AND p.deleted_at IS NULL AND p.status = true
      JOIN hr_riwayat_jabatan j ON j.kepegawaian_uuid = h.uuid AND j.faskes_uuid = h.faskes_uuid AND j.deleted_at IS NULL
      WHERE h.faskes_uuid = $1 AND h.uuid = $2 AND h.deleted_at IS NULL AND j.unit_uuid = $3
      AND j.status_kepegawaian <> 'purna_tugas' AND j.tanggal_mulai <= $4 AND (j.tanggal_selesai IS NULL OR j.tanggal_selesai >= $5)
      AND (j.tanggal_selesai IS NULL OR j.tanggal_selesai > $4)
      AND h.tanggal_mulai <= $4 AND (h.tanggal_selesai IS NULL OR h.tanggal_selesai >= $5)`, [f, pegawai, unitUuid, tanggal, selesai ?? tanggal + 1], k);
    if (!p) throw galat(422, "Pegawai tidak layak untuk unit dan rentang shift", { kepegawaian_uuid: pegawai, tanggal_kerja: tanggal });
  };
  return { faskes, hak, unit, sendiri, layak };
};
