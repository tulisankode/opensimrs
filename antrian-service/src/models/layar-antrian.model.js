import { DataTypes, Model } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";
import moment from "moment";

export default class LayarAntrianModel extends Model {}

LayarAntrianModel.init(
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
    nama_layar: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    tipe_layar: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    judul: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    is_admisi: {
      type: DataTypes.BOOLEAN,
    },
    is_poli: {
      type: DataTypes.BOOLEAN,
    },
    is_farmasi: {
      type: DataTypes.BOOLEAN,
    },
    flash_text: {
      type: DataTypes.JSON,
    },
    media: {
      type: DataTypes.STRING(255),
    },
    status: {
      type: DataTypes.BOOLEAN,
    },
    // Kunci akses mode kiosk (URL layar TV tanpa login).
    kunci_kiosk: {
      type: DataTypes.STRING(64),
    },
    createdAt: {
      type: DataTypes.BIGINT,
      allowNull: false,
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
    modelName: "LayarAntrian",
    tableName: "layar_antrian",
    timestamps: false,
  }
);
