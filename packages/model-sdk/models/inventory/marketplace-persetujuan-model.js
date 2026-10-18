import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";

// Jejak persetujuan berjenjang permintaan marketplace (STD-0019), mengikuti pola persetujuan PO yang berlaku.
export default class MarketplacePersetujuanModel extends Model {
}

MarketplacePersetujuanModel.init(
    {
        ...identifierModel,
        pesanan_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        urutan: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
        pemberi_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        pemberi_nama: {
            type: DataTypes.STRING(255),
        },
        keputusan: {
            // setujui|tolak — dijaga lewat CHECK constraint di migrasi
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        alasan: {
            type: DataTypes.STRING(255),
        },
        diputuskan_pada: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "inventory_marketplace_persetujuan",
        className: "marketplacePersetujuan",
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
