// import TarifKomponenTindakanPoli from "../models/tarif_komponen_tindakan_poli-model.js";
// import { Op } from "sequelize";
// import { BaseRePosiotry } from "./base-repository.js";

// export default class TarifKomponenTindakanPoliRepository extends BaseRePosiotry {


//   /**
//    * 
//    * @param {Array{}} tarifKomponenTindakanPoliList 
//    * @param {import("sequelize").TransactionOptions} tr 
//    * @returns 
//    */

//   static async saveAll(tarifKomponenTindakanPoliList, tr) {
//     return await TarifKomponenTindakanPoli.bulkCreate(tarifKomponenTindakanPoliList, { transaction: tr });
//   }

//   /**
//    * 
//    * @param {Array<string>} names 
//    */
//   static async findByNameIn(names){
//     const tarifKomponenTindakanPoli = await TarifKomponenTindakanPoli.findAll({
//       where: {
//         [Op.and]: [
//           {
//             name: {
//               [Op.in]: names
//             }
//           },
//           {
//             deletedAt: {
//               [Op.is]: null
//             }
//           }
//         ]
//       }
//     });
//     if(!tarifKomponenTindakanPoli){
//       return null;
//     }
//     return tarifKomponenTindakanPoli.map(tarifKomponenTindakanPoli => tarifKomponenTindakanPoli.toJSON());
//   }


//   static async addTarifKomponenTindakanPoli(data, transaction) {
//     return await TarifKomponenTindakanPoli.create(data, { transaction });
//   }

//   static async getTarifTindakanPoliByTarifUuids(tarifUuids) {
//     return await TarifKomponenTindakanPoli.findAll({
//       where: {
//         tarif_uuid: {
//           [Op.in]: tarifUuids,
//         },
//       },
//     });
//   }

//   static async getTarifTindakanPoliByTarifUuid(tarifUuid) {
//     return await TarifKomponenTindakanPoli.findAll({
//       where: { tarif_uuid: tarifUuid },
//     });
//   }

//   static async getAllTarifKomponenTindakanPoli() {
//     return await TarifKomponenTindakanPoli.findAll();
//   }

//   static async findTarifKomponenTindakanPoliByTarifId(tarif_uuid) {
//     return await TarifKomponenTindakanPoli.findAll({
//       where: { tarif_uuid },
//     });
//   }

//   static async findTarifKomponenTindakanPoliById(uuid) {
//     return await TarifKomponenTindakanPoli.findOne({ where: { uuid } });
//   }

//   static async updateTarifKomponenTindakanPoli(
//     tarifKomponenTindakanPoli,
//     data,
//     transaction
//   ) {
//     return await tarifKomponenTindakanPoli.update(data, { transaction });
//   }

//   static async exportTarifKomponenTindakanPoli() {
//     return await TarifKomponenTindakanPoli.findAll();
//   }

//   static async deleteTarifKomponenTindakanPoli(
//     tarifKomponenTindakanPoli,
//     transaction
//   ) {
//     return await tarifKomponenTindakanPoli.destroy({ transaction });
//   }

//   static async deleteTarifKomponenTindakanPoliByTarifUuid(
//     tarifUuid,
//     transaction
//   ) {
//     return await TarifKomponenTindakanPoli.destroy({
//       where: {
//         tarif_uuid: tarifUuid,
//       },
//       transaction: transaction,
//     });
//   }
// }
