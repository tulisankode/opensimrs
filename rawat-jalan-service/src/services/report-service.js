import ReportRepository from "../repositories/report-repository.js";

export default class ReportService {
    
    static async getAllKunjungan(args) {
        if (!args.start_date || !args.end_date) {
            throw new Error("start_date and end_date perlu diisi");
        }
        return await ReportRepository.getAllKunjungan(args);
    }

    static async getCancelKunjungan(args) {
        if (!args.start_date || !args.end_date) {
            throw new Error("start_date and end_date perlu diisi");
        }
        return await ReportRepository.getCancelKunjungan(args);
    }

    static async getTindakans(args) {
        if (!args.timestamp) {
            throw new Error("tanggal perlu diisi");
        }
        return await ReportRepository.getTindakans(args);
    }
}