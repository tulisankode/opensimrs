import {DataTypes, Model} from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import {hookModel} from "./common/hook-model.js";
import JenisStokModel from "./jenis-stok-model.js";
import HargaItemModel from "./harga-item-model.js";
import StockMedisModel from "../inventory/stock-medis-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import ItemMedisModel from "./item-medis-model.js";

export default class ItemMedisJenisStokModel extends Model {
}

ItemMedisJenisStokModel.init({
        ...identifierModel,
        item_medis_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jenis_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        ...fieldTime
    }, {
        sequelize: sequelizeInstance,
        tableName: "item_medis_jenis_stok",
        className: "ItemMedisJenisStok",
        hooks: hookModel,
        underscored: true,
        timestamps: false,
        indexes: [
            {
                fields: ['faskes_uuid'],
            },
        ],
        // uniqueKeys: {
        //     uniq_scores: {
        //         fields: ['jenis_stok_uuid', 'item_medis_uuid']
        //     }
        // }
    }
)

ItemMedisJenisStokModel.belongsTo(JenisStokModel, {
    foreignKey: "jenis_stok_uuid",
    as: "detail_stok",
    constraints: false
});

ItemMedisJenisStokModel.hasMany(HargaItemModel, {
    foreignKey: "item_medis_jenis_stok_uuid",
    as: "detail_harga",
})

ItemMedisJenisStokModel.hasMany(StockMedisModel, {
    foreignKey: "item_medis_jenis_stok_uuid",
    as: "stocks",
    constraints: false
})

JenisStokModel.hasMany(ItemMedisJenisStokModel, {
    foreignKey: "jenis_stok_uuid",
    as: "item_medis"
})

StockMedisModel.belongsTo(ItemMedisJenisStokModel, {
    foreignKey: "item_medis_jenis_stok_uuid",
    as: "item_medis_jenis_stok",
    constraints: false
})

ItemMedisModel.hasMany(ItemMedisJenisStokModel, {
    foreignKey: "item_medis_uuid",
    as: "jenis_stok",
    constraints: false
})

ItemMedisJenisStokModel.belongsTo(ItemMedisModel, {
    foreignKey: "item_medis_uuid",
    as: "item_medis",
    constraints: false
})