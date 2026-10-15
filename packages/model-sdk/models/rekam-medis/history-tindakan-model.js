import { DataTypes, Model } from "sequelize";
import fieldTime from "./common/base-model.js";
import identifierModel from "./common/identifier-model.js"
import sequelizeInstance from "../../configurations/config-db.js";
import PetugasTindakanModel from "./petugas-tindakan-model.js";

export default class HistoryTindakanModel extends Model {}
HistoryTindakanModel.init(
  {
    ...identifierModel,
    tarif_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    nama_tindakan: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    harga_tindakan: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    qty_tindakan: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    lokasi_uuid: {
      type: DataTypes.STRING(255),
    },
    pelayanan: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "history_tindakan",
    className: "HistoryTindakans",
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ["faskes_uuid"],
      },
    ],
  }
);

HistoryTindakanModel.hasMany(PetugasTindakanModel, {
    sourceKey: 'uuid',
    foreignKey: 'historyTindakanUuid',
    as: 'petugas_tindakan',
});
