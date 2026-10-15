import successResponse from "../responses/success-response.js";
import PengadaanBarangService from "../services/pengadaan-barang-service.js";

export default class PengadaanBarangController {
  static async create(req, res, nextFunction) {
    try {
      const headers = req.headers;
      const payload = {
        ...req.body,
        faskes_uuid: req.author.faskesUuid,
        petugas_pembuat_po: req.author.username,
        petugas_pembuat_po_uuid: req.author.user_uuid
      };
      const result = await PengadaanBarangService.create(payload, headers);
      res.status(201).json(successResponse("Data berhasil disimpan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAll(req, res, nextFunction) {
    try {
      const options = {
        ...req.query,
        faskes_uuid: req.author.faskesUuid,
      };
      const result = await PengadaanBarangService.getAll(options);
      res.status(200).json(
          successResponse(
            "Data berhasil ditampilkan",
            result.data,
            result.pagination
          )
        );
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getDetail(req, res, nextFunction) {
    try {
      const payload = {
        uuid: req.params.uuid,
        faskes_uuid: req.author.faskesUuid,
      };
      const result = await PengadaanBarangService.getDetail(payload);
      res.status(200).json(successResponse("data berhasil didapat", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAvailableItemsForPO(req, res, next) {
        try {
            const payload = { ...req.query, faskes_uuid: req.author.faskesUuid };
            const result = await PengadaanBarangService.getAvailableItemsForPO(payload);
            res.status(200).json(successResponse("Data item berhasil ditampilkan", result));
        } catch (error) {
            next(error);
        }
    }

  static async update(req, res, nextFunction) {
    try {
      const headers = req.headers;
      const payload = {
        ...req.body,
        uuid: req.params.uuid,
        faskes_uuid: req.author.faskesUuid
      };
      const updatedPurchaseOrder = await PengadaanBarangService.update(payload, headers);
      res.status(200).json(successResponse("Data pengadaan berhasil diupdate", updatedPurchaseOrder));
    } catch (error) {
        nextFunction(error);
    }
  }

  static async cancelPembelianBarang(req, res, nextFunction) {
    try {
      const payload = {
        ...req.body,
        uuid: req.params.uuid,
        faskes_uuid: req.author.faskesUuid,
      };
      await PengadaanBarangService.cancelPembelianBarang(payload);
      res.status(200).json(successResponse("data berhasil dibatalkan"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getSuppliersByItemMedis(req, res, nextFunction) {
    try {
      const payload = {
        faskes_uuid: req.author.faskesUuid,
        kategori_items: req.query.kategori_item,
        search: req.query.search
      };
      const result = await PengadaanBarangService.getSuppliersByItemMedis(payload);;
      res.status(200).json(successResponse("Data Berhasil Ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }
}
