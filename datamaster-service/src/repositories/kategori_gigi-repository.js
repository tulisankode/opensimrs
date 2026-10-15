import { Op } from "sequelize";
import KategoriGigi from "../models/kategori_gigi-model.js";
import { CategoriGigiModel } from "@opensimrs/model-sdk/datamaster";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { BaseRePosiotry } from "./base-repository.js";
export default class KategoriGigiRepository extends BaseRePosiotry {


  static async findAllByNameIn(nameList){
    const kateGoriGigiList = await CategoriGigiModel.findAll({
      where: {
        name: {
          [Op.in]: nameList
        }
      }
    });
    if(kateGoriGigiList.length > 0) return kateGoriGigiList.map(k => k.toJSON())
    return [];
  }
  

  /**
   * 
   * @param {Array<{}>} categoryGigiList 
   */
  static async saveAll(categoryGigiList){
    await sequelizeInstance.transaction(async tr => {
      await KategoriGigi.bulkCreate(categoryGigiList, { transaction: tr });
    })
  }

  static async addKategoriGigi(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await KategoriGigi.create(data, { transaction: tr });
    });

    return result;
  }

  static async getAllKategoriGigi(display = null, page = 1, limit = 10) {
    let whereClause = { deletedAt: null };
    
    if (display) {
      whereClause.display = { [Op.iLike]: `%${display}%` };
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await KategoriGigi.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      order: [["id", "DESC"]],
    });

    return {
      totalItems: count,
      kategoriGigiList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findKategoriGigiNameByUuid(uuid) {
    return await KategoriGigi.findOne({
      where: { uuid },
      attributes: ["name"],
    });
  }

  static async findKategoriGigiUuidByName(name) {
    return await KategoriGigi.findOne({
      where: { name },
      attributes: ["uuid"],
    });
  }

  static async findKategoriGigiByUuid(uuid) {
    return await KategoriGigi.findOne({ where: { uuid } });
  }

  static async findKategoriGigiByCode(code) {
    return await KategoriGigi.findOne({ where: { code: code } });
  }

  static async findKategoriGigiByDisplay(display) {
    return await KategoriGigi.findOne({ where: { display } });
  }

  static async findKategoriGigiByName(name) {
    return await KategoriGigi.findOne({ where: { name } });
  }

  static async updateKategoriGigi(kategoriGigi, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await kategoriGigi.update(
        data,
        { updatedAt: Math.floor(Date.now() / 1000) },
        { transaction: tr }
      );
    });

    return result;
  }

  static async deleteKategoriGigi(kategoriGigi) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await kategoriGigi.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { transaction: tr }
      );
    });

    return result;
  }

  static async getAllKategoriGigiAktif() {
    return await KategoriGigi.findAll({
      where: {
        deletedAt: null,
        status: true,
      },
    });
  }

  static async exportKategoriGigi() {
    return await KategoriGigi.findAll({
      where: {
        deletedAt: null,
      },
    });
  }
}
