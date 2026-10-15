import { Op, Transaction } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Snomed from "../models/snomed-model.js";
import ICD9 from "../models/icd9-model.js";
import { Icd9Model, SnomedModel, TindakanModel } from "@opensimrs/model-sdk/datamaster";
import { BaseRePosiotry } from "./base-repository.js";
import { HttpException } from "../errors/http-exception.js";
import { generateErrorResponse } from "../helpers/generate-message.js";
import { toEpochDate } from "../helpers/helper.js";



const tindakanXsnomed = SnomedModel.belongsTo(TindakanModel, {
  foreignKey: "snomed_uuid",
  targetKey: "uuid",
  as: "snomed",
  constraints: false
})

const tindakanXIcd9 = Icd9Model.belongsTo(TindakanModel, {
  constraints: false,
  foreignKey: "icd9_uuid",
  targetKey: "uuid",
  as: "icd9"
})
export default class TindakanRepository extends BaseRePosiotry {
  /**
   *
   * @param {TindakanModel} tindakan
   * @param {Transaction} transaction
   */
  static async save(tindakan, transaction) {
    await TindakanModel.create(tindakan, { transaction });
  }

  /**
   *
   * @param {Array<{uuid: string}>} tindakanList
   * @returns
   */
  static async saveAll(tindakanList) {
    return await sequelizeInstance.transaction(async (tr) => {
      await TindakanModel.bulkCreate(tindakanList, { transaction: tr });
    });
  }

  /**
   *
   * @param {Array<string>} names
   */
  static async findAllByNameIn(names, faskestUuid) {
    const tindakanList = await TindakanModel.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: names.map((name) => {
              return {
                name: {
                  [Op.iLike]: `%${name}%`,
                },
              };
            }),
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            faskes_uuid: faskestUuid,
          }
        ],
      },
    });
    if (!tindakanList) {
      return [];
    }
    return tindakanList.map((tindakan) => tindakan.toJSON());
  }

  static async addTindakan(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      const tindakan = await TindakanModel.create(data, { transaction: tr });
      return tindakan;
    });
    return result;
  }

  static async getAllTindakan(name = null, page = 1, limit = 10, faskes_uuid) {
    let whereClause = {
      deletedAt: null,
      faskes_uuid: faskes_uuid,
    };
    if (name) {
      whereClause.name = { [Op.iLike]: `%${name}%` };
    }
    const offset = (page - 1) * limit;
    const { count, rows } = await TindakanModel.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      order: [["id", "DESC"]],
    });

    return {
      totalItems: count,
      tindakanList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async getAllTindakanAktif(faskes_uuid) {
    return await TindakanModel.findAll({
      where: {
        deletedAt: null,
        status: true,
        faskes_uuid: faskes_uuid
      },
    });
  }

  static async getAllTindakanByUuids(tindakanUuids) {
    return await TindakanModel.findAll({
      where: { uuid: Array.from(tindakanUuids) },
      attributes: ["uuid", "name"],
    });
  }

  static async exportTindakan(faskes_uuid) {
    return await TindakanModel.findAll({
      where: {
        deletedAt: null,
        faskes_uuid: faskes_uuid
      },
      include: [
        { 
          association: tindakanXsnomed,
          required: false,
          attributes: ["uuid", "code", "name", "status", "createdAt", "updatedAt", "deletedAt"]
        },
        { 
          association: tindakanXIcd9,
          required: false,
          attributes: ["uuid", "code", "name", "status", "createdAt", "updatedAt", "deletedAt"]
        },
      ],
    });
  }

  static async findTindakanById(request) {
    const result =  await TindakanModel.findOne({
      where: {
        uuid: request.uuid,
        faskes_uuid: request.faskes_uuid,
        deletedAt: {
          [Op.is]: null
        }
      }
    });
    if(result) return result.toJSON();
    else return null;
  }

  static async findTindakanByCode(code, faskesUuid) {
    return await TindakanModel.findOne({
      where: {
        [Op.and]: [
          { code },
          { faskes_uuid: faskesUuid },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
    });
  }

  static async updateTindakan(request) {
    await sequelizeInstance.transaction(async tr => {
      const tindakan = await TindakanModel.update(request, {
        where: {
          uuid: request.uuid,
          faskes_uuid: request.faskes_uuid,
        },
        transaction: tr
      });
      if(tindakan[0] !== 1){
        throw new HttpException(generateErrorResponse("Gagal update tindakan", "internal server error", "gagal update tindakan"), 500)
      }
    })
    
  }

  static async deleteTindakan(request) {
    request.deletedAt = toEpochDate(new Date())
    const result = await TindakanModel.update(request, {
      where: {
        uuid: request.uuid,
        faskes_uuid: request.faskes_uuid,
        deletedAt: null
      }
    })  
    return result[0];
  }

}
