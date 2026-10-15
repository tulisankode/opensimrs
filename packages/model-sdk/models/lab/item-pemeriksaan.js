import { DataTypes, Model } from "sequelize";
import identifierModel from "../farmasi/common/identifier-model.js";
import CategoryPemeriksaanModel from "./category-pemeriksaan.js";
import PilihanHasilItemPemeriksaanModel from "./pilihan-hasil-item-pemeriksaan-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import fieldTime from "../farmasi/base-model.js";

export default class ItemPemeriksaanModel extends Model {}

ItemPemeriksaanModel.init(
  {
    ...identifierModel,
    category_pemeriksaan_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    metode: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    satuan: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    snomed_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    icd9_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    loinc_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    no_urut: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    jenis_input: {
      type: DataTypes.ENUM("angka", "text", "pilihan", "long text"),
      allowNull: true,
    },
    status_nilai_rujukan: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "item_pemeriksaan",
    className: "ItemPemeriksaan",
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ["faskes_uuid"],
      },
    ],
    uniqueKeys: {
      uniq_scores: {
        fields: ["code", "faskes_uuid", "deleted_at"],
      },
    },
  }
);

ItemPemeriksaanModel.belongsTo(CategoryPemeriksaanModel, {
  foreignKey: "category_pemeriksaan_uuid",
  as: "category_pemeriksaan",
  targetKey: "uuid",
  constraints: false,
});

ItemPemeriksaanModel.hasOne(PilihanHasilItemPemeriksaanModel, {
  foreignKey: "item_pemeriksaan_uuid",
  as: "pilihan_hasil_item_pemeriksaan",
  constraints: false,
});

// ItemPemeriksaanModel.hasMany(ItemKelompokPemeriksaanModel, {
//     foreignKey: "item_pemeriksaan_uuid",
//     as: "item_kelompok_pemeriksaan",
//     constraints: false,
// })

// ItemPemeriksaanModel.belongsToMany(KelompokPemeriksaanModel, {
//     through: ItemKelompokPemeriksaanModel,
//     foreignKey: "item_pemeriksaan_uuid",
//     otherKey: "kelompok_pemeriksaan_uuid",
//     as: "kelompok_pemeriksaan",
//     timestamps: false,
//     constraints: false,
// })
