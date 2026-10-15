import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import fieldTime from "./base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import AddressModel from "./address-model.js";

export default class FaskesProfilesModel extends Model {}
FaskesProfilesModel.init(
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
      allowNull: false,
      defaultValue: () => uuidv7(),
      unique: true,
    },
    faskesUuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    addressUuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "address_uuid",
    },
    phone: {
      type: DataTypes.STRING(15),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    urlGmaps: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    logo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    bgWarna: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    valuePpn: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    statusPpn: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    statusBiayaLain: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    valueBiayaLain: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    codeProvinsi: {
      type: DataTypes.STRING(50),
    },
    codeKabupaten: {
      type: DataTypes.STRING(50),
    },
    lat: {
      type: DataTypes.STRING(50),
    },
    long: {
      type: DataTypes.STRING(50),
    },
    cover: {
      type: DataTypes.TEXT,
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "faskes_profiles",
    underscored: true,
    timestamps: false,
  }
);

FaskesProfilesModel.belongsTo(AddressModel, {
  foreignKey: "addressUuid",
  targetKey: "uuid",
  as: "address",
  constraints: false,
});
