import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";
import LokasiStokModel from "../farmasi/lokasi-stok-model.js";
import PermintaanUnitItemModel from "./permintaan-unit-item-model.js";

export default class PermintaanUnitModel extends Model{
}

PermintaanUnitModel.init(
    {
        ...identifierModel,
        no_permintaan: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        tanggal_permintaan: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        kategori_item: {
            type: DataTypes.ENUM('medis', 'non-medis'),
            allowNull: false,
        },
        jenis_stok: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jenis_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jenis_item: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        lokasi_stok_awal_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        lokasi_stok_tujuan_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        catatan: {
            type: DataTypes.STRING(255),
        },
        cito: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
        total_item: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        total_harga: {
            type: DataTypes.FLOAT,
        },
        petugas_permintaan: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        petugas_permintaan_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('request', 'request_sebagian', 'verified', 'verif_sebagian', 'dikirim', 'cancel'),
            allowNull: false,
        },
        alasan_batal: {
            type: DataTypes.STRING(255),
        },
        catatan_verifikasi: {
            type: DataTypes.STRING(255),
        },
        catatan_pengiriman: {
            type: DataTypes.STRING(255),
        },
        alasan_batal_tolak: {
            type: DataTypes.STRING(255),
        },
        petugas_verifikasi: {
            type: DataTypes.STRING(255),
        },
        petugas_verifikasi_uuid: {
            type: DataTypes.STRING(255),
        },
        petugas_kirim: {
            type: DataTypes.STRING(255),
        },
        petugas_kirim_uuid: {
            type: DataTypes.STRING(255),
        },
        petugas_batal_tolak: {
            type: DataTypes.STRING(255),
        },
        petugas_batal_tolak_uuid: {
            type: DataTypes.STRING(255),
        },
        medical_stocks : {
            type: DataTypes.JSON,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "permintaan_unit",
        className:
            "permintaanUnit",
        hooks: hookModel,
        underscored: true,
        timestamps: false,
        indexes: [
            {
                fields: ['faskes_uuid'],
            },
        ],
    }
)

PermintaanUnitModel.belongsTo(LokasiStokModel, {
    foreignKey: 'lokasi_stok_tujuan_uuid',
    as: 'lokasi_stok_tujuan',
    constraints: false
})

PermintaanUnitModel.hasMany(PermintaanUnitItemModel, {
    foreignKey: 'permintaan_unit_uuid',
    as: 'items',
    constraints: false
})