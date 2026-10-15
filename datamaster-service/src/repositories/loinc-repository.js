import { Op, Transaction } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Loinc from "../models/loinc-model.js";
import { BaseRePosiotry } from "./base-repository.js";

export default class LoincRepository extends BaseRePosiotry {

  /**
   * 
   * @param {Array<{Loinc}>} loincList 
   * @param {Transaction} transaction 
   */
  static async saveAll(loincList, transaction){
    await Loinc.bulkCreate(loincList, { transaction });
  }


  static async addLoinc(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Loinc.create(data, { transaction: tr });
    });

    return result;
  }

  static async getAllLoinc(name = null, page = 1, limit = 10) {
    let whereClause = {
      deletedAt: null,
    };

    if (name) {
      whereClause.name = {
        [Op.iLike]: `%${name}%`,
      };
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await Loinc.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      order: [["id", "DESC"]],
    });

    return {
      totalItems: count,
      loincList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findLoincById(uuid) {
    return await Loinc.findOne({ where: { uuid } });
  }

  static async findLoincByCode(code) {
    return await Loinc.findOne({ where: { code: code } });
  }

  static async updateLoinc(loinc, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await loinc.update(
        data,
        { updatedAt: Math.floor(Date.now() / 1000) },
        { transaction: tr }
      );
    });

    return result;
  }

  static async deleteLoinc(loinc) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      const date = Math.floor(Date.now() / 1000);
      const code = loinc.code + "_" + date;
      return await loinc.update(
        {
          deletedAt: date,
          code: code,
        },
        { transaction: tr }
      );
    });

    return result;
  }

  static async getAllLoincAktif() {
    return await Loinc.findAll({
      where: {
        deletedAt: null,
        status: true,
      },
    });
  }

  static async exportLoinc() {
    return await Loinc.findAll({
      where: {
        deletedAt: null,
      },
    });
  }
}
