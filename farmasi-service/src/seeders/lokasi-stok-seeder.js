// lokasi-stok-seeder.js
import { v7 as uuidv7 } from "uuid";
import { LokasiStokModel } from "@opensimrs/model-sdk/farmasi";

// 1. Definisikan dan EKSPOR UUID dinamis
export const lokasiGudangFarmasiUuid = uuidv7();
export const lokasiApotekInternalUuid = uuidv7();

export default class LokasiStokSeeder {
  static async seed(transaction) {
    await LokasiStokModel.destroy({
      where: {},
      truncate: true,
      cascade: true, // Tambahkan cascade untuk keamanan
      transaction,
    });
    const faskesUuid = "01981726-d5cf-7bc4-97ca-9804168283f7";

    const lokasiStokToSeed = [
      {
        uuid: lokasiGudangFarmasiUuid, // 2. Gunakan UUID yang diekspor
        faskes_uuid: faskesUuid,
        code: "GDU",
        name: "Gudang Farmasi Utama",
        status: true,
        jenis_lokasi: "gudang",
      },
      {
        uuid: lokasiApotekInternalUuid, // Gunakan UUID yang diekspor
        faskes_uuid: faskesUuid,
        code: "DEPO-RJ",
        name: "Depo Farmasi Rawat Jalan",
        status: true,
        jenis_lokasi: "depo",
      },
      // ... lokasi lain bisa menggunakan uuidv7() jika tidak perlu direferensikan
    ];
    await LokasiStokModel.bulkCreate(lokasiStokToSeed, { transaction });
  }
}
