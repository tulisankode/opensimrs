// stok-medis-seeder.js
import { v7 as uuidv7 } from "uuid";
import { StockMedisModel } from "@opensimrs/model-sdk/inventory";

// 1. IMPOR UUID kombinasi dari item-medis-jenis-stok-seeder
import {
  paracetamolUmumUuid,
  amoxicillinBpjsUuid,
  jarumSuntikUmumUuid,
  paracetamolBpjsUuid, // Impor juga ini jika perlu membuat stoknya
} from "./item-medis-jenis-stok-seeder.js";

// Impor UUID lain yang dibutuhkan
import {
  lokasiGudangFarmasiUuid,
  lokasiApotekInternalUuid,
} from "./lokasi-stok-seeder.js";
import {
  konversiParacetamolBoxUuid,
  konversiAmoxicillinStripUuid,
  konversiJarumSuntikPcsUuid,
} from "./conversion-seeder.js"; 

export default class StokMedisSeeder {
  static async seed(transaction) {
    await StockMedisModel.destroy({
      where: {},
      truncate: true,
      cascade: true,
      transaction,
    });
    const faskesUuid = "01981726-d5cf-7bc4-97ca-9804168283f7";

    const itemsToSeed = [
      {
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        exp_date: new Date("2026-12-31"),
        stok: 1000,
        sisa_stok: 1000,
        harga_satuan: 50000,
        konversi_uuid: konversiParacetamolBoxUuid,
        lokasi_stok_uuid: lokasiGudangFarmasiUuid,
        item_medis_jenis_stok_uuid: paracetamolUmumUuid, 
      },
      {
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        exp_date: new Date("2027-05-20"),
        stok: 500,
        sisa_stok: 500,
        harga_satuan: 75000,
        konversi_uuid: konversiAmoxicillinStripUuid,
        lokasi_stok_uuid: lokasiGudangFarmasiUuid,
        item_medis_jenis_stok_uuid: amoxicillinBpjsUuid,
      },
      {
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        exp_date: new Date("2026-12-31"),
        stok: 50,
        sisa_stok: 50,
        harga_satuan: 52000,
        konversi_uuid: konversiParacetamolBoxUuid,
        lokasi_stok_uuid: lokasiApotekInternalUuid,
        item_medis_jenis_stok_uuid: paracetamolUmumUuid, 
      },
      {
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        exp_date: null,
        stok: 2000,
        sisa_stok: 2000,
        harga_satuan: 1500,
        konversi_uuid: konversiJarumSuntikPcsUuid,
        lokasi_stok_uuid: lokasiGudangFarmasiUuid,
        item_medis_jenis_stok_uuid: jarumSuntikUmumUuid, 
      },
    ];
    await StockMedisModel.bulkCreate(itemsToSeed, { transaction });
  }
}
