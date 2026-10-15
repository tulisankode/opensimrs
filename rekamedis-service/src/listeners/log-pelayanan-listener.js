
import {LOG_PELAYANAN_CHANNEL} from "../constant/event-constant.js";
import ZodValidator from "../validations/zod-validator.js";
import Utils from "../helpers/utils.js";
import EventValidation from "../validations/event-validation.js";
import LogPelayananRepository from "../repositories/log-pelayanan-repository.js";
import { eventEmitter } from "../helpers/event.js";

export default class LogPelayananListener{
    static registerEvent() {
        eventEmitter.on(LOG_PELAYANAN_CHANNEL, this.handleEvent);
    }

    static async handleEvent(data) {
        try{
            console.log("LogPelayananListener received data:", data);
            const validData = ZodValidator.validate(EventValidation.LOGPELAYANAN, data);
            Utils.bannerChannel(LOG_PELAYANAN_CHANNEL, data);
            await LogPelayananRepository.LogPelayanan(validData);
        }catch (e){
            console.log("Error on LogPelayananListener");
            console.log(e);
        }
    }
}