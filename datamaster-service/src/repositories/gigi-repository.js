import { Op } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { BaseRePosiotry } from "./base-repository.js";
import { GigiModel } from "@opensimrs/model-sdk/datamaster";

export default class GigiRepository extends BaseRePosiotry {

  /**
   * 
   * @param {Array<{code: string, display: string, name: string}>} gigi 
   */
  static async saveAll(gigi) {
    await sequelizeInstance.transaction(async tr => {
      await GigiModel.bulkCreate(gigi, { transaction: tr });
    })
  }

  static async addGigi(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await GigiModel.create(data, { transaction: tr });
    });

    return result;
  }

  static async getAllGigi(display = null, page = 1, limit = 10) {
    let whereClause = { deletedAt: null };
    if (display) {
      whereClause.display = { [Op.iLike]: `%${display}%` };
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await GigiModel.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      order: [["id", "DESC"]],
    });

    return {
      totalItems: count,
      gigiList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findGigiByUuid(uuid) {
    return await GigiModel.findOne({ where: { uuid } });
  }

  static async findGigiByCode(code) {
    return await GigiModel.findOne({ where: { code: code } });
  }

  static async findGigiByDisplay(display) {
    return await GigiModel.findOne({ where: { display } });
  }

  static async findGigiByName(name) {
    return await GigiModel.findOne({ where: { name } });
  }

  static async updateGigi(gigi, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await gigi.update(
        data,
        { updatedAt: Math.floor(Date.now() / 1000) },
        { transaction: tr }
      );
    });

    return result;
  }

  static async deleteGigi(gigi) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await gigi.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { transaction: tr }
      );
    });

    return result;
  }

  static async getAllGigiAktif() {
    return await GigiModel.findAll({
      where: {
        deletedAt: null,
        status: true,
      },
    });
  }

  static async exportGigi() {
    return await GigiModel.findAll({
      where: {
        deletedAt: null,
      },
    });
  }
}
