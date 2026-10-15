import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../../configurations/config-db.js";
import { FaskesProfilesModel } from "../../exports/setting-exports.js";

export default class FaskesModel extends Model {}
FaskesModel.init(
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
      primaryKey: true,
      unique: true,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    organization_ihs_number: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: false,
    },
    client_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    client_secret: {
      type: DataTypes.STRING(255),
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
    tableName: "faskes",
    indexes: [
      {
        fields: ["name"],
      },
    ],
    underscored: true,
    timestamps: false,
    uniqueKeys: {
      unique_code_x_deletedAt: {
        fields: [
          "code",
          "deleted_at",
          "organization_ihs_number",
          "client_id",
          "client_secret",
        ],
      },
    },
  }
);

FaskesModel.hasOne(FaskesProfilesModel, {
  foreignKey: "faskesUuid",
  sourceKey: "uuid",
  as: "faskes_profile",
  constraints: false,
});
