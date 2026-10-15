import sequelizeInstance from "../../configurations/config-db.js";
import { DataTypes, Model } from "sequelize";

export default class GenralConsenMasterModel extends Model {}
GenralConsenMasterModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      unique: true,
    },
    uuid: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: true,
      unique: true,
      defaultValue: () => uuidv7(),
    },
    faskes_uuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: false,
    },
    code: {
      type: DataTypes.STRING(255),
      unique: false,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      unique: false,
      allowNull: false,
    },
    isi_surat: {
      type: DataTypes.TEXT,
      unique: false,
      allowNull: false,
    },
    status: {
      type: DataTypes.BOOLEAN,
      unique: false,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.BIGINT,
      defaultValue: Math.floor(Date.now() / 1000.0),
    },
    updatedAt: {
      type: DataTypes.BIGINT,
      defaultValue: Math.floor(Date.now() / 1000.0),
    },
    deletedAt: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
  },
  {
    sequelize: sequelizeInstance,
    underscored: true,
    freezeTableName: false,
    tableName: "general_consen_master",
    timestamps: false,
    indexes: [
      {
        fields: ["name", "code"],
      },
    ],
    uniqueKeys: {
      unique_faskes_x_code_x_deletedAt: {
        fields: ["code", "faskes_uuid", "deleted_at"],
      },
    },
  }
);
