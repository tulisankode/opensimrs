import Pagination from "../helpers/pagination.js";
import { Op } from "sequelize";
import { StockMedisModel } from "@opensimrs/model-sdk/inventory";

export default class ReportRepository {
    static async getExpiredItems(req, itemMedisJenisStokUuids = null) {
        const { page, limit } = req;
        const whereClause = this._buildExpiredStockWhere(req);

        if (itemMedisJenisStokUuids !== null) {
            whereClause.item_medis_jenis_stok_uuid = { [Op.in]: itemMedisJenisStokUuids };
        }

        const options = {
            where: whereClause,
            attributes: [ 
                "uuid", 
                "sisa_stok", 
                "no_po", 
                "faskes_uuid", 
                "exp_date", 
                "harga_satuan",
                "item_medis_jenis_stok_uuid",
                "lokasi_stok_uuid"
            ],
            order: [["exp_date", "ASC"]],
            subquery: false,
        };
        return await Pagination.init(StockMedisModel, { page, limit }, options);
    }

    static async getPersediaan(req, itemMedisJenisStokUuids = null) {
        const { page, limit } = req;
        const whereClause = this._buildPersediaanStockWhere(req);

        if (itemMedisJenisStokUuids !== null) {
            whereClause.item_medis_jenis_stok_uuid = { [Op.in]: itemMedisJenisStokUuids };
        }

        const options = {
            where: whereClause,
            attributes: [
                "item_medis_jenis_stok_uuid",
                "lokasi_stok_uuid", 
                [StockMedisModel.sequelize.fn("SUM", StockMedisModel.sequelize.col("sisa_stok")), "stok_akhir"],
                [
                    StockMedisModel.sequelize.literal(
                        "CAST(SUM(harga_satuan * sisa_stok) AS DECIMAL) / NULLIF(SUM(sisa_stok), 0)"
                    ),
                    "hpp_avg"
                ]
            ],
            group: ["item_medis_jenis_stok_uuid", "lokasi_stok_uuid"],
            order: [["item_medis_jenis_stok_uuid", "ASC"]],
        };

        return await Pagination.init(StockMedisModel, { page, limit }, options);
    }

    static _buildExpiredStockWhere(req) {
        const { faskes_uuid, lokasi_stok_uuid, tanggal_mulai, tanggal_selesai } = req;
        const today = new Date();
        let endDateFilter  = tanggal_selesai ? new Date(tanggal_selesai) : today;
        if (endDateFilter > today) endDateFilter = today;
        
        const whereClause = {
            faskes_uuid: faskes_uuid,
            sisa_stok: { [Op.gt]: 0 },
            exp_date: { [Op.between]: [ tanggal_mulai, endDateFilter ] }
        };
        
        if (lokasi_stok_uuid) whereClause.lokasi_stok_uuid = lokasi_stok_uuid;
        return whereClause;
    }

    static _buildPersediaanStockWhere(req) {
        const { faskes_uuid, lokasi_stok_uuid, tanggal_mulai, tanggal_selesai } = req;
        
        const stockWhere = {
            faskes_uuid: faskes_uuid,
            sisa_stok: { [Op.gt]: 0 },
            created_at: { [Op.between]: [tanggal_mulai, tanggal_selesai] },
        };
        
        if (lokasi_stok_uuid) stockWhere.lokasi_stok_uuid = lokasi_stok_uuid;
        
        return stockWhere;
    }
}