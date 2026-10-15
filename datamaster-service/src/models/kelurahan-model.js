import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Kecamatan from "./kecamatan-model.js";

const Kelurahan = sequelizeInstance.define(
  "Kelurahan",
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
    kecamatan_code: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    tableName: "kelurahan",
    underscored: true,
    timestamps: false,
  }
);
Kelurahan.hasOne(Kecamatan, {
  constraints: false,
  foreignKey: "code",
  sourceKey: "kecamatan_code"
})
Kecamatan.belongsTo(Kelurahan, {
  constraints: false,
  foreignKey: "code",
  targetKey: "kecamatan_code"
})
export default Kelurahan;
