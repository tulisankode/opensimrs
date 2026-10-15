import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import {ReturItemModel} from "../../exports/farmasi-exports.js";

export default class ReturModel extends Model {
}

ReturModel.init({
        ...identifierModel,
        jenis_retur: {
            type: DataTypes.ENUM('obat', 'alkes'),
            allowNull: false,
        },
        no_resep: {
            type: DataTypes.STRING(255),
        },
        no_order_alkes: {
            type: DataTypes.STRING(255),
        },
        no_reg: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        rekam_medis_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        patient_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        no_rm: {
            type: DataTypes.STRING(150),
            allowNull: false,
        },
        order_date: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        total: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        lokasi_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        alasan_retur: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        petugas_retur: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        ...fieldTime
    }, {
        sequelize: sequelizeInstance,
        tableName: "retur",
        className: "Retur",
        underscored: true,
        timestamps: false,
        hooks: hookModel,
        indexes: [
            {
                fields: ['faskes_uuid'],
            },
        ],
    }
)

ReturModel.hasMany(ReturItemModel, {
    foreignKey: "retur_uuid",
    as: "items",
    constraints: false
})