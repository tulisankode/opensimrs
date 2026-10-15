import Pagination from "../helpers/pagination.js";
import { Op, Sequelize } from "sequelize";
import { toEpochDate } from "../helpers/date-helper.js";
import {
    KabupatenModel,
    KecamatanModel,
    KelurahanModel,
    ProvinceModel,
} from "@opensimrs/model-sdk/datamaster";
import {
    MasterSupplierModel,
    MasterSupplierKategoriItemModel,
} from "@opensimrs/model-sdk/inventory";

const supplierDetailIncludes = [
    { model: ProvinceModel, as: "province", required: false, attributes: ["code", "name"] },
    { model: KabupatenModel, as: "kabupaten", required: false, attributes: ["code", "name"] },
    { model: KecamatanModel, as: "kecamatan", required: false, attributes: ["code", "name"] },
    { model: KelurahanModel, as: "kelurahan", required: false, attributes: ["code", "name"] },
    { model: MasterSupplierKategoriItemModel, as: "supplier_items", required: false, attributes: ["kategori_item"] }
];

export default class DatamasterSupplierRepository {
    static async create(payload, transaction) {
        return await MasterSupplierModel.create(payload, {transaction});
    }

    static async createSupplierItem(payload, transaction) {
        return await MasterSupplierKategoriItemModel.create(payload, {transaction});
    }

    static async bulkCreateSupplierItem(payload, transaction) {
        return await MasterSupplierKategoriItemModel.bulkCreate(payload, {transaction});
    }

    static async deleteAllSupplierItem(payload, transaction) {
        return await MasterSupplierKategoriItemModel.destroy({
            where: {
                supllier_uuid: payload,
            },
            transaction,
        });
    }

    static async getAll(options) {
        const whereClause = {
            faskes_uuid: options.faskes_uuid,
            deleted_at: { [Op.is]: null },
        };

        if (options.name) {
            whereClause.name = { [Op.iLike]: `%${options.name}%` };
        }

        const queryOptions = {
            where: whereClause,
            include: supplierDetailIncludes,
        };

        const paginationArgs = {
            ...options,
            subQuery: true 
        };

        return Pagination.init(MasterSupplierModel, paginationArgs, queryOptions);
    }

    static async getAllWithoutPagination(options) {
        const whereClause = {
            faskes_uuid: options.faskes_uuid,
            status: true,
            deleted_at: { [Op.is]: null }
        };

        if (options.name) {
            whereClause.name = { [Op.iLike]: `%${options.name}%` };
        }

        return await MasterSupplierModel.findAll({
            where: whereClause,
        });
    }

    static async getByUuid({ uuid, faskes_uuid }) {
        return await MasterSupplierModel.findOne({
            where: { uuid, faskes_uuid, deleted_at: null },
            include: supplierDetailIncludes,
        });
    }

    static async getCode(code, faskesUuid, currentUuid = null) {
        const whereClause = {
            faskes_uuid: faskesUuid,
            deleted_at: { [Op.is]: null },
            code: { [Op.iLike]: code }
        };

        if (currentUuid) {
            whereClause.uuid = { [Op.ne]: currentUuid };
        }

        return await MasterSupplierModel.findOne({
            where: whereClause,
            attributes: ["uuid", "code"],
        });
    }

    static async update(payload, transaction) {
        const { uuid, faskes_uuid,  ...dataToUpdate} = payload;
        return await MasterSupplierModel.update(dataToUpdate, {
            where: {
                uuid: uuid,
                faskes_uuid: faskes_uuid
            },
            transaction
        });
    }

    static async delete(payload) {
        return await MasterSupplierModel.update(
            { 
                deleted_at: toEpochDate(new Date())
            },
            { 
                where: { 
                    uuid: payload.uuid, 
                    faskes_uuid: payload.faskes_uuid 
                }
            }
        );
    }

    static async findCodesInFaskes(codes, faskesUuid) {
        if (!codes || codes.length === 0) return [];
        const suppliers = await MasterSupplierModel.findAll({
            where: {
                code: {
                    [Op.in]: codes 
                },
                faskes_uuid: faskesUuid,
                deleted_at: null 
            },
            attributes: ["code"], 
            raw: true 
        });
        return suppliers;
    }

     static async bulkCreate(suppliersData, transaction) {
        if (!suppliersData || suppliersData.length === 0) return [];
        return await MasterSupplierModel.bulkCreate(suppliersData, { transaction: transaction, returning: true });
    }

    static async getAvailableSupplierByItemMedis(req) {
      const { faskes_uuid, kategori_items } = req;

      let categories = [];
      if (Array.isArray(kategori_items)) {
        categories = kategori_items;
      } else if (typeof kategori_items === "string") {
        categories = kategori_items.split(",").map(item => item.trim());
      }

      if (categories.length === 0) return [];

      const matchedSuppliers = await MasterSupplierKategoriItemModel.findAll({
        attributes: ["supllier_uuid"],
        where: {
          faskes_uuid: faskes_uuid,
          kategori_item: {
            [Op.in]: categories,
          }
        },
        group: ["supllier_uuid"],
        having: Sequelize.literal(`COUNT(DISTINCT "kategori_item") = ${categories.length}`),
        raw: true,
      });

      const supplierUuids = matchedSuppliers.map(s => s.supllier_uuid);

      if (supplierUuids.length === 0) return [];

      const whereClause = {
        faskes_uuid: faskes_uuid,
        uuid: {
            [Op.in]: supplierUuids
        },
        deleted_at: null,
        status: true,
      };

      return await MasterSupplierModel.findAll({
        where: whereClause,
        attributes: ["uuid", "code", "name"],
        include: [
            {
                model: MasterSupplierKategoriItemModel,
                as: "supplier_items",
                attributes: ["kategori_item"],
                required: false
            }
        ],
        order: [["name", "ASC"]]
      });
    }
}
