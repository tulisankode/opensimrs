import successResponse from "../responses/success-response.js";
import MobilePasienService from "../services/mobile-pasien-service.js";

function getFaskesUuid(req) {
    return req.headers["faskes-uuid"];
}

export default class MobilePasienController {
    static async bootstrap(req, res, next) {
        try {
            const data = await MobilePasienService.bootstrap(getFaskesUuid(req));
            return res.status(200).json(successResponse("Bootstrap mobile pasien berhasil ditampilkan", data));
        } catch (error) {
            next(error);
        }
    }

    static async getFacilities(req, res, next) {
        try {
            const data = await MobilePasienService.getFacilities(getFaskesUuid(req));
            return res.status(200).json(successResponse("Faskes berhasil ditampilkan", data));
        } catch (error) {
            next(error);
        }
    }

    static async getPolyclinics(req, res, next) {
        try {
            const data = await MobilePasienService.getPolyclinics(getFaskesUuid(req));
            return res.status(200).json(successResponse("Poliklinik berhasil ditampilkan", data));
        } catch (error) {
            next(error);
        }
    }

    static async getPatients(req, res, next) {
        try {
            const data = await MobilePasienService.getPatients(getFaskesUuid(req), req.query);
            return res.status(200).json(successResponse("Pasien berhasil ditampilkan", data));
        } catch (error) {
            next(error);
        }
    }

    static async checkPatient(req, res, next) {
        try {
            const data = await MobilePasienService.checkPatient(getFaskesUuid(req), req.body);
            return res.status(200).json(successResponse("Pasien berhasil dicek", data));
        } catch (error) {
            next(error);
        }
    }

    static async getSchedules(req, res, next) {
        try {
            const data = await MobilePasienService.getSchedules(getFaskesUuid(req), req.query);
            return res.status(200).json(successResponse("Jadwal dokter berhasil ditampilkan", data));
        } catch (error) {
            next(error);
        }
    }

    static async createBooking(req, res, next) {
        try {
            const data = await MobilePasienService.createBooking(getFaskesUuid(req), req.body);
            return res.status(201).json(successResponse("Booking rawat jalan berhasil dibuat", data));
        } catch (error) {
            next(error);
        }
    }

    static async cancelBooking(req, res, next) {
        try {
            const data = await MobilePasienService.cancelBooking(getFaskesUuid(req), req.body);
            return res.status(200).json(successResponse("Booking rawat jalan berhasil dibatalkan", data));
        } catch (error) {
            next(error);
        }
    }

    static async getBookings(req, res, next) {
        try {
            const data = await MobilePasienService.getBookings(getFaskesUuid(req), req.query);
            return res.status(200).json(successResponse("Booking rawat jalan berhasil ditampilkan", data));
        } catch (error) {
            next(error);
        }
    }
}
