import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../../configurations/config-db.js";

export default class OrganizationModel extends Model {}
OrganizationModel.init(
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
      unique: false,
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
    phone: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: false,
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
    part_of: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: false
    },
    part_of_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: false
    },
    url: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    address_uuid: {
      type: DataTypes.STRING(255),
      unique: true,
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
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    organization_ihs_number: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: false,
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
    tableName: "organization",
    indexes: [{ fields: ["name"] }],
    underscored: true,
    timestamps: false,
    sequelize: sequelizeInstance,
    uniqueKeys: {
      uniq_scores: {
        fields: ["code", "deleted_at", "faskes_uuid", "organization_ihs_number", "satu_sehat_id"],
      },
    },
  }
);
