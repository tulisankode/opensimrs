import { Op } from "sequelize";
import {
  FaskesModel,
  KabupatenModel,
  KecamatanModel,
  KelurahanModel,
  LokasiModel,
  ProvinceModel,
} from "@opensimrs/model-sdk/datamaster";
import { BaseRePosiotry } from "./base-repository.js";
import { toEpochDate } from "../helpers/helper.js";
import { AddressModel, FaskesProfilesModel } from "@opensimrs/model-sdk/setting";

AddressModel.belongsTo(ProvinceModel, {
  foreignKey: "prov",
  targetKey: "code",
  as: "province",
});

AddressModel.belongsTo(KabupatenModel, {
  foreignKey: "city",
  targetKey: "code",
  as: "cityData",
});

AddressModel.belongsTo(KecamatanModel, {
  foreignKey: "district",
  targetKey: "code",
  as: "districtData",
});

AddressModel.belongsTo(KelurahanModel, {
  foreignKey: "village",
  targetKey: "code",
  as: "villageData",
});

export default class FaskesRepository extends BaseRePosiotry {
  static async findByUuid(uuid) {
    const faskes = await FaskesModel.findOne({
      attributes: [
        "uuid",
        "code",
        "name",
        "status",
        "organization_ihs_number",
        "client_id",
        "client_secret",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ],
      where: {
        [Op.and]: [
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

    if (faskes) return faskes.toJSON();
    else return null;
  }

  /**
   *
   * @param {Array<{uuid: uuid | string, code: string, name: string, status: boolean}>} faskeses
   */
  static async saveAll(faskeses, transaction) {
    await FaskesModel.bulkCreate(faskeses, { transaction });
  }

  static async addFaskes(data, transaction) {
    return await FaskesModel.create(data, { transaction });
  }

  static async findFaskesByCode(code) {
    return await FaskesModel.findOne({ where: { code: code } });
  }

  static async getAllFaskesAktif() {
    return await FaskesModel.findAll({
      where: {
        deletedAt: null,
        status: true,
      },
    });
  }

  static async exportFaskes() {
    return await FaskesModel.findAll({
      where: {
        deletedAt: null,
      },
    });
  }

  static async getAllFaskes(name = null, page = 1, limit = 10) {
    let whereClause = {
      deletedAt: null,
    };

    if (name) {
      whereClause = {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            name: {
              [Op.iLike]: `%${name}%`,
            },
          },
        ],
      };
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await FaskesModel.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    return {
      totalItems: count,
      faskesList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findFaskesById(uuid) {
    return await FaskesModel.findOne({
      where: {
        [Op.and]: [
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
  }

  static async update(request, transaction) {
    request.updatedAt = toEpochDate(new Date());
    const affected = await FaskesModel.update(request, {
      transaction: transaction,
      where: {
        [Op.and]: [
          {
            uuid: request.uuid,
          },
        ],
      },
    });
    return affected[0];
  }

  static async delete(request, transaction) {
    request.deletedAt = toEpochDate(new Date());
    const affected = await FaskesModel.update(request, {
      transaction: transaction,
      where: {
        [Op.and]: [
          {
            uuid: request.uuid,
          },
        ],
      },
    });
    return affected[0];
  }

  static async restoreFaskes(uuid) {}

  static async findAllFaskesIncludePoliAndAddress(request) {
    FaskesModel.hasMany(LokasiModel, {
      constraints: false,
      foreignKey: "faskes_uuid",
      sourceKey: "uuid",
    });
    LokasiModel.belongsTo(FaskesModel, {
      constraints: false,
      foreignKey: "faskes_uuid",
      targetKey: "uuid",
    });
    FaskesModel.hasOne(FaskesProfilesModel, {
      foreignKey: "faskesUuid",
      sourceKey: "uuid",
      constraints: false,
    });

    let whereClause;
    if (request.search) {
      whereClause = {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            name: {
              [Op.iLike]: `%${request.search}%`,
            },
          },
          {
            code: {
              [Op.iLike]: `%${request.search}%`,
            },
          },
        ],
      };
    }
    const { count, rows } = await FaskesModel.findAndCountAll({
      where: whereClause,
      distinct: true, // ⬅️ penting!
      col: "id",
      limit: request.pageSize,
      offset: (request.page - 1) * request.pageSize,
      order: [["id", request.orderBy]],
      include: [
        {
          model: LokasiModel,
          required: false,
        },
        {
          model: FaskesProfilesModel,
          required: false,
          as: "faskes_profile",
          include: [
            {
              model: AddressModel,
              required: false,
              as: "address",
              include: [
                {
                  model: KelurahanModel,
                  as: "villageData",
                  attributes: ["code", "name"],
                },
              ],
              attributes: {
                exclude: [
                  "createdAt",
                  "updatedAt",
                  "deletedAt",
                  "address_uuid",
                  "uuid",
                  "faskesUuid",
                ],
              },
            },
          ],
        },
      ],
    });
    // console.log("rows => ", JSON.stringify(rows));
    if (count == 0) {
      return [];
    } else {
      return {
        faskesList: rows.map((faskes) => {
          let resp = faskes.toJSON();
          delete resp.LokasiModels;
          resp.poli = faskes.toJSON().LokasiModels;
          return resp;
        }),
        paginationInfo: {
          totalPage: Math.ceil(count / request.pageSize),
          totalItem: count,
          currentPage: request.page,
          limit: request.pageSize,
        },
      };
    }
  }

  static async findFaskesIncludePoliAndAddress(request) {
    FaskesModel.hasMany(LokasiModel, {
      constraints: false,
      foreignKey: "faskes_uuid",
      sourceKey: "uuid",
    });
    LokasiModel.belongsTo(FaskesModel, {
      constraints: false,
      foreignKey: "faskes_uuid",
      targetKey: "uuid",
    });

    FaskesModel.hasOne(FaskesProfilesModel, {
      foreignKey: "faskesUuid",
      sourceKey: "uuid",
      constraints: false,
    });

    const whereClause = {
      [Op.and]: [
        {
          deletedAt: {
            [Op.is]: null,
          },
        },
        {
          uuid: request.uuid,
        },
      ],
    };

    // // Manual query untuk cross-check
    // const manualCheck = await FaskesProfilesModel.findOne({
    //   where: { faskes_uuid: request.uuid },
    // });
    // console.log("Manual check result:", manualCheck?.toJSON());
    console.log(
      "AddressModel attributes:",
      Object.entries(AddressModel.rawAttributes).map(([k, v]) => ({
        prop: k,
        field: v.field || k,
      }))
    );

    const result = await FaskesModel.findOne({
      where: whereClause,
      include: [
        {
          model: LokasiModel,
          required: false,
        },
        {
          model: FaskesProfilesModel,
          required: false,
          as: "faskes_profile",
          include: [
            {
              model: AddressModel,
              required: false,
              as: "address",
              include: [
                {
                  model: KelurahanModel,
                  as: "villageData",
                  attributes: ["code", "name"],
                },
              ],
              attributes: {
                exclude: [
                  "createdAt",
                  "updatedAt",
                  "deletedAt",
                  "address_uuid",
                  "uuid",
                  "faskesUuid",
                ],
              },
            },
          ],
        },
      ],
    });

    console.log(JSON.stringify(result, null, 2));

    const resp = result?.toJSON();
    if (!resp) return resp;

    // const manualCheckAddress = await AddressModel.findOne({
    //   where: { uuid: "01995580-1ff0-772e-a5aa-b410e493cb43" },
    //   raw: true, // hasil berupa plain object, bukan instance Sequelize
    // });
    // console.log("Manual check address :", manualCheckAddress?.toJSON());

    const { LokasiModels, ...rest } = resp;
    return {
      ...rest,
      poli: LokasiModels,
    };
  }
}
