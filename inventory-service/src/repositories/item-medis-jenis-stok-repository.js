import {
  ItemMedisJenisStokModel,
  ItemMedisModel,
  JenisStokModel,
  KategoriObatModel,
  LokasiStokModel,
  ManufactureModel,
  SatuanModel,
} from "@opensimrs/model-sdk/farmasi";
import { StockMedisModel } from "@opensimrs/model-sdk/inventory";
import { col, fn, Op, where } from "sequelize";
import Pagination from "../helpers/pagination.js";
import InternalServerException from "../errors/internal-server-exception.js";

export default class ItemMedisJenisStokRepository {
  static async getForKartuStok(req) {
    const { faskes_uuid, jenis_item, jenis_stok_uuid, lokasi_stok_uuid, search } = req;
    const searchQuery = search ?? "";
    req.subQuery = true;

    const options = {
      where: {
        faskes_uuid: faskes_uuid,
      },
      attributes: ["uuid"],
      include: [
        {
          model: ItemMedisModel,
          as: "item_medis",
          required: true,
          attributes: ["uuid", "name", "jenis_item"],
          where: {
            [Op.or]: [
              { name: { [Op.iLike]: `%${searchQuery}%` } }, 
              { code: { [Op.iLike]: `%${searchQuery}%` } },
            ],
            ...(jenis_item && { jenis_item: jenis_item }),
          },
          include: [
            {
              model: KategoriObatModel,
              as: "kategori_obat",
              required: true,
              attributes: ["name"],
            },
            {
              model: SatuanModel,
              as: "satuan_kemasan",
              required: true,
              attributes: ["name"],
            },
          ],
        },
        {
          model: JenisStokModel,
          as: "detail_stok",
          required: true,
          attributes: ["uuid", "name"],
          where: { ...jenis_stok_uuid && { uuid: jenis_stok_uuid } },
        },
        {
          model: StockMedisModel,
          as: "stocks", 
          required: true,
          attributes: ["sisa_stok"],
          where: {
            sisa_stok: {
              [Op.gt]: 0,
            },
            ...(lokasi_stok_uuid && { lokasi_stok_uuid: lokasi_stok_uuid }),
          },
          include: [
            {
              model: LokasiStokModel,
              as: "lokasi_stok",
              required: false,
              attributes: ["name"],
            }
          ]
        }
      ]
    };

    return await Pagination.init(ItemMedisJenisStokModel, req, options);
  }

  static async getDetailForStokAdjustment(req) {
    return await ItemMedisJenisStokModel.findOne({
      where: {
        uuid: req.uuid,
        faskes_uuid: req.faskes_uuid,
      },
      attributes: ["uuid"],
      include: [
        {
          model: ItemMedisModel,
          as: "item_medis",
          required: true,
          attributes: ["uuid", "name", "jenis_item"],
          [Op.or]: [
            { name: { [Op.iLike]: `%${req.search}%` } },
            { code: { [Op.iLike]: `%${req.search}%` } },
          ],
          include: [
            {
              model: KategoriObatModel,
              as: "kategori_obat",
              required: true,
              attributes: ["name"],
            },
          ],
        },
        {
          model: JenisStokModel,
          as: "detail_stok",
          required: true,
          attributes: ["uuid", "name"],
        },
        {
          model: StockMedisModel,
          as: "stocks",
          required: true,
          attributes: ["uuid", "sisa_stok", "exp_date"],
          where: {
            sisa_stok: {
              [Op.gt]: 0,
            },
            lokasi_stok_uuid: req.lokasi_stok_uuid,
          },
        },
      ],
    });
  }

  static async getDetailForRiwayatTarif(req) {
    return await ItemMedisJenisStokModel.findOne({
      where: {
        uuid: req.uuid,
        faskes_uuid: req.faskes_uuid
      },
      include: [
        {
          model: JenisStokModel,
          as: "detail_stok",
          required: false,
          attributes: ["name"]
        },
        {
          model: ItemMedisModel,
          as: "item_medis",
          required: false,
          attributes: ["code", "jenis_item"],
          include: [
            {
              model: SatuanModel,
              as: "satuan_penggunaan",
              required: false,
              attributes: ["name"]
            },
            {
              model: ManufactureModel,
              as: "manufacture",
              required: false,
              attributes: ["name"]
            }
          ]
        }
      ]
    });
  }

  static async getForStokOpname(req) {
    const lowerNames = req.names.map(name => name.trim().toLowerCase());
    return await ItemMedisJenisStokModel.findAll({
      where: {
        faskes_uuid: req.faskes_uuid,
        item_medis_uuid: { [Op.in]: req.item_medis_uuids },
      },
      attributes: ["uuid", "item_medis_uuid"],
      include: [
        {
          model: JenisStokModel,
          as: "detail_stok",
          required: true,
          attributes: ["uuid", "name"],
          where: where(fn("LOWER", col("detail_stok.name")), { [Op.in]: lowerNames })
        },
      ],
    });
  }

  static async getForPengadaanBarang(req) {
    return await ItemMedisJenisStokModel.findAll({
      where: {
        faskes_uuid: req.faskes_uuid,
        item_medis_uuid: req.item_medis_uuids,
        jenis_stok_uuid: req.jenis_stok_uuid,
      },
      attributes: ["uuid", "jenis_stok_uuid", "item_medis_uuid"],
    });
  }
  
  static async countValidItemsForJenisStok(itemUuids, jenisStokUuid, faskesUuid) {
    try {
      return await ItemMedisJenisStokModel.count({
        where: {
          item_medis_uuid: { [Op.in]: itemUuids },
          jenis_stok_uuid: jenisStokUuid,
          faskes_uuid: faskesUuid
        }
      });
    } catch (error) {
      throw new InternalServerException(`Gagal menghitung item valid: ${error.message}`);
    } 
  }

  static async getAvailableItemsForPO(req) {
        const { faskes_uuid, jenis_stok_uuid, jenis_item, search = "" } = req;
        
        const itemMedisWhere = {
            faskes_uuid: faskes_uuid,
            [Op.or]: [
                { name: { [Op.iLike]: `%${search}%` } },
            ]
        };
        
        const itemJenisStokWhere = {
            faskes_uuid: faskes_uuid,
        };

        if (jenis_stok_uuid) {
            itemJenisStokWhere.jenis_stok_uuid = jenis_stok_uuid;
        }
        if (jenis_item) {
            itemMedisWhere.jenis_item = jenis_item;
        }

        return await ItemMedisJenisStokModel.findAll({
            where: itemJenisStokWhere,
            attributes: [
                "uuid", 
                [col("item_medis.uuid"), "item_medis_uuid"],
                [col("item_medis.name"), "nama_item"],
            ],
            include: [
                {
                    model: ItemMedisModel,
                    as: "item_medis",
                    attributes: [], 
                    required: true, 
                    where: itemMedisWhere
                }
            ],
            limit: 20,
            raw: true,
        });
    }
}
