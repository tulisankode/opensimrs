import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";
import StockMedisModel from "./stock-medis-model.js";
import ConversionModel from "../farmasi/conversion-model.js";

export default class PengeluaranUnitItemModel extends Model{
}

PengeluaranUnitItemModel.init(
    {
        ...identifierModel,
        pengeluaran_unit_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        stock_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        qty: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        exp_date: {
            type: DataTypes.DATE,
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
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "pengeluaran_unit_item",
        className: "pengeluaranUnitItem",
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

PengeluaranUnitItemModel.belongsTo(StockMedisModel, {
    foreignKey: "stock_uuid",
    as: "stok",
    constraints: false
})

PengeluaranUnitItemModel.belongsTo(ConversionModel, {
    foreignKey: "konversi_uuid",
    as: "konversi",
    constraints: false
})