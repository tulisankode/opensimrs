import AuditTrailService from "../services/audit-trail-service.js";

export default class AuditTrailController {
  static async cari(request, response, nextFunction) {
    try {
      const hasil = await AuditTrailService.cari(request.author, request.query);
      response.status(200).json(hasil);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async detail(request, response, nextFunction) {
    try {
      const hasil = await AuditTrailService.detail(request.author, request.params.uuid);
      response.status(200).json(hasil);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async riwayatPasien(request, response, nextFunction) {
    try {
      const hasil = await AuditTrailService.riwayatPasien(request.author, request.params.patientUuid, request.query);
      response.status(200).json(hasil);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async ekspor(request, response, nextFunction) {
    try {
      const hasil = await AuditTrailService.ekspor(request.author, request.body);
      response.status(200).json(hasil);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async verifikasi(request, response, nextFunction) {
    try {
      const hasil = await AuditTrailService.verifikasi(request.author, request.body);
      response.status(200).json(hasil);
    } catch (error) {
      nextFunction(error);
    }
  }
}
