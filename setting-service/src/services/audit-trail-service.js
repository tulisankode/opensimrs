import AuditTrailRepository, { hitungUlangHash } from "../repositories/audit-trail-repository.js";
import sequelizeInstance from "../configurations/sequelize-instance.js";
import { catatPeristiwaAudit } from "@opensimrs/model-sdk/audit-sequelize";
import BadRequestException from "../errors/bad-request-exception.js";
import NotfoundException from "../errors/notfound-exception.js";

const BATAS_EKSPOR = 5000;

const bacaFilter = (query = {}) => ({
  patientUuid: query.patient_uuid || undefined,
  penggunaUuid: query.pengguna_uuid || undefined,
  aksi: query.aksi || undefined,
  entitas: query.entitas || undefined,
  layanan: query.layanan || undefined,
  dari: query.dari ? Number(query.dari) : undefined,
  sampai: query.sampai ? Number(query.sampai) : undefined,
});

export default class AuditTrailService {
  // Cakupan faskes SELALU dari token (author.faskesUuid); parameter permintaan tidak pernah dipakai untuk itu.
  static async cari(author, query) {
    const filter = bacaFilter(query);
    const hasil = await AuditTrailRepository.cari(author.faskesUuid, filter, query.page, query.page_size);
    return { message: "Audit trail berhasil diambil", payload: hasil };
  }

  static async detail(author, uuid) {
    const item = await AuditTrailRepository.detail(author.faskesUuid, uuid);
    if (!item) throw new NotfoundException("Catatan audit tidak ditemukan");
    return { message: "Detail audit berhasil diambil", payload: { item } };
  }

  static async riwayatPasien(author, patientUuid, query) {
    if (!patientUuid) throw new BadRequestException("patient_uuid wajib diisi");
    const hasil = await AuditTrailRepository.riwayatPasien(author.faskesUuid, patientUuid, query.page, query.page_size);
    return { message: "Riwayat audit pasien berhasil diambil", payload: hasil };
  }

  static async ekspor(author, body = {}) {
    const filter = bacaFilter(body.filter ?? {});
    const hasil = await AuditTrailRepository.cari(author.faskesUuid, filter, 1, BATAS_EKSPOR, BATAS_EKSPOR);
    const dipotong = hasil.total > hasil.items.length;

    await catatPeristiwaAudit(sequelizeInstance, {
      faskes_uuid: author.faskesUuid,
      layanan: "setting",
      aksi: "ekspor",
      entitas: "Audit Trail",
      pengguna_uuid: author.user_uuid,
      identitas_akun: author.username,
      peran: author.role,
      ringkasan_perubahan: { filter: JSON.stringify(filter), jumlah_baris: { lama: null, baru: hasil.items.length } },
    });

    return {
      message: dipotong
        ? `Ekspor dibatasi ${BATAS_EKSPOR} baris pertama dari ${hasil.total} baris yang cocok`
        : "Ekspor audit trail berhasil disiapkan",
      payload: { items: hasil.items, jumlah_baris: hasil.items.length, total_cocok: hasil.total, dipotong },
    };
  }

  // Memverifikasi keterkaitan hash pada rentang catatan. Tidak mengubah data (STD-0029 KF-7/KT-17/KT-18).
  static async verifikasi(author, body = {}) {
    const dari = body.dari ? Number(body.dari) : undefined;
    const sampai = body.sampai ? Number(body.sampai) : undefined;
    const { baris, terpotong } = await AuditTrailRepository.ambilRentangUntukVerifikasi(author.faskesUuid, dari, sampai);

    const tidakCocok = [];
    let hashSebelumnyaDiharapkan = baris[0]?.hash_sebelumnya ?? null;
    for (const b of baris) {
      const hashUlang = hitungUlangHash(b);
      const rantaiCocok = b.hash_sebelumnya === hashSebelumnyaDiharapkan;
      const hashCocok = hashUlang === b.hash_baris;
      if (!rantaiCocok || !hashCocok) tidakCocok.push(b.uuid);
      hashSebelumnyaDiharapkan = b.hash_baris;
    }

    return {
      message: tidakCocok.length ? "Verifikasi menemukan ketidakcocokan rantai hash" : "Rantai hash utuh",
      payload: {
        status: tidakCocok.length ? "tidak_cocok" : "utuh",
        diperiksa: baris.length,
        waktu_mulai: baris[0]?.waktu_epoch ?? null,
        waktu_selesai: baris[baris.length - 1]?.waktu_epoch ?? null,
        uuid_tidak_cocok: tidakCocok,
        // STD-0029: true bila rentang melebihi batas baris verifikasi — bagi rentang waktu lebih kecil untuk
        // memeriksa sisanya; hasil "utuh" di atas hanya berlaku untuk bagian yang diperiksa, bukan seluruh rentang.
        terpotong,
      },
    };
  }
}
