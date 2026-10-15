import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class AturanPakaiModel extends Model {}
AturanPakaiModel.init(
  {
    ...identifierModel,
    code: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    periode_unit: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    periode: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    frekuensi: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    name: {
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
    tableName: "aturan_pakai",
    className: "AturanPakai",
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
