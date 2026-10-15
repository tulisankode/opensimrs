import { Op, or, Transaction } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Organization from "../models/organization-model.js";
import { OrganizationModel, PartOfOrganizationModel } from "@opensimrs/model-sdk/datamaster";
import { toEpochDate } from "../helpers/helper.js";
import { BaseRePosiotry } from "./base-repository.js";
import { AddressModel } from "@opensimrs/model-sdk/setting";

OrganizationModel.hasOne(AddressModel, {
  constraints: false,
  foreignKey: "uuid",
  sourceKey: "address_uuid",
});
AddressModel.belongsTo(Organization, {
  foreignKey: "address_uuid",
  targetKey: "uuid",
  constraints: false,
});

OrganizationModel.hasMany(PartOfOrganizationModel, {
  foreignKey: "faskes_uuid",
  constraints: false,
  sourceKey: "faskes_uuid",
});

PartOfOrganizationModel.belongsTo(Organization, {
  constraints: false,
  foreignKey: "faskes_uuid",
  targetKey: "faskes_uuid",
});

const addressXPartOfOrgAssociation = PartOfOrganizationModel.belongsTo(AddressModel, {
  foreignKey: "address_uuid",
  targetKey: "uuid",
  constraints: false,
  as: "address",
});
export default class OrganizationRepository extends BaseRePosiotry {
  /**
   *
   * @param {{faskes_uuid: string, limit: string, offset: string, order_by: string, search: string}} request - data request
   */
  static async findAllIncludePartOf(request) {
    const count = `
      SELECT COUNT(*) AS total 
      FROM organization AS org INNER JOIN addresses AS addr ON (org.address_uuid = addr.uuid)
        WHERE org.faskes_uuid = :faskes_uuid
        AND org.deleted_at IS NULL`;

    // Validasi manual order_by agar aman
    const allowedOrderBy = ["ASC", "DESC"];
    const orderBy = allowedOrderBy.includes(request.order_by?.toUpperCase()) ? request.order_by.toUpperCase() : "ASC";

    const query = `
      SELECT org.*,
          addr.full_address AS full_address, addr.prov AS province_code, addr.city AS city_code, 
          addr.district AS district_code, addr.rt AS rt, addr.rw AS rw, addr.village AS village_code, 
          addr.postal_code AS postal_code, addr.country AS country, 
          (SELECT name FROM organization AS o WHERE o.uuid = org.part_of_uuid) as part_of_name FROM organization AS org
      INNER JOIN addresses AS addr ON (org.address_uuid = addr.uuid) WHERE 
            org.faskes_uuid = :faskes_uuid 
            AND org.name ILIKE :search 
            AND org.deleted_at IS NULL 
      ORDER BY org.id ${orderBy} 
      LIMIT :limit OFFSET :offset`;

    const [total, result] = await Promise.all([
      sequelizeInstance.query(count, {
        replacements: {
          faskes_uuid: request.faskes_uuid,
          search: `%${request.search || ""}%`,
        },
        type: sequelizeInstance.QueryTypes.SELECT,
      }),
      sequelizeInstance.query(query, {
        replacements: {
          faskes_uuid: request.faskes_uuid,
          limit: Number(request.limit),
          offset: Number(request.offset - 1) * Number(request.limit),
          search: `%${request.search ?? ""}%`,
        },
        type: sequelizeInstance.QueryTypes.SELECT,
      }),
    ]);

    return {
      data: result,
      properties: {
        limit: request.limit,
        offset: request.offset,
        total_item: total[0].total,
        total_page: Math.ceil((request.offset + 1) / parseInt(total[0].total)),
      },
    };
  }

  /**
   *
   * @param {{uuid: string, faskes_uuid: string}} request
   * @returns {Promise<OrganizationModel>}
   */
  static async findByUuidIncludeAddress(request) {
    OrganizationModel.hasOne(AddressModel, {
      constraints: false,
      foreignKey: "uuid",
      sourceKey: "address_uuid",
    });
    AddressModel.belongsTo(OrganizationModel, {
      constraints: false,
      foreignKey: "uuid",
      targetKey: "address_uuid",
    });
    const organization = await OrganizationModel.findOne({
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
      attributes: ["uuid", "faskes_uuid", "code", "name", "phone", "email", "url", "address_uuid", "satu_sehat_id", "status", "organization_ihs_number", "createdAt", "updatedAt", "deletedAt"],
      include: [
        {
          model: AddressModel,
          attributes: ["uuid", "faskes_uuid", "full_address", "prov", "city", "district", "rt", "rw", "village", "postal_code", "country", "createdAt", "updatedAt", "deletedAt"],
          required: true,
        },
      ],
    });
    if (organization) {
      const or = organization.toJSON();
      delete or.AddressModel;
      or.address = organization.toJSON().AddressModel;
      return or;
    } else return null;
  }

  static async update(request, transaction) {
    request.updatedAt = toEpochDate(new Date());
    const affected = await OrganizationModel.update(request, {
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
      returning: false,
    });
    return affected[0];
  }

  static async findByUuid(uuid, faskes_uuid) {
    const organization = await OrganizationModel.findOne({
      where: {
        [Op.and]: [
          {
            uuid: uuid,
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
    if (organization) return organization.toJSON();
    else return null;
  }

  static async save(organization, transaction) {
    await OrganizationModel.create(organization, { transaction });
  }

  /**
   *
   * @param {string} name
   * @param {string} faskes_uuid
   */
  static async findByNameEqual(name, faskes_uuid) {
    const org = await OrganizationModel.findOne({
      attributes: ["id", "uuid", "faskes_uuid", "code", "name", "phone", "email", "url", "address_uuid", "satu_sehat_id", "status", "organization_ihs_number", "createdAt", "updatedAt", "deletedAt"],
      [Op.and]: [
        {
          faskes_uuid: faskes_uuid,
        },
        {
          name: name,
        },
        {
          deletedAt: {
            [Op.is]: null,
          },
        },
      ],
    });

    if (org) return org.toJSON();
    else return null;
  }

  /**
   *
   * @param {Array<{Organization}>} organizationList
   * @param { Transaction } tr
   */
  static async saveAll(organizationList, tr) {
    await OrganizationModel.bulkCreate(organizationList, { transaction: tr });
  }

  /**
   *
   * @param { Array<string> } nameList
   * @returns { Promise<Array<{}>>}
   */
  static async findAllByNameIn(nameList) {
    const organizationList = await Organization.findAll({
      where: {
        name: {
          [Op.or]: nameList.map((nl) => {
            return {
              [Op.iLike]: `%${nl}%`,
            };
          }),
        },
      },
    });
    if (!organizationList.length > 0) return [];
    else return organizationList.map((o) => o.toJSON());
  }

  static async addOrganization(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Organization.create(data, {
        transaction: tr,
      });
    });
    return result;
  }

  static async getAllOrganizationAktif(faskes_uuid) {
    return await Organization.findAll({
      where: {
        [Op.and]: [
          {
            status: true,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            faskes_uuid: faskes_uuid,
          },
        ],
      },
    });
  }

  static async getAllOrganization(name = null, page = 1, limit = 10, order_by, faskesUuid) {
    const whereClause = {
      [Op.and]: [
        {
          faskes_uuid: faskesUuid,
        },
        {
          deletedAt: {
            [Op.is]: null,
          },
        },
      ],
    };

    if (name) whereClause.name = { [Op.iLike]: `%${name}%` };

    const offset = (page - 1) * limit;
    let { count, rows } = await OrganizationModel.findAndCountAll({
      where: {
        faskes_uuid: faskesUuid,
        deletedAt: null,
      },
      offset: offset,
      limit: limit,
      include: [
        {
          model: AddressModel,
          required: false,
          attributes: ["uuid", "faskesUuid", "fullAddress", "prov", "city", "district", "rt", "rw", "village", "postalCode", "country", "createdAt", "updatedAt", "deletedAt"],
        },
        {
          model: PartOfOrganizationModel,
          required: false,
          where: whereClause,
          attributes: [
            "id",
            "uuid",
            "name",
            "code",
            "satu_sehat_id",
            "part_of",
            "part_of_name",
            "satu_sehat_id",
            "organization_ihs_number",
            "phone",
            "email",
            "url",
            "address_uuid",
            "status",
            "createdAt",
            "updatedAt",
            "deletedAt",
          ],
          include: [
            {
              association: addressXPartOfOrgAssociation,
              required: false,
              attributes: ["uuid", "faskesUuid", "fullAddress", "prov", "city", "district", "rt", "rw", "village", "postalCode", "country", "createdAt", "updatedAt", "deletedAt"],
            },
          ],
        },
      ],
      order: [["id", order_by]],
    });

    let organizationList = [];
    let masterOrganization = [];
    rows.forEach((o) => {
      const org = o.toJSON();
      if (org.AddressModel) org.address = org.AddressModel;
      org.PartOfOrganizationModels.forEach((p) => organizationList.push(p));
      delete org.AddressModel;
      delete org.PartOfOrganizationModels;
      masterOrganization.push(org);
    });
    return {
      organizationList: [...masterOrganization, ...organizationList].reverse(),
      paginationInfo: {
        total_items: [...masterOrganization, ...organizationList].length,
        current_page: page,
        total_pages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findOrganizationByCode(code) {
    return await OrganizationModel.findOne({ where: { code } });
  }

  static async findOrganizationBySatuSehatID(satu_sehat_id) {
    return await Organization.findOne({
      where: { satu_sehat_id },
    });
  }

  static async findOrganizationByUuid(uuid) {
    OrganizationModel.hasOne(AddressModel, {
      foreignKey: "uuid",
      constraints: false,
      sourceKey: "address_uuid",
    });
    AddressModel.belongsTo(OrganizationModel, {
      constraints: false,
      foreignKey: "uuid",
      targetKey: "uuid",
    });
    const organization = await OrganizationModel.findOne({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            uuid: uuid,
          },
        ],
      },
      include: [
        {
          model: AddressModel,
          required: false,
        },
      ],
    });
    if (organization) {
      const data = organization.toJSON();
      delete data.AddressModel;
      data.address = organization.toJSON().AddressModel;
      return data;
    } else return null;
  }

  static async findOrganizationByName(name) {
    return await Organization.findOne({
      where: { name: { [Op.like]: `%${name}%` } },
    });
  }

  static async updateOrganization(organization, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await organization.update(
        data,
        { updatedAt: Math.floor(Date.now() / 1000) },
        {
          transaction: tr,
        }
      );
    });
    return result;
  }

  static async searchOrganization(query, page, limit) {
    const offset = (page - 1) * limit;
    const { count, rows } = await OrganizationModel.findAndCountAll({
      where: {
        deletedAt: null,
        name: {
          [Sequelize.Op.iLike]: `%${query}%`,
        },
      },
      limit: limit,
      offset: offset,
      order: [["id", "DESC"]],
    });

    return {
      totalItems: count,
      organizationList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  // Enhanced exportOrganization function
  static async exportOrganization(faskes_uuid) {
    const query = `
     SELECT org.*,
          addr.full_address AS full_address, 
          (SELECT p.name FROM provinsi AS p WHERE code = addr.prov) AS province, 
          (SELECT k.name FROM kabupaten AS k WHERE k.code = addr.city) AS city, 
          (SELECT kc.name FROM kecamatan AS kc WHERE kc.code = addr.district) AS district, 
          (SELECT kl.name FROM kelurahan AS kl WHERE kl.code =  addr.village) AS village,
          addr.rt AS rt, addr.rw AS rw, 
          addr.postal_code AS postal_code, addr.country AS country, 
          (SELECT name FROM organization AS o WHERE o.uuid = org.part_of_uuid) as part_of_name FROM organization AS org
      INNER JOIN addresses AS addr ON (org.address_uuid = addr.uuid) WHERE 
            org.faskes_uuid = :faskes_uuid 
            AND org.deleted_at IS NULL 
      ORDER BY org.id DESC`;

    const result = await sequelizeInstance.query(query, {
      replacements: {
        faskes_uuid: faskes_uuid,
      },
    });
    return result[0];
  }
}
