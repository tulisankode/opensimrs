import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";

const TarifLab = sequelizeInstance.define(
  "TarifLab",
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
    tarif_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    tarif_lab_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
  },
  {
    tableName: "tarif_lab",
    underscored: true,
    timestamps: false,
  }
);

export default TarifLab;
