import { v7 as uuidv7 } from "uuid";
import { KategoriObatModel } from "@opensimrs/model-sdk/farmasi"; // Pastikan path import benar

// 1. Definisikan dan EKSPOR UUID dinamis
export const kategoriObatAnalgesikUuid = uuidv7();
export const kategoriObatAntibiotikUuid = uuidv7();
export const kategoriObatAlkesUuid = uuidv7();

export default class KategoriObatSeeder {
  /**
   * Mengisi data awal untuk tabel kategori_obat.
   */
  static async seed(transaction) {
    await KategoriObatModel.destroy({
      where: {},
      truncate: true,
      cascade: true, // Tambahkan cascade untuk keamanan
      transaction,
    });

    const faskesUuid = "01981726-d5cf-7bc4-97ca-9804168283f7";

    const kategoriToSeed = [
      {
        uuid: kategoriObatAnalgesikUuid, // Gunakan UUID dinamis yang diekspor
        faskes_uuid: faskesUuid,
        code: "ANL",
        name: "Analgesik",
        status: true,
      },
      {
        uuid: kategoriObatAntibiotikUuid, // Gunakan UUID dinamis yang diekspor
        faskes_uuid: faskesUuid,
        code: "ANT",
        name: "Antibiotik",
        status: true,
      },
      {
        uuid: uuidv7(), // Tidak perlu direferensikan, jadi bisa acak
        faskes_uuid: faskesUuid,
        code: "VIT",
        name: "Vitamin dan Suplemen",
        status: true,
      },
      {
        uuid: uuidv7(), // Tidak perlu direferensikan, jadi bisa acak
        faskes_uuid: faskesUuid,
        code: "A-HIST",
        name: "Antihistamin",
        status: true,
      },
      {
        uuid: kategoriObatAlkesUuid, // Gunakan UUID dinamis yang diekspor
        faskes_uuid: faskesUuid,
        code: "ALK",
        name: "Alat Kesehatan",
        status: true,
      },
    ];

    await KategoriObatModel.bulkCreate(kategoriToSeed, { transaction });
  }
}
