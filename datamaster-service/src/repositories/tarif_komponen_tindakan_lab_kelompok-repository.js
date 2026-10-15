import sequelizeInstance from "@opensimrs/model-sdk/instance";
import TarifKomponenTindakanLabKelompok from "../models/tarif_komponen_tindakan_lab_kelompok-model.js";
import { BaseRePosiotry } from "./base-repository.js";

export default class TarifKomponenTindakanLabKelompokRepository extends BaseRePosiotry{
  static async addTarifKomponenTindakanLabKelompok(data, transaction) {
    return await TarifKomponenTindakanLabKelompok.create(data, { transaction });
  }

  static async getAllTarifKomponenTindakanLabKelompok() {
    return await TarifKomponenTindakanLabKelompok.findAll();
  }

  static async findTarifKomponenTindakanLabKelompokByTarifId(tarif_uuid) {
    return await TarifKomponenTindakanLabKelompok.findAll({
      where: { tarif_uuid },
    });
  }

  static async findTarifKomponenTindakanLabKelompokById(uuid) {
    return await TarifKomponenTindakanLabKelompok.findOne({ where: { uuid } });
  }

  static async updateTarifKomponenTindakanLabKelompok(
    tarifKomponenTindakanLabKelompok,
    data
  ) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await tarifKomponenTindakanLabKelompok.update(data, {
        transaction: tr,
      });
    });

    return result;
  }

  static async exportTarifKomponenTindakanLabKelompok() {
    return await TarifKomponenTindakanLabKelompok.findAll();
  }

  static async deleteTarifKomponenTindakanLabKelompok(
    tarifKomponenTindakanLabKelompok
  ) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await tarifKomponenTindakanLabKelompok.destroy({
        transaction: tr,
      });
    });
    return result;
  }
}
