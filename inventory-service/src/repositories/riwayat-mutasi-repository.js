import { Op } from "sequelize";
import Pagination from "../helpers/pagination.js";
import { RiwayatMutasiModel } from "@opensimrs/model-sdk/inventory";

export default class RiwayatMutasiRepository {
    static async getAll(req, itemUuids = null) {
        const {
            faskes_uuid,
            lokasi_stok_uuid,
            code,
            start_date,
            end_date,
            jenis_stok_uuid,
            search = "" 
        } = req;

        const whereClause = {
            faskes_uuid,
            ...(lokasi_stok_uuid && { lokasi_stok_uuid }),
            ...(jenis_stok_uuid && { jenis_stok_uuid }),
            ...(code && { code: { [Op.iLike]: `%${code}%` } }),
            ...(start_date && end_date && {
                created_at: { [Op.between]: [start_date, end_date] },
            }),
        };

        if (itemUuids !== null) {
            whereClause.item_uuid = { [Op.in]: itemUuids };
        } 
        else if (search) {
             whereClause.code = { [Op.iLike]: `%${search}%` };
        }

        return await Pagination.init(RiwayatMutasiModel, req, {
            where: whereClause,
            order: [["created_at", "DESC"]],
            attributes: {
                exclude: ["updated_at", "deleted_at"]
            },
            include: [] 
        });
    }

    static async bulkCreate(req, options = {}) {
        await RiwayatMutasiModel.bulkCreate(req, options);
    }
}
