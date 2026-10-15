import { DataTypes, Model } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";
import moment from "moment";

export default class LayarAntrianPoliModel extends Model {}

LayarAntrianPoliModel.init(
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
    lokasiUuid: {
      type: DataTypes.STRING(255),
      field: "lokasi_uuid",
    },
    layarAntrianUuid: {
      type: DataTypes.STRING(255),
      field: "layar_antrian_uuid",
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
    modelName: "LayarAntrianPoli",
    tableName: "layar_antrian_poli",
    timestamps: false,
  }
);
