import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";

const DemografiWilayah = sequelizeInstance.define(
  "DemografiWilayah",
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
    kode_kelurahan: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
    },
    nama_kelurahan: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    kode_kecamatan: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    nama_kecamatan: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    kode_kabupaten: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    nama_kabupaten: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    kode_provinsi: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    nama_provinsi: {
      type: DataTypes.STRING(255),
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
    tableName: "demografi_wilayah",
    underscored: true,
    timestamps: false,
  }
);

export default DemografiWilayah;
