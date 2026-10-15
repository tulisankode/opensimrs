// import { BaseRePosiotry } from "./base-repository.js";
import { Op } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Province from "../models/province-model.js";
import { ProvinceModel } from "@opensimrs/model-sdk/datamaster";
export default class ProvinceRepository {

  static async findByCode(code){
    const province = await ProvinceModel.findOne({
      where: {
        code: code
      }
    });
    if(province) return province.toJSON();
    else return null;
  }

  /**
   * 
   * @param {Array<{code: string, name: string}>} provinces 
   */
  static async saveAll(provinceList, transaction){
   await ProvinceModel.bulkCreate(provinceList, {transaction});
  }


  /**
   * 
   * @param {Array<string>} nameList 
   * @returns { Promise<Array<{}>> }
   */
  static async findAllByNameIn(nameList){
    const provinceList = await Province.findAll({
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
    if(!provinceList.length > 0) return [];
    else return provinceList.map(p => p.toJSON());
  }

  static async addProvince(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Province.create(data, { transaction: tr });
    });
    return result;
  }

  static async getAllProvince() {
    return await Province.findAll();
  }

  static async getAllProvincePaginate(name = null, page = 1, limit = 10) {
    let whereClause = {};

    if (name) {
      whereClause.name = {
        [Op.iLike]: `%${name}%`,
      };
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await Province.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
    });

    return {
      totalItems: count,
      provinceList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findProvinceById(id) {
    return await Province.findOne({ where: { id } });
  }

  static async findProvinceByCode(code) {
    return await Province.findOne({ where: { code } });
  }

  static async findProvinceByName(name) {
    return await Province.findOne({
      where: { name: { [Op.iLike]: `%${name}%` } },
    });
  }

  static async updateProvince(province, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await province.update(data, { transaction: tr });
    });
    return result;
  }

  static async deleteProvince(province) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await province.destory({ transaction: tr });
    });

    return result;
  }
}
