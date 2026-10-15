import { v7 as uuidv7 } from "uuid";
import { SatuanModel } from "@opensimrs/model-sdk/farmasi"; 

export const satuanDosisMgUuid = uuidv7();
export const satuanPenggunaanPcsUuid = uuidv7();
export const satuanBoxUuid = uuidv7();
export const satuanStripUuid = uuidv7();

export default class SatuanSeeder {
  static async seed(transaction) {
    await SatuanModel.destroy({
      where: {},
      truncate: true,
      cascade: true,
      transaction,
    });

    const faskesUuid = "01981726-d5cf-7bc4-97ca-9804168283f7";

    const satuanToSeed = [
      {
        uuid: satuanDosisMgUuid, 
        faskes_uuid: faskesUuid,
        code: "MG",
        name: "Miligram",
        status: true,
        satuan_dosis: true,
        editable: false,
      },
      {
        uuid: satuanPenggunaanPcsUuid, 
        faskes_uuid: faskesUuid,
        code: "PCS",
        name: "Pieces",
        status: true,
        satuan_dosis: false,
        editable: false,
      },
      {
        uuid: satuanBoxUuid, 
        faskes_uuid: faskesUuid,
        code: "BOX",
        name: "Box",
        status: true,
        satuan_dosis: false,
        editable: false,
      },
      {
        uuid: satuanStripUuid, 
        faskes_uuid: faskesUuid,
        code: "STRIP",
        name: "Strip",
        status: true,
        satuan_dosis: false,
        editable: false,
      },
      {
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        code: "BTL",
        name: "Botol",
        status: true,
        satuan_dosis: false,
        editable: false,
      },
    ];

    await SatuanModel.bulkCreate(satuanToSeed, { transaction });
  }
}
