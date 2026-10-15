import { Op, QueryTypes, Transaction } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Lokasi from "../models/lokasi-model.js";
import {
  LokasiModel,
  PartOfLocationModel,
} from "@opensimrs/model-sdk/datamaster";
import { BaseRePosiotry } from "./base-repository.js";
import { toEpochDate } from "../helpers/helper.js";

LokasiModel.hasMany(PartOfLocationModel, {
  foreignKey: "faskes_uuid",
  constraints: false,
  sourceKey: "faskes_uuid",
});

PartOfLocationModel.belongsTo(LokasiModel, {
  foreignKey: "faskes_uuid",
  constraints: false,
  targetKey: "faskes_uuid",
});
export default class LokasiRepository extends BaseRePosiotry {
  /**
   *
   * @param {{faskes_uuid: string, uuid: string}} request
   */
  static async findByUuid(request) {
    const query = `SELECT * FROM lokasi WHERE faskes_uuid = :faskes_uuid AND uuid = :uuid AND deleted_at IS NULL`;
    const result = await sequelizeInstance.query(query, {
      replacements: {
        uuid: request.uuid,
        faskes_uuid: request.faskes_uuid,
      },
    });
    return result[0][0];
  }

  /**
   *
   * @param {Array<string>} names
   * @param {string} faskesUuid
   */
  static async findAllByNameIn(names, faskesUuid) {
    const lokasiList = await LokasiModel.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: names.map((n) => ({ name: n })),
          },
          {
            faskes_uuid: faskesUuid,
          },
        ],
      },
      attributes: [
        "uuid",
        "faskes_uuid",
        "code",
        "name",
        "no_room",
        "kategori_ruangan_uuid",
        "status",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ],
    });
    return lokasiList.map((r) => r.toJSON());
  }

  /**
   *
   * @param {{limit: string, offset: string, order_by: string, search: string, faskes_uuid: string }} request
   */
  static async findAllLokasiIncludePartOf(request) {
    console.table(request);
    /**
     * COUNT BERAPA BANYAK DATA
     */
    const qeury1 = `SELECT COUNT(*) FROM lokasi as l WHERE l.faskes_uuid = :faskes_uuid AND deleted_at IS NULL`;
    const count = await sequelizeInstance.query(qeury1, {
      replacements: {
        faskes_uuid: request.faskes_uuid,
      },
    });

    /**
     * MEKLAKUKAN QUERY KE DATABASE
     */
    const query2 = `SELECT 
      l.*, (SELECT l2.name FROM lokasi AS l2 WHERE l2.faskes_uuid = :faskes_uuid 
        AND uuid = l.part_of_uuid AND deleted_at IS NULL) AS part_of_name 
      FROM lokasi AS l WHERE faskes_uuid = :faskes_uuid AND deleted_at IS NULL AND l.name ILIKE :search ORDER BY id ${request.order_by} LIMIT :limit OFFSET :offset`;
    const result = await sequelizeInstance.query(query2, {
      replacements: {
        faskes_uuid: request.faskes_uuid,
        search: `%${request.search}%`,
        limit: request.limit,
        offset: request.offset,
      },
    });

    return {
      payload: result[0],
      properties: {
        total_page: Math.ceil(request.limit / parseInt(count[0][0].count)),
        total_item: parseInt(count[0][0].count),
        limit: request.limit,
        offset: request.offset,
      },
    };
  }

  /**
   *
   * @param {{faskes_uuid: string, code: string}} request
   * @returns
   */
  static async findByCode(request) {
    let lokasi = await LokasiModel.findOne({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            code: request.code,
          },
          {
            faskes_uuid: request.faskes_uuid,
          },
        ],
      },
    });
    if (lokasi) return lokasi.toJSON();
    else return null;
  }

  /**
   *
   * @param {Array<string>} uuidList
   */
  static async findAllByUuidIn(uuidLis, faskes_uuid) {
    const lokasiList = await LokasiModel.findAll({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            uuid: {
              [Op.in]: uuidLis,
            },
          },
          {
            faskes_uuid: faskes_uuid,
          },
        ],
      },
    });
    if (lokasiList.length > 0) return lokasiList.map((l) => l.toJSON());
    else return [];
  }

  /**
   *
   * @param {string} name
   * @param { string } faskes_uuid
   * @returns {Promise<LokasiModel>}
   */
  static async findByName(name, faskes_uuid) {
    const location = await LokasiModel.findOne({
      where: {
        [Op.and]: [
          {
            faskes_uuid: faskes_uuid,
          },
          {
            name: name,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
    });

    if (location) return location.toJSON();
    else return null;
  }

  /**
   *
   * @param {Array<Lokasi>} locationList
   *
   */
  static async saveAll(locationList, transaction) {
    await LokasiModel.bulkCreate(locationList, { transaction });
  }

  /**
   *
   * @param {Object} location
   * @param {Transaction} trsansaction
   */
  static async save(location, transaction) {
    await LokasiModel.create(location, { transaction });
  }

  static async addLokasi(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await LokasiModel.create(data, { transaction: tr });
    });
    return result;
  }

  /**
   *
   * @param {string} faskes_uuid
   * @returns {Promise<LokasiModel | null>}
   */
  static async findByFaskesUuid(faskes_uuid) {
    const lokasi = await LokasiModel.findOne({
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
        ],
      },
    });
    if (lokasi) return lokasi.toJSON();
    else return null;
  }

  static async getAllLokasi(request) {
    let whereClause = {
      deletedAt: {
        [Op.is]: null,
      },
      faskes_uuid: request.faskes_uuid,
    };
    if (request.name) whereClause.name = { [Op.iLike]: `%${request.name}%` };

    const { count, rows } = await LokasiModel.findAndCountAll({
      // where: whereClause,
      limit: request.limit,
      offset: request.offset - 1,
      order: [["id", request.order_by]],
      distinct: ["code"],
      include: [
        {
          model: PartOfLocationModel,
          required: false,
          where: whereClause,
        },
      ],
    });

    let locationList = [];
    rows.forEach((l) => {
      const lokasi = l.toJSON();
      delete lokasi.PartOfLokasiModels;
      locationList.push(lokasi);
      l.toJSON().PartOfLokasiModels.forEach((p) => locationList.push(p));
    });

    return {
      data: locationList.reverse(),
      properties: {
        total_item: locationList.length,
        total_pages: Math.ceil(count / request.limit),
        limit: request.limit,
        current_page: request.offset,
      },
    };
  }

  static async getAllLokasiByUuids(uuids) {
    return await LokasiModel.findAll({
      where: {
        deletedAt: null,
        uuid: { [Op.in]: uuids },
      },
      attributes: ["uuid", "name"],
    });
  }

  static async getLokasiByName(name) {
    return await LokasiModel.findOne({
      where: {
        deletedAt: null,
        name: name,
      },
      attributes: ["uuid", "name"],
    });
  }

  static async getLokasiNameByUuid(uuid) {
    return await LokasiModel.findOne({ where: { uuid }, attributes: ["name"] });
  }

  static async findLokasiByCode(code) {
    return await LokasiModel.findOne({ where: { code } });
  }

  static async findLokasiByCodeAntrianPoli(code_antrian_poli) {
    return await LokasiModel.findOne({ where: { code_antrian_poli } });
  }

  static async findLokasiBySatuSehatId(satu_sehat_id) {
    return await LokasiModel.findOne({
      where: { satu_sehat_id: satu_sehat_id },
    });
  }

  static async findLokasiByOraganizatioIhsNumber(organization_ihs_number) {
    return await LokasiModel.findOne({
      where: { organization_ihs_number },
    });
  }

  static async findLokasiByUuid(uuid) {
    return await LokasiModel.findOne({ where: { uuid } });
  }

  static async findLokasiByName(name) {
    return await LokasiModel.findOne({ where: { name } });
  }

  static async exportLokasi() {
    return await LokasiModel.findAll({
      where: {
        deletedAt: null,
      },
    });
  }

  static async update(lokasi, transaction) {
    lokasi.updatedAt = toEpochDate(new Date());
    const afectedRow = await LokasiModel.update(lokasi, {
      where: {
        [Op.and]: [
          {
            uuid: lokasi.uuid,
          },
          {
            faskes_uuid: lokasi.faskes_uuid,
          },
        ],
      },
      transaction: transaction,
    });
    return afectedRow[0];
  }

  static async getAllLokasiAktif(request) {
    let whereClause = {
      deletedAt: null,
      faskes_uuid: request.faskes_uuid,
      status: true,
    };
    if (request.is_poli) whereClause.is_poli = request.is_poli;
    if (request.name) whereClause.name = { [Op.iLike]: `%${request.name}%` };
    if (request.type) whereClause.location_type = request.type;

    const { count, rows } = await LokasiModel.findAndCountAll({
      // where: whereClause,
      limit: request.limit,
      offset: request.offset - 1,
      order: [["id", request.order_by]],
      include: [
        {
          model: PartOfLocationModel,
          required: true,
          where: whereClause,
        },
      ],
    });
    return {
      data: rows.map((l) => {
        let resp = [];
        const lokasi = l.toJSON();
        delete lokasi.PartOfLokasiModels;
        resp.push(lokasi);
        if (l.toJSON().PartOfLokasiModels?.length >= 0) {
          l.toJSON().PartOfLokasiModels.forEach((p) => {
            resp.push(p);
          });
        }
        return resp;
      })[0],
      properties: {
        total_item: count + 1,
        total_pages: Math.ceil((count + 1) / request.limit),
        limit: request.limit,
        current_page: request.offset,
      },
    };
  }

  static async getAllLokasiPoliAktif(request) {
    let whereClause = {
      is_poli: true,
      deletedAt: null,
      faskes_uuid: request.faskes_uuid,
      status: true,
    };
    if (request.name) whereClause.name = { [Op.iLike]: `%${request.name}%` };
    return await LokasiModel.findAll({
      where: whereClause,
    });
  }

  static async deleteLokasi(lokasi) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await lokasi.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { transaction: tr }
      );
    });
    return result;
  }
}
