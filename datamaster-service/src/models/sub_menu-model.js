import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

const SubMenu = sequelizeInstance.define(
  "SubMenu",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      unique: true,
      allowNull: false,
    },
    main_menu_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    tableName: "sub_menu",
    indexes: [
      {
        fields: ["name"],
      },
    ],
    underscored: true,
    timestamps: false,
  }
);

export default SubMenu;
