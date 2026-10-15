// import successResponse from "../response/result-response.js";
// import {
//   messageErrorDataNotFound,
//   messageErrorDelete,
//   messageErrorEdit,
//   messageErrorShow,
//   messageErrorUuidNotValid,
//   messageSuccessDelete,
//   messageSuccessEdit,
//   messageSuccessExport,
//   messageSuccessShow,
// } from "../validations/message-validation-error.js";
// import BadRequestException from "../errors/bad_request-exception.js";
// import NotFoundException from "../errors/notfound-exception.js";
// import Utils from "../helpers/utils.js";
// import TarifPenjaminRepository from "../repositories/tarif_penjamin-repository.js";

// export default class TarifPenjaminService {
  
//   static async createTarifPenjamin(data, transaction) {
//     return await TarifPenjaminRepository.addTarifPenjamin(data, transaction);
//   }

//   static async deleteTarifPenjaminByTarifUuid(tarifUuid, transaction) {
//     return await TarifPenjaminRepository.deleteTarifPenjaminByTarifUuid(
//       tarifUuid,
//       transaction
//     );
//   }

//   static async deleteTarifPenjaminByTarifUuid(tarifUuid, transaction) {
//     return await TarifPenjaminRepository.deleteTarifPenjaminByTarifUuid(
//       tarifUuid,
//       transaction
//     );
//   }

//   static async updateTarifPenjamin(uuid, data, transaction) {
//     const checkUUID = Utils.validateUUID(uuid);
//     if (!checkUUID) {
//       throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
//     }

//     const existingTarifPenjamin =
//       await TarifPenjaminRepository.findTarifPenjaminById(uuid);
//     if (!existingTarifPenjamin) {
//       throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
//     }

//     return await TarifPenjaminRepository.updateTarifPenjamin(
//       existingTarifPenjamin,
//       data,
//       transaction
//     );
//   }

//   static async exportTarifPenjamin() {
//     const result = await TarifPenjaminRepository.exportTarifPenjamin();
//     return successResponse(messageSuccessExport, result);
//   }

//   static async getAllTarifPenjamin() {
//     const result = await TarifPenjaminRepository.getAllTarifPenjamin();
//     return Utils.convertSequelizeResultToSnakeCase(result);
//   }

//   static async getAllTarifPenjaminAktif() {
//     const result = await TarifPenjaminRepository.getAllTarifPenjaminAktif();
//     return successResponse(messageSuccessShow, result);
//   }

//   static async getTarifPenjaminByTarifUuids(tarifUuids, penjamin) {
//     const result = await TarifPenjaminRepository.getTarifPenjaminByTarifUuids(
//       tarifUuids,
//       penjamin
//     );
//     return Utils.convertSequelizeResultToSnakeCase(result);
//   }

//   static async getTarifPenjaminById(uuid) {
//     const checkUUID = Utils.validateUUID(uuid);
//     if (!checkUUID) {
//       throw new BadRequestException(messageErrorShow);
//     }

//     const existingTarifPenjamin =
//       await TarifPenjaminRepository.findTarifPenjaminById(uuid);
//     if (!existingTarifPenjamin) {
//       throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
//     }

//     return successResponse(messageSuccessShow, existingTarifPenjamin);
//   }

//   static async getTarifPenjaminByTarifId(tarifUuid) {
//     const result = await TarifPenjaminRepository.getTarifPenjaminByTarifId(
//       tarifUuid
//     );
//     return Utils.convertSequelizeResultToSnakeCase(result);
//   }

//   static async searchTarifPenjamin(query, page, pageSize) {
//     const result = await TarifPenjaminRepository.searchTarifPenjamin(
//       query,
//       page,
//       pageSize
//     );
//     return successResponse(messageSuccessShow, result.TarifPenjaminList, {
//       page: result.paginationInfo.currentPage,
//       page_size: result.paginationInfo.limit,
//       total: result.totalItems,
//     });
//   }

//   static async deleteTarifPenjamin(uuid, transaction) {
//     const checkUUID = Utils.validateUUID(uuid);
//     if (!checkUUID) {
//       throw new BadRequestException(
//         messageErrorDelete,
//         messageErrorUuidNotValid
//       );
//     }

//     const existingTarifPenjamin =
//       await TarifPenjaminRepository.findTarifPenjaminById(uuid);
//     if (!existingTarifPenjamin) {
//       throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
//     }

//     return await TarifPenjaminRepository.deleteTarifPenjamin(
//       existingTarifPenjamin,
//       transaction
//     );
//   }
// }
