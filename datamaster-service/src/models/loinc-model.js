import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";

const Loinc = sequelizeInstance.define(
  "Loinc",
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
      unique: true,
      primaryKey: true,
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
    tableName: "loinc",
    indexes: [{ fields: ["name"] }],
    underscored: true,
    timestamps: false,
  }
);

export default Loinc;
