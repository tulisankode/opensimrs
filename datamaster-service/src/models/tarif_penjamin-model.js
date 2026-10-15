import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";

const TarifPenjamin = sequelizeInstance.define(
  "TarifPenjamin",
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
    penjamin_uuid: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    harga: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
  },
  {
    tableName: "tarif_penjamin",
    underscored: true,
    timestamps: false,
  }
);

export default TarifPenjamin;
