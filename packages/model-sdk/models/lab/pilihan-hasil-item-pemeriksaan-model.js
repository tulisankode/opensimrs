import { DataTypes, Model } from "sequelize";
import identifierModel from "../farmasi/common/identifier-model.js";
import fieldTime from "../farmasi/base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class PilihanHasilItemPemeriksaanModel extends Model{}

PilihanHasilItemPemeriksaanModel.init({
    ...identifierModel,
    item_pemeriksaan_uuid: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    pilihan_hasil :{
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false
    },
    ...fieldTime
},{
    sequelize: sequelizeInstance,
    tableName: "pilihan_hasil_item_pemeriksaan",
    className: "PilihanHasilItemPemeriksaan",
    underscored: true,
    timestamps: false,
    indexes: [
        {
            fields: ["item_pemeriksaan_uuid"],
        },
    ],
})