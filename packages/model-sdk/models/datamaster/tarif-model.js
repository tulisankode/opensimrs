import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../../configurations/config-db.js";

export default class TarifModel extends Model {}
TarifModel.init(
  {
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
    jenis_tarif: {
      type: DataTypes.ENUM("Tindakan", "Ruangan"),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    code: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: false,
      validate: {
        notEmpty: true,
      },
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    grand_total: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    mode: {
      type: DataTypes.ENUM(["Single", "Multiple"]),
      allowNull: true,
    },
    is_mcu: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    penjamin: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    unit_pelayanan: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tindakan: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lokasi_uuid: {
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
    tableName: "tarif",
    indexes: [{ fields: ["name"] }],
    underscored: true,
    timestamps: false,
    sequelize: sequelizeInstance,
    uniqueKeys: {
      uniq_scores: {
        fields: ["code", "faskes_uuid", "deleted_at"],
      },
    },
  }
);
