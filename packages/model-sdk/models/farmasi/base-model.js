import { DataTypes } from "sequelize";
import { toEpochDate } from "../../helpers/date-helper.js";
import moment from "moment";

const fieldTime = {
  created_at: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: false,
    defaultValue: () => moment().unix(),
  },
  updated_at: {
    type: DataTypes.BIGINT,
    allowNull: true,
    unique: false,
  },
  deleted_at: {
    type: DataTypes.BIGINT,
    allowNull: true,
    unique: false,
  },
};

export default fieldTime;
