// import { Op } from "sequelize";
// import TarifPelayanan from "../models/tarif_pelayanan-model.js";
// import { BaseRePosiotry } from "./base-repository.js";

// export default class TarifPelayananRepository extends BaseRePosiotry {

//   /**
//    * 
//    * @param {Array<{}>} tarifPelayananList 
//    * @param {import("sequelize").TransactionOptions} transaction 
//    */
//   static async saveAll(tarifPelayananList, transaction) {
//     await TarifPelayanan.bulkCreate(tarifPelayananList, { transaction });
//   }

//   static async addTarifPelayanan(data, transaction) {
//     return await TarifPelayanan.create(data, { transaction });
//   }

//   static async getAllTarifPelayanan() {
//     return await TarifPelayanan.findAll();
//   }

//   static async findTarifPelayananByUnit(tarif_uuid, noPelayanan) {
//     return await TarifPelayanan.findOne({
//       where: { unit_pelayanan: noPelayanan, tarif_uuid },
//     });
//   }

//   static async findTarifPelayananByTarifUuid(tarifUuid) {
//     return await TarifPelayanan.findOne({
//       where: { tarif_uuid: tarifUuid },
//     });
//   }

//   static async getTarifPelayananByTarifId(tarifUuid) {
//     return await TarifPelayanan.findAll({
//       where: { tarif_uuid: tarifUuid }, // Tidak perlu Op.in jika hanya satu UUID
//     });
//   }

//   static async findTarifPelayananById(uuid) {
//     return await TarifPelayanan.findOne({ where: { uuid } });
//   }

//   static async updateTarifPelayanan(tarifPelayanan, data, transaction) {
//     return await tarifPelayanan.update(data, { transaction });
//   }

//   static async getTarifPelayananByTarifUuids(tarifUuids, unit) {
//     const whereClause = { tarif_uuid: { [Op.in]: tarifUuids } };
//     if (unit) whereClause.unit_pelayanan = unit;
//     return await TarifPelayanan.findAll({ where: whereClause });
//   }

//   static async exportTarifPelayanan() {
//     return await TarifPelayanan.findAll();
//   }

//   static async deleteTarifPelayananByTarifUuid(tarifUuid, transaction) {
//     return await TarifPelayanan.destroy({
//       where: {
//         tarif_uuid: tarifUuid,
//       },
//       transaction: transaction,
//     });
//   }

//   static async deleteTarifPelayanan(tarifPelayanan, transaction) {
//     return await tarifPelayanan.destroy({ transaction });
//   }
// }
