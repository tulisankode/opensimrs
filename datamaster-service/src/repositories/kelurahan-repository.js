import { Op } from "sequelize";
import Kelurahan from "../models/kelurahan-model.js";
import { KelurahanModel } from "@opensimrs/model-sdk/datamaster";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
export default class KelurahanRepository {


   static async findByCode(code){
      const kelurahan = await KelurahanModel.findOne({
        where: {
          code: code
        }
      });
      if(kelurahan) return kelurahan.toJSON();
      else return null;
    }


  /**
   * kelurahan dalam array
   * example: 
   *  {
   *    code: code,
   *    kelurahan_code: code,
   *    name: nama
   *  }
   * @param { array } kelurahan 
   */
  static async saveAll(kelurahanList, transaction){
    await KelurahanModel.bulkCreate(kelurahanList, { transaction });
  }

  /**
   * 
   * @param {Array<string>} nameList 
   */
  static async findAllByNameIn(nameList){
    const kelurahanList = await Kelurahan.findAll({
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
    if(kelurahanList.length < 0) return [];
    else return kelurahanList.map(k => k.toJSON());
  }



  static async addKelurahan(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Kelurahan.create(data, { transaction: tr });
    });
    return result;
  }

  static async getAllKelurahan(name = null, page = 1, limit = 10) {
    let whereClause = {};

    if (name) {
      whereClause.name = {
        [Op.iLike]: `%${query}%`,
      };
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await Kelurahan.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
    });

    return {
      totalItems: count,
      kelurahanList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findKelurahanById(id) {
    return await Kelurahan.findOne({ where: { id } });
  }

  static async findKelurahanByCode(code) {
    return await Kelurahan.findOne({ where: { code } });
  }

  static async findKelurahanByName(name, kecamatan_code) {
    return await Kelurahan.findOne({
      where: { name: { [Op.iLike]: `%${name}%` }, kecamatan_code },
    });
  }

  static async getKelurahanByKecamatanCode(kecamatanCode) {
    return await Kelurahan.findAll({
      where: { kecamatan_code: kecamatanCode },
    });
  }

  static async updateKelurahan(Kelurahan, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Kelurahan.update(data, { transaction: tr });
    });
    return result;
  }

  static async deleteKelurahan(Kelurahan) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Kelurahan.destory({ transaction: tr });
    });

    return result;
  }
}
