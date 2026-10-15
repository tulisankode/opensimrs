import { DataTypes, Model } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";
import moment from "moment";

export default class PrescriptionItemSubstitutionModel extends Model {}

PrescriptionItemSubstitutionModel.init(
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
    item_medis_uuid: {
      type: DataTypes.STRING(255),
    },
    jenis_stok_uuid: {
      type: DataTypes.STRING(255),
    },
    harga_satuan: {
      type: DataTypes.FLOAT,
    },
    medication_qty: {
      type: DataTypes.FLOAT,
    },
    medication_dose_qty: {
      type: DataTypes.FLOAT,
    },
    medication_dose_satuan_uuid: {
      type: DataTypes.STRING(255),
    },
    medication_period: {
      type: DataTypes.STRING(255),
    },
    aturan_pakai_uuid: {
      type: DataTypes.STRING(255),
    },
    cara_pakai_uuid: {
      type: DataTypes.STRING(255),
    },
    route: {
      type: DataTypes.STRING(255),
    },
    is_chronic: {
      type: DataTypes.BOOLEAN,
    },
    alasan_subtitusi: {
      type: DataTypes.TEXT,
    },
    penanggungjawab_subtitusi: {
      type: DataTypes.STRING(255),
    },
    catatan: {
      type: DataTypes.TEXT,
    },
    is_substitution: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: () => moment().unix(),
    },
    updated_at: {
      type: DataTypes.BIGINT,
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
