import { DataTypes, Model } from "sequelize";
import identifierModel from "../farmasi/common/identifier-model.js";
import fieldTime from "../farmasi/base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class TarifLabPelayananModel extends Model {}
TarifLabPelayananModel.init({
    ...identifierModel,
    tarif_lab_uuid: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    pelayanan :{
        type: DataTypes.ENUM(["igd", "rajal", "ranap","aps"]),
        allowNull: false
    },
    ...fieldTime
}, {
    sequelize: sequelizeInstance,
    tableName: "tarif_lab_pelayanan",
    className: "TarifLabPelayanan",
    underscored: true,
    timestamps: false,
    indexes: [
        {
            fields: ["tarif_lab_uuid"],
        },
    ],
})