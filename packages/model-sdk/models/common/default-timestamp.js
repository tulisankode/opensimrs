import { DataTypes } from "sequelize";

const defaultTimestamp = {
  status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  createdAt: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: false,
    defaultValue: Math.floor(new Date().getTime() / 1000.0),
  },
  updatedAt: {
    type: DataTypes.BIGINT,
    allowNull: true,
    unique: false,
    defaultValue: Math.floor(new Date().getTime() / 1000.0)
  },
  deletedAt: {
    type: DataTypes.BIGINT,
    allowNull: true,
    unique: false,
  },
};
export default defaultTimestamp;