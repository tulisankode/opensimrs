import { v7 as uuidv7 } from "uuid";
import { ItemMedisJenisStokModel } from "@opensimrs/model-sdk/farmasi";
import { jenisStokBpjsUuid, jenisStokUmumUuid } from "./jenis-stok-seeder.js";
import {
  itemParacetamolUuid,
  itemAmoxicillinUuid,
  itemJarumSuntikUuid,
} from "./item-medis-seeder.js";

export const paracetamolBpjsUuid = uuidv7();
export const paracetamolUmumUuid = uuidv7();
export const amoxicillinBpjsUuid = uuidv7();
export const jarumSuntikUmumUuid = uuidv7();

export default class ItemMedisJenisStokSeeder {
  static async seed(transaction) {
    await ItemMedisJenisStokModel.destroy({
      where: {},
      truncate: true,
      cascade: true,
      transaction,
    });
    const faskesUuid = "01981726-d5cf-7bc4-97ca-9804168283f7";

    const itemsToSeed = [
      {
        uuid: paracetamolBpjsUuid, 
        faskes_uuid: faskesUuid,
        item_medis_uuid: itemParacetamolUuid,
        jenis_stok_uuid: jenisStokBpjsUuid,
      },
      {
        uuid: paracetamolUmumUuid, 
        faskes_uuid: faskesUuid,
        item_medis_uuid: itemParacetamolUuid,
        jenis_stok_uuid: jenisStokUmumUuid,
      },
      {
        uuid: amoxicillinBpjsUuid, 
        faskes_uuid: faskesUuid,
        item_medis_uuid: itemAmoxicillinUuid,
        jenis_stok_uuid: jenisStokBpjsUuid,
      },
      {
        uuid: jarumSuntikUmumUuid, 
        faskes_uuid: faskesUuid,
        item_medis_uuid: itemJarumSuntikUuid,
        jenis_stok_uuid: jenisStokUmumUuid,
      },
    ];
    await ItemMedisJenisStokModel.bulkCreate(itemsToSeed, { transaction });
  }
}
