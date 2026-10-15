import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";

export default class StokAdjustmentModel extends Model{
}

StokAdjustmentModel.init(
    {
        ...identifierModel,
        stok_medis_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        no_adjustment: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        stok: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        exp_date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "stok_adjustment",
        className: "stokAdjustment",
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