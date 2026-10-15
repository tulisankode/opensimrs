import successResponse from "../responses/success-response.js";
import AssessmentService from "../services/assessment-service.js";

export default class AssessmentController {
    static async insert(request, response, nextFunction) {
        try {
            request.body.data.petugas = request.author.username;
            request.body.petugas = request.author.username;
            const result = await AssessmentService.insert(request.body);
            response.status(201).json(successResponse("data berhasil dibuat", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async insertCatatanPerawat(request, response, nextFunction) {
        try {
            request.body.user_uuid = request.author.userUuid ?? request.author.user_uuid;
            request.body.name = request.author.username;
            const result = await AssessmentService.insertCatatanPerawat(request.body);
            response.status(201).json(successResponse("data berhasil dibuat", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async insertInstruksiMedis(request, response, nextFunction) {
        try {
            request.body.user_uuid = request.author.userUuid ?? request.author.user_uuid;
            request.body.name = request.author.username;
            const result = await AssessmentService.insertInstruksiMedis(request.body);
            response.status(201).json(successResponse("data berhasil dibuat", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async updateInstruksiMedis(request, response, nextFunction) {
        try {
            const result = await AssessmentService.updateInstruksiMedis(request.body);
            response.status(200).json(successResponse("data berhasil diupdate", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async updateCatatanPerawat(request, response, nextFunction) {
        try {
            const result = await AssessmentService.updateCatatanPerawat(request.body);
            response.status(200).json(successResponse("data berhasil diupdate", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async insertTindakan(request, response, nextFunction) {
        try {
            request.body.petugas_input = request.author.username;
            request.body.token = request.headers["authorization"];
            const result = await AssessmentService.insertTindakan(request.body);
            response.status(201).json(successResponse("data berhasil dibuat", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async getItemBefore(request, response, nextFunction) {
        try {
            const result = await AssessmentService.getItemBefore(request.query);
            response.status(200).json(successResponse("data berhasil ditemukan", result.data, result.metadata));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async pushOrderObat(request, response, nextFunction) {
        try {
            const result = await AssessmentService.pushOrderObat(request.body);
            response.status(201).json(successResponse("data berhasil dibuat", result));
        } catch (error) {
            console.error(error);
            nextFunction(error);
        }
    }
}