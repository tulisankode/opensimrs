import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";
import JenisStokModel from "../farmasi/jenis-stok-model.js";
import ItemMedisModel from "../farmasi/item-medis-model.js";

export default class RiwatatMutasiModel extends Model{
}

RiwatatMutasiModel.init(
    {
        ...identifierModel,
        item_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        code: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        exp_date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        lokasi_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jenis_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        keterangan: {
            type: DataTypes.JSON,
            allowNull: false,
        },
        petugas: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        stok_awal: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        stok_mutasi: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        sumber_mutasi : {
            type: DataTypes.ENUM('pelayanan', 'inventory'),
            allowNull: false,
        },
        type : {
            type: DataTypes.ENUM('surplus', 'defisit'),
            allowNull: false,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "riwayat_mutasi",
        className: "riwayatMutasi",
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

RiwatatMutasiModel.belongsTo(ItemMedisModel, {
    foreignKey: "item_uuid",
    as: "detail_item",
    constraints: false
});

RiwatatMutasiModel.belongsTo(JenisStokModel, {
    foreignKey: "jenis_stok_uuid",
    as: "jenis_stok",
    constraints: false
});