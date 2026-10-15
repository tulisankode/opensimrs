import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import ItemMedisModel from "./item-medis-model.js";

export default class PrescriptionItemRacikanModel extends Model {
}

PrescriptionItemRacikanModel.init({
        ...identifierModel,
        prescription_item_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        item_medis_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        medication_qty: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        jenis_stok_uuid: {
            type: DataTypes.STRING(255),
        },
        harga_satuan: {
            type: DataTypes.FLOAT,
        },
        ...fieldTime
    }, {
        sequelize: sequelizeInstance,
        tableName: "prescription_item_racikans",
        className: "PrescriptionItemRacikan",
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

PrescriptionItemRacikanModel.belongsTo(ItemMedisModel, {
    foreignKey: "item_medis_uuid",
    as: "item_medis",
    constraints: false
})