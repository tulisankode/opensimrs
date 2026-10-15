import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";

const User = sequelizeInstance.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      primaryKey: true,
      autoIncrement: true,
    },
    uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      defaultValue: uuidv7(),
    },
    faskes_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: false,
    },
    phone: {
      type: DataTypes.STRING(15),
      allowNull: false,
      unique: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    username: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: false,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: false,
    },
    token: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    inventory_medis: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      unique: false,
    },
    inventory_non_medis: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      unique: false,
    },
    photo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    awalan_gelar: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    akhiran_gelar: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: false,
      defaultValue: Math.floor(Date.now() / 1000),
    },
    updatedAt: {
      type: DataTypes.BIGINT,
      allowNull: true,
      unique: false,
    },
    deletedAt: {
      type: DataTypes.BIGINT,
      allowNull: true,
      unique: false,
    },
  },
  {
    tableName: "users",
    timestamps: false,
    underscored: true,
  }
);

export default User;
