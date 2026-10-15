import RekamMedisService from "../services/rekam-medis-service.js";
import successResponse from "../responses/success-response.js";

export default class RekamMedisController {
    static async get(request, response, nextFunction) {
        try {
            const result = await RekamMedisService.get(request.query);
            response.status(200).json(successResponse("data berhasil didapat", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async createNew(request, response, nextFunction) {
        try {
            request.body.faskes_uuid = request.author.faskesUuid;
            const result = await RekamMedisService.createNew(request.body);
            response.status(201).json(successResponse("data berhasil disimpan", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async addRecord(request, response, nextFunction){
        try {
            const result = await RekamMedisService.addRecord(request.body);
            response.status(201).json(successResponse("data berhasil disimpan", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async getHistory(request, response, nextFunction){
        try {
            request.query.faskes_uuid = request.author.faskesUuid;
            const result = await RekamMedisService.getHistory(request.query);
            response.status(200).json(successResponse("data berhasil ditampilkan", result));
        } catch (error){
            nextFunction(error);
        }
    }
}