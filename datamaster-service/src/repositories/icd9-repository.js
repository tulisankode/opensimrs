import { Op, where } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import ICD9 from "../models/icd9-model.js";
import { Icd9Model } from "@opensimrs/model-sdk/datamaster";
import { BaseRePosiotry } from "./base-repository.js";
import { toEpochDate } from "../helpers/helper.js";


const attributes = ["id", "uuid", "code", "name", "status"]
export default class ICD9Repository extends BaseRePosiotry {


  static async delete(request, trsansaction){
    request.deletedAt = toEpochDate(new Date());
    await Icd9Model.update(request, {
      where: {
        id: request.id,
        uuid: request.uuid,
        deletedAt: null
      },
      transaction: trsansaction
    })
  }
  /**
   * 
   * @param {string} uuid 
   * @returns {Promise<Icd9Model | null>}
   */
  static async findByUuid(uuid) {
    const icd9 = await ICD9.findOne({
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
      attributes: attributes
    });
    if (icd9) return icd9.toJSON();
    else return null;
  }

  static async findAllBynameIn(nameList) {

    const icd9List = await ICD9.findAll({
      where: {
        [Op.and]: [
          {
            name: {
              [Op.in]: nameList,
            }
          },
          {
            deletedAt: {
              [Op.is]: null,
            }
          }
        ]
      },
      attributes: attributes
    });

    if(icd9List.length === 0) {
      return [];
    } else return icd9List.map(icd9 => icd9.toJSON());
  }

  static async findByName(name) {
    const idcd10 = await ICD9.findOne({
      where: {
        name: name,
      },
      attributes: attributes
    });

    if (!idcd10) {
      return null;
    } else return idcd10.toJSON();
  } 
  static async addICD9(data) {
   await Icd9Model.create(data, {
    returning: false
   });
  }

  static async getAllICD9(name = null, page = 1, limit = 10) {
    let whereClause = {
      deletedAt: null,
    };

    if (name) {
      whereClause.name = {
        [Op.iLike]: `%${name}%`,
      };
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await ICD9.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      order: [["id", "DESC"]],
      attributes: attributes
    });

    return {
      totalItems: count,
      icd9List: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async getAllICD9ByUuids(uuids) {
    return await ICD9.findAll({
      where: { uuid: Array.from(uuids) },
      attributes: attributes,
    });
  }

  static async getICD9ByName(name) {
    return await ICD9.findOne({
      where: { name: name },
      attributes: attributes,
    });
  }

  static async findICD9ById(uuid) {
    return await ICD9.findOne({ where: { uuid }, attributes: attributes });
  }

  static async findICD9ByCode(code) {
    return await ICD9.findOne({ where: { code: code }, attributes: attributes });
  }

  static async updateICD9(icd9, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await icd9.update(
        data,
        { updatedAt: Math.floor(Date.now() / 1000) },
        { transaction: tr }
      );
    });

    return result;
  }

  static async deleteICD9(icd9) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await icd9.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { 
          transaction: tr,
          where: {
            id: icd9.id,
            uuid: icd9.uuid,
            deletedAt: null
          }
        }
      );
    });

    return result;
  }

  static async getAllICD9Aktif() {
    return await ICD9.findAll({
      where: {
        deletedAt: null,
        status: true,
      },
      order: [["id", "DESC"]],
      attributes: attributes
    });
  }

  static async exportICD9() {
    return await ICD9.findAll({
      where: {
        deletedAt: null,
      },
      order: [["id", "DESC"]],
      attributes: attributes
    });
  }

  /**
   * 
   * @param {Array<{uuid: uuid | string, code: string, name: string, status: boolean}>} icd9s 
   * @returns { Promise<void> }
   */
  static async saveAll(icd9s){
    return sequelizeInstance.transaction(async tr => {
      await ICD9.bulkCreate(icd9s, { transaction: tr, returning: false});
    })
  }
}
