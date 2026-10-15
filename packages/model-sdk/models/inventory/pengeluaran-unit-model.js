import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";
import JenisStokModel from "../farmasi/jenis-stok-model.js";
import LokasiStokModel from "../farmasi/lokasi-stok-model.js";
import PengeluaranUnitItemModel from "./pengeluaran-unit-item-model.js";

export default class PengeluaranUnitModel extends Model{
}

PengeluaranUnitModel.init(
    {
        ...identifierModel,
        no_pengeluaran: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jenis_pengeluaran: {
            type: DataTypes.ENUM('pemakaian unit', 'pengeluaran tanpa permintaan', 'pemusnahan barang'),
            allowNull: false,
        },
        tanggal_pengeluaran: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        kategori_item: {
            type: DataTypes.ENUM('medis', 'non-medis'),
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
            allowNull: true,
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
        petugas_pengeluaran: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        petugas_pengeluaran_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jenis_pemusnahan: {
            type: DataTypes.ENUM('rusak', 'kadaluarsa'),
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "pengeluaran_unit",
        className: "pengeluaranUnit",
        hooks: hookModel,
        underscored: true,
        timestamps: false,
        indexes: [
            {
                fields: ['faskes_uuid'],
            },
        ],
        uniqueKeys: {
            uniq_scores: {
                fields: ['no_pengeluaran', 'faskes_uuid']
            }
        }
    }
)

PengeluaranUnitModel.belongsTo(JenisStokModel, {
    foreignKey: "jenis_stok_uuid",
    as: "jenis_stok",
    constraints: false
})

PengeluaranUnitModel.belongsTo(LokasiStokModel, {
    foreignKey: "lokasi_stok_tujuan_uuid",
    as: "lokasi_stok_akhir",
    constraints: false
})

PengeluaranUnitModel.hasMany(PengeluaranUnitItemModel, {
    foreignKey: "pengeluaran_unit_uuid",
    as: "items",
    constraints: false
})