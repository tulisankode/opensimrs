import FpoService from "../services/fpo-service.js";
import successResponse from "../responses/success-response.js";

export default class FpoController {
    static async get(request, response, nextFunction) {
        try {
            const result = await FpoService.get(request.query);
            response.status(200).json(successResponse("data berhasil didapat", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async insert(request, response, nextFunction) {
        try {
            request.body.faskes_uuid = request.author.faskesUuid;
            await FpoService.insert(request.body);
            response.status(201).json(successResponse("data berhasil ditambahkan"));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async update(request, response, nextFunction) {
        try {
            await FpoService.update(request.body);
            response.status(200).json(successResponse("data berhasil diubah"));
        } catch (error) {
            nextFunction(error);
        }
    }
}