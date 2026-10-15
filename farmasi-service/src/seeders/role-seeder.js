import {FaskesModel, RoleModel} from "@opensimrs/model-sdk/datamaster";
import {Op} from "sequelize";

export default class RoleSeeder {
    static async seed(transaction) {
        const [roleAdmin, ] = await RoleModel.findOrCreate({
            where: {
                [Op.and]: [{ name: "admin1" }, { code: "ADM1" }],
            },
            defaults: {
                uuid : "0192b31f-365d-731c-8b16-3a4565c9475e",
                name: "admin 1",
                code: "ADM1",
                status: true,
            },
            // transaction: transaction
        });
    }
}