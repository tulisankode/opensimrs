// import deleteFile from "../helpers/delete-file.js";
// import NotFoundException from "../errors/notfound-exception.js";
// import { faskes_uuid_dummy } from "../helpers/faskes-uuid.js";
// import PractitionerPoliService from "../services/practitioner_poli-service.js";
// import {
//   messageErrorFileNotFound,
//   messageErrorImport,
//   messageErrorOnlyExcel,
// } from "../validations/message-validation-error.js";
// import path from "path";
// import BadRequestException from "../errors/bad_request-exception.js";
// import { validateExcel } from "../helpers/helper.js";

// export default class PractitionerPoliController {
//   static async createPractitionerPoli(req, res, nextFunction) {
//     try {
//       // const faskes_uuid = res.locals.jwtData.faskesUuid;
//       const body = {...req.body, faskes_uuid: req.author.faskesUuid};
//       const result = await PractitionerPoliService.createPractitionerPoli(body);
//       res.status(201).json(result);
//     } catch (error) {
//       nextFunction(error);
//     }
//   }

//   static async updatePractitionerPoli(req, res, nextFunction) {
//     try {
//       const result = await PractitionerPoliService.updatePractitionerPoli(
//         req.params.uuid,
//         req.body
//       );

//       res.status(200).json(result);
//     } catch (error) {
//       nextFunction(error);
//     }
//   }

//   static async getAllPractitionerPoli(req, res, nextFunction) {
//     try {
//       const page = parseInt(req.query.page) || 1;
//       const pageSize = parseInt(req.query.limit) || 10;
//       const query = req.query.name;

//       if (query) {
//         const result = await PractitionerPoliService.searchPractitionerPoli(
//           query,
//           page,
//           pageSize
//         );
//         res.status(200).json(result);
//       } else {
//         const result = await PractitionerPoliService.getAllPractitionerPoli(
//           page,
//           pageSize
//         );
//         res.status(200).json(result);
//       }
//     } catch (error) {
//       nextFunction(error);
//     }
//   }

//   static async importPractitionerPoli(req, res, nextFunction) {
//     try {
//       validateExcel(req.file);
//       const result = await PractitionerPoliService.importPractitionerPoli(req.file.path);
//       await deleteFile(req.file.path);
//       res.status(200).json(result);
//     } catch (error) {
//       if (req.file && req.file.path) {
//         await deleteFile(req.file.path);
//       }
//       nextFunction(error);
//     }
//   }

//   static async exportPractitionerPoli(req, res, nextFunction) {
//     try {
//       const data = await PractitionerPoliService.exportPractitionerPoli();
//       res.status(200).json(data);
//     } catch (error) {
//       nextFunction(error);
//     }
//   }

//   static async getAllPractitionerPoliAktif(req, res, nextFunction) {
//     try {
//       const practitionerPoliList =
//         await PractitionerPoliService.getAllPractitionerPoliAktif();
//       res.status(200).json(practitionerPoliList);
//     } catch (error) {
//       nextFunction(error);
//     }
//   }

//   static async getPractitionerPoliById(req, res, nextFunction) {
//     try {
//       const practitionerPoli =
//         await PractitionerPoliService.getPractitionerPoliById(req.params.uuid);
//       res.status(200).json(practitionerPoli);
//     } catch (error) {
//       nextFunction(error);
//     }
//   }

//   static async deletePractitionerPoli(req, res, nextFunction) {
//     try {
//       const practitionerPoli =
//         await PractitionerPoliService.deletePractitionerPoli(req.params.uuid);
//       res.status(200).send(practitionerPoli);
//     } catch (error) {
//       nextFunction(error);
//     }
//   }
// }
