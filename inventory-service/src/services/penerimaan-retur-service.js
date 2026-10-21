import PenerimaanReturRepository from "../repositories/penerimaan-retur-repository.js";
import ZodValidator from "../validations/zod-validator.js";
import PenerimaanReturValidation from "../validations/penerimaan-validation.js";
import BadRequestException from "../errors/bad-request-exception.js";
import FarmasiExternalRepository from "../repositories/farmasi-external-repository.js";
import PenerimaanReturMapper from "../mappers/penerimaan-retur-mapper.js";

export default class PenerimaanReturService {
    static async getAll(request) {
        const validated = await ZodValidator.validate(PenerimaanReturValidation.GET_ALL, request);
        const searchTrimmed = (validated.search || "").trim();
        
        let matchedLocationUuids = [];
        
        if (searchTrimmed) {
            try {
                const lokasiRes = await FarmasiExternalRepository.getLokasiStok({
                    faskes_uuid: validated.faskes_uuid,
                    name: searchTrimmed 
                }, request.headers);

                const lokasiPayload = lokasiRes?.payload || [];
                
                const filteredLokasi = lokasiPayload.filter(l => 
                    l.name.toLowerCase().includes(searchTrimmed.toLowerCase())
                );

                matchedLocationUuids = filteredLokasi.map(l => l.uuid);

            } catch (error) {
                console.warn("[Service] Gagal pre-fetch lokasi untuk pencarian:", error.message);
            }
        }
        const repositoryRequest = {
            ...validated,
            matchedLocationUuids: matchedLocationUuids 
        };

        const result = await PenerimaanReturRepository.getAll(repositoryRequest);
        if (result.data.length === 0) return result;

        const lokasiUuids = [
            ...new Set(
                result.data
                    .map(item => [item.lokasi_stok_awal_uuid, item.lokasi_stok_tujuan_uuid])
                    .flat()
                    .filter(Boolean)
            )
        ];

        let mapLokasi = new Map();
        if (lokasiUuids.length > 0) {
            const uuidParams = lokasiUuids.join(",");
            const lokasiData = await FarmasiExternalRepository.getLokasiStok({
                faskes_uuid: request.faskes_uuid,
                uuid: uuidParams, 
            }, request.headers);

            if (lokasiData?.payload) {
                mapLokasi = new Map(lokasiData.payload.map(loc => [loc.uuid, loc]));
            }
        }

        result.data = PenerimaanReturMapper.toListDTO(result.data, mapLokasi);
        return result;
    }

    // Function untuk ambil detail penerimaan retur
    static async getDetail(request) {
        // Validasi request berdasarkan schema Zod
        const validated = await ZodValidator.validate(PenerimaanReturValidation.GET_DETAIL, request);

        // Ambil detail utama dari repository internal
        const response = await PenerimaanReturRepository.getDetail({ ...validated, faskes_uuid: request.faskes_uuid });
        if (!response) throw new BadRequestException("Data tidak ditemukan");

        // Normalisasi hasil (handle instance ORM yang punya toJSON)
        const data = response.toJSON ? response.toJSON() : response;

        // Kumpulkan UUID lokasi stok yang diperlukan untuk enrichment
        const lokasiUuids = [
            data.lokasi_stok_awal_uuid, 
            data.lokasi_stok_tujuan_uuid
        ].filter(Boolean);

        // Kumpulkan UUID item medis untuk pemanggilan eksternal
        const itemUuids = data.items?.map(i => i.item_uuid).filter(Boolean) || [];

        // Ambil data lokasi & item medis dari service eksternal secara paralel
        const [lokasiRes, itemsRes] = await Promise.all([
            lokasiUuids.length > 0 ? FarmasiExternalRepository.getLokasiStok({
                faskes_uuid: request.faskes_uuid,
                uuid: lokasiUuids
            }, request.headers) : Promise.resolve({ payload: [] }),

            itemUuids.length > 0 ? FarmasiExternalRepository.getAllItemMedis({
                faskes_uuid: request.faskes_uuid,
                uuid: itemUuids 
            }, request.headers) : Promise.resolve([])
        ]);

        // Mapping lokasi & item ke dalam Map agar lookup lebih cepat
        const mapLokasi = new Map((lokasiRes.payload || []).map(l => [l.uuid, l]));
        const mapItem = new Map((itemsRes || []).map(i => [i.uuid, i]));

        console.log("--- Item UUIDs yang dicari:", itemUuids);
        console.log("--- Isi Map Item:", mapItem);
        console.log("--- Item pertama transaksi:", data.items[0]);

        // Gabungkan data utama + data eksternal ke DTO final
        return PenerimaanReturMapper.toDetailDTO(data, mapLokasi, mapItem);
    }
}