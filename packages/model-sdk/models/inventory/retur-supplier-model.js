import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";
import MasterSupplierModel from "../inventory/master-supplier-model.js";
import LokasiStokModel from "../farmasi/lokasi-stok-model.js";
import PembelianBarangSupplierModel from "./pembelian-barang-supplier-model.js";
import ReturSupplierItemModel from "./retur-supplier-item-model.js";

export default class ReturSupplierModel extends Model{
}

ReturSupplierModel.init(
    {
        ...identifierModel,
        no_retur_supplier: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        tanggal_retur: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        alasan_retur: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        lokasi_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        catatan: {
            type: DataTypes.STRING(255),
        },
        pembelian_supplier_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('retur', 'terima'),
            allowNull: false,
        },
        diskon: {
            type: DataTypes.FLOAT,
        },
        materai: {
            type: DataTypes.FLOAT,
        },
        ppn: {
            type: DataTypes.FLOAT,
        },
        petugas_retur: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        petugas_retur_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jenis_penggantian: {
            type: DataTypes.ENUM('barang', 'uang'),
        },
        tanggal_penggantian: {
            type: DataTypes.BIGINT,
        },
        total_pengembalian_uang: {
            type: DataTypes.DOUBLE,
        },
        petugas_penerima_retur: {
            type: DataTypes.STRING(255),
        },
        petugas_penerima_retur_uuid: {
            type: DataTypes.STRING(255),
        },
        supplier_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "retur_supplier",
        className: "returSupplier",
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
                fields: ["pembelian_supplier_uuid", "faskes_uuid"],
            },
        },
    }
)

ReturSupplierModel.belongsTo(
    MasterSupplierModel,
    {
        foreignKey: "supplier_uuid",
        as: "spplr",
        constraints: false,
    }
)

ReturSupplierModel.belongsTo(
    LokasiStokModel,
    {
        foreignKey: "lokasi_stok_uuid",
        as: "lokasi_stok",
        constraints: false,
    }
)

ReturSupplierModel.belongsTo(
    PembelianBarangSupplierModel,
    {
        foreignKey: "pembelian_supplier_uuid",
        as: "pembelian_barang_supplier",
        constraints: false,
    }
)

PembelianBarangSupplierModel.hasOne(
    ReturSupplierModel,
    {
        foreignKey: "pembelian_supplier_uuid",
        as: "retur_supplier",
        constraints: false,
    }
)

ReturSupplierModel.hasMany(
    ReturSupplierItemModel,
    {
        foreignKey: "retur_supplier_uuid",
        as: "items",
        constraints: false,
    }
)