import { DataTypes, Model } from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import fieldTime from "./common/fieldTime-model.js";
import identifierModel from "./common/identifier-model.js";
import { hookModel } from "./common/hook-model.js";
import PatientModel from "./patient-model.js";
import LokasiModel from "../datamaster/lokasi-model.js";

export default class RoomMonitoringModel extends Model {}
RoomMonitoringModel.init(
  {
    ...identifierModel,
    patientUuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    room_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    noBed: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("Bed Cadangan", "Box Bayi", "Bed"),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    status_operasional: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    lokasi_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    modelName: "RoomMonitoring",
    tableName: "room_monitorings",
    underscored: true,
    hooks: hookModel,
    timestamps: false,
  }
);

RoomMonitoringModel.belongsTo(PatientModel, {
  foreignKey: "patient_uuid",
  as: "patient",
  constraints: false,
});

RoomMonitoringModel.belongsTo(LokasiModel, {
  foreignKey: "room_uuid",
  as: "room",
  constraints: false,
});

RoomMonitoringModel.belongsTo(LokasiModel, {
  foreignKey: "lokasi_uuid",
  as: "bed_lokasi",
  constraints: false,
});
