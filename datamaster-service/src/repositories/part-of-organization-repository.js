import { PartOfOrganizationModel } from "@opensimrs/model-sdk/datamaster";
import { Op, Transaction } from "sequelize";
import { BaseRePosiotry } from "./base-repository.js";
import { toEpochDate } from "../helpers/helper.js";
import { AddressModel } from "@opensimrs/model-sdk/setting";


PartOfOrganizationModel.hasOne(AddressModel, {
  constraints: false,
  foreignKey: "uuid",
  sourceKey: "address_uuid",
});
AddressModel.belongsTo(PartOfOrganizationModel, {
  constraints: false,
  foreignKey: "uuid",
  targetKey: "address_uuid",
});
export class PartOfOrganizationRepository extends BaseRePosiotry {

  static async delete(request){

    request.deletedAt = toEpochDate(new Date());
    const affected = await PartOfOrganizationModel.update(request, {
      where: {
        faskes_uuid: request.faskes_uuid,
        deletedAt: null,
        uuid: request.uuid
      }
    })
    return affected[0];
  }

  /**
   *
   * @param {{faskes_uuid: string, uuid: string}} request
   */
  static async findByUuidIncludeAddress(request) {
    const partOfOrg = await PartOfOrganizationModel.findOne({
      where: {
        [Op.and]: [
          {
            faskes_uuid: request.faskes_uuid,
          },
          {
            uuid: request.uuid,
          },
        ],
      },
      attributes: ["uuid", "faskes_uuid", "code", "name", "part_of", "part_of_name", "satu_sehat_id", "organization_ihs_number", "phone", "email", "url", "status", "createdAt", "updatedAt", "deletedAt"],
      include: [
        {
          model: AddressModel,
          attributes: ["uuid", "faskesUuid", "fullAddress", "prov", "city", "district", "rt", "rw", "village", "postalCode", "country", "createdAt", "updatedAt", "deletedAt"],
          required: true,
        },
      ],
    });
    if (partOfOrg) {
      const or = partOfOrg.toJSON();
      delete or.AddressModel;
      or.address = partOfOrg.toJSON().AddressModel;
      return or;
    } else return null;
  }

  /**
   *
   * @param {PartOfOrganizationModel} request
   * @param {Transaction} transaction
   * @returns {Promise<number>}
   */
  static async update(request, transaction) {
    request.updatedAt = toEpochDate(new Date());
    const affected = await PartOfOrganizationModel.update(request, {
      transaction: transaction,
      where: {
        [Op.and]: [
          {
            faskes_uuid: request.faskes_uuid,
          },
          {
            uuid: request.uuid,
          },
        ],
      },
    });
    return affected[0];
  }

  static async findByUuid(faskes_uuid, uuid) {
    const partOfOrg = await PartOfOrganizationModel.findOne({
      where: {
        [Op.and]: [
          {
            faskes_uuid: faskes_uuid,
          },
          {
            uuid: uuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
    });
    if (partOfOrg) return partOfOrg.toJSON();
    else return null;
  }

  /**
   *
   * @param {{limit: number | string, offset: number | string, name: string, faskes_uuid: string, order_by: string}} request
   * @returns {Promise<{data: Array<{}>, properties: {total: number, total_page: number, current_page: number, limit: number}}>}
   */
  static async findAll(request) {
    let whereClause = null;
    if (request.name) {
      whereClause = {
        [Op.and]: [
          {
            name: {
              [Op.iLike]: `%${request.name}%`,
            },
          },
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
    const { count, rows } = await PartOfOrganizationModel.findAndCountAll({
      where: whereClause,
      limit: request.limit,
      offset: request.offset - 1,
      order: [["id", request.order_by]],
      attributes: ["uuid", "name", "faskes_uuid", "code", "part_of", "createdAt", "updatedAt", "deletedAt"],
    });
    return {
      data: rows.map((p) => p.toJSON()),
      properties: {
        total: count,
        total_page: Math.ceil(count / request.limit),
        current_page: request.offset,
        limit: request.limit,
      },
    };
  }

  /**
   *
   * @param {string} name
   * @returns { Promise<PartOfOrganizationModel> }
   */
  static async findByName(name) {
    const partOfOrg = await PartOfOrganizationModel.findOne({
      where: {
        [Op.and]: [
          {
            name: name,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
    });
    if (partOfOrg) return partOfOrg.toJSON();
    else return null;
  }

  /**
   *
   * @param {Object} partOfOrganization
   * @param {Transaction} transaction
   */
  static async save(partOfOrganization, transaction) {
    await PartOfOrganizationModel.create(partOfOrganization, { transaction });
  }

  /**
   *
   * @param {Array<{name: string, part_of: string}>} partOfOrganization
   * @param {Transaction} transaction
   */
  static async saveAll(partOfOrganizationList, transaction) {
    await PartOfOrganizationModel.bulkCreate(partOfOrganizationList, { 
      transaction: transaction,
      returning: false
    });
  }
}
