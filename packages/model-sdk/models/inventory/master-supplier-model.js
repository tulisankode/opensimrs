import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";

export default class MasterSupplierModel extends Model{
}

MasterSupplierModel.init(
    {
        ...identifierModel,
        code: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        no_tlp: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        status: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
        kecamatan_code: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        provinsi_code: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        kabupaten_code: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        kelurahan_code: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        alamat: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "master_supplier",
        className: "masterSupplier",
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
                fields: ['code', 'faskes_uuid']
            }
        }
    }
)