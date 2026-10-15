import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";
import ItemMedisModel from "../farmasi/item-medis-model.js";

export default class ReturUnitItemModel extends Model{
}

ReturUnitItemModel.init(
    {
        ...identifierModel,
        retur_unit_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        kategori_item: {
            type: DataTypes.ENUM('medis', 'non-medis'),
            allowNull: false,
        },
        item_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        qty: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        qty_terima: {
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
        stok_awal_lokasi_pengirim: {
            type: DataTypes.INTEGER,
        },
        stok_awal_lokasi_penerima: {
            type: DataTypes.INTEGER,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "retur_unit_item",
        className: "returUnitItem",
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

ReturUnitItemModel.belongsTo(ItemMedisModel, {
    foreignKey: 'item_uuid',
    as: 'item',
})