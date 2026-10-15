import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class ConversionModel extends Model {}
ConversionModel.init(
  {
    ...identifierModel,
    item_medis_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    satuan_pembelian_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    satuan_pembelian: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    satuan_penggunaan_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    satuan_penggunaan: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    konversi: {
      type: DataTypes.INTEGER,
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
    tableName: "conversions",
    className: "Conversion",
    hooks: hookModel,
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ["faskes_uuid"],
      },
    ],
  }
);
