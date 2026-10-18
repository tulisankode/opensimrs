import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";
import moment from "moment";

// Jejak peristiwa pembaruan status marketplace (webhook/tarik) untuk idempotensi & audit (STD-0019).
// Payload tersanitasi, tidak pernah memuat kunci API/kunci masuk.
export default class MarketplacePeristiwaModel extends Model {
}

MarketplacePeristiwaModel.init(
    {
        ...identifierModel,
        pesanan_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        sumber: {
            // webhook|tarik — dijaga lewat CHECK constraint di migrasi
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        peristiwa_mitra_id: {
            type: DataTypes.STRING(100),
        },
        status_mitra: {
            type: DataTypes.STRING(50),
        },
        status_lokal: {
            type: DataTypes.STRING(50),
        },
        valid: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        catatan: {
            type: DataTypes.STRING(255),
        },
        payload: {
            type: DataTypes.JSONB,
        },
        created_at: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: () => moment().unix(),
        },
    },
    {
        sequelize: sequelizeInstance,
        tableName: "inventory_marketplace_peristiwa",
        className: "marketplacePeristiwa",
        hooks: hookModel,
        underscored: true,
        timestamps: false,
        indexes: [
            {
                fields: ["faskes_uuid"],
            },
        ],
    }
)
