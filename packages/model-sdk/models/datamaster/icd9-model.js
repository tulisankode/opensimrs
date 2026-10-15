import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../../configurations/config-db.js";

export default class Icd9Model extends Model {}
Icd9Model.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    unique: true,
    allowNull: false,
  },
  uuid: {
    type: DataTypes.STRING(255),
    defaultValue: () => uuidv7(),
    unique: true,
    primaryKey: true,
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.BIGINT,
    defaultValue: Math.floor(Date.now() / 1000.0),
  },
  updatedAt: {
    type: DataTypes.BIGINT,
    defaultValue: Math.floor(Date.now() / 1000.0),
  },
  deletedAt: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
},
{
  tableName: "icd9",
  indexes: [{ fields: ["name"] }],
  underscored: true,
  timestamps: false,
  sequelize: sequelizeInstance,
  uniqueKeys: {
    unique_code_x_name_x_deletedAt: {
      fields: ["code", "name", "deleted_at"]
    }
  }
});
