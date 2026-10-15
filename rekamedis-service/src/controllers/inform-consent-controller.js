import InformConsentService from "../services/inform-consent-service.js";
import successResponse from "../responses/success-response.js";

export default class InformConsentController {
    static async create(request, response, nextFunction) {
        try {
            request.body.faskes_uuid = request.author.faskesUuid;
            request.body.petugas = request.author.username;
            const result = await InformConsentService.create(request.body);
            response.status(201).json(successResponse("data berhasil dibuat"));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async getAll(request, response, nextFunction) {
        try {
            const result = await InformConsentService.getAllByRekamMedisUuid(request.query.rekam_medis_uuid);
            response.status(200).json(successResponse("data berhasil didapat", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async getDetail(request, response, nextFunction) {
        try {
            console.log(request.params.uuid);
            const result = await InformConsentService.getDetailByUuid(request.params.uuid);
            response.status(200).json(successResponse("Detail inform consent berhasil diambil", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async delete(request, response, nextFunction) {
        try {
            const { uuid } = request.params 
            console.log("uuuid", uuid);
            const result = await InformConsentService.delete(uuid);
            response.status(200).json(successResponse("Inform Consent berhasil dihapus", result));
        } catch (error) {
            nextFunction(error);
        }
    }
}