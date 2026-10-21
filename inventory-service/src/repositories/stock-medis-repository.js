import {Op} from "sequelize";
import BadRequestException from "../errors/bad-request-exception.js";
import {StockMedisModel} from "@opensimrs/model-sdk/inventory";
import {
    ConversionModel,
    ItemMedisJenisStokModel,
    ItemMedisModel,
    JenisStokModel, LokasiStokModel, ManufactureModel,
    SatuanModel
} from "@opensimrs/model-sdk/farmasi";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import InternalServerException from "../errors/internal-server-exception.js";
import { NotfoundException } from "@opensimrs/model-sdk/exceptions";

export default class StockMedisRepository {
    static async reduceQuantity(req, t) {
        if (req.item_medis_uuid) {
            let remainingQuantity = req.quantity;
            let stock;
            const today = new Date();
            let result = [];

            let order = [];

            if (req.metode_pemotongan_stok === "FEFO") {
                order.push(["exp_date", "ASC"]);
            } else if (req.metode_pemotongan_stok === "FIFO") {
                order.push(["created_at", "ASC"]);
            } else {
                order.push(["created_at", "DESC"]);
            }

            const sisaStockRaw = await StockMedisModel.findAll({
                where: {
                    sisa_stok: {
                        [Op.gt]: 0
                    },
                    exp_date: {
                        [Op.gt]: today
                    },
                    lokasi_stok_uuid: req.lokasi_stok_uuid,
                },
                attributes: ["sisa_stok"],
                include: [
                    {
                        model: ItemMedisJenisStokModel,
                        as: "item_medis_jenis_stok",
                        required: true,
                        where: {
                            jenis_stok_uuid: req.jenis_stok_uuid,
                            item_medis_uuid: req.item_medis_uuid,
                        },
                        attributes: ["uuid"],
                    }
                ],
                transaction: t,
            });

            const totalStock = sisaStockRaw.reduce((acc, curr) => acc + curr.sisa_stok, 0);

            if (totalStock < req.quantity) {
                throw new BadRequestException(`${req.name} not enough or empty (total stock : ${totalStock})`);
            }

            while (remainingQuantity > 0) {
                stock = await StockMedisModel.findOne({
                    where: {
                        sisa_stok: {
                            [Op.gt]: 0
                        },
                        exp_date: {
                            [Op.gt]: today
                        },
                        lokasi_stok_uuid: req.lokasi_stok_uuid,
                    },
                    include: [
                        {
                            model: ItemMedisJenisStokModel,
                            as: "item_medis_jenis_stok",
                            required: true,
                            where: {
                                item_medis_uuid: req.item_medis_uuid,
                                jenis_stok_uuid: req.jenis_stok_uuid,
                            },
                            attributes: ["uuid"],
                        }
                    ],
                    order: order,
                    transaction: t,
                    lock: t.LOCK.UPDATE,
                });

                const newStock = stock.sisa_stok - remainingQuantity;

                if (newStock >= 0) {
                    await StockMedisModel.update(
                        {sisa_stok: newStock},
                        {
                            where: {uuid: stock.uuid},
                            transaction: t
                        }
                    );

                    result.push({
                        stock_medis_uuid: stock.uuid,
                        quantity: remainingQuantity,
                        previous_stock: stock.sisa_stok,
                        expired_date: stock.exp_date,
                    });

                    remainingQuantity = 0;
                } else {
                    await StockMedisModel.update(
                        {sisa_stok: 0},
                        {
                            where: {
                                uuid: stock.uuid,
                            },
                            transaction: t
                        }
                    );
                    result.push({
                        stock_medis_uuid: stock.uuid,
                        quantity: stock.sisa_stok,
                        expired_date: stock.exp_date,
                        previous_stock: stock.sisa_stok,
                    });

                    remainingQuantity = Math.abs(newStock);
                }
            }

            return result;
        } else if (req.stock_medis_uuid) {
            const whereClause = {
                uuid: req.stock_medis_uuid,
                faskes_uuid: req.faskes_uuid
            };

            if (req.lokasi_stok_awal_uuid) {
                whereClause.lokasi_stok_uuid = req.lokasi_stok_awal_uuid;
            }

            const stock = await StockMedisModel.findOne({
                where: whereClause,
                include: [
                    {
                        model: ItemMedisJenisStokModel,
                        as: "item_medis_jenis_stok",
                        required: true,
                        attributes: ["uuid", "item_medis_uuid", "jenis_stok_uuid"],
                        include: [
                            {
                                model: ItemMedisModel,
                                as: "item_medis",
                                required: true,
                                attributes: ["name"],
                            }
                        ],
                    }
                ],
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (!stock) {
                throw new BadRequestException(`Stok medis dengan UUID ${req.stock_medis_uuid} tidak ditemukan.`);
            }

            const previousStockValue = stock.sisa_stok;

            if (previousStockValue < req.quantity) {
                throw new BadRequestException(`${stock.item_medis_jenis_stok?.item_medis?.name || "Item"} stok tidak cukup (tersedia: ${previousStockValue})`);
            }

            const newStockValue = previousStockValue - req.quantity;

            const result = await StockMedisModel.update(
                {sisa_stok: newStockValue},
                {
                    where: {uuid: req.stock_medis_uuid},
                    transaction: t
                }
            );

            if (result[0] === 0) {
                throw new BadRequestException(`${stock.item_medis_jenis_stok?.item_medis?.name || "Item"} stok medis tidak diupdate`);
            }

            return { 
                ...stock.get({ plain: true }), 
                previous_stock: previousStockValue 
            };
        }
    }

    static async increaseQuantity(req, t) {
        const startDate = new Date(req.exp_date);
        startDate.setUTCHours(0, 0, 0, 0);
        const endDate = new Date(req.exp_date);
        endDate.setUTCHours(23, 59, 59, 999);
        const existingStock = await StockMedisModel.findOne({
            where: {
                lokasi_stok_uuid: req.lokasi_stok_uuid,
                exp_date: {
                    [Op.between]: [startDate, endDate]
                },
                harga_satuan: req.harga_satuan
            },
            include: [{
                model: ItemMedisJenisStokModel,
                as: "item_medis_jenis_stok",
                required: true,
                where: {
                    item_medis_uuid: req.item_uuid,
                    jenis_stok_uuid: req.jenis_stok_uuid,
                }
            }],
            transaction: t,
            lock: t.LOCK.UPDATE, 
        });
        if (existingStock) {
            const previous_stock = existingStock.sisa_stok;
            const new_stock = previous_stock + req.quantity_to_add;
            // Kolom stok = total yang pernah masuk ke batch ini; ikut bertambah agar sisa_stok <= stok.
            await existingStock.update({ 
                stok: Number(existingStock.stok || 0) + req.quantity_to_add,
                sisa_stok: new_stock 
            }, { transaction: t });
            return { existingStock, previous_stock, new_stock };
        } else {
            const itemJenisStok = await ItemMedisJenisStokModel.findOne({
                where: {
                    item_medis_uuid: req.item_uuid,
                    jenis_stok_uuid: req.jenis_stok_uuid,
                    faskes_uuid: req.faskes_uuid 
                },
                attributes: ["uuid"],
                transaction: t
            });

            if (!itemJenisStok) {
                throw new InternalServerException(`Gagal menemukan relasi ItemMedisJenisStok untuk item ${req.item_uuid}`);
            }

            const newStockBatch = await StockMedisModel.create({
                faskes_uuid: req.faskes_uuid,
                lokasi_stok_uuid: req.lokasi_stok_uuid,
                item_medis_jenis_stok_uuid: itemJenisStok.uuid,
                konversi_uuid: req.konversi_uuid,
                harga_satuan: req.harga_satuan,
                exp_date: req.exp_date,
                stok: req.quantity_to_add, 
                sisa_stok: req.quantity_to_add,
                no_po: req.no_po || null 
            }, { transaction: t });

            return { 
                existingStock: newStockBatch, 
                previous_stock: 0, 
                new_stock: req.quantity_to_add 
            };
        }   
    }

    static async bulkCreate(req, transaction) {
        return await StockMedisModel.bulkCreate(req, {
            transaction
        });
    }

    static async getSome(uuids) {
        const result = await StockMedisModel.findAll({
            where: {
                uuid: uuids
            },
            attributes: {
                exclude: [
                    "deleted_at",
                    "created_at",
                    "updated_at",
                ],
            },
        });

        if (!result) {
            throw new BadRequestException({message: "Data tidak ditemukan"});
        }

        return result;
    }

    static async getAllForPengeluaran(req) {
        const result = await StockMedisModel.findAll({
            where: {
                sisa_stok: {
                    [Op.gt]: 0
                },
                exp_date: {
                    [Op.gt]: new Date(req.tanggal_pengeluaran)
                },
                lokasi_stok_uuid: req.lokasi_stok_uuid,
            },
            attributes: ["uuid", "exp_date", "sisa_stok", "harga_satuan"],
            include: [
                {
                    model: ItemMedisJenisStokModel,
                    as: "item_medis_jenis_stok",
                    required: true,
                    attributes: ["uuid"],
                    include: [
                        {
                            model: JenisStokModel,
                            as: "detail_stok",
                            required: true,
                            attributes: ["name"],
                            where: {
                                uuid: req.jenis_stok_uuid
                            }
                        },
                        {
                            model: ItemMedisModel,
                            as: "item_medis",
                            required: true,
                            attributes: ["name", "uuid"],
                        }
                    ],
                }
            ]
        });

        if (!result) {
            throw new BadRequestException({message: "Data tidak ditemukan"});
        }

        return result;
    }

    static async update(req, transaction) {
        const where = { uuid: req.uuid };
        if (req.faskes_uuid) where.faskes_uuid = req.faskes_uuid;
        const result = await StockMedisModel.update(req, {
            where,
            transaction
        });

        if (result[0] === 0) {
            throw new BadRequestException("Data tidak ditemukan");
        }

        return result;
    }

    static async bulkAdjustStock(itemsToAdjust, faskes_uuid, transaction) {
        if (!itemsToAdjust || itemsToAdjust.length === 0) return;
        const dataToUpsert = itemsToAdjust.map(item => ({
            uuid: item.id_stok, 
            faskes_uuid: faskes_uuid,
            item_medis_jenis_stok_uuid: item.item_medis_jenis_stok_uuid,
            lokasi_stok_uuid: item.lokasi_stok_uuid,
            harga_satuan: item.harga_satuan,
            konversi_uuid: item.konversi_uuid,
            no_po: item.no_po,
            stok: item.stok, 
            sisa_stok: item.stok_fisik, 
            exp_date: item.ed,
        }));
        
        return await StockMedisModel.bulkCreate(dataToUpsert, {
            transaction: transaction,
            updateOnDuplicate: ["sisa_stok", "exp_date", "updated_at"],
            conflictAttributes: ["uuid"] 
        });
    }

    static async getForMutasi(req) {
        return await StockMedisModel.findAll({
            where: {
                lokasi_stok_uuid: req.lokasi_stok_uuids,
            },
            include: [
                {
                    model: ItemMedisJenisStokModel,
                    as: "item_medis_jenis_stok",
                    required: true,
                    attributes: ["uuid", "item_medis_uuid", "jenis_stok_uuid"],
                    where: {
                        item_medis_uuid: req.item_uuids,
                        jenis_stok_uuid: req.jenis_stok_uuids
                    },
                }
            ]
        });
    }

    static async getDetail(req) {
        const where = { uuid: req.uuid };
        // Isolasi faskes bila pemanggil menyertakan faskes_uuid (mis. stok adjustment).
        if (req.faskes_uuid) where.faskes_uuid = req.faskes_uuid;
        return await StockMedisModel.findOne({
            where,
            include: [
                {
                    model: ItemMedisJenisStokModel,
                    as: "item_medis_jenis_stok",
                    required: true,
                    include: [
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
                        },
                        {
                            model: JenisStokModel,
                            as: "detail_stok",
                            required: false,
                            attributes: ["name"],
                        }
                    ]
                }
            ]
        });
    }

    static async getRiwayatTarif(req) {
        const whereClause = {
            faskes_uuid: req.faskes_uuid,
        };

        if (req.jenis_stok_uuid) {
            whereClause.jenis_stok_uuid = req.jenis_stok_uuid;
        }

        const limit = parseInt(req.limit) || 10;
        const page = parseInt(req.page) || 1;
        const offset = (page - 1) * limit;

        const stockWhereClause = {
            sisa_stok: { [Op.gt]: 0 },
        };

        if (req.lokasi_stok_uuid) {
            stockWhereClause.lokasi_stok_uuid = req.lokasi_stok_uuid;
        }

        const option = {
            where: whereClause, 
            attributes: {
                exclude: ["deleted_at", "created_at", "updated_at"],
            },
            include: [
                {
                    model: ItemMedisModel,
                    as: "item_medis",
                    required: true,
                    attributes: ["name", "jenis_item", "uuid"], 
                    where: {
                        [Op.or]: [
                            { name: { [Op.iLike]: `%${req.search ?? ""}%` } },
                            { code: { [Op.iLike]: `%${req.search ?? ""}%` } },
                        ],
                        jenis_item: {
                            [Op.in]: req.jenis_item ? [req.jenis_item] : ["obat", "alkes"],
                        }
                    }
                },
                {
                    model: JenisStokModel,
                    as: "detail_stok",
                    required: false,
                    attributes: ["name"],
                },
                {
                    model: StockMedisModel,
                    as: "stocks",
                    required: true,
                    attributes: ["uuid", "sisa_stok", "exp_date", "harga_satuan", "created_at"],
                    where: stockWhereClause,
                    include: [
                        {
                            model: ConversionModel,
                            as: "konversi",
                            required: false,
                            attributes: {
                                exclude: ["deleted_at", "created_at", "updated_at", "faskes_uuid"],
                            }
                        }
                    ]
                },
            ],
            limit: limit,
            offset: offset,
            distinct: true,
        };

        try {
            const { count, rows } = await ItemMedisJenisStokModel.findAndCountAll(option);

            return {
                data: rows,
                pagination: {
                    total: count,
                    page: page,
                    page_size: limit,
                    total_pages: Math.ceil(count / limit),
                    prev_page: page > 1 ? page - 1 : null,
                    next_page: page < Math.ceil(count / limit) ? page + 1 : null,
                }
            };
        } catch (error) {
            console.error("Error fetching Riwayat Tarif:", error);
            throw new InternalServerException("Gagal mengambil data riwayat tarif.");
        }
    }

    static async getPurchaseHistory(req) {
        return await StockMedisModel.findAll({
            where: {
                item_medis_jenis_stok_uuid: req.item_medis_jenis_stok_uuid,
            },
            attributes: ["exp_date", "harga_satuan", "created_at", "no_po"],
            order: [["created_at", "DESC"]],
        });
    }

    static async findStockByItem(req) {
        // Isolasi faskes: tanpa saringan ini, permintaan tanpa lokasi (atau dengan lokasi faskes lain)
        // menampilkan stok seluruh faskes.
        const whereClause = {
            sisa_stok: { [Op.gt]: 0 },
            faskes_uuid: req.faskes_uuid,
            deleted_at: null,
        };

        if (req.lokasi_stok_uuid) {
            whereClause.lokasi_stok_uuid = req.lokasi_stok_uuid;
        }

        const itemMedisJenisStokWhere = {};

        if (req.item_uuids && req.item_uuids.length > 0) {
            itemMedisJenisStokWhere.item_medis_uuid = { [Op.in]: req.item_uuids };
        }

        if (req.jenis_stok_uuid) {
            itemMedisJenisStokWhere.jenis_stok_uuid = req.jenis_stok_uuid;
        }

        return await StockMedisModel.findAll({
            attributes: [
                [sequelizeInstance.fn("SUM", sequelizeInstance.col("sisa_stok")), "jumlah_tersedia"],
                [sequelizeInstance.fn("AVG", sequelizeInstance.col("harga_satuan")), "harga_satuan"],
                [sequelizeInstance.col("StockMedisModel.uuid"), "stock_uuid"],
                "exp_date"
            ],
            where: whereClause,
            group: [
                "StockMedisModel.uuid",
                "exp_date",
                "lokasi_stok.uuid",
                "item_medis_jenis_stok.uuid",
                "item_medis_jenis_stok->item_medis.uuid",
                "item_medis_jenis_stok->item_medis->satuan_penggunaan.uuid",
                "item_medis_jenis_stok->detail_stok.uuid",
            ],
            include: [
                {
                    model: LokasiStokModel,
                    as: "lokasi_stok",
                    attributes: ["uuid", "name"],
                    required: true
                },
                {
                    model: ItemMedisJenisStokModel,
                    as: "item_medis_jenis_stok",
                    attributes: ["uuid", "item_medis_uuid"],
                    required: true,
                    where: itemMedisJenisStokWhere, 
                    include: [
                        {
                            model: ItemMedisModel,
                            as: "item_medis",
                            attributes: ["uuid", "name"],
                            required: true,
                            include: [{
                                model: SatuanModel,
                                as: "satuan_penggunaan", 
                                attributes: ["uuid", "name"],
                                required: false 
                            }]
                        },
                        {
                            model: JenisStokModel,
                            as: "detail_stok",
                            attributes: ["uuid", "name"],
                            required: true
                        }
                    ]
                }
            ],
            raw: true
        });
    }

    static async findBatchesForAllocation(req, t = null) {
        let remainingQuantity = req.quantity_needed;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let allocatedBatches = []; 

        const itemExist = await ItemMedisModel.findOne({
            where: { uuid: req.item_medis_uuid }
        });

        if (!itemExist) {
            throw new NotfoundException(`Item dengan UUID ${req.item_medis_uuid} tidak ditemukan di database.`);
        }

        let order = [];
        if (req.metode_pemotongan_stok === "FEFO") {
            order.push(["exp_date", "ASC"]);
        } else if (req.metode_pemotongan_stok === "FIFO") {
            order.push(["created_at", "ASC"]);
        } else {
            order.push(["created_at", "DESC"]); 
        }

        // Ambil semua batch yang memenuhi (lokasi, faskes, item, jenis stok) sekali saja, urut sesuai metode
        // pemotongan, lalu bagi kebutuhan ke batch berurutan. Sebelumnya findOne di dalam loop selalu
        // mengembalikan batch pertama yang sama (pengurangan hanya di memori) sehingga kebutuhan yang
        // melebihi satu batch dialokasikan berulang ke batch itu dan gagal saat dikirim; jenis stok juga
        // tidak ikut disaring.
        const itemJenisStokWhere = { item_medis_uuid: req.item_medis_uuid };
        if (req.jenis_stok_uuid) {
            itemJenisStokWhere.jenis_stok_uuid = req.jenis_stok_uuid;
        }

        const allStocks = await StockMedisModel.findAll({
            where: {
                sisa_stok: { [Op.gt]: 0 },
                exp_date: { [Op.gte]: today }, 
                lokasi_stok_uuid: req.lokasi_stok_uuid,
                faskes_uuid: req.faskes_uuid, 
                deleted_at: null,
            },
            include: [
                {
                    model: ItemMedisJenisStokModel,
                    as: "item_medis_jenis_stok",
                    required: true,
                    attributes: [],
                    where: itemJenisStokWhere,
                }
            ],
            order: [...order, ["id", "ASC"]],
            transaction: t, 
        });

        const totalStockResult = allStocks.reduce((acc, stock) => acc + Number(stock.sisa_stok), 0);

        if (totalStockResult < req.quantity_needed) {
            throw new BadRequestException(`Stok ${itemExist.name || "item"} tidak cukup (butuh: ${req.quantity_needed}, tersedia: ${totalStockResult})`);
        }

        for (const stockBatch of allStocks) {
            if (remainingQuantity <= 0) break;
            const quantityFromThisBatch = Math.min(Number(stockBatch.sisa_stok), remainingQuantity);
            allocatedBatches.push({
                stock_medis_uuid: stockBatch.uuid,
                quantity: quantityFromThisBatch,
            });
            remainingQuantity -= quantityFromThisBatch;
        }

        return allocatedBatches;
    }
}