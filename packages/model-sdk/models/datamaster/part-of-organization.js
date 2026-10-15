import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../../configurations/config-db.js";

export default class PartOfOrganizationModel extends Model {}
PartOfOrganizationModel.init(
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
      unique: false
    },
    code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: false
    },
    name: {
      type: DataTypes.STRING(255),
      unique: false,
      allowNull: false,
    },
    part_of: {
      type: DataTypes.STRING(255),
      unique: false,
      allowNull: true,
    },
    part_of_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    satu_sehat_id: {
      type: DataTypes.STRING(255),
      unique: false,
    },
    organization_ihs_number: {
      type: DataTypes.STRING(255),
      unique: false,
    },
    phone: {
      type: DataTypes.STRING(16),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    url: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    address_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false
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
    tableName: "part_of_organization",
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
        fields: ["code", "faskes_uuid", "deleted_at", "satu_sehat_id"],
      },
    },
  }
);
