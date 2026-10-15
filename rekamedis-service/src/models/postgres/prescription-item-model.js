import {DataTypes, Model} from "sequelize";
import identifierModel from "./common/identifier-model.js";
import {hookModel} from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/sequelize-instance.js";
import fieldTime from "./common/fieldTime-model.js";

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