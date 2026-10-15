import {DataTypes, Model} from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import {hookModel} from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class HargaItemModel extends Model {
}

HargaItemModel.init({
        ...identifierModel,
        item_medis_jenis_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        harga_terakhir: {
            type: DataTypes.FLOAT,
        },
        harga_avg: {
            type: DataTypes.FLOAT,
        },
        hna: {
            type: DataTypes.FLOAT,
        },
        harga_dasar: {
            type: DataTypes.FLOAT,
        },
        ...fieldTime
    }, {
        sequelize: sequelizeInstance,
        tableName: "harga_item",
        className: "HargaItem",
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