import { QueryTypes } from "sequelize";
import sequelizeInstance from "../configurations/sequelize-instance.js";
import { hitungHashBaris } from "@opensimrs/model-sdk/audit-core";

const KOLOM = `uuid, faskes_uuid, waktu_epoch, pengguna_uuid, identitas_akun, peran, layanan, aksi, entitas,
  entitas_uuid, patient_uuid, ringkasan_perubahan, alamat_ip, user_agent, request_id, hash_sebelumnya, hash_baris`;

// Semua kueri DI SINI wajib membawa faskes_uuid dari token (diteruskan oleh service) — tidak pernah dari parameter
// permintaan pengguna (STD-0029 KF-3, KT-3).
export default class AuditTrailRepository {
  // batasMaks: 200 baris per halaman untuk tampilan; ekspor memakai batas ekspor sendiri (BATAS_EKSPOR).
  static async cari(faskesUuid, filter = {}, page = 1, pageSize = 20, batasMaks = 200) {
    const kondisi = ["faskes_uuid = :faskesUuid"];
    const replacements = { faskesUuid };

    if (filter.patientUuid) {
      kondisi.push("patient_uuid = :patientUuid");
      replacements.patientUuid = filter.patientUuid;
    }
    if (filter.penggunaUuid) {
      kondisi.push("pengguna_uuid = :penggunaUuid");
      replacements.penggunaUuid = filter.penggunaUuid;
    }
    if (filter.aksi) {
      kondisi.push("aksi = :aksi");
      replacements.aksi = filter.aksi;
    }
    if (filter.entitas) {
      kondisi.push("entitas = :entitas");
      replacements.entitas = filter.entitas;
    }
    if (filter.layanan) {
      kondisi.push("layanan = :layanan");
      replacements.layanan = filter.layanan;
    }
    if (filter.dari) {
      kondisi.push("waktu_epoch >= :dari");
      replacements.dari = filter.dari;
    }
    if (filter.sampai) {
      kondisi.push("waktu_epoch <= :sampai");
      replacements.sampai = filter.sampai;
    }

    const where = kondisi.join(" AND ");
    const limit = Math.min(Math.max(Number(pageSize) || 20, 1), batasMaks);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const [items, [{ total }]] = await Promise.all([
      sequelizeInstance.query(
        `SELECT ${KOLOM} FROM audit_trail WHERE ${where} ORDER BY id DESC LIMIT :limit OFFSET :offset`,
        { replacements: { ...replacements, limit, offset }, type: QueryTypes.SELECT }
      ),
      sequelizeInstance.query(`SELECT COUNT(*)::int AS total FROM audit_trail WHERE ${where}`, {
        replacements,
        type: QueryTypes.SELECT,
      }),
    ]);

    return { items, total, page: Number(page) || 1, page_size: limit };
  }

  static async detail(faskesUuid, uuid) {
    const rows = await sequelizeInstance.query(`SELECT ${KOLOM} FROM audit_trail WHERE faskes_uuid = :faskesUuid AND uuid = :uuid`, {
      replacements: { faskesUuid, uuid },
      type: QueryTypes.SELECT,
    });
    return rows[0] ?? null;
  }

  static async riwayatPasien(faskesUuid, patientUuid, page = 1, pageSize = 20) {
    return this.cari(faskesUuid, { patientUuid }, page, pageSize);
  }

  // Mengambil seluruh baris rentang (ASC) untuk verifikasi rantai hash. Dibatasi `batasBaris` agar permintaan
  // verifikasi tidak membebani layanan (rantai per faskes bisa dipecah ulang per rentang waktu bila lebih besar).
  // Mengambil batasBaris + 1 baris agar pemanggil bisa mendeteksi apakah rentang terpotong tanpa kueri COUNT kedua.
  static async ambilRentangUntukVerifikasi(faskesUuid, dari, sampai, batasBaris = 5000) {
    const kondisi = ["faskes_uuid = :faskesUuid"];
    const replacements = { faskesUuid, batasPengambilan: batasBaris + 1 };
    if (dari) {
      kondisi.push("waktu_epoch >= :dari");
      replacements.dari = dari;
    }
    if (sampai) {
      kondisi.push("waktu_epoch <= :sampai");
      replacements.sampai = sampai;
    }
    const baris = await sequelizeInstance.query(
      `SELECT ${KOLOM} FROM audit_trail WHERE ${kondisi.join(" AND ")} ORDER BY id ASC LIMIT :batasPengambilan`,
      { replacements, type: QueryTypes.SELECT }
    );
    const terpotong = baris.length > batasBaris;
    return { baris: terpotong ? baris.slice(0, batasBaris) : baris, terpotong };
  }
}

// Menghitung ulang hash satu baris persis seperti saat penulisan (lihat packages/model-sdk/umum/audit-core.js),
// untuk dibandingkan dengan hash_baris yang tersimpan.
export function hitungUlangHash(baris) {
  return hitungHashBaris(baris);
}
