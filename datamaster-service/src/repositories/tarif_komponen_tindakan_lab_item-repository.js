import { Transaction } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import TarifKomponenTindakanLabItem from "../models/tarif_komponen_tindakan_lab_item-model.js";
import { BaseRePosiotry } from "./base-repository.js";

export default class TarifKomponenTindakanLabItemRepository extends BaseRePosiotry {
  /**
   * 
   * @param {TrifKomponenLanItem} data 
   * @param {Transaction} transaction 
   */
  static async addTarifKomponenTindakanLabItem(data, transaction) {
    await TarifKomponenTindakanLabItem.create(data, { transaction });
  }

  static async getAllTarifKomponenTindakanLabItem() {
    return await TarifKomponenTindakanLabItem.findAll();
  }

  static async findTarifKomponenTindakanLabItemByTarifId(tarif_uuid) {
    return await TarifKomponenTindakanLabItem.findAll({
      where: { tarif_uuid },
    });
  }

  static async findTarifKomponenTindakanLabItemById(uuid) {
    return await TarifKomponenTindakanLabItem.findOne({ where: { uuid } });
  }

  static async updateTarifKomponenTindakanLabItem(
    tarifKomponenTindakanLabItem,
    data
  ) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await tarifKomponenTindakanLabItem.update(data, {
        transaction: tr,
      });
    });

    return result;
  }

  static async exportTarifKomponenTindakanLabItem() {
    return await TarifKomponenTindakanLabItem.findAll();
  }

  static async deleteTarifKomponenTindakanLabItem(
    tarifKomponenTindakanLabItem
  ) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await tarifKomponenTindakanLabItem.destroy({ transaction: tr });
    });
    return result;
  }
}
