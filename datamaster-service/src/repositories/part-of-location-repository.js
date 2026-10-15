import {
  LokasiModel,
  PartOfLocationModel,
} from "@opensimrs/model-sdk/datamaster";
import { Op, Transaction } from "sequelize";
import { BaseRePosiotry } from "./base-repository.js";
import { toEpochDate } from "../helpers/helper.js";

const type = ["Bed"];

export class PartOfLocationRepository extends BaseRePosiotry {
  static async findAllByPartOfUuid(req) {
    try {
      const result = await LokasiModel.findAll({
        where: {
          [Op.and]: [
            {
              deletedAt: {
                [Op.is]: null,
              },
              status: true,
              faskes_uuid: req.faskes_uuid,
              part_of_uuid: req.part_of_uuid,
              location_type: type[0],
            },
          ],
        },
      });

      return result;
    } catch (error) {
      console.log(error);
    }
  }

  /**
   *
   * @param {{code: string, faskes_uuid: string}} request
   * @returns
   */
  static async findByCode(request) {
    let partOfLocation = await PartOfLocationModel.findOne({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            code: request.code,
          },
          {
            faskes_uuid: request.faskes_uuid,
          },
        ],
      },
    });
    if (partOfLocation) return partOfLocation.toJSON();
    else return null;
  }

  /**
   *
   * @param {Array<string>} uuidList
   * @param {string} faskes_uuid
   */
  static async findAllByUuidIn(uuidList, faskes_uuid) {
    const pof = await PartOfLocationModel.findAll({
      where: {
        [Op.and]: [
          {
            uuid: {
              [Op.in]: uuidList,
            },
          },
          {
            faskes_uuid: faskes_uuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
    });
    if (pof.length > 0) return pof.map((d) => d.toJSON());
    else return null;
  }

  static async findAllWithoutPagig(faskes_uuid) {
    PartOfLocationModel.hasOne(LokasiModel, {
      constraints: false,
      foreignKey: "faskes_uuid",
      sourceKey: "faskes_uuid",
    });

    LokasiModel.belongsTo(PartOfLocationModel, {
      foreignKey: "faskes_uuid",
      constraints: false,
      targetKey: "faskes_uuid",
    });
    const locationList = await PartOfLocationModel.findAll({
      where: {
        [Op.and]: [
          {
            faskes_uuid: faskes_uuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
      include: [
        {
          model: LokasiModel,
          required: false,
        },
      ],
    });

    if (locationList.length > 0) return locationList.map((l) => l.toJSON());
    else return [];
  }

  static async findAll(request) {
    let whereClause;
    if (request.name !== null) {
      whereClause = {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            faskes_uuid: request.faskes_uuid,
          },
          {
            name: {
              [Op.iLike]: `%${request.name}%`,
            },
          },
        ],
      };
    } else {
      whereClause = {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            faskes_uuid: request.faskes_uuid,
          },
        ],
      };
    }

    const { count, rows } = await PartOfLocationModel.findAndCountAll({
      limit: request.limit,
      offset: (request.offset - 1) * request.limit,
      order: [["id", request.order_by]],
      where: whereClause,
    });

    const partOfLocationList = rows.map((l) => l.toJSON());
    return {
      data: partOfLocationList,
      properties: {
        total_item: count,
        total_pages: Math.ceil(count / request.limit),
        limit: request.limit,
        current_page: request.offset,
      },
    };
  }
  /**
   *
   * @param {Array<{}>} partOfLocationList
   * @param {Transaction} transaction
   */
  static async saveAll(partOfLocationList, transaction) {
    await PartOfLocationModel.bulkCreate(partOfLocationList, { transaction });
  }

  /**
   *
   * @param {string} name nama lokasi
   * @param {string} faskes_uuid faskes uuid
   * @returns {Promise<PartOfLocationModel>}
   */
  static async findByname(name, faskes_uuid) {
    const partOfLocation = await PartOfLocationModel.findOne({
      where: {
        [Op.and]: [
          {
            name: name,
          },
          {
            faskes_uuid: faskes_uuid,
          },
        ],
      },
    });
    if (partOfLocation) return partOfLocation.toJSON();
    else return null;
  }

  /**
   *
   * @param {PartOfLocationModel} PartOfLocationModel
   * @param {Transaction} transaction
   */
  static async save(partofLokasi, transaction) {
    await PartOfLocationModel.create(partofLokasi, {
      transaction: transaction,
    });
  }

  static async update(update_request, transaction) {
    update_request.updatedAt = toEpochDate(new Date());
    const afectedRow = await PartOfLocationModel.update(update_request, {
      transaction: transaction,
      where: {
        [Op.and]: [
          {
            uuid: update_request.uuid,
          },
          {
            faskes_uuid: update_request.faskes_uuid,
          },
        ],
      },
    });
    return afectedRow[0];
  }
}
