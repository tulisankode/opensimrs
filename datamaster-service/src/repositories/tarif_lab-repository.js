import { TarifLabModel } from "@opensimrs/model-sdk/datamaster";
import TarifLab from "../models/tarif_lab-model.js";
import { Op } from "sequelize";
import { BaseRePosiotry } from "./base-repository.js";

export default class TarifLabRepository extends BaseRePosiotry {

  static async searchTarifLab(request){
    const { count ,rows } = await TarifLabModel.findAndCountAll({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null
            }
          },
          {
            faskes_uuid: request.faskes_uuid
          },
          {
            name: {
              [Op.iLike]: `%${request.name}%`
            }
          }
        ]
      },
      limit: request.limit,
      offset: request.page
    });
    const tarifList = rows.map(t => t.toJSON());
    return {
      data: tarifList,
      properties: {
        current_page: request.page,
        total_item: count,
        total_page: (request.limit / count),
        limit: request.limit
      }
    }
  }

  static async addTarifLab(data, transaction) {
    return await TarifLab.create(data, { transaction });
  }

  static async getAllTarifLab() {
    return await TarifLab.findAll();
  }

  static async getTarifLabByTarifUuid(tarifUuid) {
    return await TarifLab.findAll({
      where: { tarif_uuid: tarifUuid },
    });
  }

  static async getTarifLabByTarifUuids(tarifUuids) {
    return await TarifLab.findAll({
      where: {
        tarif_uuid: {
          [Op.in]: tarifUuids,
        },
      },
    });
  }

  static async findTarifLabById(uuid) {
    return await TarifLab.findOne({ where: { uuid } });
  }

  static async updateTarifLab(tarifLab, data, transaction) {
    return await tarifLab.update(data, { transaction });
  }

  static async deleteTarifLab(tarifLab, transaction) {
    return await tarifLab.destroy({ transaction });
  }

  static async deleteTarifLabByTarifUuid(tarifUuid, transaction) {
    return await TarifLab.destroy({
      where: {
        tarif_uuid: tarifUuid,
      },
      transaction: transaction,
    });
  }
}
