import FarmasiExternalRepository from "../repositories/farmasi-external-repository.js";
import InternalServerException from "../errors/internal-server-exception.js";

export default class LokasiGudangService {
    static async getLokasiGudang(options, originalReq) {
        try {
            const params = {
                jenis_lokasi: "gudang", 
                name: options.search,
                page: options.page,
                limit: options.limit,
            };

            const headers = {
                authorization: originalReq.headers.authorization
            };

            if (!headers.authorization) {
                console.warn("[LokasiGudangService] Warning: No authorization token found.");
            }

            const responseData = await FarmasiExternalRepository.getLokasiStok(params, headers);

            if (!responseData || !responseData.payload) {
                throw new Error("Format respons dari Farmasi API tidak sesuai.");
            }

            let lokasiData = responseData.payload || [];
            const pagination = responseData.properties;

            if (lokasiData.length > 0) {
                lokasiData.sort((a, b) => {
                    const idA = String(a.id);
                    const idB = String(b.id);
                    // Sort Descending by ID
                    if (idB > idA) return 1;
                    if (idB < idA) return -1;
                    return 0;
                });
            }

            return {
                data: lokasiData,
                pagination: pagination,
            };
            
        } catch (error) {
            console.error("[LokasiGudangService] Error processing data:", error.message);
            throw new InternalServerException("Gagal menghubungi layanan Farmasi untuk mengambil data lokasi gudang.");
        }
    }
}