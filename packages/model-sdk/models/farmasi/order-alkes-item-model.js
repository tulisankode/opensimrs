import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import ItemMedisModel from "./item-medis-model.js";
import JenisStokModel from "./jenis-stok-model.js";

export default class OrderAlkesItemModel extends Model {
}

OrderAlkesItemModel.init({
        ...identifierModel,
        order_alkes_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        item_medis_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        qty: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        harga_satuan: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        jenis_stok_uuid: {
            type: DataTypes.STRING(255),
        },
        stok_medis_uuides: {
            type: DataTypes.JSON
        },
        ...fieldTime
    }, {
        hooks: hookModel,
        sequelize: sequelizeInstance,
        tableName: "order_alkes_items",
        className: "OrderAlkesItem",
        underscored: true,
        timestamps: false,
        indexes: [
            {
                fields: ['faskes_uuid'],
            },
        ],
    }
)

OrderAlkesItemModel.belongsTo(ItemMedisModel, {
    foreignKey: 'item_medis_uuid',
    as: 'item_medis',
    constraints: false
});

OrderAlkesItemModel.belongsTo(JenisStokModel, {
    foreignKey: 'jenis_stok_uuid',
    as: 'jenis_stok',
    constraints: false
});