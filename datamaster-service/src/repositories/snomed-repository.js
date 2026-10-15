import { Op, Transaction } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Snomed from "../models/snomed-model.js";
import { SnomedModel } from "@opensimrs/model-sdk/datamaster";

export default class SnomedRepository {
  /**
   *
   * @param {string} uuid
   * @returns {Promise<SnomedModel | null>}
   */
  static async findByUuid(uuid) {
    const snomed = await SnomedModel.findOne({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            uuid: uuid,
          },
        ],
      },
      attributes: {
        include: ["uuid", "code", "name", "status", "createdAt", "updatedAt", "deletedAt"],
        exclude: ["snomed_uuid"],
      },
    });
    if (snomed) return snomed.toJSON();
    else return null;
  }

  /**
   *
   * @param {SnomedModel} snomed
   * @param {Transaction} transaction
   * @returns {Promise<number>}
   */
  static async delete(snomed, transaction) {
    snomed.deletedAt = Math.floor(new Date().getTime() / 1000.0);
    const affected = await SnomedModel.update(snomed, {
      transaction: transaction,
      where: {
        uuid: snomed.uuid,
      },
      returning: false,
    });
    return affected[0];
  }

  /**
   *
   * @param {SnomedModel} request
   * @param {Transaction} transaction
   * @returns {Promise<number>}
   */
  static async update(request, transaction) {
    request.updatedAt = Math.floor(new Date().getTime() / 1000.0);
    const snomed = await SnomedModel.update(request, {
      where: {
        uuid: request.uuid,
      },
      transaction: transaction,
      returning: false
    });
    return snomed[0];
  }

  /**
   *
   * @param {string} uuid
   * @returns {Promise<SnomedModel | null>}
   */
  static async findByuuid(uuid) {
    const snomed = await SnomedModel.findOne({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            uuid: uuid,
          },
        ],
      },
      attributes: {
        include: ["uuid", "code", "name", "status", "createdAt", "updatedAt", "deletedAt"],
        exclude: ["snomed_uuid"],
      },
    });
    if (snomed) return snomed.toJSON();
    else return null;
  }

  /**
   *
   * @param {Array<{uuid: string, code: string, name: string, status: boolean}>} snomeds
   */
  static async saveAll(snomeds) {
    return await sequelizeInstance.transaction(async (tr) => {
      await SnomedModel.bulkCreate(snomeds, {
        transaction: tr,
        returning: false,
      });
    });
  }

  static async findSnomedByName(name) {
    const snomed = await Snomed.findOne({
      where: {
        name: name,
      },
      attributes: {
        include: ["uuid", "code", "name", "status", "createdAt", "updatedAt", "deletedAt"],
        exclude: ["snomed_uuid"],
      },
    });
    if (!snomed) {
      return null;
    } else return snomed.toJSON();
  }

  /**
   *
   * @param {Array<string>} nameList
   * @returns
   */
  static async findByNameIn(nameList) {
    const snomedList = await Snomed.findAll({
      where: {
        [Op.and]: [
          {
            name: {
              [Op.in]: nameList,
            },
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
      attributes: {
        include: ["uuid", "code", "name", "status", "createdAt", "updatedAt", "deletedAt"],
        exclude: ["snomed_uuid"],
      },
    });
    if (snomedList.length === 0) {
      return [];
    } else return snomedList.map((snomed) => snomed.toJSON());
  }

  static async addSnomed(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Snomed.create(data, { transaction: tr });
    });

    return result;
  }

  static async getAllSnomed(name = null, page = 1, limit = 10) {
    let whereClause = {
      deletedAt: null,
    };

    if (name) {
      whereClause.name = {
        [Op.iLike]: `%${name}%`,
      };
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await Snomed.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      attributes: {
        include: ["uuid", "code", "name", "status", "createdAt", "updatedAt", "deletedAt"],
        exclude: ["snomed_uuid"]
      },
      order: [["id", "DESC"]],
    });

    return {
      totalItems: count,
      snomedList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async getAllSnomedByUuids(uuids) {
    return await Snomed.findAll({
      where: { uuid: Array.from(uuids) },
      attributes: {
        include: ["uuid", "code", "name", "status", "createdAt", "updatedAt", "deletedAt"],
        exclude: ["snomed_uuid"]
      }
    });
  }

  static async getSnomedByName(name) {
    return await Snomed.findOne({
      where: { name: name },
      attributes: {
        include: ["uuid", "code", "name", "status", "createdAt", "updatedAt", "deletedAt"],
        exclude: ["snomed_uuid"]
      }
    });
  }

  static async findSnomedById(uuid) {
    return await Snomed.findOne({
       where: { 
        uuid: uuid,
        attributes: {
          include: ["uuid", "code", "name", "status", "createdAt", "updatedAt", "deletedAt"],
          exclude: ["snomed_uuid"]
        }
      }
    });
  }

  static async findSnomedByCode(code) {
    return await Snomed.findOne({
      where: { 
        code: code
      },
      attributes: {
        include: ["uuid", "code", "name", "status", "createdAt", "updatedAt", "deletedAt"],
        exclude: ["snomed_uuid"]
      }
    });
  }

  static async updateSnomed(snomed, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await snomed.update(data, { updatedAt: Math.floor(Date.now() / 1000) }, { transaction: tr });
    });

    return result;
  }

  static async deleteSnomed(snomed) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await snomed.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { transaction: tr }
      );
    });

    return result;
  }

  static async getAllSnomedAktif() {
    return await Snomed.findAll({
      where: {
        deletedAt: null,
        status: true,
      },
    });
  }

  static async exportSnomed() {
    return await Snomed.findAll({
      where: {
        deletedAt: null,
      },
      attributes: {
        include: ["uuid", "code", "name", "status", "createdAt", "updatedAt", "deletedAt"],
        exclude: ["snomed_uuid"]
      }
    });
  }
}
