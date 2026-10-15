import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../../configurations/config-db.js";

export default class LokasiModel extends Model {}
LokasiModel.init(
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
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    phone: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    url: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    satu_sehat_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: false,
    },
    organization_ihs_number: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    location_type: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "site",
      validate: {
        notEmpty: true,
      },
    },
    part_of: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: false,
    },
    part_of_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: false,
    },
    class_code: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    class_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    code_antrian_poli: {
      type: DataTypes.STRING(15),
      unique: false,
      allowNull: true,
    },
    is_poli: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    pelayanan: {
      type: DataTypes.ENUM("RJ", "RI", "IGD"),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    no_room: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    kategori_ruangan_uuid: {
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
    tableName: "lokasi",
    indexes: [
      {
        fields: ["name"],
      },
    ],
    uniqueKeys: {
      uniq_scores: {
        fields: ["code", "faskes_uuid", "location_type", "deleted_at"],
      },
    },
    underscored: true,
    timestamps: false,
    sequelize: sequelizeInstance,
  }
);
