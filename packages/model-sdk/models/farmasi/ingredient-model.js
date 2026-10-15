import { DataTypes, Model } from "sequelize";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../../configurations/config-db.js";

export default class IngredientModel extends Model {}
IngredientModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      unique: true,
    },
    uuid: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      defaultValue: function () {
        return uuidv7();
      },
      allowNull: false,
      unique: true,
    },
    code: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "ingredients",
    className: "Ingredient",
    hooks: hookModel,
    underscored: true,
    timestamps: false,
  }
);
