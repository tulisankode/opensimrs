import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";

// Snapshot penawaran yang menjadi dasar permintaan marketplace (STD-0019). Harga, stok & estimasi kirim adalah
// informasi penawaran saat diambil (bisa berubah sebelum checkout), bukan jaminan dari mitra.
export default class MarketplacePesananItemModel extends Model {
}

MarketplacePesananItemModel.init(
    {
        ...identifierModel,
        pesanan_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        produk_mitra_id: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        nama_produk_mitra: {
            type: DataTypes.STRING(255),
        },
        item_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        satuan_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        konversi_uuid: {
            type: DataTypes.STRING(255),
        },
        konversi: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 1,
        },
        jumlah: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        harga_satuan: {
            type: DataTypes.DOUBLE,
            allowNull: false,
        },
        total_harga: {
            type: DataTypes.DOUBLE,
            allowNull: false,
        },
        stok_penawaran: {
            type: DataTypes.INTEGER,
        },
        estimasi_kirim: {
            type: DataTypes.STRING(100),
        },
        penawaran_diambil_pada: {
            type: DataTypes.BIGINT,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "inventory_marketplace_pesanan_item",
        className: "marketplacePesananItem",
        hooks: hookModel,
        underscored: true,
        timestamps: false,
        indexes: [
            {
                fields: ["faskes_uuid"],
            },
        ],
    }
)
