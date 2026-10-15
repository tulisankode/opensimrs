import {DataTypes, Model} from "sequelize";
import identifierModel from "../farmasi/common/identifier-model.js";
import fieldTime from "../farmasi/base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";
import LokasiStokModel from "../farmasi/lokasi-stok-model.js";
import ConversionModel from "../farmasi/conversion-model.js";

export default class StockMedisModel extends Model {
}

StockMedisModel.init({
        ...identifierModel,
        exp_date: {
            type: DataTypes.DATE,
        },
        stok: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        sisa_stok: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        konversi_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        item_medis_jenis_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        harga_satuan: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        lokasi_stok_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        no_po: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        ...fieldTime
    }, {
        sequelize: sequelizeInstance,
        tableName: "stock_medis",
        className: "StockMedis",
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


StockMedisModel.belongsTo(LokasiStokModel, {
    foreignKey: "lokasi_stok_uuid",
    as: "lokasi_stok",
    constraints: false
})

StockMedisModel.belongsTo(
    ConversionModel, {
        foreignKey: 'konversi_uuid',
        as: 'konversi',
        constraints: false
    }
)