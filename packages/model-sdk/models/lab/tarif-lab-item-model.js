import { DataTypes, Model } from "sequelize";
import identifierModel from "../farmasi/common/identifier-model.js";
import fieldTime from "../farmasi/base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class TarifLabItemModel extends Model {}

TarifLabItemModel.init({
    ...identifierModel,
    tarif_lab_uuid: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    item_pemeriksaan_uuid:{
        type: DataTypes.STRING(255),
        allowNull: true
    },
    kelompok_pemeriksaan_uuid:{
        type: DataTypes.STRING(255),
        allowNull: true
    },
    total_tarif: {
        type: DataTypes.DOUBLE,
        allowNull: false,
    },
   ...fieldTime
},
{
    sequelize: sequelizeInstance,
    tableName: "tarif_lab_item",
    className: "TarifLabItem",
    underscored: true,
    timestamps: false,
    indexes: [
        {
            fields: ["tarif_lab_uuid"],
        },
    ]
})