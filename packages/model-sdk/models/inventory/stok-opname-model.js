import fieldTime from "../farmasi/base-model.js";
import identifierModel from "../farmasi/common/identifier-model.js";
import {DataTypes, Model} from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import {hookModel} from "../farmasi/common/hook-model.js";

export default class StokOpnameModel extends Model{
}

StokOpnameModel.init(
    {
        ...identifierModel,
        no_stok_opname: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        tanggal_cut_off: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        judul_stok_opname: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jenis_stoks: {
            type: DataTypes.JSON,
            allowNull: false,
        },
        kategori_item: {
            type: DataTypes.ENUM('medis', 'non-medis'),
            allowNull: false,
        },
        jenis_items: {
            type: DataTypes.JSON,
            allowNull: false,
        },
        petugas_so: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        petugas_pengubah: {
            type: DataTypes.STRING(255),
        },
        status: {
            type: DataTypes.ENUM('draft', 'final', 'process'),
            allowNull: false,
        },
        lokasi_stok_uuid : {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        error_message : {
            type : DataTypes.TEXT,
        },
        ...fieldTime
    },
    {
        sequelize: sequelizeInstance,
        tableName: "stok_opname",
        className: "stokOpname",
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