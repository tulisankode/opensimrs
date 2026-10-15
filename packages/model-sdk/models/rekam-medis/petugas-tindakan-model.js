import { DataTypes, Model } from "sequelize";
import fieldTime from "./common/base-model.js";
import identifierModel from "./common/identifier-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class PetugasTindakanModel extends Model {}
PetugasTindakanModel.init(
  {
    ...identifierModel,
    historyTindakanUuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    practitionerUuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "petugas_tindakan",
    className: "PetugasTindakans",
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ["faskes_uuid"],
      },
    ],
  }
);
