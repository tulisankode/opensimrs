import { DataTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";

const Lokasi = sequelizeInstance.define(
  "Lokasi",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      unique: true,
      allowNull: false,
    },
    uuid: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv7(),
      unique: true,
      primaryKey: true,
      allowNull: false,
    },
    faskes_uuid: {
      type: DataTypes.UUID,
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
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    phone: {
      type: DataTypes.STRING(100),
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
    status_operasional: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    satu_sehat_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    org_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    location_type: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    class_code: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    class_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    part_of_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    part_of: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    code_antrian_poli: {
      type: DataTypes.STRING(15),
      unique: true,
      allowNull: true,
    },
    is_poli: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
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
    tableName: "lokasi",
    indexes: [
      {
        fields: ["name"],
      },
    ],
    underscored: true,
    timestamps: false,
  }
);

export default Lokasi;
