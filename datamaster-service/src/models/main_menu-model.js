import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

const MainMenu = sequelizeInstance.define(
  "MainMenu",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "main_menu",
    underscored: true,
    timestamps: false,
  }
);

export default MainMenu;
