import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import PrescriptionItemRacikanModel from "./prescription-item-racikan-model.js";
import AturanPakaiModel from "./aturan-pakai-model.js";
import CaraiPakaiModel from "./cara-pakai-model.js";
import ItemMedisModel from "./item-medis-model.js";
import SatuanModel from "./satuan-model.js";
import BentukRacikanModel from "./bentuk-racikan-model.js";
import FpoPemberianModel from "./fpo-pemberian-model.js";
import JenisStokModel from "./jenis-stok-model.js";

export default class PrescriptionItemModel extends Model {
}

PrescriptionItemModel.init({
        ...identifierModel,
        prescription_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        item_medis_uuid: {
            type: DataTypes.STRING(255),
        },
        medication_qty: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        medication_dose_qty: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        medication_dose_satuan_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        medication_period: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        aturan_pakai_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        cara_pakai_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        prescription_notes: {
            type: DataTypes.STRING(255),
        },
        is_chronic: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
        route: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        is_compound: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        nama_racikan: {
            type: DataTypes.STRING(255),
        },
        jenis_racikan: {
            type: DataTypes.INTEGER,
        },
        bentuk_racikan_uuid: {
            type: DataTypes.STRING(255),
        },
        sisa_qty_order: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        stok_medis_uuid: {
            type: DataTypes.STRING(255),
        },
        jenis_stok_uuid: {
            type: DataTypes.STRING(255),
        },
        harga_satuan: {
            type: DataTypes.FLOAT,
        },
        biaya_embalase: {
            type: DataTypes.FLOAT,
        },
        biaya_racik: {
            type: DataTypes.FLOAT,
        },
        stok_medis_uuides: {
            type: DataTypes.JSON
        },
        ...fieldTime
    }, {
        sequelize: sequelizeInstance,
        tableName: "prescription_items",
        className: "PrescriptionItem",
        underscored: true,
        timestamps: false,
        hooks: hookModel,
        indexes: [
            {
                fields: ['faskes_uuid'],
            },
        ],
    }
)

PrescriptionItemModel.hasMany(PrescriptionItemRacikanModel, {
    foreignKey: "prescription_item_uuid",
    as: "racikan",
    constraints: false
})

PrescriptionItemModel.belongsTo(AturanPakaiModel, {
    foreignKey: "aturan_pakai_uuid",
    as: "aturan_pakai",
    constraints: false
})

PrescriptionItemModel.belongsTo(CaraiPakaiModel, {
    foreignKey: "cara_pakai_uuid",
    as: "cara_pakai",
    constraints: false
})

PrescriptionItemModel.belongsTo(ItemMedisModel, {
    foreignKey: "item_medis_uuid",
    as: "item_medis",
    constraints: false
})

PrescriptionItemModel.belongsTo(SatuanModel, {
    foreignKey: "medication_dose_satuan_uuid",
    as: "satuan_dosis",
    constraints: false
})

PrescriptionItemModel.belongsTo(BentukRacikanModel, {
    foreignKey: "bentuk_racikan_uuid",
    as: "bentuk_racikan",
    constraints: false
})

PrescriptionItemModel.hasMany(FpoPemberianModel, {
    foreignKey: "prescription_item_uuid",
    as: "fpo_pemberian",
    constraints: false
})

PrescriptionItemModel.belongsTo(JenisStokModel, {
    foreignKey: "jenis_stok_uuid",
    as: "jenis_stok",
    constraints: false
})