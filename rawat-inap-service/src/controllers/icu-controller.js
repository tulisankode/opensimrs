import IcuService from "../services/icu-service.js";
import successResponse from "../responses/success-response.js";
import IcuKhususService from "../services/icu-khusus-service.js";
import { labelUnit } from "../repositories/icu-repository.js";

// Unit intensif dipasang rute: ICU bawaan; CCU/HDU memakai pengendali yang sama lewat routes/intensif-routes.js.
const unit = (req) => req.unitIntensif ?? "icu";
const label = (req) => labelUnit(unit(req));

export default class IcuController {
    static Khusus(tindakan) {
        return async (req, res) => {
            try {
                const payload = await IcuKhususService.jalankan(tindakan, req.params, req.body, req.query);
                return res.status(200).json(successResponse("Berhasil memproses data ICU", payload));
            } catch (error) {
                const code = error.name === "ZodError" ? 400 : error.name === "SequelizeUniqueConstraintError" ? 409 : error.code ?? error.status ?? 500;
                return res.status(Number.isInteger(code) ? code : 500).json({ message: code === 409 ? "Perubahan berkonflik; muat ulang data" : code === 400 ? "Permintaan ICU tidak valid" : code === 403 || code === 404 ? error.message : "Gagal memproses data ICU", payload: null });
            }
        };
    }
    static async GetDashboard(req, res, next) {
        try {
            const result = await IcuService.GetDashboard(req.query, unit(req));
            return res.status(200).json(successResponse(`Berhasil mengambil dasbor ${label(req)}`, result));
        } catch (error) {
            console.log("Error on IcuController.GetDashboard");
            next(error);
        }
    }

    static async GetPerawatan(req, res, next) {
        try {
            const result = await IcuService.GetPerawatan(req.params.perawatan_uuid, unit(req));
            return res.status(200).json(successResponse(`Berhasil mengambil detail perawatan ${label(req)}`, result));
        } catch (error) {
            console.log("Error on IcuController.GetPerawatan");
            next(error);
        }
    }

    static async MulaiPerawatan(req, res, next) {
        try {
            const result = await IcuService.MulaiPerawatan(req.params.perpindahan_uuid, req.body, unit(req));
            return res.status(200).json(successResponse(`Berhasil memulai perawatan ${label(req)}`, result));
        } catch (error) {
            console.log("Error on IcuController.MulaiPerawatan");
            next(error);
        }
    }

    static async KeluarPerawatan(req, res, next) {
        try {
            const result = await IcuService.KeluarPerawatan(req.params.perawatan_uuid, req.body, unit(req));
            return res.status(200).json(successResponse(`Berhasil menyelesaikan perawatan ${label(req)}`, result));
        } catch (error) {
            console.log("Error on IcuController.KeluarPerawatan");
            next(error);
        }
    }

    static async TambahObservasi(req, res, next) {
        try {
            const result = await IcuService.TambahObservasi(req.params.perawatan_uuid, req.body, unit(req));
            return res.status(200).json(successResponse("Berhasil menyimpan observasi", result));
        } catch (error) {
            console.log("Error on IcuController.TambahObservasi");
            next(error);
        }
    }

    static async GetObservasi(req, res, next) {
        try {
            const result = await IcuService.GetObservasi(req.params.perawatan_uuid, req.query, unit(req));
            return res.status(200).json(successResponse("Berhasil mengambil observasi", result));
        } catch (error) {
            console.log("Error on IcuController.GetObservasi");
            next(error);
        }
    }

    static async KoreksiObservasi(req, res, next) {
        try {
            const result = await IcuService.KoreksiObservasi(req.params.observasi_uuid, req.body, unit(req));
            return res.status(200).json(successResponse("Berhasil mengoreksi observasi", result));
        } catch (error) {
            console.log("Error on IcuController.KoreksiObservasi");
            next(error);
        }
    }

    static async TambahIntakeOutput(req, res, next) {
        try {
            const result = await IcuService.TambahIntakeOutput(req.params.perawatan_uuid, req.body, unit(req));
            return res.status(200).json(successResponse("Berhasil menyimpan entri intake/output", result));
        } catch (error) {
            console.log("Error on IcuController.TambahIntakeOutput");
            next(error);
        }
    }

    static async GetBalance(req, res, next) {
        try {
            const result = await IcuService.GetBalance(req.params.perawatan_uuid, req.query, unit(req));
            return res.status(200).json(successResponse("Berhasil mengambil balance cairan", result));
        } catch (error) {
            console.log("Error on IcuController.GetBalance");
            next(error);
        }
    }

    static async TambahSkorSofa(req, res, next) {
        try {
            const result = await IcuService.TambahSkorSofa(req.params.perawatan_uuid, req.body, unit(req));
            return res.status(200).json(successResponse("Berhasil menyimpan skor SOFA", result));
        } catch (error) {
            console.log("Error on IcuController.TambahSkorSofa");
            next(error);
        }
    }

    static async GetSkorSofa(req, res, next) {
        try {
            const result = await IcuService.GetSkorSofa(req.params.perawatan_uuid, unit(req));
            return res.status(200).json(successResponse("Berhasil mengambil riwayat skor SOFA", result));
        } catch (error) {
            console.log("Error on IcuController.GetSkorSofa");
            next(error);
        }
    }

    static async GetLaporan(req, res, next) {
        try {
            const result = await IcuService.GetLaporan(req.query, unit(req));
            return res.status(200).json(successResponse(`Berhasil mengambil laporan ${label(req)}`, result));
        } catch (error) {
            console.log("Error on IcuController.GetLaporan");
            next(error);
        }
    }

    static async GetPerpindahanSiap(req, res, next) {
        try {
            const result = await IcuService.GetPerpindahanSiap(req.query, unit(req));
            return res.status(200).json(successResponse("Berhasil mengambil perpindahan yang siap ditautkan", result));
        } catch (error) {
            console.log("Error on IcuController.GetPerpindahanSiap");
            next(error);
        }
    }
}
