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
// // import TarifKomponenTindakanPoliRepository from "../repositories/tarif_komponen_tindakan_poli-repository.js";

// export default class TarifKomponenTindakanPoliService {
//   static async createTarifKomponenTindakanPoli(data, transaction) {
//     return await TarifKomponenTindakanPoliRepository.addTarifKomponenTindakanPoli(data, transaction);
//   }

//   static async updateTarifKomponenTindakanPoli(uuid, data, transaction) {
//     const checkUUID = Utils.validateUUID(uuid);
//     if (!checkUUID) {
//       throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
//     }

//     const existingTarifKomponenTindakanPoli =
//       await TarifKomponenTindakanPoliRepository.findTarifKomponenTindakanPoliById(
//         uuid
//       );
//     if (!existingTarifKomponenTindakanPoli) {
//       throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
//     }

//     return await TarifKomponenTindakanPoliRepository.updateTarifKomponenTindakanPoli(
//       existingTarifKomponenTindakanPoli,
//       data,
//       transaction
//     );
//   }

//   static async exportTarifKomponenTindakanPoli() {
//     const result =
//       await TarifKomponenTindakanPoliRepository.exportTarifKomponenTindakanPoli();
//     return successResponse(messageSuccessExport, result);
//   }

//   static async getTarifTindakanPoliByTarifUuids(tarifUuids) {
//     const result =
//       await TarifKomponenTindakanPoliRepository.getTarifTindakanPoliByTarifUuids(
//         tarifUuids
//       );
//     return Utils.convertSequelizeResultToSnakeCase(result);
//   }

//   static async getTarifTindakanPoliByTarifUuid(tarifUuid) {
//     const result =
//       await TarifKomponenTindakanPoliRepository.getTarifTindakanPoliByTarifUuid(
//         tarifUuid
//       );
//     return Utils.convertSequelizeResultToSnakeCase(result);
//   }

//   static async getAllTarifKomponenTindakanPoli(page, pageSize) {
//     const result =
//       await TarifKomponenTindakanPoliRepository.getAllTarifKomponenTindakanPoli(
//         page,
//         pageSize
//       );
//     return successResponse(
//       messageSuccessShow,
//       result.TarifKomponenTindakanPoliList,
//       {
//         page: result.paginationInfo.currentPage,
//         page_size: result.paginationInfo.limit,
//         total: result.totalItems,
//       }
//     );
//   }

//   static async getAllTarifKomponenTindakanPoliAktif() {
//     const result =
//       await TarifKomponenTindakanPoliRepository.getAllTarifKomponenTindakanPoliAktif();
//     return successResponse(messageSuccessShow, result);
//   }

//   static async getTarifKomponenTindakanPoliById(uuid) {
//     const checkUUID = Utils.validateUUID(uuid);
//     if (!checkUUID) {
//       throw new BadRequestException(messageErrorShow);
//     }

//     const existingTarifKomponenTindakanPoli =
//       await TarifKomponenTindakanPoliRepository.findTarifKomponenTindakanPoliById(
//         uuid
//       );
//     if (!existingTarifKomponenTindakanPoli) {
//       throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
//     }

//     return successResponse(
//       messageSuccessShow,
//       existingTarifKomponenTindakanPoli
//     );
//   }

//   static async searchTarifKomponenTindakanPoli(query, page, pageSize) {
//     const result =
//       await TarifKomponenTindakanPoliRepository.searchTarifKomponenTindakanPoli(
//         query,
//         page,
//         pageSize
//       );
//     return successResponse(
//       messageSuccessShow,
//       result.TarifKomponenTindakanPoliList,
//       {
//         page: result.paginationInfo.currentPage,
//         page_size: result.paginationInfo.limit,
//         total: result.totalItems,
//       }
//     );
//   }

//   static async deleteTarifKomponenTindakanPoli(uuid, transaction) {
//     const checkUUID = Utils.validateUUID(uuid);
//     if (!checkUUID) {
//       throw new BadRequestException(
//         messageErrorDelete,
//         messageErrorUuidNotValid
//       );
//     }

//     const existingTarifKomponenTindakanPoli =
//       await TarifKomponenTindakanPoliRepository.findTarifKomponenTindakanPoliById(
//         uuid
//       );
//     if (!existingTarifKomponenTindakanPoli) {
//       throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
//     }

//     return await TarifKomponenTindakanPoliRepository.deleteTarifKomponenTindakanPoli(
//       existingTarifKomponenTindakanPoli,
//       transaction
//     );
//   }

//   static async deleteTarifKomponenTindakanPoliByTarifUuid(
//     tarifUuid,
//     transaction
//   ) {
//     return await TarifKomponenTindakanPoliRepository.deleteTarifKomponenTindakanPoliByTarifUuid(
//       tarifUuid,
//       transaction
//     );
//   }
// }
