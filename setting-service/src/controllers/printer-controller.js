import SuccessResponse from "../responses/success-response.js";
import PrinterService from "../services/printer-service.js";

export default class PrinterController {
    static async findByUuid(request, response, nextFunction) {
        try {
            const result = await PrinterService.findByUuid(request.author.faskesUuid);
            response.status(200).json(SuccessResponse("data berhasil didapat", result));
        } catch (error) {
            nextFunction(error);
        }
    }

    static async update(request, response, nextFunction) {
        try {
            request.body.uuid = request.author.faskesUuid;
            const result = await PrinterService.update(request.body);
            response.status(200).json(result);
        } catch (error) {
            nextFunction(error);
        }
    }
}