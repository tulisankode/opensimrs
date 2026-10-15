import { Op } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Voucher from "../models/voucher-model.js";
import { VoucherModel } from "@opensimrs/model-sdk/datamaster";
import { BaseRePosiotry } from "./base-repository.js";

export default class VoucherRepository extends BaseRePosiotry{
  /**
   * @param {Array<Voucher>}
   */
  static async saveAll(voucherList, transaction) {
    await Voucher.bulkCreate(voucherList, { transaction });
  }

  static async addVoucher(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Voucher.create(data, { transaction: tr });
    });
    return result;
  }

  static async getAllVoucher(request) {
    console.log(request);
    let whereClause = {
      deletedAt: null,
      faskes_uuid: request.faskes_uuid,
    };
    if (request.name) {
      whereClause.name = {
        [Op.iLike]: `%${request.name}%`,
      };
    }
    const { count, rows } = await VoucherModel.findAndCountAll({
      where: whereClause,
      limit: request.limit,
      offset: request.offset - 1,
      order: [["id", request.order_by]],
    });

    return {
      totalItems: count,
      voucherList: rows,
      currentPage: request.offset,
      paginationInfo: {
        currentPage: request.offset,
        totalPages: Math.ceil(count / request.limit),
        limit: request.limit,
      },
    };
  }

  static async getAllVoucherAktif(faskes_uuid) {
    return await Voucher.findAll({
      where: {
        deletedAt: null,
        faskes_uuid: faskes_uuid,
        status: true,
      },
    });
  }

  static async exportVoucher() {
    return await Voucher.findAll({
      where: {
        deletedAt: null,
      },
    });
  }

  static async findVoucherById(uuid) {
    return await Voucher.findOne({ where: { uuid } });
  }

  static async findVoucherByCode(code) {
    return await Voucher.findOne({ where: { code } });
  }

  static async updateVoucher(voucher, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await voucher.update(
        data,
        {
          updatedAt: Math.floor(Date.now() / 1000),
        },
        {
          transaction: tr,
        }
      );
    });
    return result;
  }

  static async deleteVoucher(voucher) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await voucher.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { transaction: tr }
      );
    });
    return result;
  }
}
