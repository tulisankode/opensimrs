import { v7 as uuidv7 } from "uuid";
import { JenisStokModel } from "@opensimrs/model-sdk/farmasi";

// 1. Definisikan & Ekspor UUID di luar kelas agar bisa diakses file lain
export const jenisStokBpjsUuid = uuidv7();
export const jenisStokUmumUuid = uuidv7();

export default class JenisStokSeeder {
  static async seed(transaction) {
    await JenisStokModel.destroy({
      where: {},
      truncate: true,
      cascade: true,
      transaction,
    });

    const faskesUuid = "01981726-d5cf-7bc4-97ca-9804168283f7";

    const jenisStokToSeed = [
      {
        uuid: jenisStokBpjsUuid, // 2. Gunakan UUID yang sudah diekspor
        faskes_uuid: faskesUuid,
        code: "BPJS",
        name: "BPJS",
        status: true,
      },
      {
        uuid: jenisStokUmumUuid, // 3. Gunakan UUID yang sudah diekspor
        faskes_uuid: faskesUuid,
        code: "UMUM",
        name: "Umum",
        status: true,
      },
      {
        uuid: uuidv7(), // Data ini tidak perlu direferensikan, jadi bisa acak
        faskes_uuid: faskesUuid,
        code: "ASR",
        name: "Asuransi Lain",
        status: true,
      },
    ];

    await JenisStokModel.bulkCreate(jenisStokToSeed, { transaction });
  }
}
