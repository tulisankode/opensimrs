import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";
import Snomed from "./snomed-model.js";
import ICD9 from "./icd9-model.js";

const Tindakan = sequelizeInstance.define(
  "Tindakan",
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
    faskes_uuid: {
      type: DataTypes.UUID,
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
    snomed_uuid: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    icd9_uuid: {
      type: DataTypes.UUID,
      allowNull: true,
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
    tableName: "tindakan",
    indexes: [{ fields: ["name"] }],
    underscored: true,
    timestamps: false,
  }
);

// Associations
Tindakan.belongsTo(ICD9, { foreignKey: "icd9_uuid", as: "icd9" });
Tindakan.belongsTo(Snomed, { foreignKey: "snomed_uuid", as: "snomed" });

export default Tindakan;
