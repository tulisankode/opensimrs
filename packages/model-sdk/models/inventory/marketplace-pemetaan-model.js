import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";

// Pemetaan produk marketplace mitra ke master barang gudang (item_uuid) & satuan pembelian (STD-0019).
// Konversi/kesetaraan kemasan divalidasi lewat farmasi-service (lihat FarmasiExternalRepository.getConversionByItem)
// setiap kali dipakai, kolom konversi di sini hanya cache tampilan.
export default class MarketplacePemetaanModel extends Model {
}

MarketplacePemetaanModel.init(
    {
        ...identifierModel,
        mitra_kode: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        produk_mitra_id: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        nama_produk_mitra: {
            type: DataTypes.STRING(255),
        },
        kemasan_mitra: {
            type: DataTypes.STRING(100),
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
        },
        aktif: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "inventory_marketplace_pemetaan",
        className: "marketplacePemetaan",
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
