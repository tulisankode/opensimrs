import { DataTypes, Model } from "sequelize";
import { uuidv7 } from "uuidv7";
import fieldTime from "./base-model.js";
import sequelizeInstance from "../../configurations/config-db.js";

export default class AddressModel extends Model {}
AddressModel.init(
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
        fullAddress: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        prov: {
            type: DataTypes.STRING(150),
            allowNull: true,
        },
        city: {
            type: DataTypes.STRING(150),
            allowNull: true,
        },
        district: {
            type: DataTypes.STRING(150),
            allowNull: true,
        },
        rt: {
            type: DataTypes.STRING(150),
            allowNull: true,
        },
        rw: {
            type: DataTypes.STRING(150),
            allowNull: true,
        },
        village: {
            type: DataTypes.STRING(150),
            allowNull: true,
        },
        postalCode: {
            type: DataTypes.STRING(150),
            allowNull: true,
        },
        country: {
            type: DataTypes.STRING(150),
            allowNull: true,
        },
        ...fieldTime,

    },
    {
        sequelize: sequelizeInstance,
        tableName: "addresses",
        underscored: true,
        timestamps: false,
    }
);
