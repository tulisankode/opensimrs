import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../../configurations/config-db.js";

export default class TarifRuanganModel extends Model {}
TarifRuanganModel.init( {
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
  tarif_uuid: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  ruangan_uuid: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
    },
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
  tableName: "tarif_ruangan",
  underscored: true,
  timestamps: false,
  sequelize: sequelizeInstance,
  uniqueKeys: {
    unique_faskes_x_deletedAt: {
      fields: ["faskes_uuid", "deleted_at"]
    }
  }
});
