import successResponse from "../responses/success-response.js";
import VerifikasiBarangService from "../services/verifikasi-barang-service.js";

export default class VerifikasiBarangController {
    static async verifikasiPembelianBarang(req, res, nextFunction) {
        try {
            const payload = {
                uuid: req.params.uuid,
                faskes_uuid: req.author.faskesUuid,
                petugas_verifikasi_uuid: req.author.user_uuid,
            };
            await VerifikasiBarangService.verifikasiPembelianBarang(payload);
            res.status(200).json(successResponse("data berhasil diverifikasi"));
        } catch (error) {
            nextFunction(error);
        }
    }
}
