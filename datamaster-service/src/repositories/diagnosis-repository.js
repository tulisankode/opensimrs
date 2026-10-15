import { Op } from "sequelize";
import Diagnosis from "../models/diagnosis-model.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { DiagnosisModel } from "@opensimrs/model-sdk/datamaster";


export default class DiagnosisRepository {

  static async delete(diagnosis, transaction) {
    diagnosis.deletedAt = Math.floor(new Date().getTime() / 1000.0)
    const affected = await DiagnosisModel.update(diagnosis, {
      transaction: transaction,
      where: {
        [Op.and]: [
          {
            id: diagnosis.id,
          },
          {
            uuid: diagnosis.uuid
          }
        ]
      }
    });
    return affected[0];
  }

  static async findByuuid(uuid){
    const diagnosis = await DiagnosisModel.findOne({
      where: {
        [Op.and]: [
          {
            status: true
          },
          {
            uuid: uuid
          }
        ]
      }
    });
    if(diagnosis) return diagnosis.toJSON();
    else return null;
  }


  /**
   *
   * @param {Array<{uuid: uuid | string, code: string, name: string, status: boolean}>} icd10s
   */
  static async saveAll(icd10s, transaction) {
    await DiagnosisModel.bulkCreate(icd10s, { transaction});
  }

  static async addDiagnosis(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Diagnosis.create(data, { transaction: tr });
    });

    return result;
  }

  static async exportDiagnosis() {
    return await Diagnosis.findAll({
      where: {
        deletedAt: null,
      },
    });
  }

  static async getAllDiagnosisAktif() {
    return await Diagnosis.findAll({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            status: true,
          },
        ],
      },
    });
  }

  static async getAllDiagnosis(request) {
    const whereClause = {
      deletedAt: null,
      status: true,
    }
    if (request.name) {
      whereClause.name = {
        [Op.iLike]: `%${request.name}%`,
      };
    }
    const offset = (request.page - 1) * request.pageSize;
    const { count, rows } = await DiagnosisModel.findAndCountAll({
      where: whereClause,
      limit: request.pageSize,
      offset: offset,
      order: [["id", request.order_by]],
    });

    return {
      totalItems: count,
      diagnosisList: rows,
      currentPage: request.page,
      paginationInfo: {
        currentPage: request.page,
        totalPage: Math.ceil(count / request.pageSize),
        limit: request.pageSize,
      },
    };
  }

  static async findDiagnosisById(uuid) {
    return await Diagnosis.findOne({ where: { uuid } });
  }

  static async findDiagnosisByCode(code) {
    return await Diagnosis.findOne({ where: { code: code } });
  }

  static async updateDiagnosis(diagnosis, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await diagnosis.update(
        data,
        { updatedAt: Math.floor(Date.now() / 1000) },
        {
          transaction: tr,
        }
      );
    });

    return result;
  }

  static async deleteDiagnosis(diagnosis) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await diagnosis.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { transaction: tr }
      );
    });
    return result;
  }
}
