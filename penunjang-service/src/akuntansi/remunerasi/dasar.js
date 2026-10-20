import { query, satu } from "../../db.js";
import { tidakDitemukan } from "../../umum/respons.js";
import { catatAuditPusat } from "../../hr/audit.js";
import { wajibSalahSatu } from "../../umum/izin.js";
import { MODUL_IZIN } from "./bersama.js";

// Helper basis data Remunerasi. Semua kueri disaring faskes_uuid dari token; data faskes lain = "tidak ditemukan".

// Audit Trail pusat (STD-0029) di dalam transaksi `k` yang sama dengan perubahan data.
export const audit = (k, req, aksi, entitas, entitasUuid, ringkasan) =>
  catatAuditPusat(k, {
    faskesUuid: req.author.faskesUuid,
    aksi,
    entitas,
    entitasUuid,
    ringkasan,
    pengguna: req.author.username,
    layanan: "penunjang-service/akuntansi/remunerasi",
  });

// Lolos bila punya salah satu [submodul, aksi] pada modul Akuntansi & Remunerasi.
export const izinSalahSatu = (...pasangan) => wajibSalahSatu(...pasangan.map(([sub, aksi]) => [MODUL_IZIN, sub, aksi]));

// Nama tampilan praktisi: gelar depan + nama + gelar belakang (pegawai).
export const NAMA_PRAKTISI = `TRIM(CONCAT(NULLIF(TRIM(pg.first_title), '') || ' ', pg.name, ', ' || NULLIF(TRIM(pg.last_title), '')))`;

export const daftarPraktisi = (f, k) =>
  query(
    `SELECT pr.uuid, ${NAMA_PRAKTISI} AS nama, pr.is_doctor, pr.status
       FROM practitioner pr LEFT JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid AND pg.faskes_uuid = pr.faskes_uuid AND pg.deleted_at IS NULL
      WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL
      ORDER BY pg.name NULLS LAST, pr.uuid`,
    [f],
    k,
  );

export const praktisi = (k, f, uuid) =>
  satu(
    `SELECT pr.uuid, ${NAMA_PRAKTISI} AS nama, pr.is_doctor
       FROM practitioner pr LEFT JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid AND pg.faskes_uuid = pr.faskes_uuid AND pg.deleted_at IS NULL
      WHERE pr.uuid = $1 AND pr.faskes_uuid = $2 AND pr.deleted_at IS NULL`,
    [String(uuid ?? ""), f],
    k,
  );

// Penerima remunerasi faskes (aktif & nonaktif) beserta nama praktisi.
export const muatPenerima = (k, f) =>
  query(
    `SELECT p.*, ${NAMA_PRAKTISI} AS nama
       FROM remunerasi_penerima p
       LEFT JOIN practitioner pr ON pr.uuid = p.practitioner_uuid AND pr.faskes_uuid = p.faskes_uuid
       LEFT JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid AND pg.faskes_uuid = p.faskes_uuid AND pg.deleted_at IS NULL
      WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL
      ORDER BY pg.name NULLS LAST, p.uuid`,
    [f],
    k,
  );

export const ambilPeriode = async (k, f, uuid, kunci = false) => {
  const p = await satu(`SELECT * FROM remunerasi_periode WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`, [String(uuid ?? ""), f], k);
  if (!p) throw tidakDitemukan("Periode remunerasi");
  return p;
};

// INSERT banyak baris dalam kelompok 500 (kolom sama untuk semua baris).
export const sisipkanBanyak = async (k, tabel, kolom, baris) => {
  for (let i = 0; i < baris.length; i += 500) {
    const potong = baris.slice(i, i + 500);
    const nilai = [];
    const tempat = potong.map((b) => `(${kolom.map((c) => `$${nilai.push(b[c] !== null && typeof b[c] === "object" ? JSON.stringify(b[c]) : (b[c] ?? null))}`).join(", ")})`);
    await query(`INSERT INTO ${tabel} (${kolom.join(", ")}) VALUES ${tempat.join(", ")}`, nilai, k);
  }
};
