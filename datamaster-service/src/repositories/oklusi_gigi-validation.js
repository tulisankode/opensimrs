import { Op } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import OklusiGigi from "../models/oklusi_gigi-model.js";
import { BaseRePosiotry } from "./base-repository.js";

export default class OklusiGigiRepository extends BaseRePosiotry {

  /**
   * 
   * @param {Array<{}>} oklusiGigi 
   */
  static async saveAll(oklusiGigi){
    await sequelizeInstance.transaction(async tr => {
      await OklusiGigi.bulkCreate(oklusiGigi, { transaction: tr});
    })
  }

  static async addOklusiGigi(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await OklusiGigi.create(data, { transaction: tr });
    });

    return result;
  }

  static async getAllOklusiGigi(display = null, page = 1, limit = 10) {
    let whereClause = {
      deletedAt: null,
    };

    if (display) {
      whereClause.display = { [Op.iLike]: `%${display}%` };
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await OklusiGigi.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      order: [["id", "DESC"]],
    });

    return {
      totalItems: count,
      oklusiGigiList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findOklusiGigiByUuid(uuid) {
    return await OklusiGigi.findOne({ where: { uuid } });
  }

  static async findOklusiGigiByCode(code) {
    return await OklusiGigi.findOne({ where: { code: code } });
  }

  static async findOklusiGigiByDisplay(display) {
    return await OklusiGigi.findOne({ where: { display } });
  }

  static async findOklusiGigiByName(name) {
    return await OklusiGigi.findOne({ where: { name } });
  }

  static async updateOklusiGigi(OklusiGigi, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await OklusiGigi.update(
        data,
        { updatedAt: Math.floor(Date.now() / 1000) },
        { transaction: tr }
      );
    });

    return result;
  }

  static async deleteOklusiGigi(oklusiGigi) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await oklusiGigi.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { transaction: tr }
      );
    });

    return result;
  }

  static async getAllOklusiGigiAktif() {
    return await OklusiGigi.findAll({
      where: {
        deletedAt: null,
        status: true,
      },
    });
  }

  static async exportOklusiGigi() {
    return await OklusiGigi.findAll({
      where: {
        deletedAt: null,
      },
    });
  }
}
