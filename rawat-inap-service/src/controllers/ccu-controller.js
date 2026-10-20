import CcuService from "../services/ccu-service.js";
import successResponse from "../responses/success-response.js";

// Pengendali data khusus CCU. Episode, serah terima, flowsheet, balance cairan, dan laporan dasar memakai
// IcuController lewat routes/intensif-routes.js (unit = "ccu").
const tangani = (nama, pesan, fn) => async (req, res, next) => {
    try {
        const result = await fn(req);
        return res.status(200).json(successResponse(pesan, result));
    } catch (error) {
        console.log(`Error on CcuController.${nama}`);
        next(error);
    }
};

export default class CcuController {
    static GetKlinis = tangani("GetKlinis", "Berhasil mengambil data klinis kardiak", (req) => CcuService.GetKlinis(req.params.perawatan_uuid));
    static SimpanKlinis = tangani("SimpanKlinis", "Berhasil menyimpan data klinis kardiak", (req) => CcuService.SimpanKlinis(req.params.perawatan_uuid, req.body));

    static TambahEkg = tangani("TambahEkg", "Berhasil menyimpan EKG", (req) => CcuService.TambahEkg(req.params.perawatan_uuid, req.body));
    static GetEkg = tangani("GetEkg", "Berhasil mengambil riwayat EKG", (req) => CcuService.GetEkg(req.params.perawatan_uuid));
    static BatalEkg = tangani("BatalEkg", "Berhasil membatalkan EKG", (req) => CcuService.Batalkan("ekg", req.params.uuid, req.body));

    static TambahPenanda = tangani("TambahPenanda", "Berhasil menyimpan penanda jantung", (req) => CcuService.TambahPenanda(req.params.perawatan_uuid, req.body));
    static GetPenanda = tangani("GetPenanda", "Berhasil mengambil penanda jantung", (req) => CcuService.GetPenanda(req.params.perawatan_uuid));
    static BatalPenanda = tangani("BatalPenanda", "Berhasil membatalkan penanda jantung", (req) => CcuService.Batalkan("penanda", req.params.uuid, req.body));

    static TambahSkor = tangani("TambahSkor", "Berhasil menyimpan skor risiko", (req) => CcuService.TambahSkor(req.params.perawatan_uuid, req.body));
    static GetSkor = tangani("GetSkor", "Berhasil mengambil skor risiko", (req) => CcuService.GetSkor(req.params.perawatan_uuid));

    static TambahIntervensi = tangani("TambahIntervensi", "Berhasil menyimpan intervensi kardiak", (req) => CcuService.TambahIntervensi(req.params.perawatan_uuid, req.body));
    static GetIntervensi = tangani("GetIntervensi", "Berhasil mengambil intervensi kardiak", (req) => CcuService.GetIntervensi(req.params.perawatan_uuid));
    static BatalIntervensi = tangani("BatalIntervensi", "Berhasil membatalkan intervensi kardiak", (req) => CcuService.Batalkan("intervensi", req.params.uuid, req.body));

    static GetDashboardKardiak = tangani("GetDashboardKardiak", "Berhasil mengambil dasbor kardiak CCU", () => CcuService.GetDashboardKardiak());
    static GetLaporanKardiak = tangani("GetLaporanKardiak", "Berhasil mengambil laporan kardiak CCU", (req) => CcuService.GetLaporanKardiak(req.query));
}
