import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class IngredientItemMedisModel extends Model {}
IngredientItemMedisModel.init(
  {
    ...identifierModel,
    ingredient_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    item_medis_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "ingredient_item_medis",
    className: "IngredientItemMedis",
    hooks: hookModel,
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ["faskes_uuid"],
      },
    ],
    uniqueKeys: {
      uniq_scores: {
        fields: ["ingredient_uuid", "item_medis_uuid"],
      },
    },
  }
);
