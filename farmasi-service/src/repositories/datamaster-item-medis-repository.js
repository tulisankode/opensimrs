import Pagination from "../helpers/pagination.js";
import { Op } from "sequelize";
import { toEpochDate } from "../helpers/date-helper.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import {
  BentukSediaanModel,
  ConversionModel,
  HargaItemModel,
  ItemMedisJenisStokModel,
  ItemMedisModel,
  JenisStokModel,
  KategoriObatModel,
  ManufactureModel,
  SatuanModel,
} from "@opensimrs/model-sdk/farmasi";
import moment from "moment";
import { StockMedisModel } from "@opensimrs/model-sdk/inventory";
import NotfoundException from "../errors/notfound-exception.js";

export default class DataMasterItemMedisRepository {
  static async create(req, transaction) {
    return await ItemMedisModel.create(req, { transaction });
  }

  static async getItemMedisJenisStoks(req) {
    return await ItemMedisJenisStokModel.findAll({
      where: {
        faskes_uuid: req.faskes_uuid,
      },
      attributes: {
        exclude: ["deleted_at", "created_at", "faskes_uuid", "id"],
      },
      include: [
        {
          model: ItemMedisModel,
          as: "item_medis",
          attributes: ["uuid", "name", "code"],
          required: false,
        },
        {
          model: JenisStokModel,
          as: "detail_stok",
          attributes: ["uuid", "name"],
          required: false,
        },
      ],
    });
  }

  static async getAll(req) {
    let whereJenisStok = {
      deleted_at: { [Op.is]: null },
    };

    if (req.jenis_stok_uuides) {
      let filterUuids = req.jenis_stok_uuides;

      if (typeof filterUuids === "string") {
        filterUuids = filterUuids.split(",").map((id) => id.trim());
      }

      if (Array.isArray(filterUuids) && filterUuids.length > 0) {
        whereJenisStok.jenis_stok_uuid = {
          [Op.in]: filterUuids,
        };
      }
    }

    const isStockRequired =
      req.has_stock === "true" || whereJenisStok.jenis_stok_uuid !== undefined;

    const option = {
      distinct: true,
      where: {
        faskes_uuid: req.faskes_uuid,
        name: { [Op.iLike]: `%${req.name || ""}%` },
        deleted_at: {
          [Op.is]: null,
        },
      },
      include: [
        {
          model: ConversionModel,
          as: "conversions",
          required: false,
          separate: true,
          where: { deleted_at: { [Op.is]: null } },
          attributes: [
            "satuan_pembelian",
            "satuan_penggunaan",
            "konversi",
            "uuid",
          ],
        },
        {
          model: ManufactureModel,
          as: "manufacture",
          required: false,
          where: { deleted_at: { [Op.is]: null } },
          attributes: ["code", "name"],
        },
        {
          model: ItemMedisJenisStokModel,
          as: "jenis_stok",
          required: isStockRequired,
          separate: true,
          where: whereJenisStok,
          attributes: ["uuid", "jenis_stok_uuid"],
          include: [
            {
              model: JenisStokModel,
              as: "detail_stok",
              required: false,
              where: { deleted_at: { [Op.is]: null } },
              attributes: ["name", "uuid"],
            },
          ],
        },
        {
          model: SatuanModel,
          as: "satuan_penggunaan",
          required: false,
          where: { deleted_at: { [Op.is]: null } },
          attributes: ["name"],
        },
        {
          model: SatuanModel,
          as: "satuan_dosis",
          required: false,
          where: { deleted_at: { [Op.is]: null } },
          attributes: ["name"],
        },
        {
          model: SatuanModel,
          as: "satuan_kemasan",
          required: false,
          where: { deleted_at: { [Op.is]: null } },
          attributes: ["name"],
        },
        {
          model: KategoriObatModel,
          as: "kategori_obat",
          required: false,
          where: { deleted_at: { [Op.is]: null } },
          attributes: ["name"],
        },
        {
          model: BentukSediaanModel,
          as: "bentuk_sediaan",
          required: false,
          where: { deleted_at: { [Op.is]: null } },
          attributes: ["name"],
        },
      ],
      order: [
        ["created_at", "DESC"],
        ["uuid", "ASC"],
      ],
    };

    if (req.status) {
      option.where.status = req.status;
    }

    if (req.jenis_item) {
      option.where.jenis_item = req.jenis_item;
    }

    return Pagination.init(ItemMedisModel, req, option);
  }

  static async update(req, transaction) {
    const [affectedRow] = await ItemMedisModel.update(req, {
      where: {
        uuid: req.uuid,
      },
      transaction,
    });

    if (affectedRow === 0) {
      throw new NotfoundException("Data gagal diedit");
    }

    return affectedRow;
  }

  static async delete(req) {
    return await sequelizeInstance.transaction(async (tr) => {
      await ItemMedisJenisStokModel.update(
        {
          deleted_at: moment().unix(),
        },
        {
          where: {
            item_medis_uuid: req.uuid,
          },
          tr,
        }
      );

      const [affectedRow] = await ItemMedisModel.update(
        {
          deleted_at: toEpochDate(new Date()),
        },
        {
          where: {
            uuid: req.uuid,
            deleted_at: null,
          },
          tr,
        }
      );

      if (affectedRow === 0) {
        throw new NotfoundException("Data gagal dihapus");
      }

      return affectedRow;
    });
  }

  static async getAllWithoutPagination(req, isAvg = false) {
    const whereClause = {
      faskes_uuid: req.faskes_uuid,
      deleted_at: {
        [Op.is]: null,
      },
    };

    if (req.jenis_item) {
      let jenisItem = req.jenis_item;

      if (typeof jenisItem === "string" && jenisItem.includes(",")) {
        jenisItem = jenisItem.split(",").map((item) => item.trim());
      }

      if (Array.isArray(jenisItem)) {
        whereClause.jenis_item = { [Op.in]: jenisItem };
      } else {
        whereClause.jenis_item = jenisItem;
      }
    }

    if (req.status) {
      whereClause.status = req.status;
    }

    return await ItemMedisModel.findAll({
      where: whereClause,
      attributes: ["uuid", "name", "code", "jenis_item"],
      include: [
        {
          model: SatuanModel,
          as: "satuan_penggunaan",
          required: false,
          attributes: ["name"],
        },
        {
          model: BentukSediaanModel,
          as: "bentuk_sediaan",
          required: false,
          where: { deleted_at: { [Op.is]: null } },
          attributes: ["name"],
        },
        {
          model: ManufactureModel,
          as: "manufacture",
          required: false,
          where: { deleted_at: { [Op.is]: null } },
          attributes: ["code", "name"],
        },
        {
          model: SatuanModel,
          as: "satuan_dosis",
          required: false,
          where: { deleted_at: { [Op.is]: null } },
          attributes: ["name"],
        },
        {
          model: ItemMedisJenisStokModel,
          as: "jenis_stok",
          required: false,
          where: { deleted_at: { [Op.is]: null } },
          attributes: ["uuid"],
          include: [
            {
              model: JenisStokModel,
              as: "detail_stok",
              required: false,
              where: { deleted_at: { [Op.is]: null } },
              attributes: ["name", "uuid"],
            },
            {
              model: HargaItemModel,
              as: "detail_harga",
              required: false,
              limit: 1,
              order: [["created_at", "DESC"]],
              where: { deleted_at: { [Op.is]: null } },
              attributes: [
                [
                  sequelizeInstance.literal(
                    `CASE WHEN ${isAvg} THEN harga_avg ELSE harga_terakhir END`
                  ),
                  "harga",
                ],
              ],
            },
          ],
        },
      ],
    });
  }

  static async insertJenisStok(req, transaction) {
    return await ItemMedisJenisStokModel.create(req, { transaction });
  }

  static async updateJenisStok(req, transaction) {
    const [affectedRow] = ItemMedisJenisStokModel.update(req, {
      where: {
        uuid: req.uuid,
      },
      transaction,
    });

    if (affectedRow === 0) {
      throw new NotfoundException("Data gagal diedit");
    }

    return affectedRow;
  }

  static async deleteJenisStok(req, transaction) {
    const [affectedRow] = await ItemMedisJenisStokModel.update(
      {
        deleted_at: toEpochDate(new Date()),
      },
      {
        where: {
          uuid: req.uuid,
        },
        transaction,
      }
    );

    if (affectedRow === 0) {
      throw new NotfoundException("Data gagal dihapus");
    }

    return affectedRow;
  }

  static async getItemMedisJenisStok(req) {
    return await ItemMedisJenisStokModel.findOne({
      where: {
        item_medis_uuid: req.item_medis_uuid,
        jenis_stok_uuid: req.jenis_stok_uuid,
        deleted_at: {
          [Op.is]: null,
        },
      },
      include: [
        {
          model: HargaItemModel,
          as: "detail_harga",
          required: true,
          where: {
            deleted_at: {
              [Op.is]: null,
            },
          },
          limit: 1,
          order: [["created_at", "DESC"]],
        },
      ],
    });
  }

  static async findJenisStockByUuid(uuid, jenisStock, faskes_uuid) {
    return await ItemMedisJenisStokModel.findOne({
      where: {
        item_medis_uuid: uuid,
        jenis_stok_uuid: jenisStock.jenis_stok_uuid,
        faskes_uuid: faskes_uuid,
        deleted_at: {
          [Op.is]: null,
        },
      },
    });
  }

  // Jenis stok sebuah item obat beserta stok tersedia (belum kedaluwarsa). Parameter boleh UUID item medis
  // (dipakai layar Resep Dokter, Penjualan Obat, Farmasi Ruangan) atau UUID item_medis_jenis_stok.
  // lokasi_stok_uuid opsional: tanpa lokasi, stok dihitung dari semua lokasi.
  static async getAvailableJenisStok(params) {
    const kunci = params.item_medis_jenis_stok_uuid;
    const syaratStok = {
      deleted_at: { [Op.is]: null },
      sisa_stok: { [Op.gt]: 0 },
      exp_date: { [Op.gte]: new Date() },
    };
    if (params.lokasi_stok_uuid) syaratStok.lokasi_stok_uuid = params.lokasi_stok_uuid;
    return await ItemMedisJenisStokModel.findAll({
      where: {
        [Op.or]: [{ uuid: kunci }, { item_medis_uuid: kunci }],
        deleted_at: { [Op.is]: null },
      },
      attributes: ["uuid", "item_medis_uuid", "jenis_stok_uuid"],
      include: [
        {
          model: JenisStokModel,
          as: "detail_stok",
          required: true,
          attributes: ["uuid", "name"],
          where: { deleted_at: { [Op.is]: null } },
        },
        {
          model: StockMedisModel,
          as: "stocks",
          required: false,
          attributes: ["sisa_stok"],
          where: syaratStok,
        },
      ],
    });
  }

  static async findLatestPricesForItemJenisStok(
    itemJenisStokUuid,
    isAvg = false
  ) {
    return HargaItemModel.findOne({
      where: {
        item_medis_jenis_stok_uuid: itemJenisStokUuid,
        deleted_at: { [Op.is]: null },
      },
      order: [["created_at", "DESC"]],
      attributes: [
        [
          sequelizeInstance.literal(
            `CASE WHEN ${isAvg} THEN harga_avg ELSE harga_terakhir END`
          ),
          "harga",
        ],
      ],
    });
  }

  static async getPrice(req) {
    return await ItemMedisJenisStokModel.findOne({
      where: {
        item_medis_uuid: req.item_medis_uuid,
        jenis_stok_uuid: req.jenis_stok_uuid,
        deleted_at: {
          [Op.is]: null,
        },
      },
      include: [
        {
          model: HargaItemModel,
          as: "detail_harga",
          required: true,
          where: {
            deleted_at: {
              [Op.is]: null,
            },
          },
          limit: 1,
          order: [["created_at", "DESC"]],
        },
      ],
    });
  }

  static bulkCreate(req) {
    return ItemMedisModel.bulkCreate(req, {
      individualHooks: true,
    });
  }

  static async bulkInsertJenisStok(req, transaction) {
    return await ItemMedisJenisStokModel.bulkCreate(req, { transaction });
  }

  static async getSome(uuidArray) {
    return await ItemMedisModel.findAll({
      where: {
        uuid: {
          [Op.in]: uuidArray,
        },
      },
      include: [
        {
          model: SatuanModel,
          as: "satuan_penggunaan",
          required: false,
          attributes: ["name"],
        },
      ],
      attributes: ["uuid", "name"],
    });
  }

  static async getForPengadaan(req) {
    const where = {
      faskes_uuid: req.faskes_uuid,
      deleted_at: {
        [Op.is]: null,
      },
    };

    if (req.jenis_item) {
      where.jenis_item = req.jenis_item;
    }

    return await ItemMedisModel.findAll({
      where,
      attributes: ["uuid", "name"],
      include: [
        {
          model: ConversionModel,
          as: "conversions",
          required: false,
          where: { deleted_at: { [Op.is]: null } },
          attributes: [
            "satuan_pembelian",
            "satuan_penggunaan",
            "konversi",
            "uuid",
          ],
        },
      ],
    });
  }
}
