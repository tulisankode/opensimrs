import { DataTypes, Model } from "sequelize";
import fieldTime from "../farmasi/base-model.js";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../../configurations/config-db.js";

export default class ItemKelompokPemeriksaanModel extends Model {}

ItemKelompokPemeriksaanModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      unique: true,
      allowNull: false,
    },
    uuid: {
      type: DataTypes.STRING(255),
      defaultValue: () => uuidv7(),
      unique: true,
      primaryKey: true,
      allowNull: false,
    },
    kelompok_pemeriksaan_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    item_pemeriksaan_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ...fieldTime,
  },
  {
    tableName: "item_kelompok_pemeriksaan",
    className: "ItemKelompokPemeriksaan",
    underscored: true,
    timestamps: false,
    sequelize: sequelizeInstance,
    indexes: [
      {
        fields: ["kelompok_pemeriksaan_uuid"],
      },
      {
        fields: ["item_pemeriksaan_uuid"],
      },
    ],
    underscored: true,
    timestamps: false,
  }
);





// ItemKelompokPemeriksaanModel.belongsTo(KelompokPemeriksaanModel, {
//   foreignKey: "kelompok_pemeriksaan_uuid",
//   as: "kelompok_pemeriksaan",
//   constraints: false,
// })

// ItemKelompokPemeriksaanModel.belongsTo(ItemPemeriksaanModel, {
//   foreignKey: "item_pemeriksaan_uuid",
//   as: "item_pemeriksaan",
//   constraints: false,
// })






