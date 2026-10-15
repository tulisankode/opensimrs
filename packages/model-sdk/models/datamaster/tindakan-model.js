import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../../configurations/config-db.js";

export default class TindakanModel extends Model {}
TindakanModel.init({
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
  faskes_uuid: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(255),
    unique: false,
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
  snomed_uuid: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  icd9_uuid: {
    type: DataTypes.STRING(255),
    allowNull: true,
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
  tableName: "tindakan",
  indexes: [{ fields: ["name"] }],
  underscored: true,
  timestamps: false,
  sequelize: sequelizeInstance,
  uniqueKeys: {
    uniq_scores: {
      fields: ["code", "faskes_uuid", "deleted_at"],
    },
  },
});
