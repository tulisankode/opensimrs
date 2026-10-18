import { satu } from "../db.js";
import { permintaanSalah } from "../umum/respons.js";

export const STATUS_KEPEGAWAIAN = ["tetap", "kontrak", "honorer", "magang", "purna_tugas"];
export const JENIS_KREDENSIAL = ["str", "sip", "sertifikat_kompetensi", "lainnya"];
export const STATUS_VERIFIKASI = ["belum_diverifikasi", "terverifikasi", "ditolak"];
export const namaPegawai = (alias) => `TRIM(CONCAT_WS(' ', ${alias}.first_title, ${alias}.name, NULLIF(${alias}.last_title, '')))`;

export const cekPegawaiDatamaster = async (pegawaiUuid, faskesUuid, k) => {
  if (typeof pegawaiUuid !== "string" || !pegawaiUuid) throw permintaanSalah("pegawai_uuid wajib diisi");
  const row = await satu(
    `SELECT p.uuid, ${namaPegawai("p")} AS nama FROM pegawai p WHERE p.uuid = $1 AND p.faskes_uuid = $2 AND p.deleted_at IS NULL AND p.status = true`,
    [pegawaiUuid, faskesUuid], k,
  );
  if (!row) throw permintaanSalah("Pegawai tidak ditemukan atau tidak aktif di faskes ini");
  return row;
};

export const tanganiUnik = (error, pesan = "Data sudah terdaftar") => {
  if (error.code === "23505") throw Object.assign(new Error(pesan), { status: 409 });
  if (error.code === "23503") throw Object.assign(new Error("Rujukan tidak ditemukan di faskes ini"), { status: 400 });
  throw error;
};
