import { v7 as uuidv7 } from "uuid";
import { BentukSediaanModel } from "@opensimrs/model-sdk/farmasi"; // Pastikan path import benar

// 1. Definisikan dan EKSPOR UUID dinamis agar bisa diimpor seeder lain
export const bentukSediaanTabletUuid = uuidv7();
export const bentukSediaanCairUuid = uuidv7();
export const bentukSediaanAlkesUuid = uuidv7();

export default class BentukSediaanSeeder {
  /**
   * Mengisi data awal untuk tabel bentuk_sediaan.
   */
  static async seed(transaction) {
    await BentukSediaanModel.destroy({
      where: {},
      truncate: true,
      cascade: true, // Tambahkan cascade untuk keamanan
      transaction,
    });

    const faskesUuid = "01981726-d5cf-7bc4-97ca-9804168283f7";

    const sediaanToSeed = [
      {
        uuid: bentukSediaanTabletUuid, // Gunakan UUID dinamis yang diekspor
        faskes_uuid: faskesUuid,
        code: "TAB",
        name: "Tablet",
        status: true,
      },
      {
        uuid: bentukSediaanCairUuid, // Gunakan UUID dinamis yang diekspor
        faskes_uuid: faskesUuid,
        code: "CAIR",
        name: "Cair",
        status: true,
      },
      {
        uuid: uuidv7(), // UUID ini tidak perlu direferensikan, jadi bisa acak
        faskes_uuid: faskesUuid,
        code: "KAP",
        name: "Kapsul",
        status: true,
      },
      {
        uuid: uuidv7(), // UUID ini tidak perlu direferensikan, jadi bisa acak
        faskes_uuid: faskesUuid,
        code: "SALEP",
        name: "Salep",
        status: true,
      },
      {
        uuid: bentukSediaanAlkesUuid, // Gunakan UUID dinamis yang diekspor
        faskes_uuid: faskesUuid,
        code: "ALK",
        name: "Alat Kesehatan",
        status: true,
      },
    ];

    await BentukSediaanModel.bulkCreate(sediaanToSeed, { transaction });
  }
}
