import { DataTypes, Model } from "sequelize";
import Kabupaten from "./kabupaten-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class KecamatanModel extends Model {}
KecamatanModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      unique: true,
      allowNull: false,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
    },
    kabupaten_code: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    tableName: "kecamatan",
    underscored: true,
    timestamps: false,
    sequelize: sequelizeInstance,
  }
);
