import successResponse from "../responses/success-response.js";
import PrescriptionService from "../services/prescription-service.js";

export default class PrescriptionController {
  static async orderObat(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.dokter_order = req.author.username;
      req.body.token = req.get("Authorization");

      await PrescriptionService.orderObat(req.body);

      res.status(200).json(successResponse("Data berhasil disimpan"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async editSisaObat(req, res, nextFunction){
     try {
       const data = req.body;
       const prescription_item_uuid = req.params.prescription_item_uuid;
       const result = await PrescriptionService.editSisaObat(
         data,
         prescription_item_uuid,
         req.author.faskesUuid
       );
       res
         .status(200)
         .json(successResponse("Sisa obat berhasil diubah", result));
     } catch (error) {
       nextFunction(error);
     }
  }

  static async addObat(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await PrescriptionService.addObat(req.body);
      res
        .status(200)
        .json(successResponse("data berhasil ditambahkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteObat(req, res, nextFunction) {
    try {
      req.body.prescription_item_uuid = req.params.prescription_item_uuid;
      req.body.faskes_uuid = req.author.faskesUuid;
      await PrescriptionService.deleteObat(req.body);
      res.status(200).json(successResponse("Data berhasil dihapus"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getByUuid(req, res, nextFunction) {
    try {
      const result = await PrescriptionService.getByUuid(
        req.params.uuid,
        req.author.faskesUuid
      );
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async substituteItem(req, res, nextFunction) {
    try {
      const result = await PrescriptionService.substituteItem(
        req.body,
        req.author
      );
      res
        .status(200)
        .json(successResponse("Obat berhasil disubstitusi", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getOpsiSubstitusi(req, res, nextFunction) {
    try {
      const result = await PrescriptionService.getOpsiSubstitusi(
        req.params.uuid,
        req.author.faskesUuid
      );
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getRiwayatSubstitusi(req, res, nextFunction) {
    try {
      const result = await PrescriptionService.getRiwayatSubstitusi(
        req.params.uuid,
        req.author.faskesUuid
      );
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updatePrescription(req, res, nextFunction) {
    try {
      req.body.uuid = req.params.uuid;
      req.body.faskes_uuid = req.author.faskesUuid;
      await PrescriptionService.updatePrescription(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateObat(req, res, nextFunction) {
    try {
      req.body.uuid = req.params.uuid;
      req.body.faskes_uuid = req.author.faskesUuid;
      await PrescriptionService.updateObat(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getHistoryObat(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.no_rm = req.query.no_rm;
      req.body.group_index = (req.query.page ?? 1) - 1;
      req.body.pelayanan = req.query.pelayanan;
      const result = await PrescriptionService.getHistoryObat(req.body);
      res
        .status(200)
        .json(
          successResponse(
            "Data berhasil ditampilkan",
            result.data,
            result.metadata
          )
        );
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getOrderBySomeUuid(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await PrescriptionService.getOrderBySomeUuid(req.body);
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateTelaah(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      await PrescriptionService.updateTelaah(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async batalOrder(req, res, nextFunction) {
    try {
      req.body.petugas_pembatalan = req.author.username;
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.token = req.get("Authorization");
      await PrescriptionService.batalOrder(req.body);
      res.status(200).json(successResponse("data berhasil dibatalkan"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateVerifikasi(req, res, nextFunction) {
    try {
      req.body.petugas_verifikasi = req.author.username;
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.token = req.get("Authorization");

      await PrescriptionService.updateVerifikasi(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateSiapDiserahkan(req, res, nextFunction) {
    try {
      req.body.petugas_penyiapan_obat = req.author.username;
      req.body.faskes_uuid = req.author.faskesUuid;
      await PrescriptionService.updateSiapDiserahkan(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateDiserahkan(req, res, nextFunction) {
    try {
      req.body.petugas_pemberi = req.author.username;
      req.body.faskes_uuid = req.author.faskesUuid;
      await PrescriptionService.updateDiserahkan(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async batalSiapDiserahkan(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      await PrescriptionService.batalSiapDiserahkan(req.body);
      res.status(200).json(successResponse("data berhasil dibatalkan"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateLokasiStok(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      await PrescriptionService.updateLokasiStok(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAll(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await PrescriptionService.getAll(req.body);
      res
        .status(200)
        .json(successResponse("data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateJenisStokItem(req, res, nextFunction) {
    try {
      req.body.uuid = req.params.uuid;
      req.body.faskes_uuid = req.author.faskesUuid;
      await PrescriptionService.updateJenisItem(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getForFpo(req, res, nextFunction) {
    try {
      const result = await PrescriptionService.getForFpo({
        ...req.query,
        faskes_uuid: req.author.faskesUuid,
      });
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getEticketData(req, res, nextFunction) {
    try {
      const result = await PrescriptionService.getEticketData(
        req.params.uuid,
        req.author.faskesUuid
      );
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getPrintPrescription(req, res, nextFunction) {
    try {
      const result = await PrescriptionService.getPrintPrescription(
        req.params.uuid,
        req.author.faskesUuid
      );
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getForInvoicePrint(req, res, nextFunction) {
    try {
      const result = await PrescriptionService.getForInvoicePrint(
        req.params.uuid,
        req.author.faskesUuid
      );
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }
}
