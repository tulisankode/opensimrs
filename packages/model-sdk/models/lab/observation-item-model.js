import { DataTypes, Model } from "sequelize";
import identifierModel from "../farmasi/common/identifier-model.js";
import fieldTime from "../farmasi/base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class ObservationItemModel extends Model{}

ObservationItemModel.init({
    ...identifierModel,
    // noreg :{
    //     type: DataTypes.STRING(255),
    //     allowNull: false
    // },
    // patient_uuid:{
    //     type: DataTypes.STRING(255),
    //     allowNull: false
    // },
    // no_rm :{
    //     type: DataTypes.STRING(255),
    //     allowNull: false
    // },
    order_lab_uuid :{
        type: DataTypes.STRING(255),
        allowNull: false
    },
    item_pemeriksaan_uuid:{
        type:DataTypes.STRING(255),
        allowNull: false
    },
    result :{
        type: DataTypes.TEXT(),
        allowNull: true
    },
    flag :{
        type: DataTypes.STRING(255),
        allowNull: true
    },
    waktu_periksa :{
        type: DataTypes.STRING(255),
        allowNull: false
    },
    status_periksa :{
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    dirujuk: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    lab_rujukan_uuid: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    status_rujukan: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    waktu_kirim_rujukan: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    catatan_rujukan: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    berkas_hasil_rujukan: {
        type: DataTypes.BLOB,
        allowNull: true
    },
    berkas_hasil_rujukan_info: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    ...fieldTime
},{
    tableName: "observation_item",
    sequelize: sequelizeInstance,
    className: "ObservationItem",
    underscored: true,
    timestamps: false,
    indexes: [

        {
            fields: ["order_lab_uuid"],
        },
        {
            fields: ["item_pemeriksaan_uuid"],
        },
    ],
})