import { DataTypes, Model } from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import defaultTimestamp from "../common/default-timestamp.js";
import defaultIdentifier from "../common/default-identifier.js";

export default class UserModel extends Model {}
UserModel.init(
  {
    ...defaultIdentifier,
    roleUuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: false,
    },
    practitioner_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: false,
    },
    phone: {
      type: DataTypes.STRING(15),
      allowNull: true,
      unique: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: false,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: false,
    },
    photo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    permissions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ...defaultTimestamp,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "users",
    underscored: true,
    timestamps: false,
    unique_email_x_deletedAt: {
      faskes_x_deletedAt: {
        fields: ["faskes_uuid", "deleted_at", "email"]
      }
    }
  }
);
