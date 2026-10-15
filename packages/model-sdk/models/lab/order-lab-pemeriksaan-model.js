import { DataTypes, Model } from "sequelize";

import identifierModel from "../farmasi/common/identifier-model.js";
import fieldTime from "../farmasi/base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class OrderLabPemeriksaanModel extends Model{}

OrderLabPemeriksaanModel.init({
    ...identifierModel,
    order_lab_uuid: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    tarif_lab_uuid: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    ...fieldTime,
},{
    sequelize: sequelizeInstance,
    tableName: "order_lab_pemeriksaan",
    className: "OrderLabPemeriksaan",
    underscored: true,
    timestamps: false,
    indexes: [
        {
            fields: ["order_lab_uuid"],
        },
        {
            fields: ["tarif_lab_uuid"],
        },
    ],
})