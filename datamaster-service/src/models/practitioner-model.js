import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";
import Pegawai from "./pegawai-model.js";

const Practitioner = sequelizeInstance.define(
  "Practitioner",
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
    pegawai_uuid: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        notEmpty: true,
      },
    },
    sip: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    str: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    code_bpjs: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: true,
    },
    satu_sehat_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_doctor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      validate: {
        notEmpty: true,
      },
    },
    code_antrian_dokter: {
      type: DataTypes.STRING(15),
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
    tableName: "practitioner",
    underscored: true,
    timestamps: false,
  }
);

Practitioner.belongsTo(Pegawai, {
  foreignKey: "pegawai_uuid",
  targetKey: "uuid",
});

Pegawai.hasOne(Practitioner, {
  foreignKey: "pegawai_uuid",
  sourceKey: "uuid",
});

export default Practitioner;
