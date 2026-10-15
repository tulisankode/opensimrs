import { DataTypes, Model } from "sequelize";
import identifierModel from "../farmasi/common/identifier-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import fieldTime from "../farmasi/base-model.js";

export default class OrderlabModel extends Model {}

OrderlabModel.init(
  {
    ...identifierModel,
    no_order: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    noreg: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    patient_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    no_rm: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    rekam_medis_date: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    payment_method: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    penjamin_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    pelayanan: {
      type: DataTypes.ENUM(["igd", "rajal", "ranap", "aps"]),
      allowNull: false,
    },
    lokasi_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    dokter_pengirim_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    dokter_pengirim: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    pasien_maternitas: {
      type: DataTypes.BOOLEAN(),
      allowNull: false,
    },
    keluhan_utama: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    catatan: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    diagnosis: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    tgl_order: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    tgl_pemeriksaan: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    cito: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    status_puasa: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    petugas_order: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    order_status: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    spesimen_uuids: {
      type: DataTypes.ARRAY(DataTypes.STRING(255)),
      allowNull: true,
    },
    catatan_analis: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    expertise: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    catatan_expertise: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    practitioner_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    waktu_validasi: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    waktu_selsai: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_mcu: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    alasan_batal_order: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    alasan_batal_validasi: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sesi_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    waktu_expertise: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    petugas_expertise: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "order_lab",
    className: "Orderlab",
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ["patient_uuid"],
      },
      {
        fields: ["dokter_pengirim_uuid"],
      },
      {
        fields: ["practitioner_uuid"],
      },
      {
        fields: ["lokasi_uuid"],
      },
      {
        fields: ["penjamin_uuid"],
      },
      {
        fields: ["sesi_uuid"],
      },
    ],
  }
);
