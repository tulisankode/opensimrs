import { Op, Transaction, where } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Surat from "../models/surat-model.js";
import { SuratModel } from "@opensimrs/model-sdk/datamaster";

export default class SuratRepository {


  /**
   * @param {SuratModel} surat
   * @param {Transaction} transaction
   * @returns {Promise<number>}
   */
  static async delete(surat, transaction){
    surat.deletedAt = Math.floor(Date.now() / 1000.0);
    const affected = await SuratModel.update(surat, {
      transaction: transaction,
      where: {
        [Op.and]: [
          {
            uuid: surat.uuid
          },
          {
            faskes_uuid: surat.faskes_uuid
          }
        ]
      }
    });
    return affected[0];
  }


  static async addSurat(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await SuratModel.create(data, { transaction: tr });
    });
    return result;
  }

  static async findSuratByCode(code) {
    return await SuratModel.findOne({ where: { code: code } });
  }

  static async getAllSurat(request) {
    const whereClause = {
      deletedAt: null,
      faskes_uuid: request.faskes_uuid
    }
    if(request.name) whereClause.name = {[Op.iLike]: `%${request.name}%`}
    const offset = (request.page - 1) * request.pageSize;
    const { count, rows } = await SuratModel.findAndCountAll({
      where: whereClause,
      limit: request.pageSize,
      offset: offset,
      order: [["id", request.order_by]],
    });

    return {
      totalItems: count,
      suratList: rows,
      currentPage: request.page,
      paginationInfo: {
        currentPage: request.page,
        totalPages: Math.ceil(count / request.limit),
        limit: request.pageSize,
      },
    };
  }

  static async getAllSuratAktif(faskes_uuid) {
    return await SuratModel.findAll({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            faskes_uuid: faskes_uuid,
          },
          {
            status: true,
          },
        ],
      },
    });
  }

  static async findSuratById(uuid, faskes_uuid) {
   const result = await SuratModel.findOne({
    where: {
      uuid: uuid,
      faskes_uuid: faskes_uuid,
      deletedAt: {
        [Op.is]: null
      }
    }
   })

   if(result) return result.toJSON();
   return null;
  }

  static async updateSurat(updateRequest) {
    console.log("DATA ==>>", updateRequest)
    updateRequest.updatedAt = Math.floor(Date.now() / 1000.0);
    await SuratModel.update(updateRequest, {
      where: {
        [Op.and]: [
          {
            uuid: updateRequest.uuid,
          },
          {
            faskes_uuid: updateRequest.faskes_uuid,
          },
        ],
      },
    })
  }

  static async exportSurat() {
    return await Surat.findAll({
      where: {
        deletedAt: null,
      },
    });
  }

  static async deleteSurat(surat) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await surat.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { transaction: tr }
      );
    });
    return result;
  }
}
