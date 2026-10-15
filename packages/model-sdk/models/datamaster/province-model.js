import { DataTypes, Model } from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";

export default class ProvinceModel extends Model {}
ProvinceModel.init(
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
    sequelize: sequelizeInstance,
  }
);
