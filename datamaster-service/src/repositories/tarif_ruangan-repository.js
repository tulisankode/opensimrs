import { Op } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import TarifRuangan from "../models/tarif_ruangan-model.js";
import { BaseRePosiotry } from "./base-repository.js";

export default class TarifRuanganRepository extends BaseRePosiotry{
  static async addTarifRuangan(data, transaction) {
    return await TarifRuangan.create(data, { transaction });
  }

  static async getAllTarifRuangan() {
    return await TarifRuangan.findAll();
  }

  static async findTarifRuanganRuanganId(tarif_uuid, ruangan_uuid) {
    return await TarifRuangan.findOne({
      where: { tarif_uuid, ruangan_uuid },
    });
  }

  static async getTarifRuanganByTarifUuid(tarifUuid) {
    return await TarifRuangan.findAll({
      where: { tarif_uuid: tarifUuid },
    });
  }

  static async getTarifRuanganByTarifUuids(tarifUuids) {
    return await TarifRuangan.findAll({
      where: {
        tarif_uuid: {
          [Op.in]: tarifUuids,
        },
      },
    });
  }

  static async findTarifRuanganById(uuid) {
    return await TarifRuangan.findOne({ where: { uuid } });
  }

  static async findTarifRuanganByTarifUuid(tarifUuid) {
    return await TarifRuangan.findOne({ where: { tarif_uuid: tarifUuid } });
  }

  static async updateTarifRuangan(tarifRuangan, data, transaction) {
    return await tarifRuangan.update(data, { transaction });
  }

  static async exportTarifRuangan() {
    return await TarifRuangan.findAll();
  }

  static async deleteTarifRuangan(tarifRuangan) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await tarifRuangan.destroy({ transaction: tr });
    });
    return result;
  }

  static async deleteTariRuanganByTarifUuid(tarifUuid, transaction) {
    return await TarifRuangan.destroy({
      where: {
        tarif_uuid: tarifUuid,
      },
      transaction: transaction,
    });
  }
}
