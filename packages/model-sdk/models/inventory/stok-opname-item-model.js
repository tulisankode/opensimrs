import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";

export default class StokOpnameItemModel extends Model{
}

StokOpnameItemModel.init(
    {
        ...identifierModel,
        stok_opname_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        stok_fisik: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        kode_item: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        nama: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        kategori: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jenis_item: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jenis_stok: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        satuan: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        stok_awal: {
            type: DataTypes.INTEGER,
        },
        stok_masuk: {
            type: DataTypes.INTEGER,
        },
        stok_keluar: {
            type: DataTypes.INTEGER,
        },
        stok_sistem: {
            type: DataTypes.INTEGER,
        },
        ed: {
            type: DataTypes.DATE,
        },
        harga_dasar: {
            type: DataTypes.FLOAT,
        },
        harga_akhir: {
            type: DataTypes.FLOAT,
        },
        id_stok: {
            type: DataTypes.STRING(255),
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "stok_opname_item",
        className: "stokOpnameItem",
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