import successResponse from "../response/result-response.js";
import ConflictException from "../errors/conflict-exception.js";
import {
  messageErrorConflict,
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
import TarifRuanganRepository from "../repositories/tarif_ruangan-repository.js";

export default class TarifRuanganService {
  static async createTarifRuangan(data, transaction) {
    
    return await TarifRuanganRepository.addTarifRuangan(data, transaction);
  }

  static async updateTarifRuangan(uuid, data, transaction) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const existingTarifRuangan =
      await TarifRuanganRepository.findTarifRuanganById(uuid);
    if (!existingTarifRuangan) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    await TarifRuanganRepository.updateTarifRuangan(
      existingTarifRuangan,
      data,
      transaction
    );
    return successResponse(messageSuccessEdit);
  }

  static async updateTarifRuanganByTarifUuid(tarifUuid, data, transaction) {
    const checkUUID = Utils.validateUUID(tarifUuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const existingTarifRuangan =
      await TarifRuanganRepository.findTarifRuanganByTarifUuid(tarifUuid);
    if (!existingTarifRuangan) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    await TarifRuanganRepository.updateTarifRuangan(
      existingTarifRuangan,
      data,
      transaction
    );
    return successResponse(messageSuccessEdit);
  }

  static async exportTarifRuangan() {
    const result = await TarifRuanganRepository.exportTarifRuangan();
    return successResponse(messageSuccessExport, result);
  }

  static async getAllTarifRuangan() {
    const result = await TarifRuanganRepository.getAllTarifRuangan();
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getAllTarifRuanganAktif() {
    const result = await TarifRuanganRepository.getAllTarifRuangan();
    return successResponse(messageSuccessShow, result);
  }

  static async getTarifRuanganByTarifUuids(tarifUuids) {
    const result = await TarifRuanganRepository.getTarifRuanganByTarifUuids(
      tarifUuids
    );

    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getTarifRuanganByTarifUuid(tarifUuid) {
    const result = await TarifRuanganRepository.getTarifRuanganByTarifUuid(
      tarifUuid
    );

    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getTarifRuanganById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }

    const existingTarifRuangan =
      await TarifRuanganRepository.findTarifRuanganById(uuid);
    if (!existingTarifRuangan) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    return successResponse(messageSuccessShow, existingTarifRuangan);
  }

  static async searchTarifRuangan(query, page, pageSize) {
    const result = await TarifRuanganRepository.searchTarifRuangan(
      query,
      page,
      pageSize
    );
    return successResponse(messageSuccessShow, result.TarifRuanganList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async deleteTarifRuangan(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(
        messageErrorDelete,
        messageErrorUuidNotValid
      );
    }

    const existingTarifRuangan =
      await TarifRuanganRepository.findTarifRuanganById(uuid);
    if (!existingTarifRuangan) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await TarifRuanganRepository.deleteTarifRuangan(existingTarifRuangan);
    return successResponse(messageSuccessDelete);
  }

  static async deleteTarifRuanganByTarifUuid(tarifUuid, transaction) {
    return await TarifRuanganRepository.deleteTariRuanganByTarifUuid(
      tarifUuid,
      transaction
    );
  }
}
