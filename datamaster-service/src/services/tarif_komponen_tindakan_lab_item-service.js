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
import TarifKomponenTindakanLabItemRepository from "../repositories/tarif_komponen_tindakan_lab_item-repository.js";

export default class TarifKomponenTindakanLabItemService {

  static async createTarifKomponenTindakanLabItem(data, transaction) {
    const tarifKomponenLabItem = await TarifKomponenTindakanLabItemRepository.addTarifKomponenTindakanLabItem(data, transaction);

  }



  static async updateTarifKomponenTindakanLabItem(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const existingTarifKomponenTindakanLabItem =
      await TarifKomponenTindakanLabItemRepository.findTarifKomponenTindakanLabItemById(
        uuid
      );
    if (!existingTarifKomponenTindakanLabItem) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    await TarifKomponenTindakanLabItemRepository.updateTarifKomponenTindakanLabItem(
      existingTarifKomponenTindakanLabItem,
      data
    );
    return successResponse(messageSuccessEdit);
  }



  static async exportTarifKomponenTindakanLabItem() {
    const result =
      await TarifKomponenTindakanLabItemRepository.exportTarifKomponenTindakanLabItem();
    return successResponse(messageSuccessExport, result);
  }

  static async getAllTarifKomponenTindakanLabItem(page, pageSize) {
    const result =
      await TarifKomponenTindakanLabItemRepository.getAllTarifKomponenTindakanLabItem(
        page,
        pageSize
      );
    return successResponse(
      messageSuccessShow,
      result.TarifKomponenTindakanLabItemList,
      {
        page: result.paginationInfo.currentPage,
        page_size: result.paginationInfo.limit,
        total: result.totalItems,
      }
    );
  }

  static async getAllTarifKomponenTindakanLabItemAktif() {
    const result =
      await TarifKomponenTindakanLabItemRepository.getAllTarifKomponenTindakanLabItemAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async getTarifKomponenTindakanLabItemById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }

    const existingTarifKomponenTindakanLabItem =
      await TarifKomponenTindakanLabItemRepository.findTarifKomponenTindakanLabItemById(
        uuid
      );
    if (!existingTarifKomponenTindakanLabItem) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    return successResponse(
      messageSuccessShow,
      existingTarifKomponenTindakanLabItem
    );
  }

  static async searchTarifKomponenTindakanLabItem(query, page, pageSize) {
    const result =
      await TarifKomponenTindakanLabItemRepository.searchTarifKomponenTindakanLabItem(
        query,
        page,
        pageSize
      );
    return successResponse(
      messageSuccessShow,
      result.TarifKomponenTindakanLabItemList,
      {
        page: result.paginationInfo.currentPage,
        page_size: result.paginationInfo.limit,
        total: result.totalItems,
      }
    );
  }

  static async deleteTarifKomponenTindakanLabItem(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(
        messageErrorDelete,
        messageErrorUuidNotValid
      );
    }

    const existingTarifKomponenTindakanLabItem =
      await TarifKomponenTindakanLabItemRepository.findTarifKomponenTindakanLabItemById(
        uuid
      );
    if (!existingTarifKomponenTindakanLabItem) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await TarifKomponenTindakanLabItemRepository.deleteTarifKomponenTindakanLabItem(
      existingTarifKomponenTindakanLabItem
    );
    return successResponse(messageSuccessDelete);
  }
}
