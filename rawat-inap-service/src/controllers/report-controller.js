import successResponse from "../responses/success-response.js";
import ReportService from "../services/report-service.js";

export default class ReportController {
    static async getAllKunjungan(req, res, next) {
        try {
            const result = await ReportService.getAllKunjungan(req.query);
            return res.status(200).json(successResponse("Data Kunjungan RI berhasil ditampilkan", result));
        } catch (error) {
            next(error);
        }
    }

    static async getCancelKunjungan(req, res, next) {
        try {
            const result = await ReportService.getCancelKunjungan(req.query);
            return res.status(200).json(successResponse("Data Batal Kunjungan RI berhasil ditampilkan", result));
        } catch (error) {
            next(error);
        }
    }

    static async getPerpindahanPasien(req, res, next) {
        try {
            const result = await ReportService.getPerpindahanPasien(req.query);
            console.log("result:", result);
            return res.status(200).json(successResponse("Data Perpindahan Pasien berhasil ditampilkan", result));
        } catch (error) {
            next(error);
        }
    }
}