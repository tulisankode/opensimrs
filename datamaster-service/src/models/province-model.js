import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Kabupaten from "./kabupaten-model.js";

const Province = sequelizeInstance.define(
  "Province",
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    tableName: "provinsi",
    underscored: true,
    timestamps: false,
  }
);
Province.hasMany(Kabupaten, {
  constraints: false,
  foreignKey: "provinsi_code",
  sourceKey: "code"
})
Kabupaten.belongsTo(Province, {
  constraints: false,
  foreignKey: "provinsi_code",
  targetKey: "code"
})
export default Province;
