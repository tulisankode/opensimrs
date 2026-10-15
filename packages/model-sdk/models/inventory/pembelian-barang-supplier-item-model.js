import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";

export default class PembelianBarangSupplierItemModel extends Model{
}

PembelianBarangSupplierItemModel.init(
    {
        ...identifierModel,
        pembelian_barang_supplier_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        item_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        qty_order: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        qty_terima: {
            type: DataTypes.INTEGER,
        },
        exp_date: {
            type: DataTypes.DATE,
        },
        harga_satuan: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        total_harga: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        konversi_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "pembelian_Barang_supplier_item",
        className: "pembelianBarangSupplierItem",
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