import { DataTypes, Model } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

class Kecamatan extends Model {}
Kecamatan.init(
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
    underscored: false,
    timestamps: false,
    sequelize: sequelizeInstance,
  }
);

export default Kecamatan;
