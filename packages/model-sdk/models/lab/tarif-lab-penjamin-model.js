import { DataTypes, Model } from "sequelize";
import identifierModel from "../farmasi/common/identifier-model.js";
import fieldTime from "../farmasi/base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class TarifLabPenjaminModel extends Model{}

TarifLabPenjaminModel.init({
    ...identifierModel,
    penjamin_uuid : {
        type : DataTypes.STRING(255),
        allowNull: false
    },
    tarif_lab_uuid : {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    ...fieldTime
}, {
    sequelize: sequelizeInstance,
    tableName: "tarif_lab_penjamin",
    className: "TarifLabPenjamin",
    underscored: true,
    timestamps: false,
    indexes: [
        {
            fields: ["tarif_lab_uuid"],
        },
    ],
})