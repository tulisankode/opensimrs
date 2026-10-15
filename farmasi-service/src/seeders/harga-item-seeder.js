import { v7 as uuidv7 } from "uuid";
import { HargaItemModel } from "@opensimrs/model-sdk/farmasi";

import {
  paracetamolUmumUuid,
  amoxicillinBpjsUuid,
  jarumSuntikUmumUuid,
} from "./item-medis-jenis-stok-seeder.js";

export default class HargaItemSeeder {
  static async seed(transaction) {
    await HargaItemModel.destroy({
      where: {},
      truncate: true,
      cascade: true,
      transaction,
    });

    const faskesUuid = "01981726-d5cf-7bc4-97ca-9804168283f7";

    const hargaItemsToSeed = [
      {
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        item_medis_jenis_stok_uuid: paracetamolUmumUuid, 
        harga_terakhir: 52000,
        harga_avg: 51500,
        hna: 55000,
        harga_dasar: 50000,
      },
      {
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        item_medis_jenis_stok_uuid: amoxicillinBpjsUuid, 
        harga_terakhir: 75000,
        harga_avg: 74000,
        hna: 80000,
        harga_dasar: 72000,
      },
      {
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        item_medis_jenis_stok_uuid: jarumSuntikUmumUuid, 
        harga_terakhir: 1500,
        harga_avg: 1450,
        hna: 1700,
        harga_dasar: 1400,
      },
    ];

    await HargaItemModel.bulkCreate(hargaItemsToSeed, { transaction });
  }
}
