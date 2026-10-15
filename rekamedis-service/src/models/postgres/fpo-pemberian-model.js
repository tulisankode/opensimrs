import {DataTypes, Model} from "sequelize";
import {hookModel} from "./common/hook-model.js";
import identifierModel from "./common/identifier-model.js";
import fieldTime from "./common/fieldTime-model.js";
import sequelizeInstance from "../../configurations/sequelize-instance.js";

export default class FpoPemberianModel extends Model {
}

FpoPemberianModel.init({
        ...identifierModel,
        prescription_item_uuid: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        jam_pemberian: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        nama_pemberi: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        note: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        ...fieldTime
    }, {
        sequelize: sequelizeInstance,
        tableName: "fpo_pemberians",
        className: "FpoPemberian",
        hooks: hookModel,
        underscored: true,
        timestamps: false,
    }
)