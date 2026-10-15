import ModulService from "../services/modul-service.js";
import successResponse from "../responses/success-response.js";

export default class ModulController {
  static async ambil(request, response, nextFunction) {
    try {
      response.status(200).json(successResponse("Konfigurasi modul faskes", await ModulService.ambil(request.author)));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async simpan(request, response, nextFunction) {
    try {
      response.status(200).json(successResponse("Konfigurasi modul berhasil disimpan", await ModulService.simpan(request.author, request.body)));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async simpanJenisPoli(request, response, nextFunction) {
    try {
      response.status(200).json(successResponse("Jenis poli berhasil disimpan", await ModulService.simpanJenisPoli(request.author, request.body)));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async riwayat(request, response, nextFunction) {
    try {
      response.status(200).json(successResponse("Riwayat perubahan modul", await ModulService.riwayat(request.author)));
    } catch (error) {
      nextFunction(error);
    }
  }
}
