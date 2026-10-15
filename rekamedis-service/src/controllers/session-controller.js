import SessionService from "../services/session-service.js";
import successResponse from "../responses/success-response.js";

export default class SessionController {
    static async create(request, response, nextFunction) {
        try {
            const result = await SessionService.add(request.body);
            response.status(200).json(successResponse("data berhasil dibuat", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async delete(request, response, nextFunction) {
        try {
            request.body.token = request.headers["authorization"];
            console.log("body:", request.body);
            const result = await SessionService.delete(request.body);
            response.status(200).json(successResponse("data berhasil dihapus", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async getInstruksiMedises(request, response, nextFunction){
        try {
            request.query.user_uuid = request.author.userUuid ?? request.author.user_uuid;
            const result = await SessionService.getInstruksiMedises(request.query);
            response.status(200).json(successResponse("data berhasil didapat", result));
        } catch (error){
            nextFunction(error);
        }
    }

    static async getCatatanPerawat(request, response, nextFunction){
        try {
            request.query.user_uuid = request.author.userUuid ?? request.author.user_uuid;
            const result = await SessionService.getCatatanPerawat(request.query);
            response.status(200).json(successResponse("data berhasil didapat", result));
        } catch (error){
            nextFunction(error);
        }
    }
}