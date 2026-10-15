import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../../configurations/config-db.js";
import PegawaiModel from "./pegawai-model.js";

export default class PractitionerModel extends Model {}
PractitionerModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      unique: true,
      allowNull: false,
    },
    uuid: {
      type: DataTypes.STRING(255),
      defaultValue: () => uuidv7(),
      unique: true,
      primaryKey: true,
      allowNull: false,
    },
    faskes_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    pegawai_uuid: {
      type: DataTypes.STRING(255),
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
      unique: false,
      allowNull: true,
    },
    satu_sehat_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: false,
    },
    is_doctor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    code_antrian_dokter: {
      type: DataTypes.STRING(15),
      allowNull: true,
    },
    poli_pelayanan: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.BIGINT,
      defaultValue: Math.floor(Date.now() / 1000.0),
    },
    updatedAt: {
      type: DataTypes.BIGINT,
      defaultValue: Math.floor(Date.now() / 1000.0),
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
    sequelize: sequelizeInstance,
    uniqueKeys: {
      uniq_scores: {
        fields: ["code_bpjs", "faskes_uuid", "deleted_at"],
      },
    },
  }
);
PractitionerModel.belongsTo(PegawaiModel, {
  foreignKey: "pegawai_uuid",
  constraints: false,
  as: "pegawai",
  targetKey: "uuid",
});

PegawaiModel.hasOne(PractitionerModel, {
  foreignKey: "pegawai_uuid",
  sourceKey: "uuid",
  constraints: false,
});
