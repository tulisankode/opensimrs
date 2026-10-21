import {
  HargaItemModel,
  KonfigurasiHargaModel,
} from "@opensimrs/model-sdk/farmasi";

export default class KonfigurasiHargaRepository {
  static async get(faskes_uuid) {
    return await KonfigurasiHargaModel.findOne({
      where: {
        faskes_uuid: faskes_uuid,
        deleted_at: null,
      },
    });
  }

  static async getHargaItem(faskes_uuid) {
    return await HargaItemModel.findAll({
      where: {
        faskes_uuid: faskes_uuid,
        deleted_at: null,
      },
      attributes: {
        exclude: [
          "deleted_at",
          "created_at",
          "updated_at",
          "faskes_uuid",
          "id",
        ],
      },
    });
  }

  static async getHargaItemByUuid(uuid, faskes_uuid) {
    return await HargaItemModel.findOne({
      where: {
        uuid: uuid,
        faskes_uuid: faskes_uuid,
        deleted_at: null,
      },
      attributes: {
        exclude: ["deleted_at", "created_at", "updated_at", "faskes_uuid"],
      },
    });
  }

  static async create(req) {
    return await KonfigurasiHargaModel.create(req);
  }

  static async update(req) {
    const affectedRow = await KonfigurasiHargaModel.update(req, {
      where: {
        faskes_uuid: req.faskes_uuid,
      },
    });

    return affectedRow[0];
  }
}
