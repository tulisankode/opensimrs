import { Op } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Kecamatan from "../models/kecamatan-model.js";
import { KecamatanModel } from "@opensimrs/model-sdk/datamaster";

export default class KecamatanRepository {

   static async findByCode(code){
      const kecamatan = await KecamatanModel.findOne({
        where: {
          code: code
        }
      });
      if(kecamatan) return kecamatan.toJSON();
      else return null;
    }

  /**
   * 
   * @param {Array<{code: string, kabupaten_code: string, name: string}>} kecamatanList 
   */
  static async saveAll(kecamatanList, transaction){
   await KecamatanModel.bulkCreate(kecamatanList, {transaction})
  }

  /**
   * 
   * @param {Array<string>} nameList 
   */
  static async findAllByNameIn(nameList) {
    const kecamatanList = await Kecamatan.findAll({
      where: {
        name: {
          [Op.or]: nameList.map(nl => {
            return {
              [Op.iLike]: `%${nl}%`
            }
          })
        }
      }
    });

    if(!kecamatanList.length > 0) return [];
    else return kecamatanList.map(k => k.toJSON());
  }


  static async addKecamatan(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Kecamatan.create(data, { transaction: tr });
    });
    return result;
  }

  static async getAllKecamatan(name = null, page = 1, limit = 10) {
    let whereClause = {};

    if (name) {
      whereClause.name = {
        [Op.iLike]: `%${name}%`,
      };
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await Kecamatan.findAndCountAll({
      where: whereClause,
      attributes: ["id", "code", "kabupaten_code", "name"],
      limit: limit,
      offset: offset,
    });

    return {
      totalItems: count,
      kecamatanList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findKecamatanById(id) {
    return await Kecamatan.findOne({ where: { id } });
  }

  static async findKecamatanByCode(code) {
    return await Kecamatan.findOne({ where: { code } });
  }

  static async findKecamatanByName(name, kabupaten_code) {
    return await Kecamatan.findOne({
      where: { name: { [Op.iLike]: `%${name}%` }, kabupaten_code },
    });
  }

  static async getKecamatanByKabupatenCode(kabupatenCode) {
    return await Kecamatan.findAll({
      where: { kabupaten_code: kabupatenCode },
      attributes: ["id", "name", "kabupaten_code", "code"]
    });
  }

  static async updateKecamatan(Kecamatan, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Kecamatan.update(data, { transaction: tr });
    });
    return result;
  }

  static async deleteKecamatan(Kecamatan) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Kecamatan.destory({ transaction: tr });
    });

    return result;
  }
}
