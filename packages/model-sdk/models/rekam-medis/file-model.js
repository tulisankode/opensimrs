import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import fieldTime from "./common/base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class FileModel extends Model {}
FileModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      primaryKey: true,
      autoIncrement: true,
    },
    uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      defaultValue: () => uuidv7(),
    },
    faskes_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    rekam_medis_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    file: {
      type: DataTypes.TEXT,
    },
    file_type: {
      type: DataTypes.STRING(255),
    },
    file_format: {
      type: DataTypes.STRING(25),
    },
    admission_type: {
      type: DataTypes.ENUM,
      values: ["igd", "ri", "rj", "fisio"],
    },
    nomor_surat: {
      type: DataTypes.STRING(255),
    },
    nama_file: {
      type: DataTypes.STRING(255),
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "files",
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ["rekam_medis_uuid", "file_type"],
      },
    ],
    uniqueKeys: {
      uniq_scores: {
        fields: ["nomor_surat", "faskes_uuid"],
      },
    },
  }
);
