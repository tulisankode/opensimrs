import {
    DataTypes,
    Model
} from "sequelize";
import fieldTime from "./common/fieldTime-model.js";
import identifierModel from "./common/identifier-model.js";
import {hookModel} from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";


export default class RiwayatRuanganModel extends Model{}
RiwayatRuanganModel.init(
    {
        ...identifierModel,
        admissionUuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        monitoringRuanganUuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        modelName: "RiwayatRuangan",
        tableName: "riwayat_ruangan",
        underscored: true,
        hooks: hookModel,
    },
)