import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";
import ItemMedisModel from "../farmasi/item-medis-model.js";
import ConversionModel from "../farmasi/conversion-model.js";

export default class PermintaanUnitItemModel extends Model{
}

PermintaanUnitItemModel.init(
    {
        ...identifierModel,
        permintaan_unit_uuid: {
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
        qty_pengiriman: {
            type: DataTypes.INTEGER,
        },
        qty_permintaan: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        exp_date: {
            type: DataTypes.DATE,
        },
        harga_satuan: {
            type: DataTypes.FLOAT,
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
        tableName: "permintaan_unit_item",
        className: "permintaanUnitItem",
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

PermintaanUnitItemModel.belongsTo(ItemMedisModel, {
    foreignKey: 'item_uuid',
    as: 'item_medis',
    constraints: false
})

PermintaanUnitItemModel.belongsTo(ConversionModel, {
    foreignKey: 'konversi_uuid',
    as: 'konversi',
    constraints: false
})