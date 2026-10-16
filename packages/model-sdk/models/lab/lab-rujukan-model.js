import { DataTypes, Model } from "sequelize";
import identifierModel from "../farmasi/common/identifier-model.js";
import fieldTime from "../farmasi/base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class LabRujukanModel extends Model {}

LabRujukanModel.init(
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
    alamat: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    telepon: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    kontak_person: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "lab_rujukan_faskes",
    className: "LabRujukan",
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
