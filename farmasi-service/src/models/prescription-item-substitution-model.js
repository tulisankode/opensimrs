import { DataTypes, Model } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";
import moment from "moment";

// Riwayat substitusi obat Resep Dokter (tabel dibuat migrasi 20261021120000-farmasi_substitusi_obat).
// Satu baris = satu penggantian obat pada item resep non-racikan sebelum verifikasi.
export default class PrescriptionItemSubstitutionModel extends Model {}

PrescriptionItemSubstitutionModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
    },
    uuid: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      defaultValue: () => uuidv7(),
      allowNull: false,
    },
    faskes_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    prescription_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    prescription_item_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // obat asal (sebelum diganti); data_asal = snapshot kolom klinis item resep saat itu
    item_medis_asal_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    jenis_stok_asal_uuid: {
      type: DataTypes.STRING(255),
    },
    medication_qty_asal: {
      type: DataTypes.FLOAT,
    },
    data_asal: {
      type: DataTypes.JSONB,
    },
    // obat pengganti
    item_medis_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    jenis_stok_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    medication_qty: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    // HPP satuan pengganti saat substitusi (informasi; harga final dihitung ulang saat verifikasi)
    harga_satuan: {
      type: DataTypes.FLOAT,
    },
    kategori_alasan: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    alasan: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    persetujuan_dokter: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    dokter_penyetuju: {
      type: DataTypes.STRING(255),
    },
    catatan: {
      type: DataTypes.TEXT,
    },
    // status persetujuan dokter: menunggu | disetujui | disetujui_lisan | ditolak | dibatalkan | tanpa_persetujuan (data lama)
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "menunggu",
    },
    // isian yang diterapkan ke item resep saat disetujui
    perubahan: {
      type: DataTypes.JSONB,
    },
    // konfirmasi lisan/telepon: cara (telepon | lisan | langsung) & waktu konfirmasi dengan dokter
    cara_konfirmasi: {
      type: DataTypes.STRING(20),
    },
    waktu_konfirmasi: {
      type: DataTypes.BIGINT,
    },
    diputuskan_oleh: {
      type: DataTypes.STRING(255),
    },
    diputuskan_at: {
      type: DataTypes.BIGINT,
    },
    alasan_tolak: {
      type: DataTypes.TEXT,
    },
    // verifikasi dokter atas konfirmasi lisan
    diverifikasi_oleh: {
      type: DataTypes.STRING(255),
    },
    diverifikasi_at: {
      type: DataTypes.BIGINT,
    },
    petugas: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: () => moment().unix(),
    },
    updated_at: {
      type: DataTypes.BIGINT,
      defaultValue: () => moment().unix(),
    },
    deleted_at: {
      type: DataTypes.BIGINT,
    },
  },
  {
    sequelize: sequelizeInstance,
    modelName: "PrescriptionItemSubstitution",
    tableName: "prescription_item_substitutions",
    underscored: true,
    timestamps: false,
  }
);
