import {ReturUnitItemModel, ReturUnitModel} from "@opensimrs/model-sdk/inventory";
import {Op} from "sequelize";
import Pagination from "../helpers/pagination.js";

export default class PenerimaanReturRepository {
    static async getAll(request) {
        const { 
            faskes_uuid, 
            search = "", 
            alasan_retur,
            lokasi_stok_uuid,
            matchedLocationUuids = []
        } = request;

        const whereConditions = {
            faskes_uuid: faskes_uuid,
            ...(alasan_retur && { alasan_retur: alasan_retur }),
            ...(lokasi_stok_uuid && { lokasi_stok_tujuan_uuid: lokasi_stok_uuid })
        };

        const searchTrimmed = search ? search.trim() : "";

        if (searchTrimmed) {
            const orConditions = [
                { no_retur: { [Op.iLike]: `%${searchTrimmed}%` } }
            ];

            if (matchedLocationUuids.length > 0) {
                orConditions.push({
                    lokasi_stok_awal_uuid: { [Op.in]: matchedLocationUuids }
                });
                orConditions.push({
                    lokasi_stok_tujuan_uuid: { [Op.in]: matchedLocationUuids }
                });
            }

            whereConditions[Op.or] = orConditions;
        }

        const options = {
            where: whereConditions,
            attributes: [
                "uuid", 
                "no_retur", 
                "tanggal_retur", 
                "alasan_retur", 
                "petugas_retur", 
                "jenis_stok", 
                "kategori_item", 
                "jenis_item",
                "lokasi_stok_awal_uuid", 
                "lokasi_stok_tujuan_uuid",
            ],
            order: [["tanggal_retur", "DESC"]],
            subQuery: false, 
        };

        return await Pagination.init(ReturUnitModel, request, options);
    }

    static async getDetail(request) {
        return await ReturUnitModel.findOne({
            where: {
                uuid: request.uuid,
            },
            attributes: {
                exclude: ["created_at", "updated_at", "deleted_at"]
            },
            include: [
                {
                    model: ReturUnitItemModel,
                    as: "items",
                    required: false,
                    attributes: [
                        "uuid", 
                        "item_uuid",
                        "qty", 
                        "qty_terima"
                    ],
                }
            ]
        });
    }
}