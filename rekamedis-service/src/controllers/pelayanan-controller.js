import successResponse from "../responses/success-response.js";
import PelayananService from "../services/pelayanan-service.js";

export default class PelayananController {
    static async updateResume(request, response, nextFunction) {
        try {
            request.body.faskes_uuid = request.author.faskesUuid;
            const result = await PelayananService.updateResume(request.body);
            response.status(200).json(successResponse("data berhasil diupdate", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async getResume(request, response, nextFunction) {
        try {
            request.query.faskes_uuid = request.author.faskesUuid;
            const result = await PelayananService.getResume(request.query);
            response.status(200).json(successResponse("data berhasil ditemukan", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async dischargeService(request, response, nextFunction) {
        try {
            request.body.faskes_uuid = request.author.faskesUuid;
            const result = await PelayananService.dischargeService({ ...request.body, token: request.headers["authorization"] });
            response.status(200).json(successResponse("data berhasil diupdate", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async createBillingLayanan(request, response, nextFunction) {
        try {
            const { session_uuid, type, items, ref } = request.body;

            const requestBilling = {
                session_uuid: session_uuid,
                type: type,
                ref: ref,
                token: request.headers["authorization"]
            };

            const result = await PelayananService.createBillingLayanan(requestBilling, items);
            response.status(200).json(successResponse("billing layanan berhasil dibuat", result));
        } catch (error) {
            nextFunction(error);
        }
    }
}