import {
    ItemMedisModel, JenisStokModel, OrderAlkesItemModel, PrescriptionItemModel,
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
                is_compound : false
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