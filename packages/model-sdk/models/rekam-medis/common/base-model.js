import { DataTypes } from "sequelize";
import moment from "moment";

const fieldTime = {
  createdAt: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: false,
    defaultValue: () => moment().unix(),
  },
  updatedAt: {
    type: DataTypes.BIGINT,
    allowNull: true,
    unique: false,
  },
  deletedAt: {
    type: DataTypes.BIGINT,
    allowNull: true,
    unique: false,
  },
};

export default fieldTime;
