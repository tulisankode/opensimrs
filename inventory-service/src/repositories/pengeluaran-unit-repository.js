import {PengeluaranUnitItemModel, PengeluaranUnitModel, StockMedisModel} from "@opensimrs/model-sdk/inventory";
import {Op} from "sequelize";
import Pagination from "../helpers/pagination.js";


export default class PengeluaranUnitRepository {
    static async create(req, transaction) {
        return await PengeluaranUnitModel.create(req, {transaction});
    }

    static async getAll(req) {
        const { faskes_uuid, lokasi_stok_uuid, search = "", jenis_pengeluaran } = req;

        const options = {
            where: {
                deleted_at: null,
                faskes_uuid: faskes_uuid,
                ...(lokasi_stok_uuid && { lokasi_stok_awal_uuid: lokasi_stok_uuid }),
                ...(search && { no_pengeluaran: { [Op.iLike]: `%${search}%` } }),
                ...(jenis_pengeluaran && { jenis_pengeluaran: jenis_pengeluaran }),
            },
            order: [["tanggal_pengeluaran", "DESC"]],
            attributes: {
                exclude: ["deleted_at", "created_at", "updated_at", "id"]
            },
            include: [],
        };

        return await Pagination.init(PengeluaranUnitModel, req, options);
    }

    static async getDetail(uuid) {
        return await PengeluaranUnitModel.findOne({
            where: {
                uuid: uuid
            },
            include: [
                {
                    model: PengeluaranUnitItemModel,
                    as: "items",
                    required: false,
                    include: [
                        {
                            model: StockMedisModel,
                            as: "stok",
                            required: false,
                            attributes: ["uuid", "harga_satuan", "exp_date", "no_po", "item_medis_jenis_stok_uuid"],
                        },
                    ]
                }

            ]
        });
    }
}
