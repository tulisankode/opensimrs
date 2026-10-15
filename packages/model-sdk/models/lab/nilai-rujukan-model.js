import { DataTypes, Model } from "sequelize";
import identifierModel from "../farmasi/common/identifier-model.js";
import fieldTime from "../farmasi/base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class NilaiRujukanModel extends Model{}

NilaiRujukanModel.init({
    ...identifierModel,
    item_pemeriksaan_uuid: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    jenis_kelamin: {
        type: DataTypes.STRING(15),
        allowNull: false,
    },
    umur_bawah_tahun: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    umur_bawah_bulan: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    umur_bawah_hari: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    umur_atas_tahun: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    umur_atas_bulan: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    umur_atas_hari: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    batas_bawah_nilai_normal: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    batas_atas_nilai_normal: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    operator_nilai_normal: {
        type: DataTypes.CHAR(10),
        allowNull: true,
    },
    kritis_bawah :{
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    kritis_atas :{
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    operator_kritis_bawah: {
        type: DataTypes.CHAR(10),
        allowNull: true,
    },
    operator_kritis_atas: {
        type: DataTypes.CHAR(10),
        allowNull: true,
    },
    nilai_normal_text :{
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
    },
    tampilan:{
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    status:{
        type: DataTypes.BOOLEAN,
        allowNull: false,
    },
    ...fieldTime
},{
    sequelize: sequelizeInstance,
    tableName: "nilai_rujukan",
    className: "NilaiRujukan",
    underscored: true,
    timestamps: false,
    indexes: [
        {
            fields: ["item_pemeriksaan_uuid"],
        },
    ],
})