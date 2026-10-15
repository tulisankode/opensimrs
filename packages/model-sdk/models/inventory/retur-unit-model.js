import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";
import LokasiStokModel from "../farmasi/lokasi-stok-model.js";
import ReturUnitItemModel from "./retur-unit-item-model.js";

export default class ReturUnitModel extends Model{
}

ReturUnitModel.init(
    {
        ...identifierModel,
        no_retur: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        tanggal_retur: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        jenis_stok: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        kategori_item: {
            type: DataTypes.ENUM('medis', 'non-medis'),
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
        total_item: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        total_harga: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        petugas_retur: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        petugas_retur_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        alasan_retur : {
            type: DataTypes.ENUM('rusak', 'kadaluarsa', 'salah', 'sisa'),
            allowNull: false,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "retur_unit",
        className: "returUnit",
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

ReturUnitModel.belongsTo(LokasiStokModel, {
    foreignKey: 'lokasi_stok_awal_uuid',
    as: 'lokasi_stok_awal',
    constraints: false
})

ReturUnitModel.belongsTo(LokasiStokModel, {
    foreignKey: 'lokasi_stok_tujuan_uuid',
    as: 'lokasi_stok_tujuan',
    constraints: false
})

ReturUnitModel.hasMany(ReturUnitItemModel, {
    foreignKey: 'retur_unit_uuid',
    as: 'items',
    constraints: false
})