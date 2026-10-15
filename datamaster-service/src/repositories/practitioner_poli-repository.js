// import { Op, Sequelize, Transaction } from "sequelize";
// import sequelizeInstance from "@opensimrs/model-sdk/instance";
// import PractitionerPoli from "../models/practitioner_poli-model.js";
// import { PractitionerPoliModel } from "@opensimrs/model-sdk/datamaster";
// import { BaseRePosiotry } from "./base-repository.js";

// export default class PractitionerPoliRepository extends BaseRePosiotry {

//   /**
//    * 
//    * @param {Object} practitioenr 
//    * @param {Transaction} transaction 
//    */
//   static async save(practitioenr, transaction){
//     await PractitionerPoliModel.create(practitioenr, transaction);
//   }

//   /**
//    * 
//    * @param {PractitionerPoliModel} updateRequest 
//    * @param {Transaction} transaction 
//    * @returns 
//    */
//   static async updete(updateRequest, transaction) {
//     updateRequest.updatedAt = Math.floor(Date.now() / 1000.0);
//     const affectedRows = await PractitionerPoliModel.update(updateRequest, {
//       transaction: transaction,
//       where: {
//         [Op.and]: [
//           {
//             uuid: updateRequest.uuid,
//           },
//           {
//             faskes_uuid: updateRequest.faskes_uuid,
//           },
//         ],
//       },
//     });
//     return affectedRows[0];
//   }


//   /**
//    *
//    * @param {Array<{practitioner_uuid: string | uuid, faskes_uuid: string | uuid}>} request
//    * @return {Promise<Array<PractitionerPoliModel>>}
//    */
//   static async findAllIn(request) {
//     const practitionerPoliList = await PractitionerPoliModel.findAll({
//       where: {
//         practitioner_uuid: {
//           [Op.in]: request.map((r) => r.practitioner_uuid),
//         }
//       },
//     });
//     if (practitionerPoliList.length > 0) return practitionerPoliList.map((p) => p.toJSON());
//     else return [];
//   }

//   /**
//    *
//    * @param {Array<PractitionerPoliModel>} practitionerPoliList
//    * @param {Transaction} transaction
//    * @returns { Promise<void> }
//    */
//   static async saveAll(practitionerPoliList, transaction) {
//     await PractitionerPoliModel.bulkCreate(practitionerPoliList, { transaction });
//   }

//   static async addPractitionerPoli(data, transaction) {
//     return await PractitionerPoli.create(data, { transaction });
//   }

//   static async getAllPractitionerPoli(page = 1, limit = 10) {
//     const offset = (page - 1) * limit;
//     const { count, rows } = await PractitionerPoli.findAndCountAll({
//       where: {
//         deletedAt: null,
//       },
//       limit: limit,
//       offset: offset,
//       order: [["createdAt", "DESC"]],
//     });

//     return {
//       totalItems: count,
//       practitionerPoliList: rows,
//       currentPage: page,
//       paginationInfo: {
//         currentPage: page,
//         totalPages: Math.ceil(count / limit),
//         limit: limit,
//       },
//     };
//   }

//   static async findPractitionerPoliById(uuid) {
//     return await PractitionerPoli.findOne({ where: { uuid } });
//   }

//   static async getPractitionerPoliNameByUuid(uuid) {
//     return await PractitionerPoli.findOne({
//       where: { uuid },
//     });
//   }

//   static async getAllPractitionerPoliByPractitionerUuids(uuids) {
//     return await PractitionerPoli.findAll({
//       where: {
//         deletedAt: null,
//         practitioner_uuid: { [Op.in]: uuids },
//       },
//     });
//   }
//   static async getAllPractitionerPoliByPractitionerUuid(uuid) {
//     return await PractitionerPoli.findAll({
//       where: {
//         deletedAt: null,
//         practitioner_uuid: uuid,
//       },
//       attributes: ["uuid", "lokasi_uuid"],
//     });
//   }

//   static async exportPractitionerPoli() {
//     return await PractitionerPoli.findAll({
//       where: {
//         deletedAt: null,
//       },
//     });
//   }

//   /**
//    * 
//    * @param {PractitionerPoliModel} updateRequest 
//    * @param {Transaction} transaction 
//    * @returns {Promise<number>}
//    */
//   static async updatePractitionerPoli(updateRequest, transaction) {
//     updateRequest.updatedAt = Math.floor(Date.now() / 1000.0);
//     const affectedRows = await PractitionerPoli.update(updateRequest, {
//       transaction: transaction,
//       where: {
//         [Op.and]: [
//           {
//             uuid: updateRequest.uuid,
//           },
//           {
//             faskes_uuid: updateRequest.faskes_uuid,
//           },
//         ],
//       },
//     });
//     return affectedRows[0];
//   }

//   static async getAllPractitionerPoliAktif() {
//     return await PractitionerPoli.findAll({
//       where: {
//         deletedAt: null,
//         status: true,
//       },
//     });
//   }

//   static async searchPractitionerPoli(query, page = 1, limit = 10) {
//     const offset = (page - 1) * limit;
//     const { count, rows } = await PractitionerPoli.findAndCountAll({
//       where: {
//         deletedAt: null,
//         name: {
//           [Sequelize.Op.iLike]: `%${query}%`,
//         },
//       },
//       limit: limit,
//       offset: offset,
//       order: [["createdAt", "DESC"]],
//     });

//     return {
//       totalItems: count,
//       practitionerPoliList: rows,
//       currentPage: page,
//       paginationInfo: {
//         currentPage: page,
//         totalPages: Math.ceil(count / limit),
//         limit: limit,
//       },
//     };
//   }

//   static async deletePractitionerPoli(practitionerPoli, transaction) {
//     return await practitionerPoli.destroy({ transaction });
//   }
// }
