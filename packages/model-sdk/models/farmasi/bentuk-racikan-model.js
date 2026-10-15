import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class BentukRacikanModel extends Model {
}

BentukRacikanModel.init({
        ...identifierModel,
        nama_bentuk_racikan: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jumlah: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        tarif_embalase: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        tarif_racik: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        ...fieldTime
    }, {
        sequelize: sequelizeInstance,
        tableName: "bentuk_racikan",
        className: "BentukRacikan",
        underscored: true,
        timestamps: false,
        hooks: hookModel,
        indexes: [
            {
                fields: ['faskes_uuid'],
            },
        ],
        uniqueKeys: {
            uniq_scores: {
                fields: ['faskes_uuid', 'nama_bentuk_racikan']
            }
        }
    }
)