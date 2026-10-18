import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";

// Konfigurasi koneksi marketplace mitra per faskes (STD-0019). Kunci API & kunci masuk webhook disimpan
// terenkripsi oleh inventory-service/src/helpers/rahasia-marketplace.js; kolom ini hanya menyimpan ciphertext.
export default class MarketplaceKoneksiModel extends Model {
}

MarketplaceKoneksiModel.init(
    {
        ...identifierModel,
        mitra_kode: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        nama_mitra: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        base_url: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        akun_afiliasi: {
            type: DataTypes.STRING(255),
        },
        supplier_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        api_key_enc: {
            type: DataTypes.TEXT,
        },
        kunci_masuk_enc: {
            type: DataTypes.TEXT,
        },
        mode_mock: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        aktif: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "inventory_marketplace_koneksi",
        className: "marketplaceKoneksi",
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
