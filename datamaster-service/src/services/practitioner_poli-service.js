// import ZodValidator from "../validations/validator.js";
// import ValidationException from "../errors/validation-exception.js";
// import DatabaseException from "../errors/database-exception.js";
// import successResponse from "../response/result-response.js";
// import xlsx from "node-xlsx";
// import fs from "fs/promises";
// import SatuSehatId from "../helpers/axios-instance.js";
// import {
//   messageErrorDataNotFound,
//   messageErrorDelete,
//   messageErrorEdit,
//   messageErrorSave,
//   messageErrorShow,
//   messageErrorUuidNotValid,
//   messageSuccessDelete,
//   messageSuccessEdit,
//   messageSuccessExport,
//   messageSuccessSave,
//   messageSuccessShow,
// } from "../validations/message-validation-error.js";
// import NotFoundException from "../errors/notfound-exception.js";
// import Utils from "../helpers/utils.js";
// import BadRequestException from "../errors/bad_request-exception.js";
// import PractitionerPoliValidation from "../validations/practitioner_poli-validation.js";
// import PractitionerPoliRepository from "../repositories/practitioner_poli-repository.js";

// export default class PractitionerPoliService {
//   static async createPractitionerPoli(data, transaction) {
//     // const validationResult = ZodValidator.validate(
//     //   PractitionerPoliValidation.CREATE,
//     //   data
//     // );

//     // if (validationResult.errors) {
//     //   throw new ValidationException({
//     //     message: messageErrorSave,
//     //     errors: validationResult.errors,
//     //   });
//     // }

//     // // const satu_sehat_id = await SatuSehatId.getSatuSehatIdByNik(pegawai.nik);
//     // await PractitionerPoliRepository.addPractitionerPoli(data);
//     // return successResponse(messageSuccessSave);

//     return await PractitionerPoliRepository.addPractitionerPoli(
//       data,
//       transaction
//     );
//   }

//   static async updatePractitionerPoli(uuid, data, transaction) {
//     const checkUUID = Utils.validateUUID(uuid);
//     if (!checkUUID) {
//       throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
//     }

//     const validationResult = ZodValidator.validate(
//       PractitionerPoliValidation.UPDATE,
//       data
//     );

//     if (validationResult.errors) {
//       throw new ValidationException({
//         message: messageErrorSave,
//         errors: validationResult.errors,
//       });
//     }

//     const existingPractitionerPoli =
//       await PractitionerPoliRepository.findPractitionerPoliById(uuid);
//     if (!existingPractitionerPoli) {
//       throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
//     }

//     await PractitionerPoliRepository.updatePractitionerPoli(
//       existingPractitionerPoli,
//       data,
//       transaction
//     );
//     return successResponse(messageSuccessEdit);
//   }

//   static async getAllPractitionerPoli(page, pageSize) {
//     const result = await PractitionerPoliRepository.getAllPractitionerPoli(
//       page,
//       pageSize
//     );
//     return successResponse(messageSuccessShow, result.practitionerPoliList, {
//       page: result.paginationInfo.currentPage,
//       page_size: result.paginationInfo.limit,
//       total: result.totalItems,
//     });
//   }

//   static async getAllPractitionerPoliByPractitionerUuids(uuids) {
//     const result =
//       await PractitionerPoliRepository.getAllPractitionerPoliByPractitionerUuids(
//         uuids
//       );

//     return Utils.convertSequelizeResultToSnakeCase(result);
//   }

//   static async getAllPractitionerPoliByPractitionerUuid(uuid) {
//     const result =
//       await PractitionerPoliRepository.getAllPractitionerPoliByPractitionerUuid(
//         uuid
//       );

//     return Utils.convertSequelizeResultToSnakeCase(result);
//   }

//   static async exportPractitionerPoli() {
//     const result = await PractitionerPoliRepository.exportPractitionerPoli();
//     return successResponse(messageSuccessExport, result);
//   }

//   // Import all PractitionerPoli
//   static async importPractitionerPoli(filePath) {
//     let dataValid = [];
//     let error = [];

//     try {
//       // Membaca file dari disk
//       const fileBuffer = await fs.readFile(filePath);

//       // Mengurai file Excel yang diterima sebagai buffer
//       const data = xlsx.parse(fileBuffer);

//       // check banyak sheet
//       // for (let s = 0; s < data.length; s++) {
//       // check data sheet 0
//       for (let i = 1; i < data[0].data.length; i++) {
//         const no = data[0].data[i][0];
//         const PractitionerPoli_uuid = data[0].data[i][1];
//         const code_bpjs = data[0].data[i][2];
//         const code_antrian = data[0].data[i][3];
//         const name = data[0].data[i][4];
//         const title = data[0].data[i][5];
//         const sip = data[0].data[i][6];
//         const str = data[0].data[i][7];
//         const lokasi_uuid = data[0].data[i][8];
//         const satu_sehat_id = data[0].data[i][9];
//         const NIK = data[0].data[i][10];
//         const tanggal_lahir = data[0].data[i][11];
//         const gender = data[0].data[i][12];
//         const status = data[0].data[i][13];

//         // validate data
//         if (!PractitionerPoli_uuid || PractitionerPoli_uuid == undefined) {
//           error.push(
//             "PractitionerPoli UUID Pada Baris " + (no + 1) + " Kosong "
//           );
//           continue;
//         }
//         if (!code_bpjs || code_bpjs == undefined) {
//           error.push("Kode BPJS Pada Baris " + (no + 1) + " Kosong ");
//           continue;
//         }
//         if (!code_antrian || code_antrian == undefined) {
//           error.push("Kode Antrian Pada Baris " + (no + 1) + " Kosong ");
//           continue;
//         }
//         if (!name || name == undefined) {
//           error.push(
//             "Name PractitionerPoli Pada Baris " + (no + 1) + " Kosong "
//           );
//           continue;
//         }
//         if (!sip || sip == undefined) {
//           error.push(
//             "SIP PractitionerPoli Pada Baris " + (no + 1) + " Kosong "
//           );
//           continue;
//         }
//         if (!str || str == undefined) {
//           error.push(
//             "SIP PractitionerPoli Pada Baris " + (no + 1) + " Kosong "
//           );
//           continue;
//         }
//         if (!lokasi_uuid || lokasi_uuid == undefined) {
//           error.push("Lokasi UUID Pada Baris " + (no + 1) + " Kosong ");
//           continue;
//         }
//         if (!satu_sehat_id || satu_sehat_id == undefined) {
//           error.push("Satu Sehat Id Pada Baris " + (no + 1) + " Kosong ");
//           continue;
//         }
//         if (!NIK || NIK == undefined) {
//           error.push(
//             "NIK PractitionerPoli Pada Baris " + (no + 1) + " Kosong "
//           );
//           continue;
//         }
//         if (!tanggal_lahir || tanggal_lahir == undefined) {
//           error.push(
//             "Tanggal Lahir PractitionerPoli Pada Baris " + (no + 1) + " Kosong "
//           );
//           continue;
//         }
//         if (!gender || gender == undefined) {
//           error.push(
//             "Gender PractitionerPoli Pada Baris " + (no + 1) + " Kosong "
//           );
//           continue;
//         }
//         if (status == undefined) {
//           error.push(
//             "Status PractitionerPoli Pada Baris " + (no + 1) + " Kosong "
//           );
//           continue;
//         }

//         dataValid.push({
//           PractitionerPoli_uuid: PractitionerPoli_uuid,
//           code_bpjs: code_bpjs,
//           code_antrian: code_antrian,
//           name: name,
//           sip: String(sip),
//           str: str,
//           lokasi_uuid: lokasi_uuid,
//           tanggal_lahir: tanggal_lahir,
//           satu_sehat_id: satu_sehat_id,
//           nik: String(NIK),
//           gender: gender,
//           status: status,
//           title: title,
//         });
//       }
//       // }

//       if (error.length > 0) {
//         return {
//           success: false,
//           message: "Import data gagal",
//           total_error: error.length,
//           errors: error,
//         };
//       }
//     } catch (error) {
//       throw new Error(`DatabaseException: ${error.message}`);
//     }

//     let dataValidZod = [];

//     for (let i = 0; i < dataValid.length; i++) {
//       const validationResult = ZodValidator.validate(
//         PractitionerPoliValidation.CREATE,
//         dataValid[i]
//       );

//       dataValidZod.push(validationResult);
//     }

//     try {
//       let messageInsert = [];
//       // Proses data yang valid
//       for (let i = 0; i < dataValidZod.length; i++) {
//         await PractitionerPoliRepository.addPractitionerPoli(dataValidZod[i]);
//         messageInsert.push(
//           "PractitionerPoli Baris " + (i + 1) + " Berhasil Diimport"
//         );
//       }

//       // Mengembalikan respons dengan informasi sukses dan error
//       return successResponse(messageInsert);
//     } catch (error) {
//       throw new DatabaseException(error.message, error.statusCode);
//     }
//   }

//   static async getAllPractitionerPoliAktif() {
//     const result =
//       await PractitionerPoliRepository.getAllPractitionerPoliAktif();
//     return successResponse(messageSuccessShow, result);
//   }

//   static async getPractitionerPoliById(uuid) {
//     const checkUUID = Utils.validateUUID(uuid);
//     if (!checkUUID) {
//       throw new BadRequestException(messageErrorShow);
//     }
//     const practitionerPoli =
//       await PractitionerPoliRepository.findPractitionerPoliById(uuid);
//     return successResponse(messageSuccessShow, practitionerPoli);
//   }

//   static async getPractitionerPoliNameByUuid(uuid) {
//     const result =
//       await PractitionerPoliRepository.getPractitionerPoliNameByUuid(uuid);
//     return Utils.convertSequelizeResultToSnakeCase(result);
//   }

//   static async searchPractitionerPoli(query, page, pageSize) {
//     const result = await PractitionerPoliRepository.searchPractitionerPoli(
//       query,
//       page,
//       pageSize
//     );

//     return successResponse(messageSuccessShow, result.practitionerPoliList, {
//       page: result.paginationInfo.currentPage,
//       page_size: result.paginationInfo.limit,
//       total: result.totalItems,
//     });
//   }

//   static async deletePractitionerPoli(uuid, transaction) {
//     const checkUUID = Utils.validateUUID(uuid);
//     if (!checkUUID) {
//       throw new BadRequestException(messageErrorDelete);
//     }

//     const existingPractitionerPoli =
//       await PractitionerPoliRepository.findPractitionerPoliById(uuid);
//     if (!existingPractitionerPoli) {
//       throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
//     }

//     await PractitionerPoliRepository.deletePractitionerPoli(
//       existingPractitionerPoli,
//       transaction
//     );
//     return successResponse(messageSuccessDelete);
//   }
// }
