import { DataTypes, Model } from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";

export default class KelurahanModel extends Model {}
KelurahanModel.init(
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
    sequelize: sequelizeInstance,
  }
);
