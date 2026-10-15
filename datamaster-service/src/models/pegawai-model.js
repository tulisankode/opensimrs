import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";

const Pegawai = sequelizeInstance.define(
  "Pegawai",
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    nik: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    tipe: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    first_title: {
      type: DataTypes.STRING(25),
      allowNull: true,
    },
    last_title: {
      type: DataTypes.STRING(25),
      allowNull: true,
    },
    tanggal_lahir: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    gender: {
      type: DataTypes.STRING(15),
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
    tableName: "pegawai",
    indexes: [{ fields: ["name"] }],
    underscored: true,
    timestamps: false,
  }
);

export default Pegawai;
