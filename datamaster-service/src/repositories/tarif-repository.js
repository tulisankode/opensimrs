import { Op, Transaction } from "sequelize";
import Tarif from "../models/tarif-model.js";
import {
  KategoriRuanganModel,
  LokasiModel,
  RuanganModel,
  TarifModel,
} from "@opensimrs/model-sdk/datamaster";
import { BaseRePosiotry } from "./base-repository.js";
import { toEpochDate } from "../helpers/helper.js";

// Tarif ruangan menunjuk kamar rawat inap di tabel lokasi (tarif.lokasi_uuid), sama dengan kamar yang
// dipilih di Admisi/Monitoring Kamar — bukan tabel ruangan lama.
TarifModel.hasOne(LokasiModel, {
  constraints: false,
  foreignKey: "uuid",
  sourceKey: "lokasi_uuid",
  as: "ruangan",
});

if (!LokasiModel.associations.kategori_kamar) {
  LokasiModel.hasOne(KategoriRuanganModel, {
    constraints: false,
    foreignKey: "uuid",
    sourceKey: "kategori_ruangan_uuid",
    as: "kategori_kamar",
  });
}

RuanganModel.belongsTo(TarifModel, {
  constraints: false,
  foreignKey: "ruangan_uuid",
  targetKey: "uuid",
  as: "tarif",
});

RuanganModel.hasOne(KategoriRuanganModel, {
  constraints: false,
  foreignKey: "uuid",
  sourceKey: "kategori_ruangan_uuid",
  as: "kategori",
});

KategoriRuanganModel.belongsTo(RuanganModel, {
  constraints: false,
  foreignKey: "kategori_ruangan_uuid",
  targetKey: "uuid",
  as: "ruangan",
});

export default class TarifRepository extends BaseRePosiotry {
  /**
   *
   * @param {TarifModel} request
   * @param {Transaction} transaction
   * @returns {Promise<number>}
   */
  static async update(request, transaction) {
    request.updatedAt = toEpochDate(new Date());
    const affected = await TarifModel.update(request, {
      transaction: transaction,
      where: {
        [Op.and]: [
          {
            uuid: request.uuid,
          },
          {
            faskes_uuid: request.faskes_uuid,
          },
        ],
      },
    });
    return affected[0];
  }

  /**
   *
   * @param {Array{}} tarifList
   * @param {Transaction} tr
   */
  static async saveAll(tarifList, tr) {
    await TarifModel.bulkCreate(tarifList, { transaction: tr });
  }

  /**
   *
   * @param {{jenis_tarif: string, name: string, limit: number, offset: number, order_by: string, faskes_uuid: string, is_mcu: boolean, unit_pelayanan: string, penjamin: string}} request
   * @returns
   */
  static async findAll(request) {
    const whereClause = {
      faskes_uuid: request.faskes_uuid,
      deletedAt: {
        [Op.is]: null,
      },
    };
    if (request.jenis_tarif) whereClause.jenis_tarif = request.jenis_tarif;
    if (request.name) whereClause.name = { [Op.iLike]: `%${request.name}%` };
    if (request.is_mcu) whereClause.is_mcu = request.is_mcu;
    if (request.unit_pelayanan)
      whereClause.unit_pelayanan = {
        [Op.iLike]: `%${request.unit_pelayanan}%`,
      };
    if (request.penjamin)
      whereClause.penjamin = { [Op.iLike]: `%${request.penjamin}%` };
    const { count, rows } = await TarifModel.findAndCountAll({
      where: whereClause,
      order: [["id", request.order_by]],
      include: [
        {
          model: LokasiModel,
          attributes: ["uuid", "name", "class_name", "kategori_ruangan_uuid", "status"],
          required: false,
          as: "ruangan",
          include: [
            {
              model: KategoriRuanganModel,
              required: false,
              as: "kategori_kamar",
              attributes: [
                "uuid",
                "faskes_uuid",
                "code",
                "name",
                "status",
                "createdAt",
                "updatedAt",
                "deletedAt",
              ],
            },
          ],
        },
      ],
    });

    return {
      payload: rows.map((t) => {
        const tarif = t.toJSON();
        tarif.tag_penjamin = JSON.parse(t.toJSON().penjamin);
        tarif.tag_unit_pelayanan = JSON.parse(t.toJSON().unit_pelayanan);
        tarif.tindakan = JSON.parse(t.toJSON().tindakan);
        delete tarif.penjamin;
        delete tarif.unit_pelayanan;
        return tarif;
      }),
      properties: {
        limit: request.limit,
        offset: request.offset,
        total_item: count,
        total_page: Math.ceil(count / request.offset),
      },
    };
  }

  static async findTarifByCode(code, faskesUuid) {
    return await Tarif.findOne({
      where: {
        [Op.and]: [
          {
            code,
          },
          {
            faskes_uuid: faskesUuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
    });
  }

  static async getAllTarifAktif(faskes_uuid) {
    return await Tarif.findAll({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            status: true,
          },
          {
            faskes_uuid: faskes_uuid,
          },
        ],
      },
    });
  }

  static async findTarifById(uuid) {
    return await Tarif.findOne({ where: { uuid } });
  }

  static async updateTarif(tarif, data, transaction) {
    return await tarif.update(
      data,
      {
        updatedAt: Math.floor(Date.now() / 1000),
      },
      { transaction }
    );
  }

  static async searchTarif(query, page = 1, limit = 10, faskes_uuid) {
    const offset = (page - 1) * limit;
    const { count, rows } = await TarifModel.findAndCountAll({
      where: {
        [Op.and]: [
          {
            name: `%${query}%`,
          },
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
      limit: limit,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    return {
      totalItems: count,
      tarifList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async exportTarif() {
    return await Tarif.findAll({
      where: {
        deletedAt: null,
      },
    });
  }

  static async deleteTarif(tarif, transaction) {
    return await tarif.destroy({ transaction });
  }
}
