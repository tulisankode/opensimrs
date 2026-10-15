import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class LokasiStokModel extends Model {}

LokasiStokModel.init(
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
    jenis_lokasi: {
      type: DataTypes.ENUM("gudang", "depo"),
      allowNull: false,
    },
    default_tujuan_order_permintaan: {
      type: DataTypes.STRING(10),
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "lokasi_stok",
    className: "LokasiStok",
    underscored: true,
    timestamps: false,
    hooks: hookModel,
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
