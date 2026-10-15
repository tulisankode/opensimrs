import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import LokasiStokModel from "./lokasi-stok-model.js";
import ItemPenjualanObatModel from "./item-penjualan-obat-model.js";

export default class PenjualanObatModel extends Model {
}

PenjualanObatModel.init({
        ...identifierModel,
        no_transaksi: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        tanggal_pembelian: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        lokasi_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        dokter_pemberi_resep: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        nama_pembeli: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        no_hp: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        catatan: {
            type: DataTypes.STRING(255),
        },
        total_harga: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        total_item: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('cancel', 'lunas', 'belum_lunas'),
            allowNull: false,
        },
        alasan_batal: {
            type: DataTypes.STRING(255),
        },
        ...fieldTime
    }, {
        hooks: hookModel,
        sequelize: sequelizeInstance,
        tableName: "penjualan_obat",
        className: "PenjualanObat",
        underscored: true,
        timestamps: false,
        indexes: [
            {
                fields: ['faskes_uuid'],
            },
        ],
        uniqueKeys: {
            uniq_scores: {
                fields: ['no_transaksi', 'faskes_uuid']
            }
        }
    }
)

PenjualanObatModel.belongsTo(LokasiStokModel, {
    foreignKey: 'lokasi_stok_uuid',
    as: 'lokasi_stok',
    constraints: false
});

PenjualanObatModel.hasMany(ItemPenjualanObatModel, {
    foreignKey: 'penjualan_obat_uuid',
    as: 'items'
});