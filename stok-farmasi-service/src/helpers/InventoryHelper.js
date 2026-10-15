import NotfoundException from "../errors/notfound-exception.js"; // Sesuaikan path error Anda
import ResponseError from "../errors/ResponseError.js"; // Sesuaikan path error Anda
import { ItemMedisModel, ConversionModel } from "@opensimrs/model-sdk/farmasi";

export default class InventoryHelper {
  static async normalizeQuantity(itemMedisUuid, requestQty, requestSatuanUuid) {
    const itemMedis = await ItemMedisModel.findOne({
      where: { uuid: itemMedisUuid },
      attributes: ["uuid", "satuan_penggunaan_uuid", "name"],
    });
    console.log("itemMedis", itemMedis);
    if (!itemMedis) {
      throw new ResponseError("Item medis tidak ditemukan", 404);
    }

    if (requestSatuanUuid === itemMedis.satuan_penggunaan_uuid) {
      return requestQty;
    }

    const conversion = await ConversionModel.findOne({
      where: {
        item_medis_uuid: itemMedisUuid,
        satuan_pembelian_uuid: requestSatuanUuid,
        satuan_penggunaan_uuid: itemMedis.satuan_penggunaan_uuid,
        status: true,
      },
    });
    console.log("conversion", conversion);

    if (!conversion) {
      throw new ResponseError(
        `Konversi satuan untuk item '${itemMedis.name}' tidak ditemukan. Pastikan data konversi (dari satuan yang diminta ke satuan dasar) tersedia.`,
        400
      );
    }

    return requestQty * conversion.konversi;
  }
}
