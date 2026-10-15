import { DataTypes, Model } from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import { uuidv7 } from "uuidv7";

export default class PartOfLokasiModel extends Model {}
PartOfLokasiModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      unique: true,
      autoIncrement: true,
      allowNull: false,
    },
    uuid: {
      type: DataTypes.STRING(255),
      unique: true,
      defaultValue: () => uuidv7(),
      primaryKey: true,
    },
    faskes_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: false,
    },
    code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: false,
    },
    name: {
      type: DataTypes.STRING(255),
      unique: false,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    location_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: false,
    },
    status_operasional: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    class_code: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    class_name: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    part_of: {
      type: DataTypes.STRING(255),
      unique: false,
      allowNull: true,
    },
    part_of_name: {
      type: DataTypes.STRING(255),
      unique: false,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    url: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    satu_sehat_id: {
      type: DataTypes.STRING(255),
      unique: false,
    },
    organization_ihs_number: {
      type: DataTypes.STRING(255),
      unique: false,
    },
    code_antrian_poli: {
      type: DataTypes.STRING(255),
      unique: false,
    },
    is_poli: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    status: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
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
    tableName: "part_of_lokasi",
    underscored: true,
    freezeTableName: false,
    timestamps: false,
    indexes: [
      {
        fields: ["name", "uuid"],
      },
    ],
    uniqueKeys: {
      uniq_scores: {
        fields: ["code", "deleted_at", "faskes_uuid", "satu_sehat_id"],
      },
    },
  }
);
