import successResponse from "../responses/success-response.js";
import PenerimaanBarangService from "../services/penerimaan-barang-service.js";

export default class PenerimaanBarangController {
    static async createPenerimaan(req, res, nextFunction) {
        try {
            const payload = {
                ...req.body,
                uuid: req.params.uuid,
                faskes_uuid: req.author.faskesUuid,
                petugas_penerima_uuid: req.author.user_uuid,
            };
            const result = await PenerimaanBarangService.createPenerimaan(payload, req.headers);
            res.status(201).json(successResponse("Data berhasil disimpan", result));
        } catch (error) {
            nextFunction(error);
        }
    }
}