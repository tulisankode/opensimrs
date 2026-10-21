import { Op } from "sequelize";
import {
    ItemMedisModel, JenisStokModel, OrderAlkesItemModel, OrderAlkesModel, PrescriptionItemModel, PrescriptionModel,
    ReturItemModel, ReturModel,
    SatuanModel
} from "@opensimrs/model-sdk/farmasi";

export default class ReturRepository {
    static async create(req, transaction) {
        return await ReturModel.create(req, {transaction});
    }

    static async createItem(req, transaction) {
        return await ReturItemModel.create(req, {transaction});
    }

    static async getObatDetail(req){
        return await PrescriptionItemModel.findAll({
            where : {
                prescription_uuid : req.prescription_uuid,
                is_compound : false,
                ...(req.faskes_uuid ? { faskes_uuid : req.faskes_uuid } : {})
            },
            attributes : [
                "medication_qty",
                "sisa_qty_order",
                "harga_satuan",
                "stok_medis_uuides",
                "uuid"
            ],
            include : [{
                model : ItemMedisModel,
                as : 'item_medis',
                required: false,
                attributes : ['name', 'uuid'],
                include : [
                    {
                        model : SatuanModel,
                        as : 'satuan_penggunaan',
                        required: false,
                        attributes : ['name']
                    }
                ]
            },{
                model : JenisStokModel,
                as : 'jenis_stok',
                required: false,
                attributes : ['name', 'uuid']
            }]
        })
    }

    static async getAlkesDetail(req){
        return await OrderAlkesItemModel.findAll({
            where : {
                order_alkes_uuid : req.order_alkes_uuid,
                ...(req.faskes_uuid ? { faskes_uuid : req.faskes_uuid } : {})
            },
            attributes : ["qty", "stok_medis_uuides", "harga_satuan", "uuid"],
            include : [{
                model : JenisStokModel,
                as : 'jenis_stok',
                required: false,
                attributes : ['name', 'uuid']
            },{
                model : ItemMedisModel,
                as : 'item_medis',
                required: false,
                attributes : ['name', 'uuid'],
                include : [
                    {
                        model : SatuanModel,
                        as : 'satuan_penggunaan',
                        required: false,
                        attributes : ['name']
                    }
                ]
            }
            ]
        })
    }

    // Order asal retur milik faskes token, dikunci selama transaksi retur.
    static async getResep(uuid, faskesUuid, transaction){
        return await PrescriptionModel.findOne({ where : { uuid, faskes_uuid : faskesUuid }, transaction, lock : transaction.LOCK.UPDATE });
    }

    static async getOrderAlkes(uuid, faskesUuid, transaction){
        return await OrderAlkesModel.findOne({ where : { uuid, faskes_uuid : faskesUuid }, transaction, lock : transaction.LOCK.UPDATE });
    }

    static async getResepItem(uuid, prescriptionUuid, transaction){
        return await PrescriptionItemModel.findOne({
            where : { uuid, prescription_uuid : prescriptionUuid },
            include : [{ model : ItemMedisModel, as : 'item_medis', required : false, attributes : ['name'] }],
            transaction
        });
    }

    static async getOrderAlkesItem(uuid, orderAlkesUuid, transaction){
        return await OrderAlkesItemModel.findOne({
            where : { uuid, order_alkes_uuid : orderAlkesUuid },
            include : [{ model : ItemMedisModel, as : 'item_medis', required : false, attributes : ['name'] }],
            transaction
        });
    }

    // Jumlah yang sudah pernah diretur per item order (kolom: prescription_item_uuid / order_alkes_item_uuid).
    static async getQtyDiretur(kolom, itemUuids, transaction){
        if (!itemUuids.length) return {};
        const rows = await ReturItemModel.findAll({
            where : { [kolom] : { [Op.in] : itemUuids }, deleted_at : { [Op.is] : null } },
            attributes : [kolom, 'qty_retur'],
            transaction
        });
        return rows.reduce((acc, r) => ({ ...acc, [r[kolom]] : (acc[r[kolom]] ?? 0) + Number(r.qty_retur || 0) }), {});
    }

    static async editResep(uuid, data, transaction){
        return await PrescriptionModel.update(data, { where : { uuid }, transaction });
    }

    static async editOrderAlkes(uuid, data, transaction){
        return await OrderAlkesModel.update(data, { where : { uuid }, transaction });
    }

    static async getObatOne(req){
        return await ReturModel.findOne({
            where : req,
            attributes : [
                "no_resep",
                "no_order_alkes",
                "total",
                "alasan_retur",
            ],
            include : [
                {
                    model : ReturItemModel,
                    as : 'items',
                    required : false,
                    attributes : ['qty_retur', 'expired_date', 'harga_satuan'],
                    include : [
                        {
                            model : PrescriptionItemModel,
                            as: "detail_prescription_item",
                            required: false,
                            attributes : ['medication_qty', 'sisa_qty_order'],
                            include : [
                                {
                                    model : JenisStokModel,
                                    as : 'jenis_stok',
                                    required: false,
                                    attributes : ['name'],
                                },
                                {
                                    model : ItemMedisModel,
                                    as : 'item_medis',
                                    required: false,
                                    attributes : ['name'],
                                }
                            ]
                        },
                    ]
                }
            ]
        })
    }

    static async getAlkesOne(req){
        return await ReturModel.findOne({
            where : req,
            attributes : [
                "no_resep",
                "no_order_alkes",
                "total",
                "alasan_retur",
            ],
            include : [
                {
                    model : ReturItemModel,
                    as : 'items',
                    required : false,
                    attributes : ['qty_retur', 'expired_date', 'harga_satuan'],
                    include : [
                        {
                            model : OrderAlkesItemModel,
                            as: "detail_order_alkes_item",
                            required: false,
                            attributes : ['qty'],
                            include : [
                                {
                                    model : JenisStokModel,
                                    as : 'jenis_stok',
                                    required: false,
                                    attributes : ['name'],
                                },
                                {
                                    model : ItemMedisModel,
                                    as : 'item_medis',
                                    required: false,
                                    attributes : ['name'],
                                }
                            ]
                        },
                    ]
                }
            ]
        })
    }
}