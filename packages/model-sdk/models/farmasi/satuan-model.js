import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class SatuanModel extends Model {
}

SatuanModel.init({
        ...identifierModel,
        code: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        status: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
        satuan_dosis: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        editable: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        ...fieldTime
    }, {
        sequelize: sequelizeInstance,
        tableName: "satuan",
        className: "Satuan",
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