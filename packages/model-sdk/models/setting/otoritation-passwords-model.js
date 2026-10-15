import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import fieldTime from "./base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class OtoritationPasswordsModel extends Model {}
OtoritationPasswordsModel.init(
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
        otorisasiMenu: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        passLama: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        passBaru: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        confirmPass: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        ...fieldTime,
    },
    {
        sequelize: sequelizeInstance,
        tableName: "otoritation_passwords",
        underscored: true,
        timestamps: false,
    }
);
