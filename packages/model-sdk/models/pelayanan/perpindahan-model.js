import {
    DataTypes,
    Model,
} from "sequelize";
import fieldTime from "./common/fieldTime-model.js";
import identifierModel from "./common/identifier-model.js";
import {hookModel} from "./common/hook-model.js";
import RawatInapModel from "./rawat-inap-model.js";
import RoomMonitoringModel from "../admisi/room-monitoring-model.js";
import sequelizeInstance from "../../configurations/config-db.js";


export default class PerpindahanModel extends Model {}
PerpindahanModel.init(
    {
        ...identifierModel,
        petugas: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        admissionRiUuid: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        originMonitoringRoomUuid: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        destinationMonitoringRoomUuid: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        waktuPindah: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        keterangan: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        statusPindah: {
            type: DataTypes.ENUM("approve", "reject", "pending"),
            allowNull: true,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "perpindahans",
        underscored: true,
        timestamps: false,
        hooks: hookModel,
    }
)

PerpindahanModel.belongsTo(RawatInapModel, {
    foreignKey: "admission_ri_uuid",
    as: "rawat_inap",
    constraints: false,
})

PerpindahanModel.belongsTo(RoomMonitoringModel, {
    foreignKey: "origin_monitoring_room_uuid",
    as: "origin_monitoring_room",
    constraints: false,
})

PerpindahanModel.belongsTo(RoomMonitoringModel, {
    foreignKey: "destination_monitoring_room_uuid",
    as: "destination_monitoring_room",
    constraints: false,
})