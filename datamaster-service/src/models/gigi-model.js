import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";

const Gigi = sequelizeInstance.define(
  "Gigi",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      unique: true,
      allowNull: false,
    },
    uuid: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv7(),
      primaryKey: true,
      unique: true,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    display: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    name: {
      type: DataTypes.INTEGER,
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    createdAt: {
      type: DataTypes.BIGINT,
      defaultValue: Math.floor(Date.now() / 1000),
    },
    updatedAt: {
      type: DataTypes.BIGINT,
      defaultValue: Math.floor(Date.now() / 1000),
    },
    deletedAt: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
  },
  {
    tableName: "gigi",
    indexes: [
      {
        fields: ["display"],
      },
    ],
    underscored: true,
    timestamps: false,
  }
);

export default Gigi;
