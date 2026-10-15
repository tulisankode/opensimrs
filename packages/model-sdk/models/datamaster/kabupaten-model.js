import { DataTypes, Model } from "sequelize";
import Province from "./province-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class KabupatenModel extends Model {}
KabupatenModel.init({
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
  sequelize: sequelizeInstance,
});
