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
//   messageSuccessSave,
//   messageSuccessShow,
// } from "../validations/message-validation-error.js";
// import BadRequestException from "../errors/bad_request-exception.js";
// import NotFoundException from "../errors/notfound-exception.js";
// import Utils from "../helpers/utils.js";
// import TarifPelayananRepository from "../repositories/tarif_pelayanan-repository.js";

// export default class TarifPelayananService {
//   static async createTarifPelayanan(data, transaction) {
//     return await TarifPelayananRepository.addTarifPelayanan(data, transaction);
//   }

//   static async deleteTarifPelayananByTarifUuid(tarifUuid, transaction) {
//     return await TarifPelayananRepository.deleteTarifPelayananByTarifUuid(
//       tarifUuid,
//       transaction
//     );
//   }

//   static async updateTarifPelayanan(uuid, data, transaction) {
//     const checkUUID = Utils.validateUUID(uuid);
//     if (!checkUUID) {
//       throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
//     }

//     const existingTarifPelayanan =
//       await TarifPelayananRepository.findTarifPelayananById(uuid);
//     // console.log("PP", existingTarifPelayanan);
//     if (!existingTarifPelayanan) {
//       throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
//     }

//     return await TarifPelayananRepository.updateTarifPelayanan(
//       existingTarifPelayanan,
//       data,
//       transaction
//     );
//   }

//   static async updateTarifPelayananByTarifUuid(tarifUuid, data, transaction) {
//     const checkUUID = Utils.validateUUID(tarifUuid);
//     if (!checkUUID) {
//       throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
//     }

//     const existingTarifPelayanan =
//       await TarifPelayananRepository.findTarifPelayananByTarifUuid(tarifUuid);
//     if (!existingTarifPelayanan) {
//       throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
//     }

//     return await TarifPelayananRepository.updateTarifPelayanan(
//       existingTarifPelayanan,
//       data,
//       transaction
//     );
//   }

//   static async exportTarifPelayanan() {
//     const result = await TarifPelayananRepository.exportTarifPelayanan();
//     return successResponse(messageSuccessExport, result);
//   }

//   static async getTarifPelayananByTarifUuids(tarifUuids, unit) {
//     const result = await TarifPelayananRepository.getTarifPelayananByTarifUuids(
//       tarifUuids,
//       unit
//     );
//     return Utils.convertSequelizeResultToSnakeCase(result);
//   }

//   static async getAllTarifPelayanan() {
//     const result = await TarifPelayananRepository.getAllTarifPelayanan();
//     return Utils.convertSequelizeResultToSnakeCase(result);
//   }

//   static async getAllTarifPelayananByTarifUuid(tarifUuid) {
//     const result = await TarifPelayananRepository.getTarifPelayananByTarifId(
//       tarifUuid
//     );
//     return Utils.convertSequelizeResultToSnakeCase(result);
//   }

//   static async getAllTarifPelayananAktif() {
//     const result = await TarifPelayananRepository.getAllTarifPelayananAktif();
//     return successResponse(messageSuccessShow, result);
//   }

//   static async getTarifPelayananById(uuid) {
//     const checkUUID = Utils.validateUUID(uuid);
//     if (!checkUUID) {
//       throw new BadRequestException(messageErrorShow);
//     }

//     const existingTarifPelayanan =
//       await TarifPelayananRepository.findTarifPelayananById(uuid);
//     if (!existingTarifPelayanan) {
//       throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
//     }

//     return successResponse(messageSuccessShow, existingTarifPelayanan);
//   }

//   static async searchTarifPelayanan(query, page, pageSize) {
//     const result = await TarifPelayananRepository.searchTarifPelayanan(
//       query,
//       page,
//       pageSize
//     );
//     return successResponse(messageSuccessShow, result.TarifPelayananList, {
//       page: result.paginationInfo.currentPage,
//       page_size: result.paginationInfo.limit,
//       total: result.totalItems,
//     });
//   }

//   static async deleteTarifPelayanan(uuid, transaction) {
//     const checkUUID = Utils.validateUUID(uuid);
//     if (!checkUUID) {
//       throw new BadRequestException(
//         messageErrorDelete,
//         messageErrorUuidNotValid
//       );
//     }

//     const existingTarifPelayanan =
//       await TarifPelayananRepository.findTarifPelayananById(uuid);
//     if (!existingTarifPelayanan) {
//       throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
//     }

//     return await TarifPelayananRepository.deleteTarifPelayanan(
//       existingTarifPelayanan,
//       transaction
//     );
//   }
// }
