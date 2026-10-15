import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Kecamatan from "./kecamatan-model.js";

const Kabupaten = sequelizeInstance.define(
  "Kabupaten",
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
    provinsi_code: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    tableName: "kabupaten",
    underscored: true,
    timestamps: false,
  }
);
Kabupaten.hasMany(Kecamatan, {
  constraints: false,
  foreignKey: "kabupaten_code",
  sourceKey: "code"
})
Kecamatan.belongsTo(Kabupaten, {
  constraints: false,
  foreignKey: "kabupaten_code",
  targetKey: "code"
})
export default Kabupaten;
