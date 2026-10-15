import PerpindahanRepository from "../repositories/perpindahan-repository.js";
import ZodValidator from "../validations/zod-validator.js";
import PerpindahanRequest from "../validations/perpindahan-request.js";
import BadRequestException from "../exceptions/bad-request-exception.js";

export default class PerpindahanService{
    static async GetCurrentBed(uuid){
        return await PerpindahanRepository.GetCurrentBed(uuid);
    }

    static async RequestMoveBed(uuid, data){
        if(!uuid) throw new BadRequestException("Bad Request");
        const validData = ZodValidator.validate(PerpindahanRequest.REQUEST_MOVE_BED, data);
        return await PerpindahanRepository.RequestMoveBed(uuid, validData);
    }

    static async RejectMoveBed(uuid){
        if(!uuid) throw new BadRequestException("Bad Request");
        return await PerpindahanRepository.RejectMoveBed(uuid);
    }

    static async ApproveMoveBed(uuid){
        if(!uuid) throw new BadRequestException("Bad Request");
        return await PerpindahanRepository.ApproveMoveBed(uuid);
    }


    static async GetHistoryMoveBed(uuid){
        if(!uuid) throw new BadRequestException("Bad Request");
        return await PerpindahanRepository.GetHistoryBed(uuid);
    }

    static async GetRequestMoveBed(uuid){
        if(!uuid) throw new BadRequestException("Bad Request");
        return await PerpindahanRepository.GetDetailRequest(uuid);
    }

    static async GetTotalPending(){
        const pending = await PerpindahanRepository.CountPendingRequest();
        return {
            total: pending
        }
    }

    static async GetAllData(args){
        return await PerpindahanRepository.GetAll(args);
    }
}