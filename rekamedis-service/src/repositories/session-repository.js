import SessionModel from "../models/mongos/session-model.js";
import RekamMedisModel from "../models/mongos/rekam-medis-model.js";
import moment from "moment";
import InstruksiMedisModel from "../models/mongos/instruksi-medis-model.js";
import CatatanPerawatModel from "../models/mongos/catatan-perawat-model.js";

export default class SessionRepository {
    static async getById(id) {
        return await SessionModel.findById(id).exec();
    }

    static async add(rekamMedisId, dateOrder) {
        const session = new SessionModel();

        await session.save();
        return await RekamMedisModel.findOneAndUpdate({_id: rekamMedisId}, {
            $push: {
                [`daily_records.${dateOrder}.sessions`]: session._id
            }
        }, {new: true}).exec();
    }

    static async delete(id, alasan) {
        return await SessionModel.findOneAndUpdate({_id: id}, {
            "deleted_at": moment().unix(),
            "alasan": alasan
        }, {new: true}).exec();
    }

    static async getInstruksiMedises(sessionUuid){
        return await InstruksiMedisModel.find({
            session_uuid: sessionUuid
        }).populate('reply').exec();
    }

    static async getCatatanPerawat(sessionUuid){
        return await CatatanPerawatModel.find({
            session_uuid: sessionUuid
        }).populate('reply').exec();
    }
}