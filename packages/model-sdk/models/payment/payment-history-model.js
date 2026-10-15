import { DataTypes, Model } from "sequelize";
import tableIdentifier from "../admisi/common/identifier-model.js";
import sequelizeInstance from "../../configurations/config-db.js";
import fieldTime from "../admisi/common/fieldTime-model.js";
import { hookModel } from "../admisi/common/hook-model.js";

export default class PaymentHistoryModel extends Model {}
PaymentHistoryModel.init(
  {
    ...tableIdentifier,
    billUuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    kasirUuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    paymentType: {
      type: DataTypes.ENUM("CASH", "INSURANCE"),
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.ENUM("CASH", "DEBIT_KREDIT", "TRANSFER"),
      allowNull: true,
    },
    information: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    receiptNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    ...fieldTime,
  },
  {
    sequelize: sequelizeInstance,
    tableName: "payment_history",
    underscored: true,
    timestamps: false,
    hooks: hookModel,
  }
);
