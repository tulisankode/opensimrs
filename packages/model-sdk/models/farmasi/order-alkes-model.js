import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import LokasiStokModel from "./lokasi-stok-model.js";
import OrderAlkesItemModel from "./order-alkes-item-model.js";
import LokasiModel from "../datamaster/lokasi-model.js";
import PatientModel from "../admisi/patient-model.js";

export default class OrderAlkesModel extends Model {
}

OrderAlkesModel.init({
        ...identifierModel,
        no_order_alkes: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        no_reg: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        rekam_medis_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        patient_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        no_rm: {
            type: DataTypes.STRING(150),
            allowNull: false,
        },
        rekam_medis_date: {
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        order_status: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        petugas_order: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        harga_total: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        alasan_batal: {
            type: DataTypes.STRING(255),
        },
        petugas_verifikasi: {
            type: DataTypes.STRING(255),
        },
        petugas_penyiapan_obat: {
            type: DataTypes.STRING(255),
        },
        petugas_pemberi: {
            type: DataTypes.STRING(255),
        },
        petugas_pembatalan: {
            type: DataTypes.STRING(255),
        },
        penerima: {
            type: DataTypes.STRING(255),
        },
        waktu_verifikasi: {
            type: DataTypes.BIGINT,
        },
        waktu_penyiapan: {
            type: DataTypes.BIGINT,
        },
        waktu_pemberian: {
            type: DataTypes.BIGINT,
        },
        lokasi_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jenis_pelayanan: {
            type: DataTypes.ENUM("rj", "ri", "fisio", "igd"),
            allowNull: false,
        },
        lokasi_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        payment_method: {
            type: DataTypes.INTEGER,
        },
        petugas_retur: {
            type: DataTypes.STRING(255),
        },
        waktu_retur: {
            type: DataTypes.BIGINT,
        },
        ...fieldTime
    }, {
        hooks: hookModel,
        sequelize: sequelizeInstance,
        tableName: "order_alkes",
        className: "OrderAlkes",
        underscored: true,
        timestamps: false,
        indexes: [
            {
                fields: ['faskes_uuid'],
            },
        ],
        uniqueKeys: {
            uniq_scores: {
                fields: ['no_order_alkes', 'faskes_uuid']
            }
        }
    }
)

OrderAlkesModel.hasMany(OrderAlkesItemModel, {
    foreignKey: "order_alkes_uuid",
    as: "alkes_items",
    constraints: false
})

OrderAlkesModel.belongsTo(LokasiStokModel, {
    foreignKey: "lokasi_stok_uuid",
    as: "lokasi_stok",
    constraints: false
})

OrderAlkesModel.belongsTo(LokasiModel, {
    foreignKey: "lokasi_uuid",
    as: "lokasi",
    constraints: false
})

OrderAlkesModel.belongsTo(PatientModel, {
    foreignKey: "patient_uuid",
    as: "patient",
    constraints: false
})