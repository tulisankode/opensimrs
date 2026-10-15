import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../../configurations/config-db.js";

export default class ItemGigiModel extends Model {}
ItemGigiModel.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    unique: true,
    allowNull: false,
  },
  uuid: {
    type: DataTypes.STRING(255),
    defaultValue: () => uuidv7(),
    primaryKey: true,
    unique: true,
    allowNull: false,
  },
  kategori_gigi_uuid: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  system: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  code: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  display: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  name: {
    type: DataTypes.STRING(255),
    unique: false,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  catatan: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  image: {
    type: DataTypes.TEXT,
    allowNull: true,
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
  tableName: "item_gigi",
  indexes: [
    {
      fields: ["name"],
    },
  ],
  underscored: true,
  timestamps: false,
  sequelize: sequelizeInstance,
  uniqueKeys: {
    unique_code_x_name_x_display_x_deletedAt: {
      fields: ["code", "name", "display", "deleted_at"]
    }
  }
});
