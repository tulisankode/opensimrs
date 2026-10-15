import { DataTypes, Model } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";
import moment from "moment";

export default class ReportAntrianModel extends Model {}

ReportAntrianModel.init(
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
      unique: true,
    },
    faskesUuid: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "faskes_uuid",
    },
    tanggalPelayanan: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: "tanggal_pelayanan",
    },
    jadwalDokterUuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "jadwal_dokter_uuid",
    },
    practitionerName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "practitioner_name",
    },
    locationName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "location_name",
    },
    kuota: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    kuotaJkn: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "kuota_jkn",
    },
    kuotaNonJkn: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "kuota_non_jkn",
    },
    noAntrianTerakhir: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "no_antrian_terakhir",
    },
    jumlahAntrianAktif: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "jumlah_antrian_aktif",
    },
    jumlahJknAktif: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "jumlah_jkn_aktif",
    },
    jumlahNonJknAktif: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "jumlah_non_jkn_aktif",
    },
    createdAt: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: () => moment().unix(),
      field: "created_at",
    },
    updatedAt: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: "updated_at",
    },
    deletedAt: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: "deleted_at",
    },
  },
  {
    sequelize: sequelizeInstance,
    modelName: "ReportAntrian",
    tableName: "report_antrian",
    timestamps: false,
  }
);
