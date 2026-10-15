import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import fieldTime from "./base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class PpnModel extends Model {}
PpnModel.init(
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
        value: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0,
        },
        status: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        ...fieldTime,
    },
    {
        sequelize: sequelizeInstance,
        tableName: "permissions",
        underscored: true,
        timestamps: false,
    }
);
