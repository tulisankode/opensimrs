import ReportService from "../services/report-service.js";
import successResponse from "../responses/success-response.js";

export default class ReportController {
    static async getExpiredItems(req, res, next) {
        try {
            const payload = {
                ...req.query,
                faskes_uuid: req.author.faskesUuid 
            };
            const result = await ReportService.getExpiredItems(payload, req.headers);
            res.status(200).json(successResponse(
                    "Data berhasil ditampilkan",
                    result.data,
                    result.pagination
                )
            );
        } catch (error) {
            next(error);
        }
    }

    static async getPersediaan(req, res, next) {
        try {
            const payload = {
                ...req.query,
                faskes_uuid: req.author.faskesUuid
            };
            const result = await ReportService.getPersediaan(payload, req.headers);
            res.status(200).json(successResponse(
                "Data berhasil ditampilkan",
                result.data,
                result.pagination
            ));
        } catch (error) {
            next(error);
        }
    }
}