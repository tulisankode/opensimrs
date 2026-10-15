import sequelizeInstance from "../configurations/sequelize-instance.js";
import {Op} from "sequelize";
import {PrinterModel} from "@opensimrs/model-sdk/setting";

export default class PrinterRepository {
    static async findByFaskesUuid(uuid) {
        return await sequelizeInstance.transaction(async (tr) => {
            return await PrinterModel.findOne({
                where: {
                    [Op.and]: [
                        {faskesUuid: uuid},
                        {
                            deletedAt: {
                                [Op.is]: null
                            }
                        }
                    ]
                },
                transaction: tr
            });
        });
    }

    static async create(req) {
        return await sequelizeInstance.transaction(async (tr) => {
            return await PrinterModel.create(req, {
                transaction: tr
            });
        });
    }

    static async update(req) {
        return await sequelizeInstance.transaction(async (tr) => {
            let affectedRow = await PrinterModel.update(req, {
                where: {
                    [Op.and]: [
                        {faskes_uuid: req.uuid},
                        {
                            deletedAt: {
                                [Op.is]: null
                            }
                        }
                    ]
                },
                transaction: tr
            });

            return affectedRow[0];
        });
    }
}