import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";
import ConversionModel from "../farmasi/conversion-model.js";
import ItemMedisModel from "../farmasi/item-medis-model.js";

export default class ReturSupplierItemModel extends Model{
}

ReturSupplierItemModel.init(
    {
        ...identifierModel,
        retur_supplier_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        item_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        qty_retur: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        exp_date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        harga_satuan: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        konversi_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        item_type : {
          type : DataTypes.ENUM('retur', 'replacement'),
            allowNull : false,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "retur_supplier_item",
        className: "returSupplierItem",
        hooks: hookModel,
        underscored: true,
        timestamps: false,
        indexes: [
            {
                fields: ['faskes_uuid'],
            },
        ],
    }
)

ReturSupplierItemModel.belongsTo(
    ConversionModel,
    {
        foreignKey: 'konversi_uuid',
        as: 'konversi',
        constraints: false
    }
)

ReturSupplierItemModel.belongsTo(
    ItemMedisModel,
    {
        foreignKey: 'item_uuid',
        as: 'item_medis',
        constraints: false
    }
)