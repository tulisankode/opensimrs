import { PartOfLocationModel } from "@opensimrs/model-sdk/datamaster";

export default class PartOfLokasiRepository {
  static async getByUuid(uuid) {
    return await PartOfLocationModel.findOne({
      where: {
        uuid: uuid,
        deleted_at: null
      },
      attributes: ["uuid"]
    })
  }
}