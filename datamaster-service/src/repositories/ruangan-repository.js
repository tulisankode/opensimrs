import { Op, Sequelize } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Ruangan from "../models/ruangan-model.js";
import KategoriRuangan from "../models/kategori_ruangan-model.js";
import { RuanganModel } from "@opensimrs/model-sdk/datamaster";
import { BaseRePosiotry } from "./base-repository.js";

export default class RuanganRepository extends BaseRePosiotry {

  /**
   * 
   * @param {Array<string>} names 
   * @param {string} faskesUuid 
   */
  static async findAllByNameIn(names, faskesUuid){
    const ruanganList = await RuanganModel.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: names.map(n => ({name: n}))
          },
          {
            faskes_uuid: faskesUuid
          }
        ]
      },
      attributes: ["uuid", "faskes_uuid", "code", "name", "no_room", "kategori_ruangan_uuid", "status", "createdAt", "updatedAt", "deletedAt"]
    });
    return ruanganList.map(r => r.toJSON());
  }

  static async findByUuid(uuid, faskes_uuid) {
    const ruangan = await RuanganModel.findOne({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            uuid: uuid,
          },
          {
            faskes_uuid: faskes_uuid,
          },
        ],
      },
      attributes: ["uuid", "faskes_uuid", "name", "no_room", "kategori_ruangan_uuid", "kelas_ruangan", "status", "createdAt", "updatedAt", "deletedAt"]
    });
    if(ruangan) return ruangan.toJSON();
    else return null;
  }

  /**
   *
   * @param {Array<{}>} ruangans
   */
  static async saveAll(ruangans) {
    await sequelizeInstance.transaction(async (tr) => {
      await Ruangan.bulkCreate(ruangans, { transaction: tr });
    });
  }

  /**
   *
   * @param {Array<string>} names
   */
  static async findCategoryRoomByNameIn(faskesUuid, names) {
    const ruangans = await KategoriRuangan.findAll({
      where: {
        [Op.and]: [
          {
            name: {
              [Op.in]: names,
            },
          },
          {
            faskes_uuid: faskesUuid,
          },
        ],
      },
    });
    if (ruangans.length !== 0) {
      return ruangans.map((r) => r.toJSON());
    } else {
      return [];
    }
  }

  /**
   *
   * @param {Array<{faskes_uuid: string | uuid, code: string, name: string, kategori_ruangan_uuid: string, kelas_ruangan: string, no_rm: string}>} ruangan
   */
  static async saveAll(ruangan) {
    await sequelizeInstance.transaction(async (tr) => {
      await Ruangan.bulkCreate(ruangan, { transaction: tr });
    });
  }

  static async addRuangan(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Ruangan.create(data, { transaction: tr });
    });
    return result;
  }

  static async getAllRuangan(name = null, kategori_ruangan_uuid = null, kelas_ruangan = null, page = 1, limit = 10, faskes_uuid, order_by) {
    const whereClause = {
      faskes_uuid: faskes_uuid, 
      deletedAt: null
    }
    if(name) whereClause.name = {[Op.iLike]: `%${name}%`}
    if (kategori_ruangan_uuid) {
      whereClause.kategori_ruangan_uuid = kategori_ruangan_uuid;
    }

    if (kelas_ruangan) {
      whereClause.kelas_ruangan = kelas_ruangan;
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await RuanganModel.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      order: [["id", order_by]],
      attributes: ["uuid", "faskes_uuid", "code", "name", "no_room", "kategori_ruangan_uuid", "kelas_ruangan", "status", "createdAt", "updatedAt", "deletedAt"]
    });

    return {
      totalItems: count,
      ruanganList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async getAllRuanganByUuids(allRuanganUuids) {
    return await Ruangan.findAll({
      where: { uuid: Array.from(allRuanganUuids) },
      attributes: ["uuid", "name", "kelas_ruangan", "kategori_ruangan_uuid"],
    });
  }

  static async findAll(faskes_uuid) {
    const ruanganList = await RuanganModel.findAll({
      where: {
        [Op.and]: [
          {
            faskes_uuid: faskes_uuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
    });

    if (ruanganList.length >= 1) return ruanganList.map((r) => r.toJSON());
    else return [];
  }

  static async getAllRuanganAktif(faskes_uuid) {
    return await Ruangan.findAll({
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

  static async findRuanganById(uuid) {
    return await Ruangan.findOne({ where: { uuid } });
  }

  static async findRuanganByCode(code) {
    return await Ruangan.findOne({ where: { code: code } });
  }

  static async updateRuangan(ruangan, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await ruangan.update(data, { updatedAt: Math.floor(Date.now() / 1000) }, { transaction: tr });
    });
    return result;
  }

  static async exportRuangan() {
    return await Ruangan.findAll({
      where: {
        deletedAt: null,
      },
      include: [
        {
          model: KategoriRuangan,
          as: "kategori_ruangan",
          required: false,
          where: {
            deletedAt: null,
          },
          attributes: ["uuid", "code", "name", "status"],
        },
      ],
    });
  }

  static async deleteRuangan(request, transaction) {
    request.deletedAt = Math.floor(new Date().getTime() / 1000.0);
    const affected = await RuanganModel.update(request, {
      where: {
        [Op.and]: [
          {
            uuid: request.uuid
          },
          {
            faskes_uuid: request.faskes_uuid
          }
        ]
      },
      transaction: transaction
    });
    return affected[0];
  }
}
