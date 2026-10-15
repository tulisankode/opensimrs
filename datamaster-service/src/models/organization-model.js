import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";
import Kelurahan from "./kelurahan-model.js";
import Kecamatan from "./kecamatan-model.js";
import Kabupaten from "./kabupaten-model.js";
import Province from "./province-model.js";

const Organization = sequelizeInstance.define(
  "Organization",
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
    faskes_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(255),
      unique: true,
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
    phone: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    url: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    address_uuid: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    part_of_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    part_of: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    satu_sehat_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: false
    },
    kode_pos: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    alamat: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.BIGINT,
      defaultValue: Math.floor(Date.now() / 1000),
    },
    updatedAt: {
      type: DataTypes.BIGINT,
      defaultValue: Math.floor(Date.now() / 1000),
    },
    deletedAt: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
  },
  {
    tableName: "organization",
    indexes: [{ fields: ["name"] }],
    underscored: true,
    timestamps: false,
  }
);
Kelurahan.belongsTo(Kecamatan, {
  foreignKey: "kecamatan_code",
  targetKey: "code",
});

Kecamatan.belongsTo(Kabupaten, {
  foreignKey: "kabupaten_code",
  targetKey: "code",
});

Kabupaten.belongsTo(Province, {
  foreignKey: "provinsi_code",
  targetKey: "code",
});

export default Organization;
