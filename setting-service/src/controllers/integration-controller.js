import IntegrationService from "../services/integration-service.js";
import SuccessResponse from "../responses/success-response.js";

export default class IntegrationController {
    static async findByUuid(request, response, nextFunction) {
        try {
            const result = await IntegrationService.findByUuid(request.author.faskesUuid);
            response.status(200).json(SuccessResponse("data berhasil didapat", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async updateVclaim(request, response, nextFunction) {
        try {
            request.body.uuid = request.author.faskesUuid;
            const result = await IntegrationService.updateVclaim(request.body);
            response.status(200).json(result);
            response.status(200).json(SuccessResponse("data berhasil diupdate", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async updateOther(request, response, nextFunction) {
        try {
            request.body.uuid = request.author.faskesUuid;
            const result = await IntegrationService.updateOther(request.body);
            response.status(200).json(result);
            response.status(200).json(SuccessResponse("data berhasil diupdate", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async updateSatuSehat(request, response, nextFunction) {
        try {
            request.body.uuid = request.author.faskesUuid;
            const result = await IntegrationService.updateSatuSehat(request.body);
            response.status(200).json(result);
            response.status(200).json(SuccessResponse("data berhasil diupdate", result));
        } catch (error) {
            nextFunction(error);
        }
    }
}