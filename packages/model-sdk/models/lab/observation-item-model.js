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