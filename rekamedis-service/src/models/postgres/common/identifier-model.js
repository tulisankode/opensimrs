import { DataTypes } from "sequelize";
import {uuidv7} from "uuidv7";

const tableIdentifier = {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        unique: true,
    },
    uuid: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        defaultValue: function() {
            return uuidv7();
        },
        allowNull: false,
        unique: true,
    },
    faskes_uuid: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: false,
    },
}

export default tableIdentifier;