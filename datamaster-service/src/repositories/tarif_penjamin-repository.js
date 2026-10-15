// import sequelizeInstance from "@opensimrs/model-sdk/instance";
// import TarifPenjamin from "../models/tarif_penjamin-model.js";
// import { Op } from "sequelize";
// import { BaseRePosiotry } from "./base-repository.js";
// import { TarifPenjaminModel } from "@opensimrs/model-sdk/datamaster";

// export default class TarifPenjaminRepository extends BaseRePosiotry {

//   /**
//    * 
//    * @param {Array<{}>} tarifPenjaminList 
//    * @param {import("sequelize").TransactionOptions} transaction 
//    */
//   static async saveAll(tarifPenjaminList, transaction) {
//     await TarifPenjaminModel.bulkCreate(tarifPenjaminList, { transaction });
//   }

  
//   static async addTarifPenjamin(data, transaction) {
//     return await TarifPenjaminModel.create(data, { transaction });
//   }

//   static async getAllTarifPenjamin() {
//     return await TarifPenjamin.findAll();
//   }

//   static async getTarifPenjaminByTarifUuids(tarifUuids, penjamin_uuid) {
//     const whereClause = { tarif_uuid: { [Op.in]: tarifUuids } };
//     if (penjamin_uuid) {
//       whereClause.penjamin_uuid = penjamin_uuid; // Tambahkan kondisi untuk penjamin_uuid
//     }
//     return await TarifPenjamin.findAll({ where: whereClause });
//   }

//   static async findTarifPenjaminByPenjaminId(tarif_uuid, penjamin_uuid) {
//     return await TarifPenjamin.findOne({
//       where: { tarif_uuid, penjamin_uuid },
//     });
//   }

//   static async getTarifPenjaminByTarifId(tarifId) {
//     return await TarifPenjamin.findAll({
//       where: { tarif_uuid: tarifId },
//     });
//   }

//   static async findTarifPenjaminById(uuid) {
//     return await TarifPenjamin.findOne({ where: { uuid } });
//   }

//   static async updateTarifPenjamin(tarifPenjamin, data, transaction) {
//     return await tarifPenjamin.update(data, { transaction });
//   }

//   static async exportTarifPenjamin() {
//     return await TarifPenjamin.findAll();
//   }

//   static async deleteTarifPenjamin(tarifPenjamin, transaction) {
//     return await tarifPenjamin.destroy({ transaction });
//   }

//   static async deleteTarifPenjaminByTarifUuid(tarifUuid, transaction) {
//     return await TarifPenjamin.destroy({
//       where: {
//         tarif_uuid: tarifUuid,
//       },
//       transaction: transaction,
//     });
//   }
// }
