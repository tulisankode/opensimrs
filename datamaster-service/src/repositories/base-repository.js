import { Model, Op, Transaction } from "sequelize";
import { toEpochDate } from "../helpers/helper.js";

export class BaseRePosiotry {

  /**
   *  
   * @param {Object} request 
   * @param {Model} model 
   * @param {Transaction} transaction 
   */
  static async save(request, model, transaction){
    await model.create(request, { transaction });
  }


  /**
   *
   * @param {{faskes_uuid: string | null, uuid: string}} request
   * @param {Model} model
   * @returns {Promise<Object | null>}
   */
  static async findByUuid(request, model) {
    let whereClause;
    if ("faskes_uuid" in request) {
      whereClause = {
        [Op.and]: [
          {
            faskes_uuid: request.faskes_uuid,
          },
          {
            uuid: request.uuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      };
    } else {
      whereClause = {
        [Op.and]: [
          {
            uuid: request.uuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      };
    }
    const result = await model.findOne({ where: whereClause });
    if (result) return result.toJSON();
    else return null;
  }

  /**
   *
   * @param {Object} request
   * @param {Model} model
   * @param {Transaction} transaction
   * @returns {Promise<number>}
   */
  static async delete(request, model, transaction) {
    request.deletedAt = toEpochDate(new Date());
    let whereClause;
    if ("faskes_uuid" in request) {
      whereClause = {
        [Op.and]: [
          {
            uuid: request.uuid,
          },
          {
            faskes_uuid: request.faskes_uuid,
          },
          {
            id: request.id,
          },
        ],
      };
    } else {
      whereClause = {
        [Op.and]: [
          {
            id: request.id,
          },
          {
            uuid: request.uuid,
          },
        ],
      };
    }
    const affected = await model.update(request, {
      where: whereClause,
      transaction: transaction,
    });
    return affected[0];
  }

  /**
   *
   * @param {{faskes_uuid: string | null}} request
   * @param {Model} model
   * @returns {Promise<Array<Object>>}
   */
  static async findAllWithoutPaging(request, model) {
    let whereClause;
    if ("faskes_uuid" in request) {
      whereClause = {
        [Op.and]: [
          {
            faskes_uuid: request.faskes_uuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      };
    } else {
      whereClause = {
        deletedAt: {
          [Op.is]: null,
        },
      };
    }
    const resultList = await model.findAll({
      where: whereClause,
    });
    if (resultList.length > 0) return resultList.map((r) => r.toJSON());
    else return [];
  }

  /**
   *
   * @param {{limit: number, offset: number, order_by, search: string | null, faskes_uuid | null}} request
   * @param {Model} model
   */
  static async findAllWithPaging(request, model) {
    let whereClause = {};
    if ("faskes_uuid" in request) {
      whereClause.faskes_uuid = request.faskes_uuid;
    }
    if ("search" in request) {
      whereClause.name = {
        [Op.iLike]: `%${request.search}%`,
      };
    }
    const { count, rows } = await model.findAndCountAll({
      where: whereClause,
      limit: request.limit,
      offset: request.offset - 1,
      order: [["id", request.order_by]],
    });
    return {
      data: rows.map((d) => d.toJSON()),
      properties: {
        limit: request.limit,
        offset: request.offset,
        total_item: count,
        total_page: Math.ceil(count / request.offset),
      },
    };
  }
}
