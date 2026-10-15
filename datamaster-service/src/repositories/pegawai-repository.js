import { Op } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { PegawaiModel } from "@opensimrs/model-sdk/datamaster";
import { BaseRePosiotry } from "./base-repository.js";

export default class PegawaiRepository extends BaseRePosiotry {


  /**
   * 
   * @param {{uuid: string, faskes_uuid: string}} request 
   * @returns 
   */
  static async findByUuid(request){
    const result = await PegawaiModel.findOne({
      where: {
        uuid: request.uuid,
        faskes_uuid: request.faskes_uuid,
        deletedAt: null
      },
      attributes: ["uuid", "faskes_uuid", "name", "nik", "tipe", "first_title", "last_title", "tanggal_lahir", "gender", "status", "createdAt", "updatedAt","deletedAt"],
    });
    if(result) return result.toJSON();
    else return null;
  }


  /**
   *
   * @param {Array<{}>} pegawaiList
   */
  static async saveAll(pegawaiList, transaction) {
   await PegawaiModel.bulkCreate(pegawaiList, {
    transaction: transaction,
    returning: false,
   })
  }

  static async addPegawai(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await PegawaiModel.create(data, { 
        transaction: tr,
        returning: false,
      });
    });
    return result;
  }

  static async findPegawaiBySatuSehatId(satu_sehat_id) {
    return await PegawaiModel.findOne({
      where: { satu_sehat_id: satu_sehat_id },
    });
  }

  static async findPegawaiByNIK(nik, faskes_uuid) {
    const pegawai = await PegawaiModel.findOne({
      where: {
        [Op.and]: [
          {
            nik: nik,
          },
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
      attributes: ["uuid", "faskes_uuid", "name", "nik", "tipe", "first_title", "last_title", "tanggal_lahir", "gender", "status", "createdAt", "updatedAt", "deletedAt"],
    });
    if (pegawai) return pegawai.toJSON();
    else return null;
  }

  static async getAllPegawaiAktif(request) {
    const whereClause = {
      deletedAt: {[Op.is]: null},
      faskes_uuid: request.faskes_uuid,
      status: true
    }

    if(request.type) whereClause.tipe = request.type;
    return await PegawaiModel.findAll({
      where: whereClause,
      attributes: ["uuid", "faskes_uuid", "name", "nik", "tipe", "first_title", "last_title", "tanggal_lahir", "gender", "status", "createdAt", "updatedAt", "deletedAt"],
      order: [["id", request.order_by]]
    });
  }

  static async getAllPegawai(name = null, type = null, page = 1, limit = 10, order_by, faskes_uuid) {
    let whereClause = {
      deletedAt: {[Op.is]: null},
      faskes_uuid: faskes_uuid
    }
    if(name) whereClause.name = {[Op.iLike]: `%${name}%`}
    if (type) {
      whereClause.tipe = type;
    }
    const offset = (page - 1) * limit;
    const { count, rows } = await PegawaiModel.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      attributes: ["uuid", "faskes_uuid", "name", "nik", "tipe", "first_title", "last_title", "tanggal_lahir", "gender", "status", "createdAt","updatedAt", "deletedAt"],
      order: [["id", order_by]],
    });

    return {
      totalItems: count,
      pegawaiList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findPegawaiById(uuid) {
    return await PegawaiModel.findOne({ 
      where: { uuid } ,
      attributes: ["uuid", "faskes_uuid", "name", "nik", "tipe", "first_title", "last_title", "tanggal_lahir", "gender", "status", "createdAt","updatedAt", "deletedAt"],
    });
  }

  static async findPegawaiByUuid(uuid) {
    return await PegawaiModel.findOne({
      where: { uuid },
      attributes: ["name", "nik", "tipe", "first_title", "last_title", "tanggal_lahir", "gender"],
    });
  }

  static async findPegawaiName(name) {
    return await PegawaiModel.findOne({
      where: { name },
      attributes: ["uuid", "name", "nik", "tipe", "first_title", "last_title", "tanggal_lahir", "gender"],
    });
  }

  static async exportPegawai(faskes_uuid) {
    const result = await PegawaiModel.findAll({
      where: {
        deletedAt: null,
        faskes_uuid: faskes_uuid
      },
      attributes: {
        include: ["uuid", "faskes_uuid", "name", "nik", "tipe", "first_title", "last_title", "tanggal_lahir", "createdAt", "updatedAt", "deletedAt"],
        exclude: ["pegawai_uuid"]
      }
    });
    return result.map(t => t.toJSON())
  }

  static async updatePegawai(pegawai, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await pegawai.update(
        data,
        { updatedAt: Math.floor(Date.now() / 1000) },
        {
          transaction: tr,
        }
      );
    });
    return result;
  }

  static async deletePegawai(pegawai) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await pegawai.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { transaction: tr }
      );
    });
    return result;
  }
}
