import fieldTime from "../farmasi/base-model.js";
import { DataTypes, Model } from "sequelize";
import identifierModel from "../farmasi/common/identifier-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class TarifKomponenTindakanLab extends Model {}

TarifKomponenTindakanLab.init(
   {
    ...identifierModel,
    tarif_lab_uuid : {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    tarif_lab_item_uuid : {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    tarif_komponen_uuid : {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    tarif_per_komponen : {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    prosentase_per_komponen : {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    ...fieldTime,
   },
   {
         sequelize: sequelizeInstance,
         tableName: "tarif_komponen_tindakan_lab",
         className: "TarifKomponenTindakanLab",
         underscored: true,
         timestamps: false,
         indexes: [
              {
                fields: ["tarif_lab_uuid"],
              },
              {
                fields: ["tarif_lab_item_uuid"],
              },
              {
                fields: ["tarif_komponen_uuid"],
              },
         ] 
   }
)