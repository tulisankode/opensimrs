import { Op, Sequelize, Transaction } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import ItemGigi from "../models/item_gigi-model.js";
import KategoriGigiRepository from "./kategori_gigi-repository.js";
import KategoriGigi from "../models/kategori_gigi-model.js";
import { ItemGigiModel, CategoriGigiModel } from "@opensimrs/model-sdk/datamaster";
import { BaseRePosiotry } from "./base-repository.js";



const categoriXItemGigiAssociation = ItemGigiModel.belongsTo(CategoriGigiModel, { 
  foreignKey: "kategori_gigi_uuid",
  as: "kategori_gigi",
  targetKey: "uuid",
  constraints: false,
});
export default class ItemGigiRepository extends BaseRePosiotry {


  /**
   * 
   * @param {Object} itemGigi 
   * @param {Transaction} transaction 
   */
  static async save(itemGigi, transaction){
    await ItemGigiModel.create(itemGigi, { transaction: transaction })
  }

  
  /**
   * 
   * @param {Array<{code: string, system: string, name: string, image: string, display: string, catatan: string}>} itemGigi 
   */
  static async saveAll(itemGigiList, transaction){
    await ItemGigiModel.bulkCreate(itemGigiList, { transaction: transaction })
  }


  static async addItemGigi(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await ItemGigiModel.create(data, { transaction: tr });
    });

    return result;
  }

  static async getAllItemGigi(name = null, page = 1, limit = 10) {
    const whereClause = {
      deletedAt: null,
    };

    if (name) whereClause.name = { [Op.iLike]: `%${name}%` };

    const offset = (page - 1) * limit;
    const { count, rows } = await ItemGigiModel.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      include: [{
        association: categoriXItemGigiAssociation,
        required: true,
        attributes: ["uuid", "system", "code", "display", "name", "createdAt", "updatedAt", "deletedAt"],
        where: {
          deletedAt: null,
        },
      }],
      order: [["id", "DESC"]],
    });

    return {
      payload: rows.map(item => item.toJSON()),
      properies: {
        total_item: count,
        total_page: Math.ceil(count / limit),
        current_page: page,
        page_size: limit,
      }
    }
    // return {
    //   total_item: count,
    //   : rows,
    //   currentPage: page,
    //   properties: {
    //     currentPage: page,
    //     totalPages: Math.ceil(count / limit),
    //     limit: limit,
    //   },
    // };
  }

  static async getKategoriGigiByUuid(uuid) {
    return await KategoriGigiRepository.findOne({ where: { uuid } });
  }

  static async findItemGigiByUuid(uuid) {
    return await ItemGigiModel.findOne({ where: { uuid } });
  }

  static async findItemGigiByCode(code) {
    return await ItemGigiModel.findOne({ where: { code: code } });
  }

  static async findItemGigiByDisplay(display) {
    return await ItemGigiModel.findOne({ where: { display } });
  }

  static async findItemGigiByName(name) {
    return await ItemGigiModel.findOne({ where: { name } });
  }

  static async updateItemGigi(data) {
    data.updatedAt = Math.floor(Date.now() / 1000);
   await ItemGigiModel.update(data, {
      where: {
        uuid: data.uuid,
      },
    });
  }


  static async deleteItemGigi(itemGigi) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await ItemGigiModel.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { 
          transaction: tr,
          where: {
            uuid: itemGigi.uuid,
          }
        }
      );
    });
    return result;
  }

  static async getAllItemGigiAktif() {
    return await ItemGigiModel.findAll({
      where: {
        deletedAt: null,
        status: true,
      },
    });
  }

  static async exportItemGigi() {
    return await ItemGigiModel.findAll({
      where: {
        deletedAt: null,
      },
      include: [
        { model: KategoriGigi, as: "kategori_gigi", attributes: ["name"] },
      ],
    });
  }
}
