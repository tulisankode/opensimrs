import { AddressModel } from "@opensimrs/model-sdk/setting";
import { Op, Transaction } from "sequelize";
import { BaseRePosiotry } from "./base-repository.js";
import { toEpochDate } from "../helpers/helper.js";

export class AddressRepository extends BaseRePosiotry {


  static async save(request, transaction){
    await AddressModel.create(request, {
      transaction: transaction,
      returning: false
    })
  }

  /**
   * 
   * @param {Address} request 
   * @param {Transaction} transaction 
   */
  static async deleteByUuid(request, transaction){
    request.deletedAt = toEpochDate(new Date());
    const affected = await AddressModel.update(request, {
      transaction: transaction,
      where: {
        [Op.and]: [
          {
            faskesUuid: request.faskesUuid
          },
          {
            uuid: request.uuid
          }
        ],
      },
      returning: false
    });
    return affected[0];
  }

  /**
   * 
   * @param {AddressModel} addressModel 
   * @param {Transaction} transaction 
   * @returns {Promise<number>}
   */
  static async update(request, transaction){
    request.updatedAt = toEpochDate(new Date());
    const affected = await AddressModel.update(request, {
      transaction: transaction,
      where: {
        [Op.and]: [
          {
            faskesUuid: request.faskesUuid
          },
          {
            uuid: request.uuid
          }
        ]
      },
      returning: false
    });
    return affected[0];
  }


  /**
   *
   * @param { Array<AddressModel> } addressList
   * @param { Transaction } tr
   */
  static async saveAll(addressList, tr) {
    await AddressModel.bulkCreate(addressList, { 
      transaction: tr,
      returning: false,
    });
  }
}