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
  messageSuccessShow,
} from "../validations/message-validation-error.js";
import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import Utils from "../helpers/utils.js";
import TarifLabRepository from "../repositories/tarif_lab-repository.js";

export default class TarifLabService {
  static async createTarifLab(data, transaction) {
    return await TarifLabRepository.addTarifLab(data, transaction);
  }

  static async updateTarifLab(uuid, data, transaction) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const existingTarifLab = await TarifLabRepository.findTarifLabById(uuid);
    if (!existingTarifLab) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    return await TarifLabRepository.updateTarifLab(
      existingTarifLab,
      data,
      transaction
    );
  }

  static async exportTarifLab() {
    const result = await TarifLabRepository.exportTarifLab();
    return successResponse(messageSuccessExport, result);
  }

  static async getAllTarifLab() {
    const result = await TarifLabRepository.getAllTarifLab();
    return Utils.convertSequelizeResultToSnakeCase(result);
  }
  static async getTarifLabByTarifUuids(tarifUuids) {
    const result = await TarifLabRepository.getTarifLabByTarifUuids(tarifUuids);
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getTarifLabByTarifUuid(tarifUuid) {
    const result = await TarifLabRepository.getTarifLabByTarifUuid(tarifUuid);
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getAllTarifLabAktif() {
    // const result = await TarifLabRepository.getAllTarifLabAktif();
    return successResponse(messageSuccessShow);
  }

  static async getTarifLabById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }

    const existingTarifLab = await TarifLabRepository.findTarifLabById(uuid);
    if (!existingTarifLab) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    return successResponse(messageSuccessShow, existingTarifLab);
  }

  static async searchTarifLab(query, page, pageSize, faskes_uuid) {
    const {data, properties} = await TarifLabRepository.searchTarifLab(query, page, pageSize, faskes_uuid);
    return {
      message: "Berhasil menampilkan semua tarif lab",
      payload: data ?? [],
      properties
    }
  }

  static async deleteTarifLab(uuid, transaction) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(
        messageErrorDelete,
        messageErrorUuidNotValid
      );
    }

    const existingTarifLab = await TarifLabRepository.findTarifLabById(uuid);
    if (!existingTarifLab) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    return await TarifLabRepository.deleteTarifLab(
      existingTarifLab,
      transaction
    );
  }

  static async deleteTarifLabByTarifUuid(tarifUuid, transaction) {
    return await TarifLabRepository.deleteTarifLabByTarifUuid(
      tarifUuid,
      transaction
    );
  }
}
