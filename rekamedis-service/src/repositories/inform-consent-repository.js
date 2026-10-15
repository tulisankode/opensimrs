import sequelizeInstance from "@opensimrs/model-sdk/instance";
import {InformConsentModel} from "@opensimrs/model-sdk/rekam-medis";
import RekamMedisModel from "../models/mongos/rekam-medis-model.js";
import { PegawaiModel, PractitionerModel } from "@opensimrs/model-sdk/datamaster";
import moment from "moment";
import { Op } from "sequelize";

InformConsentModel.belongsTo(PractitionerModel, {
    foreignKey: "dokter_uuid",
    as: "practitioner"
})

export default class InformConsentRepository {
    static async create(request) {
        return await sequelizeInstance.transaction(async tr => {
            return await InformConsentModel.create(request, {
                transaction: tr
            });
        });
    }

    static async getAllByRekamMedisUuid(rekamMedisUuid) {
        return await InformConsentModel.findAll({
            where: {
                rekam_medis_uuid: rekamMedisUuid,
                deleted_at: { [Op.is]: null }
            },
            include: {
                model: PractitionerModel,
                as: "practitioner",
                include: {
                    model: PegawaiModel,
                    as: "pegawai"
                }
            }
        });
    }

    static async getDetailByUuid(uuid) {
        return await InformConsentModel.findOne({
            where: {
                uuid: uuid
            },
            include: {
                model: PractitionerModel,
                as: "practitioner",
                include: {
                    model: PegawaiModel,
                    as: "pegawai"
                }
            }
        });
    }

    static async delete(uuid) {
        try {

            return await InformConsentModel.update({ deletedAt: moment().unix() },
                {
                    where: { uuid, deletedAt: { [Op.is]: null } }
                }
            );

        } catch (error) {
            console.error(error);
        }
    }

}