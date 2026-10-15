import { Op } from "sequelize";
import KategoriRuangan from "../models/kategori_ruangan-model.js";
import { KategoriRuanganModel } from "@opensimrs/model-sdk/datamaster";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
export default class KategoriRuanganRepository {
  /**
   *
   * @param {Array<{faskes_uuid: uuid | string, code: string, name: string, status: boolean}>} categories
   */
  static async saveAll(categories) {
    await sequelizeInstance.transaction(async (tr) => {
      await KategoriRuangan.bulkCreate(categories, { transaction: tr });
    });
  }

  static async addKategoriRuangan(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await KategoriRuangan.create(data, {
        transaction: tr,
      });
    });
    return result;
  }

  static async getAllKategoriRuangan(name = null, page = 1, limit = 10, faskes_uuid, order_by) {
    let whereClause = {
      deletedAt: null,
      faskes_uuid: faskes_uuid,
    };
    if (name) {
      whereClause.name = {
        [Op.iLike]: `%${name}%`,
      };
    }
    const offset = (page - 1) * limit;
    const { count, rows } = await KategoriRuangan.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      order: [["id", order_by]],
    });

    return {
      totalItems: count,
      kategoriRuanganList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async getAllKategoriRuanganByUuids(uuids) {
    return await KategoriRuangan.findAll({
      where: { uuid: Array.from(uuids) },
      attributes: ["uuid", "name"],
    });
  }

  static async getKategoriRuanganByName(name) {
    return await KategoriRuangan.findOne({
      where: { name: name },
      attributes: ["uuid", "name"],
    });
  }

  static async exportKategoriRuangan() {
    return await KategoriRuangan.findAll({
      where: {
        deletedAt: null,
      },
    });
  }

  static async getAllKategoriRuanganAktif(request) {
    let whereClause = {
      deletedAt: null,
      faskes_uuid: request.faskes_uuid,
      status: true
    };
    if("name" in request) whereClause.name = {[Op.iLike]: `%${request.name}%`}


    const { count, rows } = await KategoriRuanganModel.findAndCountAll({
      limit: request.limit,
      offset: request.offset - 1,
      order: [["id", request.order_by]],
      where: whereClause,
      attributes: ["uuid", "faskes_uuid", "name", "status", "createdAt", "updatedAt", "deletedAt"]
    });

    return {
      data: rows.map((k) => k.toJSON()),
      properties: {
        total_item: count,
        limit: request.limit,
        total_page: count / request.limit,
        current_page: request.offset,
      },
    };
  }

  static async findKategoriRuanganById(request) {
    const ruangan = await KategoriRuangan.findOne({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            faskes_uuid: request.faskes_uuid,
          },
          {
            uuid: request.uuid,
          },
          {
            status: true,
          },
        ],
      },
    });
    if (ruangan) return ruangan.toJSON();
    else return null;
  }

  static async delete(ruangan, transaction){
    ruangan.deletedAt = Math.floor(new Date().getTime() / 1000.0);
    const affected = await KategoriRuanganModel.update(ruangan, {
      where: {
        [Op.and]: [
          {
            uuid: ruangan.uuid
          },
          {
            faskes_uuid: ruangan.faskes_uuid
          },
        ]
      },
      transaction: transaction
    });
    return affected[0];
  }

  static async findKategoriRuanganByCode(code, faskes_uuid) {
    return await KategoriRuangan.findOne({
      where: { 
        code: code ,
        deletedAt: {
          [Op.is]: null,
        },
        faskes_uuid: faskes_uuid,
      },
    });
  }

  static async updateKategoriRuangan(updateRequest) {
    updateRequest.updatedAt = Math.floor(Date.now() / 1000);
    await KategoriRuanganModel.update(updateRequest, {
      where: {
        uuid: updateRequest.uuid,
        faskes_uuid: updateRequest.faskes_uuid,
        deletedAt: {
          [Op.is]: null,
        }
      }
    })
  }

  static async deleteKategoriRuangan(kategoriRuangan) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await kategoriRuangan.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { transaction: tr }
      );
    });
    return result;
  }
}
