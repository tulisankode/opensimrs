import { DataTypes, Model } from "sequelize";
import identifierModel from "../farmasi/common/identifier-model.js";
import fieldTime from "../farmasi/base-model.js";
import { hookModel } from "../pelayanan/common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class CategoryPemeriksaanModel extends Model {}

CategoryPemeriksaanModel.init(
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
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    no_urut: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "category_pemeriksaan",
    className: "CategoryPemeriksaan",
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
        fields: ["code", "faskes_uuid", "deleted_at"],
      },
    },
  }
);
