import { DataTypes, Model } from "sequelize";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./base-model.js";
import { hookModel } from "./common/hook-model.js";
import ManufactureModel from "./manufacture-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import ConversionModel from "./conversion-model.js";
import SatuanModel from "./satuan-model.js";
import KategoriObatModel from "./kategori-obat-model.js";
import BentukSediaanModel from "./bentuk-sediaan-model.js";

export default class ItemMedisModel extends Model {
}

ItemMedisModel.init({
        ...identifierModel,
        code: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        bentuk_sediaan_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        dosis: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        satuan_dosis_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        isi_kemasan: {
            type: DataTypes.FLOAT,
        },
        satuan_kemasan_uuid: {
            type: DataTypes.STRING(255),
        },
        satuan_penggunaan_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        manufacture_uuid: {
            type: DataTypes.STRING(255),
        },
        jenis_item: {
            type: DataTypes.ENUM('obat', 'alkes'),
            allowNull: false,
        },
        kategori_obat_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        ingridients: {
            type: DataTypes.JSON,
        },
        status: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        ...fieldTime
    }, {
        sequelize: sequelizeInstance,
        tableName: "item_medis",
        className: "ItemMedis",
        hooks: hookModel,
        underscored: true,
        timestamps: false,
        indexes: [
            {
                fields: ['faskes_uuid'],
            },
        ],
        uniqueKeys: {
            uniq_scores: {
                fields: ['code', 'faskes_uuid']
            }
        }
    }
)

ItemMedisModel.belongsTo(ManufactureModel, {
    foreignKey: "manufacture_uuid",
    as: "manufacture",
    constraints: false
})

ItemMedisModel.hasMany(ConversionModel, {
    foreignKey: "item_medis_uuid",
    as: "conversions",
    constraints: false
})

ItemMedisModel.belongsTo(SatuanModel, {
    foreignKey: "satuan_penggunaan_uuid",
    as: "satuan_penggunaan",
    constraints: false
})

ItemMedisModel.belongsTo(SatuanModel, {
    foreignKey: "satuan_dosis_uuid",
    as: "satuan_dosis",
    constraints: false
})

ItemMedisModel.belongsTo(SatuanModel, {
    foreignKey: "satuan_kemasan_uuid",
    as: "satuan_kemasan",
    constraints: false
})

ItemMedisModel.belongsTo(BentukSediaanModel, {
    foreignKey: "bentuk_sediaan_uuid",
    as: "bentuk_sediaan",
    constraints: false
})

ItemMedisModel.belongsTo(KategoriObatModel, {
    foreignKey: "kategori_obat_uuid",
    as: "kategori_obat",
    constraints: false
})

