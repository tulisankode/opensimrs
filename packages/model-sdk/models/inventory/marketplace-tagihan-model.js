import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";

// Catatan tagihan dari marketplace mitra untuk bagian keuangan (STD-0019). Bukan bukti pembayaran: status_dikonfirmasi
// hanya berubah dari respons mitra yang tervalidasi (sinkron status/webhook), bukan sekadar checkout berhasil.
export default class MarketplaceTagihanModel extends Model {
}

MarketplaceTagihanModel.init(
    {
        ...identifierModel,
        pesanan_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        referensi_tagihan: {
            type: DataTypes.STRING(100),
        },
        nilai: {
            type: DataTypes.DOUBLE,
        },
        tanggal: {
            type: DataTypes.BIGINT,
        },
        status_dikonfirmasi: {
            // belum|sebagian|lunas — dijaga lewat CHECK constraint di migrasi
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "belum",
        },
        metadata: {
            type: DataTypes.JSONB,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "inventory_marketplace_tagihan",
        className: "marketplaceTagihan",
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
