import { DataTypes, Model } from "sequelize";
import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class KelompokPemeriksaanModel extends Model {}

KelompokPemeriksaanModel.init(
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
    category_pemeriksaan_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    snomedct_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    icd9_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    loinc_uuid: {
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
    tableName: "kelompok_pemeriksaan",
    className: "KelompokPemeriksaan",
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

// KelompokPemeriksaanModel.hasMany(ItemKelompokPemeriksaanModel, {
//     foreignKey: "kelompok_pemeriksaan_uuid",
//     as: "item_kelompok_pemeriksaan",
//     constraints: false,
// })

// KelompokPemeriksaanModel.belongsToMany(ItemPemeriksaanModel, {
//     through: ItemKelompokPemeriksaanModel,
//     foreignKey: "kelompok_pemeriksaan_uuid",
//     otherKey: "item_pemeriksaan_uuid",
//     as: "item_pemeriksaan",
//     timestamps: false,
//     constraints: false,
// })
