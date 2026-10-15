import {DataTypes, Model} from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import {hookModel} from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import PrescriptionItemModel from "./prescription-item-model.js";
import LokasiStokModel from "./lokasi-stok-model.js";
import PatientModel from "../admisi/patient-model.js";
import LokasiModel from "../datamaster/lokasi-model.js";
import moment from "moment";
import FaskesModel from "../datamaster/faskes-model.js";

export default class PrescriptionModel extends Model {
}

PrescriptionModel.init({
        ...identifierModel,
        no_resep: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        no_reg: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        rekam_medis_uuid: {
            type: DataTypes.STRING(255),
        },
        patient_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        no_rm: {
            type: DataTypes.STRING(150),
            allowNull: false,
        },
        order_date: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: () => moment().unix()
        },
        order_status: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        is_takeaway: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
        lokasi_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        status_verifikasi: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        dokter_order: {
            type: DataTypes.STRING(255),
            allowNull: false,
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
        no_hp_penerima: {
            type: DataTypes.STRING(255),
        },
        alasan_batal: {
            type: DataTypes.STRING(255),
        },
        total_harga: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0
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
        status_telaah: {
            type: DataTypes.BOOLEAN,
        },
        status_edukasi: {
            type: DataTypes.BOOLEAN,
        },
        petugas_telaah: {
            type: DataTypes.STRING(255),
        },
        petugas_edukasi: {
            type: DataTypes.STRING(255),
        },
        jenis_pelayanan: {
            type: DataTypes.ENUM("rj", "ri", "fisio", "igd"),
            allowNull: false,
        },
        session_uuid: {
            type: DataTypes.STRING(255),
        },
        petugas_retur: {
            type: DataTypes.STRING(255),
        },
        waktu_retur: {
            type: DataTypes.BIGINT,
        },
        lokasi_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        payment_method: {
            type: DataTypes.INTEGER,
        },
        no_invoice: {
            type: DataTypes.STRING(255),
        },
        ...fieldTime
    }, {
        sequelize: sequelizeInstance,
        tableName: "prescriptions",
        className: "Prescription",
        underscored: true,
        timestamps: false,
        hooks: hookModel,
        indexes: [
            {
                fields: ['faskes_uuid'],
            },
        ],
        uniqueKeys: {
            uniq_scores: {
                fields: ['no_resep', 'faskes_uuid']
            }
        }
    }
)

PrescriptionModel.hasMany(PrescriptionItemModel, {
    foreignKey: "prescription_uuid",
    as: "obat",
    constraints: false
})

PrescriptionModel.belongsTo(LokasiStokModel, {
    foreignKey: "lokasi_stok_uuid",
    as: "lokasi_stok",
    constraints: false
})

PrescriptionModel.belongsTo(PatientModel, {
    foreignKey: "patient_uuid",
    as: "patient",
    constraints: false
})

PrescriptionModel.belongsTo(LokasiModel, {
    foreignKey: "lokasi_uuid",
    as: "lokasi",
    constraints: false
})

PrescriptionModel.belongsTo(FaskesModel, {
    foreignKey: 'faskes_uuid',
    as: 'faskes',
    constraints: false
})