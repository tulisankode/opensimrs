import successResponse from "../responses/success-response.js";
import MarketplaceService from "../services/marketplace-service.js";

export default class MarketplaceController {
    static async getKonfigurasi(req, res, next) {
        try {
            const result = await MarketplaceService.getKonfigurasi({ faskes_uuid: req.author.faskesUuid });
            res.status(200).json(successResponse("Konfigurasi marketplace berhasil ditampilkan", result));
        } catch (error) {
            next(error);
        }
    }

    static async putKonfigurasi(req, res, next) {
        try {
            const result = await MarketplaceService.putKonfigurasi({ ...req.body, faskes_uuid: req.author.faskesUuid });
            res.status(200).json(successResponse("Konfigurasi marketplace berhasil disimpan", result));
        } catch (error) {
            next(error);
        }
    }

    static async cariPenawaran(req, res, next) {
        try {
            const result = await MarketplaceService.cariPenawaran({ ...req.query, faskes_uuid: req.author.faskesUuid });
            res.status(200).json(successResponse("Penawaran berhasil ditampilkan", { items: result }));
        } catch (error) {
            next(error);
        }
    }

    static async getKonversiItem(req, res, next) {
        try {
            const result = await MarketplaceService.getKonversiItem({ ...req.query, faskes_uuid: req.author.faskesUuid }, req.headers);
            res.status(200).json(successResponse("Konversi item berhasil ditampilkan", result));
        } catch (error) {
            next(error);
        }
    }

    static async putPemetaan(req, res, next) {
        try {
            const result = await MarketplaceService.upsertPemetaan(
                { ...req.body, produk_mitra_id: req.params.produk_mitra_id, faskes_uuid: req.author.faskesUuid },
                req.headers
            );
            res.status(200).json(successResponse("Pemetaan produk berhasil disimpan", result));
        } catch (error) {
            next(error);
        }
    }

    static async getPemetaan(req, res, next) {
        try {
            const result = await MarketplaceService.listPemetaan({ ...req.query, faskes_uuid: req.author.faskesUuid });
            res.status(200).json(successResponse("Pemetaan produk berhasil ditampilkan", result.data, result.pagination));
        } catch (error) {
            next(error);
        }
    }

    static async createPermintaan(req, res, next) {
        try {
            const payload = { ...req.body, faskes_uuid: req.author.faskesUuid, pemohon_uuid: req.author.user_uuid, pemohon_nama: req.author.username };
            const result = await MarketplaceService.createPermintaan(payload, req.headers);
            res.status(201).json(successResponse("Permintaan marketplace berhasil diajukan", result));
        } catch (error) {
            next(error);
        }
    }

    static async getListPesanan(req, res, next) {
        try {
            const result = await MarketplaceService.listPesanan({ ...req.query, faskes_uuid: req.author.faskesUuid });
            res.status(200).json(successResponse("Daftar pesanan marketplace berhasil ditampilkan", result.data, result.pagination));
        } catch (error) {
            next(error);
        }
    }

    static async getDetailPesanan(req, res, next) {
        try {
            const result = await MarketplaceService.getDetail({ uuid: req.params.uuid, faskes_uuid: req.author.faskesUuid });
            res.status(200).json(successResponse("Detail pesanan marketplace berhasil ditampilkan", result));
        } catch (error) {
            next(error);
        }
    }

    static async persetujuan(req, res, next) {
        try {
            const payload = {
                ...req.body,
                uuid: req.params.uuid,
                faskes_uuid: req.author.faskesUuid,
                pemberi_uuid: req.author.user_uuid,
                pemberi_nama: req.author.username,
            };
            const result = await MarketplaceService.putuskanPersetujuan(payload);
            res.status(200).json(successResponse("Keputusan persetujuan berhasil disimpan", result));
        } catch (error) {
            next(error);
        }
    }

    static async checkout(req, res, next) {
        try {
            const result = await MarketplaceService.checkout({ uuid: req.params.uuid, faskes_uuid: req.author.faskesUuid });
            res.status(200).json(successResponse("Checkout marketplace berhasil diproses", result));
        } catch (error) {
            next(error);
        }
    }

    static async sinkronStatus(req, res, next) {
        try {
            const result = await MarketplaceService.sinkronStatus({ uuid: req.params.uuid, faskes_uuid: req.author.faskesUuid });
            res.status(200).json(successResponse("Status pesanan berhasil disinkronkan", result));
        } catch (error) {
            next(error);
        }
    }

    static async getPenerimaan(req, res, next) {
        try {
            const result = await MarketplaceService.getPenerimaanInfo({ uuid: req.params.uuid, faskes_uuid: req.author.faskesUuid });
            res.status(200).json(successResponse("Informasi penerimaan berhasil ditampilkan", result));
        } catch (error) {
            next(error);
        }
    }

    static async webhook(req, res, next) {
        try {
            const result = await MarketplaceService.webhook(req.params.koneksi_uuid, req.headers, req.body);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    static async laporan(req, res, next) {
        try {
            const result = await MarketplaceService.laporan({ ...req.query, faskes_uuid: req.author.faskesUuid });
            res.status(200).json(successResponse("Laporan pembelian marketplace berhasil ditampilkan", result.data, result.pagination));
        } catch (error) {
            next(error);
        }
    }
}
