import { DataTypes } from "sequelize";
import { uuidv7 } from "uuidv7";

const defaultIdentifier = {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      unique: true,
    },
    uuid: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: true,
      unique: true,
      defaultValue: () => uuidv7(),
    },
    faskesUuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: false,
    },
  };

  export default defaultIdentifier;