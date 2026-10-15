import { Op } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Kabupaten from "../models/kabupaten-model.js";
import { KabupatenModel } from "@opensimrs/model-sdk/datamaster";
export default class KabupatenRepository {

  static async findByCode(code){
    const kabupaten = await KabupatenModel.findOne({
      where: {
        code: code
      }
    });
    if(kabupaten) return kabupaten.toJSON();
    else return null;
  }

  /**
   * 
   * @param {Array<{code: string, provinsi_code: string, name: string}>} kabupatens 
   */
  static async saveAll(kabupatens) {
    await sequelizeInstance.transaction(async tr => {
      await Kabupaten.bulkCreate(kabupatens, {
        transaction: tr
      })
    })
  }

  /**
   *
   * @param {Array<string>} nameList 
   */
  static async findAllByNameIn(nameList){
    const kabupatenList = await Kabupaten.findAll({
      where: {
        name: {
          [Op.or]: nameList.map(nl => {
            return {
              [Op.iLike]: `%${nl}%`
            }
          })
        }
      }
    })
    if(!kabupatenList.length > 0) return [];
    return kabupatenList.map(k => k.toJSON());
  }

  static async addKabupaten(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Kabupaten.create(data, { transaction: tr });
    });
    return result;
  }

  static async getAllKabupaten(name = null, page = 1, limit = 10) {
    let whereClause = {};

    if (name) {
      whereClause.name = {
        [Op.iLike]: `%${query}%`,
      };
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await Kabupaten.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
    });

    return {
      totalItems: count,
      kabupatenList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findKabupatenById(id) {
    return await Kabupaten.findOne({ where: { id } });
  }

  static async findKabupatenByCode(code) {
    return await Kabupaten.findOne({ where: { code } });
  }

  static async findKabupatenByName(name, provinsi_code) {
    return await Kabupaten.findOne({
      where: { name: { [Op.iLike]: `%${name}%` }, provinsi_code },
    });
  }

  static async getKabupatenByProvinceCode(provinsiCode) {
    return await Kabupaten.findAll({
      where: { provinsi_code: provinsiCode },
    });
  }

  static async updateKabupaten(kabupaten, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await kabupaten.update(data, { transaction: tr });
    });
    return result;
  }

  static async deleteKabupaten(kabupaten) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await kabupaten.destory({ transaction: tr });
    });

    return result;
  }
}
