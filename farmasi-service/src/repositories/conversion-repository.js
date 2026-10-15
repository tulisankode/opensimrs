import {toEpochDate} from "../helpers/date-helper.js";
import {ConversionModel} from "@opensimrs/model-sdk/farmasi";
import NotfoundException from "../errors/notfound-exception.js";

export default class ConversionRepository {
    static async bulkCreate(req, transaction) {
        return await ConversionModel.bulkCreate(req, {transaction});
    }

    static async getAll(req) {
        return await ConversionModel.findAll({
            where : {
                deleted_at : null,
                faskes_uuid : req.faskes_uuid,
                item_medis_uuid : req.item_medis_uuid
            },
            attributes: {
                exclude: ['created_at', 'updated_at', 'deleted_at']
            }
        })
    }

    static async getAllConversions(req) {
        return await ConversionModel.findAll({
            where : {
                deleted_at : null,
                faskes_uuid : req.faskes_uuid
            },  
            attributes: {
                exclude: ['id', 'faskes_uuid', 'created_at', 'updated_at', 'deleted_at']
            }
        })
    }

    static async update(req, transaction) {
        const [affectedRow] =  await ConversionModel.update(req, {
            where: {
                uuid: req.uuid,
            },
            transaction
        });

        if (affectedRow === 0) {
            throw new NotfoundException("Data gagal di edit");
        }

        return affectedRow;
    }

    static async delete(req, transaction) {
        const [affectedRow] = await ConversionModel.update({
            deleted_at : toEpochDate(new Date())
        },{
            where: {
                uuid: req.uuid,
            },
            transaction
        });

        if (affectedRow === 0) {
            throw new NotfoundException("Data gagal dihapus");
        }

        return affectedRow;
    }
}