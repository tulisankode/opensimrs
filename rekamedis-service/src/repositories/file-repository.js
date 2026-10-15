import sequelizeInstance from "@opensimrs/model-sdk/instance";
import {Op} from "sequelize";
import {FileModel} from "@opensimrs/model-sdk/rekam-medis";

export default class FileRepository {
    static async create(request) {
        return await sequelizeInstance.transaction(async tr => {
            if (Array.isArray(request)) {
                return await FileModel.bulkCreate(request, {
                    transaction: tr
                });
            } else {
                return await FileModel.create(request, {
                    transaction: tr
                });
            }
        });
    }

    static async getAllByRekamMedisUuid(rekamMedisUuid) {
        return await FileModel.findAll({
            where: {
                rekam_medis_uuid: rekamMedisUuid,
                file_type: 'berkas'
            }
        });
    }

    static async getLetters(rekamMedisUuid) {
        return await FileModel.findAll({
            where: {
                rekam_medis_uuid: rekamMedisUuid,
                file_type: {
                    [Op.not]: 'berkas'
                }
            }
        });
    }

    static async downloadLetter(uuid) {
        const file = await FileModel.findOne({
            where: {
                uuid: uuid,
                file_type: {
                    [Op.not]: 'berkas'
                }
            }
        });

        return file;
    }

    static async getLastLetterByType(faskes_uuid, file_type) {
        return FileModel.findOne({
            where: {
                faskes_uuid: faskes_uuid,
                file_type: file_type
            },
            order: [
                ['created_at', 'DESC']
            ]
        });
    }

    static async deleteByUuid(uuid) {
        return await FileModel.destroy({
            where: {
                uuid: uuid
            }
        });
    }

    static async updateByUuid(request) {
        return await sequelizeInstance.transaction(async tr => {
            let affectedRow = await FileModel.update(request, {
                where: {
                    uuid: request.file_uuid
                },
                transaction: tr
            });

            return affectedRow[0];
        });
    }
}