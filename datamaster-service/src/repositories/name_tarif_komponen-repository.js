import { Op, Transaction } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
// import NameTarifKomponen from "../models/name_tarif_komponen-model.js";
import { BaseRePosiotry } from "./base-repository.js";
import {NameTarifKomponenModel} from "@opensimrs/model-sdk/datamaster";
import { toEpochDate } from "../helpers/helper.js";

export default class NameTarifKomponenRepository extends BaseRePosiotry {

  /**
   * 
   * @param {{}} request 
   * @param {Transaction} transaction 
   * @returns 
   */
  static async update(request, transaction){
    request.updatedAt = toEpochDate(new Date());
    const affected = await NameTarifKomponenModel.update(request, {
      transaction: transaction,
      where: {
        [Op.and]: [
          {
            faskes_uuid: request.faskes_uuid,
          },
          {
            uuid: request.uuid
          }
        ]
      }
    });
    return affected[0];
  }

  /**
   * 
   * @param {Array<{faskes_uuid: uuid | string, uuid: uuid | string, code: string, name: string}>} komponenTartfList 
   */
  static async saveAll(komponenTartfList){
    await sequelizeInstance.transaction(async (tr) => {
      await NameTarifKomponenModel.bulkCreate(komponenTartfList, { transaction: tr });
    });
  }

  static async findByNameIn(names, faskesUuid){
    const nameTarifKomponen = await NameTarifKomponenModel.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: names.map(name => {
              return {
                name: {
                  [Op.iLike]: `%${name}%`
                }
              }
            })
          },
          {
            deletedAt: {
              [Op.is]: null
            }
          },
          {
            faskes_uuid: faskesUuid
          }
        ]
      }
    });
    if(nameTarifKomponen) return nameTarifKomponen.map(nameTarifKomponen => nameTarifKomponen.toJSON());
    return null;
  }

  static async addNameTarifKomponen(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await NameTarifKomponenModel.create(data, { transaction: tr });
    });
    return result;
  }

  static async getAllNameTarifKomponen(name = null, page = 1, limit = 10, faskesuuid) {
    let whereClause = { deletedAt: null, faskes_uuid: faskesuuid };
    if (name) whereClause.name = {[Op.iLike]: `%${name}%`};
    const offset = (page - 1) * limit;
    const { count, rows } = await NameTarifKomponenModel.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      order: [["id", "DESC"]],
    });

    return {
      totalItems: count,
      nameTarifKomponenList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async getAllTarifKomponenByUuids(tarifKomponenUuids) {
    return await NameTarifKomponenModel.findAll({
      where: { uuid: Array.from(tarifKomponenUuids) },
      attributes: ["uuid", "name"],
    });
  }

  static async findNameTarifKomponenByCode(code, faskesUuid) {
    return await NameTarifKomponenModel.findOne({
      where: { 
        [Op.and]: [
          {
            code: {
              [Op.iLike]: `%${code}%`
            }
          },
          {
            faskes_uuid: faskesUuid
          },
          {
            deletedAt: {
              [Op.is]: null
            }
          }
        ]
      }
    });
  }

  /**
   * 
   * @param {string} name komponen tarif name
   */
  static async findByNameIlike(name, faskesUuid){
    const komponenTarif = await NameTarifKomponenModel.findOne({
      where: {
        [Op.and]: [
          {
            name: {
              [Op.iLike]: `%${name}%`
            }
          },
          {
            deletedAt: {
              [Op.is]: null
            }
          },
          {
            faskes_uuid: faskesUuid
          }
        ]
      }
    })
    if(komponenTarif){
      return komponenTarif.toJSON();
    }
    else {
      return null;
    }
  }

  static async getAllNameTarifKomponenAktif(faskes_uuid) {
    return await NameTarifKomponenModel.findAll({
      where: {
        deletedAt: null,
        status: true,
        faskes_uuid: faskes_uuid
      },
      order: [["id", "DESC"]]
    });
  }

  static async findNameTarifKomponenById(uuid) {
    return await NameTarifKomponenModel.findOne({ where: { uuid } });
  }

  static async updateNameTarifKomponen(nameTarifKomponen, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await nameTarifKomponen.update(
        data,
        {
          updatedAt: Math.floor(Date.now() / 1000),
        },
        { transaction: tr }
      );
    });

    return result;
  }

  static async exportNameTarifKomponen() {
    return await NameTarifKomponenModel.findAll({
      where: {
        deletedAt: null,
      },
    });
  }

  static async deleteNameTarifKomponen(nameTarifKomponen) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await nameTarifKomponen.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { transaction: tr }
      );
    });
    return result;
  }
}
