import { DataTypes, Model } from "sequelize";
import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class TarifLabModel extends Model {}

TarifLabModel.init(
  {
    ...identifierModel,
    code: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    grand_total: {
      type: DataTypes.DOUBLE,
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
    tableName: "tarif_lab",
    className: "TarifLab",
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ["faskes_uuid"],
      },
    ],
    uniqueKeys: {
      uniq_scores: {
        fields: ["code", "faskes_uuid", "deleted_at"],
      },
    },
  }
);
