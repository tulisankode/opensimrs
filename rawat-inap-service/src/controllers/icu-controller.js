import IcuService from "../services/icu-service.js";
import successResponse from "../responses/success-response.js";

export default class IcuController {
    static async GetDashboard(req, res, next) {
        try {
            const result = await IcuService.GetDashboard();
            return res.status(200).json(successResponse("Berhasil mengambil dasbor ICU", result));
        } catch (error) {
            console.log("Error on IcuController.GetDashboard");
            next(error);
        }
    }

    static async GetPerawatan(req, res, next) {
        try {
            const result = await IcuService.GetPerawatan(req.params.perawatan_uuid);
            return res.status(200).json(successResponse("Berhasil mengambil detail perawatan ICU", result));
        } catch (error) {
            console.log("Error on IcuController.GetPerawatan");
            next(error);
        }
    }

    static async MulaiPerawatan(req, res, next) {
        try {
            const result = await IcuService.MulaiPerawatan(req.params.perpindahan_uuid, req.body);
            return res.status(200).json(successResponse("Berhasil memulai perawatan ICU", result));
        } catch (error) {
            console.log("Error on IcuController.MulaiPerawatan");
            next(error);
        }
    }

    static async KeluarPerawatan(req, res, next) {
        try {
            const result = await IcuService.KeluarPerawatan(req.params.perawatan_uuid, req.body);
            return res.status(200).json(successResponse("Berhasil menyelesaikan perawatan ICU", result));
        } catch (error) {
            console.log("Error on IcuController.KeluarPerawatan");
            next(error);
        }
    }

    static async TambahObservasi(req, res, next) {
        try {
            const result = await IcuService.TambahObservasi(req.params.perawatan_uuid, req.body);
            return res.status(200).json(successResponse("Berhasil menyimpan observasi", result));
        } catch (error) {
            console.log("Error on IcuController.TambahObservasi");
            next(error);
        }
    }

    static async GetObservasi(req, res, next) {
        try {
            const result = await IcuService.GetObservasi(req.params.perawatan_uuid, req.query);
            return res.status(200).json(successResponse("Berhasil mengambil observasi", result));
        } catch (error) {
            console.log("Error on IcuController.GetObservasi");
            next(error);
        }
    }

    static async KoreksiObservasi(req, res, next) {
        try {
            const result = await IcuService.KoreksiObservasi(req.params.observasi_uuid, req.body);
            return res.status(200).json(successResponse("Berhasil mengoreksi observasi", result));
        } catch (error) {
            console.log("Error on IcuController.KoreksiObservasi");
            next(error);
        }
    }

    static async TambahIntakeOutput(req, res, next) {
        try {
            const result = await IcuService.TambahIntakeOutput(req.params.perawatan_uuid, req.body);
            return res.status(200).json(successResponse("Berhasil menyimpan entri intake/output", result));
        } catch (error) {
            console.log("Error on IcuController.TambahIntakeOutput");
            next(error);
        }
    }

    static async GetBalance(req, res, next) {
        try {
            const result = await IcuService.GetBalance(req.params.perawatan_uuid, req.query);
            return res.status(200).json(successResponse("Berhasil mengambil balance cairan", result));
        } catch (error) {
            console.log("Error on IcuController.GetBalance");
            next(error);
        }
    }

    static async TambahSkorSofa(req, res, next) {
        try {
            const result = await IcuService.TambahSkorSofa(req.params.perawatan_uuid, req.body);
            return res.status(200).json(successResponse("Berhasil menyimpan skor SOFA", result));
        } catch (error) {
            console.log("Error on IcuController.TambahSkorSofa");
            next(error);
        }
    }

    static async GetSkorSofa(req, res, next) {
        try {
            const result = await IcuService.GetSkorSofa(req.params.perawatan_uuid);
            return res.status(200).json(successResponse("Berhasil mengambil riwayat skor SOFA", result));
        } catch (error) {
            console.log("Error on IcuController.GetSkorSofa");
            next(error);
        }
    }

    static async GetLaporan(req, res, next) {
        try {
            const result = await IcuService.GetLaporan(req.query);
            return res.status(200).json(successResponse("Berhasil mengambil laporan ICU", result));
        } catch (error) {
            console.log("Error on IcuController.GetLaporan");
            next(error);
        }
    }
}
