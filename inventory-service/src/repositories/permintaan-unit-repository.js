import {PermintaanUnitItemModel, PermintaanUnitModel} from "@opensimrs/model-sdk/inventory";
import {Op} from "sequelize";
import Pagination from "../helpers/pagination.js";
import BadRequestException from "../errors/bad-request-exception.js";

export default class PermintaanUnitRepository {
    static async getAll(req, locationUuids = []) {
        const whereClause = {
            deleted_at: null,
            faskes_uuid: req.faskes_uuid,
            lokasi_stok_awal_uuid: req.lokasi_gudang_uuid,
        };

        if (req.search) {
            const orConditions = [
                { no_permintaan: { [Op.iLike]: `%${req.search}%` } }
            ];
            if (locationUuids && locationUuids.length > 0) {
                orConditions.push({
                    lokasi_stok_tujuan_uuid: { [Op.in]: locationUuids }
                });
            }
            whereClause[Op.or] = orConditions;
        }

        if (req.status) {
            const statusArray = Array.isArray(req.status) ? req.status : [req.status];
            if (statusArray.length > 0) {
                whereClause.status = {
                    [Op.in]: statusArray 
                };
            }
        }

        const option = {
            where: whereClause,
            attributes: [
                "uuid", "tanggal_permintaan", "no_permintaan", "kategori_item",
                "jenis_stok", "jenis_item", "petugas_permintaan", "petugas_verifikasi",
                "petugas_kirim", "petugas_batal_tolak", "status", "cito",
                "lokasi_stok_tujuan_uuid"
            ],
        };

        return await Pagination.init(PermintaanUnitModel, req, option);
    }

    static async getDetail(req){
        const result = await PermintaanUnitModel.findOne({
            where: {
                uuid: req.uuid,
                deleted_at: null,
            },
            attributes : {
                exclude: ["deleted_at", "created_at", "updated_at", "id"]
            },
            include: [
                {
                    model : PermintaanUnitItemModel,
                    as : "items",
                    required : false,
                }
            ]
        });

        if (!result) {
            throw new BadRequestException( "Data tidak ditemukan");
        }

        return result;
    }

    static async update(req, transaction){
        return await PermintaanUnitModel.update(
            req,
            {
                where: {
                    uuid: req.uuid
                },
                transaction
            }
        );
    }

    static async create(req, transaction){
        return await PermintaanUnitModel.create(
            req,
            {
                transaction
            }
        );
    }
}
