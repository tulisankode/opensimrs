import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import fieldTime from "./common/base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class InformConsentModel extends Model {}
InformConsentModel.init(
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
    dokter_uuid: {
      type: DataTypes.STRING(255),
    },
    pemberi_informasi: {
      type: DataTypes.STRING(255),
    },
    penerima: {
      type: DataTypes.STRING(255),
    },
    nama_keluarga: {
      type: DataTypes.STRING(255),
    },
    hubungan_keluarga: {
      type: DataTypes.STRING(255),
    },
    no_hp: {
      type: DataTypes.STRING(15),
    },
    alamat: {
      type: DataTypes.STRING(255),
    },
    gender: {
      type: DataTypes.STRING(255),
    },
    diagnosis: {
      type: DataTypes.STRING(255),
    },
    tindakan_kedokteran: {
      type: DataTypes.STRING(255),
    },
    tatacara_tindakan: {
      type: DataTypes.STRING(255),
    },
    risiko_tindakan: {
      type: DataTypes.STRING(255),
    },
    prognosis: {
      type: DataTypes.STRING(255),
    },
    lainnya: {
      type: DataTypes.STRING(255),
    },
    dasar_diagnosis: {
      type: DataTypes.STRING(255),
    },
    indikasi_tindakan: {
      type: DataTypes.STRING(255),
    },
    tujuan_tindakan: {
      type: DataTypes.STRING(255),
    },
    komplikasi: {
      type: DataTypes.STRING(255),
    },
    alaternatif: {
      type: DataTypes.STRING(255),
    },
    persetujuan: {
      type: DataTypes.BOOLEAN,
    },
    tgl_persetujuan: {
      type: DataTypes.INTEGER,
    },
    saksi1: {
      type: DataTypes.STRING(255),
    },
    saksi2: {
      type: DataTypes.STRING(255),
    },
    petugas: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "inform_consents",
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ["rekam_medis_uuid"],
      },
    ],
  }
);
