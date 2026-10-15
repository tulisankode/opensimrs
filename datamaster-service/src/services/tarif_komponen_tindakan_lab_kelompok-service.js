import successResponse from "../response/result-response.js";
import {
  messageErrorDataNotFound,
  messageErrorDelete,
  messageErrorEdit,
  messageErrorShow,
  messageErrorUuidNotValid,
  messageSuccessDelete,
  messageSuccessEdit,
  messageSuccessExport,
  messageSuccessSave,
  messageSuccessShow,
} from "../validations/message-validation-error.js";
import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import Utils from "../helpers/utils.js";
import TarifKomponenTindakanLabKelompokRepository from "../repositories/tarif_komponen_tindakan_lab_kelompok-repository.js";

export default class TarifKomponenTindakanLabKelompokService {
  static async createTarifKomponenTindakanLabKelompok(data, transaction) {
    return await TarifKomponenTindakanLabKelompokRepository.addTarifKomponenTindakanLabKelompok(
      data,
      transaction
    );
  }

  static async updateTarifKomponenTindakanLabKelompok(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const existingTarifKomponenTindakanLabKelompok =
      await TarifKomponenTindakanLabKelompokRepository.findTarifKomponenTindakanLabKelompokById(
        uuid
      );
    if (!existingTarifKomponenTindakanLabKelompok) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    await TarifKomponenTindakanLabKelompokRepository.updateTarifKomponenTindakanLabKelompok(
      existingTarifKomponenTindakanLabKelompok,
      data
    );
    return successResponse(messageSuccessEdit);
  }

  static async exportTarifKomponenTindakanLabKelompok() {
    const result =
      await TarifKomponenTindakanLabKelompokRepository.exportTarifKomponenTindakanLabKelompok();
    return successResponse(messageSuccessExport, result);
  }

  static async getAllTarifKomponenTindakanLabKelompok(page, pageSize) {
    const result =
      await TarifKomponenTindakanLabKelompokRepository.getAllTarifKomponenTindakanLabKelompok(
        page,
        pageSize
      );
    return successResponse(
      messageSuccessShow,
      result.TarifKomponenTindakanLabKelompokList,
      {
        page: result.paginationInfo.currentPage,
        page_size: result.paginationInfo.limit,
        total: result.totalItems,
      }
    );
  }

  static async getAllTarifKomponenTindakanLabKelompokAktif() {
    const result =
      await TarifKomponenTindakanLabKelompokRepository.getAllTarifKomponenTindakanLabKelompokAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async getTarifKomponenTindakanLabKelompokById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }

    const existingTarifKomponenTindakanLabKelompok =
      await TarifKomponenTindakanLabKelompokRepository.findTarifKomponenTindakanLabKelompokById(
        uuid
      );
    if (!existingTarifKomponenTindakanLabKelompok) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    return successResponse(
      messageSuccessShow,
      existingTarifKomponenTindakanLabKelompok
    );
  }

  static async searchTarifKomponenTindakanLabKelompok(query, page, pageSize) {
    const result =
      await TarifKomponenTindakanLabKelompokRepository.searchTarifKomponenTindakanLabKelompok(
        query,
        page,
        pageSize
      );
    return successResponse(
      messageSuccessShow,
      result.TarifKomponenTindakanLabKelompokList,
      {
        page: result.paginationInfo.currentPage,
        page_size: result.paginationInfo.limit,
        total: result.totalItems,
      }
    );
  }

  static async deleteTarifKomponenTindakanLabKelompok(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(
        messageErrorDelete,
        messageErrorUuidNotValid
      );
    }

    const existingTarifKomponenTindakanLabKelompok =
      await TarifKomponenTindakanLabKelompokRepository.findTarifKomponenTindakanLabKelompokById(
        uuid
      );
    if (!existingTarifKomponenTindakanLabKelompok) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await TarifKomponenTindakanLabKelompokRepository.deleteTarifKomponenTindakanLabKelompok(
      existingTarifKomponenTindakanLabKelompok
    );
    return successResponse(messageSuccessDelete);
  }
}
