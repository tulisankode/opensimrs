import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class CaraiPakaiModel extends Model {}
CaraiPakaiModel.init(
  {
    ...identifierModel,
    code: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    cara_pakai: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "carai_pakai",
    className: "CaraiPakai",
    hooks: hookModel,
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ["faskes_uuid"],
      },
    ],
    uniqueKeys: {
      uniq_scores: {
        fields: ["code", "faskes_uuid"],
      },
    },
  }
);
