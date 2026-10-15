import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";

const TarifKomponenTindakanPoli = sequelizeInstance.define(
  "TarifKomponenTindakanPoli",
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
    tindakan_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    // tarif komponen
    tarif_komponen_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    tarif_per_komponen: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
    },
    persen_per_komponen: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    presentase: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    }
  },
  {
    tableName: "tarif_komponen_tindakan_poli",
    underscored: true,
    timestamps: false,
  }
);
export default TarifKomponenTindakanPoli;
