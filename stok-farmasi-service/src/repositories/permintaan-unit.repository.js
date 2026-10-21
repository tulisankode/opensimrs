import { Op } from "sequelize";
import { getPagination, getPagingData } from "../helpers/pagination.helper.js";
import {
  PermintaanUnitItemModel,
  PermintaanUnitModel,
  StockMedisModel,
} from "@opensimrs/model-sdk/inventory";
import {
  ItemMedisJenisStokModel,
  ItemMedisModel,
  LokasiStokModel,
  SatuanModel,
} from "@opensimrs/model-sdk/farmasi";
import ResponseError from "../errors/ResponseError.js";

export default class PermintaanUnitRepository {
  static get _baseOptions() {
    return {
      attributes: {
        exclude: [
          "id",
          "faskes_uuid",
          "created_at",
          "updated_at",
          "deleted_at",
        ],
      },
      include: [
        {
          model: PermintaanUnitItemModel,
          as: "items",
          // separate: true,
          attributes: {
            exclude: [
              "id",
              "faskes_uuid",
              "created_at",
              "updated_at",
              "deleted_at",
            ],
          },
          include: [
            {
              model: ItemMedisModel,
              as: "item_medis",
              attributes: ["name", "satuan_kemasan_uuid"],
              include: [
                {
                  model: SatuanModel,
                  as: "satuan_penggunaan",
                  attributes: ["name"],
                },
                {
                  model: ItemMedisJenisStokModel,
                  as: "jenis_stok",
                  attributes: ["uuid"],

                  where: {
                    jenis_stok_uuid: {
                      [Op.col]: "PermintaanUnitModel.jenis_stok_uuid",
                    },
                  },
                  required: false,
                  include: [
                    {
                      model: StockMedisModel,
                      as: "stocks",
                      attributes: ["sisa_stok", "harga_satuan"],
                      where: {
                        lokasi_stok_uuid: {
                          [Op.col]: "PermintaanUnitModel.lokasi_stok_awal_uuid",
                        },
                        sisa_stok: { [Op.gt]: 0 },
                        // Samakan dengan alokasi verifikasi: batch kedaluwarsa tidak bisa dikirim.
                        exp_date: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) },
                        deleted_at: null,
                      },
                      required: false,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          model: LokasiStokModel,
          as: "lokasi_stok_tujuan",
          attributes: ["uuid", "name"],
        },
        {
          model: LokasiStokModel,
          as: "lokasi_stok_awal",
          attributes: ["uuid", "name"],
        },
      ],
    };
  }

  static async getAllPermintaanUnit(query, faskesUuid) {
    const whereClause = { faskes_uuid: faskesUuid };
    if (query.no_permintaan) {
      whereClause.no_permintaan = { [Op.iLike]: `%${query.no_permintaan}%` };
    }

    // Saring per lokasi dengan UUID (lebih tepat daripada pencocokan nama): daftar Permintaan Unit
    // memakai lokasi tujuan (depo peminta), Verifikasi & Pengiriman memakai lokasi asal (pemasok).
    if (query.lokasi_stok_tujuan_uuid) {
      whereClause.lokasi_stok_tujuan_uuid = query.lokasi_stok_tujuan_uuid;
    }
    if (query.lokasi_stok_awal_uuid) {
      whereClause.lokasi_stok_awal_uuid = query.lokasi_stok_awal_uuid;
    }

    if (query.status) {
      let statuses = query.status;
      if (typeof statuses === "string") {
      statuses = statuses.split(",").map((s) => s.trim()).filter(Boolean);
      }
      if (Array.isArray(statuses)) {
      whereClause.status = statuses.length === 1 ? statuses[0] : { [Op.in]: statuses };
      } else {
      whereClause.status = statuses;
      }
    }

    const includeClause = [...this._baseOptions.include];
    const lokasiTujuanInclude = includeClause.find(
      (inc) => inc.as === "lokasi_stok_tujuan"
    );
    const lokasiAwalInclude = includeClause.find(
      (inc) => inc.as === "lokasi_stok_awal"
    );
    

    if (query.nama_lokasi_tujuan && lokasiTujuanInclude) {
      lokasiTujuanInclude.where = {
        name: { [Op.iLike]: `%${query.nama_lokasi_tujuan}%` },
      };
      lokasiTujuanInclude.required = true;
    }
    if (query.nama_lokasi_awal && lokasiAwalInclude) {
      lokasiAwalInclude.where = {
        name: { [Op.iLike]: `%${query.nama_lokasi_awal}%` },
      };
      lokasiAwalInclude.required = true;
    }

    // pagination
    const { limit, offset, page, pageSize } = getPagination(query);

    const result = await PermintaanUnitModel.findAndCountAll({
      where: whereClause,
      ...this._baseOptions,
      include: includeClause,
      order: [["tanggal_permintaan", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    // Tab status yang kosong adalah keadaan normal; 404 hanya untuk pencarian teks.
    const isSearching = query.no_permintaan || query.nama_lokasi_tujuan;
    if (isSearching && result.count === 0) {
      throw new ResponseError(`Data permintaan unit tidak ditemukan.`, 404);
    }

    return getPagingData(result, page, pageSize);
  }

  static async getPermintaanUnitByUuid(uuid, faskesUuid) {
    console.log("Repository: Getting permintaan unit by UUID:", uuid);
    return PermintaanUnitModel.findOne({
      where: {
        uuid,
        faskes_uuid: faskesUuid,
      },
      ...this._baseOptions,
    });
  }

  static async createPermintaanUnit(data, transaction) {
    return PermintaanUnitModel.create(data, {
      include: [
        {
          model: PermintaanUnitItemModel,
          as: "items",
        },
      ],
      transaction,
    });
  }

  static async searchitem(query, faskesUuid) {
    const whereClause = { faskes_uuid: faskesUuid };
    if (query.q) {
      whereClause[Op.or] = [
        { code: { [Op.iLike]: `%${query.q}%` } },
        { name: { [Op.iLike]: `%${query.q}%` } },
      ];
    }
    return ItemMedisModel.findAll({
      where: whereClause,
      attributes: ["code", "name"],
    });
  }

  static async updateStatusPermintaan(
    uuid,
    faskesUuid,
    dataToUpdate,
    transaction
  ) {
    const [updatedRowCount] = await PermintaanUnitModel.update(dataToUpdate, {
      where: {
        uuid: uuid,
        faskes_uuid: faskesUuid,
      },
      transaction,
    });
    return [updatedRowCount];
  }
}
