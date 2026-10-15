import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import fieldTime from "./base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class PrinterModel extends Model {}
PrinterModel.init(
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
        header: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        background: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        footer: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        ...fieldTime,
    },
    {
        sequelize: sequelizeInstance,
        tableName: "printers",
        underscored: true,
        timestamps: false,
    }
);
