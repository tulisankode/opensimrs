import { DataTypes, Model } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";
import moment from "moment";

export default class AntrianModel extends Model {}

AntrianModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      unique: true,
    },
    uuid: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      defaultValue: () => uuidv7(),
      allowNull: false,
    },
    faskesUuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "faskes_uuid",
    },
    patientUuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "patient_uuid",
    },
    rawat_jalan_uuid: {
      type: DataTypes.STRING(255),
    },
    status_panggilan: {
      type: DataTypes.INTEGER,
    },
    pelayanan: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    jenis_pasien: {
      type: DataTypes.STRING(255),
    },
    pasien_baru: {
      type: DataTypes.BOOLEAN,
    },
    jenisResep: {
      type: DataTypes.STRING(255),
      field: "jenis_resep",
    },
    kode_farmasi: {
      type: DataTypes.STRING(255),
    },
    createdAt: {
      type: DataTypes.BIGINT,
      defaultValue: () => moment().unix(),
      field: "created_at",
    },
    updatedAt: {
      type: DataTypes.BIGINT,
      field: "updated_at",
    },
    deletedAt: {
      type: DataTypes.BIGINT,
      field: "deleted_at",
    },
  },
  {
    sequelize: sequelizeInstance,
    modelName: "Antrian",
    tableName: "antrian",
    timestamps: false,
  }
);
