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
        let report = await ReportRepository.getTindakans(args);
        let result = report.data.reduce((acc, curr) => {
            let found = acc.find(item => item.tarif_uuid === curr.tarif_uuid);

            if (found) {
                found.jumlah_tindakan += curr.qty_tindakan;
            } else {
                acc.push({
                    nama_tindakan: curr.nama_tindakan,
                    jumlah_tindakan: curr.qty_tindakan,
                    tarif_uuid: curr.tarif_uuid
                });
            }

            return acc;
        }, []);


        result = result.map(({nama_tindakan, jumlah_tindakan}) => ({
            nama_tindakan,
            jumlah_tindakan
        }));

        report.data = result;

        return report;
    }
}