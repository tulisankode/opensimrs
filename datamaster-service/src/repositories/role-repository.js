import { Op } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { RoleModel } from "@opensimrs/model-sdk/datamaster";
import { BaseRePosiotry } from "./base-repository.js";
import { toEpochDate } from "../helpers/helper.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorResponse } from "../helpers/generate-message.js";

export default class RoleRepository extends BaseRePosiotry {


  /**
   * 
   * @param {string} name 
   * @param {string} faskes_uuid 
   * @returns {Promise<RoleModel>}
   */
  static async findByName(name, faskes_uuid){
    const role = await RoleModel.findOne({ 
      where: {
        name: name,
        faskes_uuid: faskes_uuid
      }
    });
    if(role) return role.toJSON();
    else return null;
  }



  /**
   * 
   * @param { Array<{faskes_uuid: uuid | string, name: string, permission: string, code: string}> } roleList 
   */
  static async saveAll(roleList){
    await sequelizeInstance.transaction(async tr => {
      await RoleModel.bulkCreate(roleList, {
        transaction: tr,
        returning: false
      });
    })
  }


  /**
   * 
   * @param {string} role 
   */
  static async save(role, transaction) {
    await RoleModel.create(role, { 
      transaction,
      returning: false
     });
  }


  /**
   * 
   * @param {Array<string>} nameList 
   */
  static async finndAllRoleIn(faskesUuid, nameList){
    const roles = await RoleModel.findAll({
      where: {
        [Op.and]: [
          {
            name: {
              [Op.in]: nameList
            }
          },
          {
            faskes_uuid: faskesUuid
          }
        ]
      },
      attributes: ["uuid", "faskes_uuid", "code", "name", "permissions", "status", "createdAt", "updatedAt", "deletedAt"]
    });
    if(roles.length !== 0 || roles) return roles.map(r => r.toJSON());
    else return [];
  }

  static async addRole(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await RoleModel.create(data, 
        { 
          transaction: tr ,
          returning: false
        });
    });
    return result;
  }

  static async getAllRole(name = null, page = 1, limit = 10, order_by, faskes_uuid) {
    let whereClause = {
      [Op.and]: [
        {
          faskes_uuid: faskes_uuid
        },
        {
          deletedAt: {
            [Op.is]: null
          }
        }
      ]
    };

    if (name) {
      whereClause = {
        [Op.and]: [
          {
            faskes_uuid: faskes_uuid
          },
          {
            deletedAt: {
              [Op.is]: null
            }
          },
          {
            name: {
              [Op.iLike]: `%${name}%`
            }
          }
        ]
      };   
    }
    const offset = (page - 1) * limit;
    const { count, rows } = await RoleModel.findAndCountAll({
      where: whereClause,
      attributes: ["uuid", "faskes_uuid", "code", "name", "permissions", "status", "createdAt", "updatedAt", "deletedAt"],
      limit: limit,
      offset: offset,
      order: [["id", order_by]],
    });
  return {
    data: rows.map(r => {
      const role = r.toJSON();
      role.permissions = JSON.parse(role.permissions)
      return role;
    }),
    properties: {
      total_item: count,
      total_page: Math.ceil(count / limit),
      current_page: page,
      limit: limit
    }
  };
}

  static async getAllRoleAktif(faskes_uuid) {
    const result = await RoleModel.findAll({
      where: {
        deletedAt: null,
        status: true,
        faskes_uuid: faskes_uuid
      },
      attributes: ["uuid", "faskes_uuid", "code", "name", "permissions", "status", "createdAt", "updatedAt", "deletedAt"]
    });
    return result.map(r => {
      let c = r.toJSON();
      c.permissions = JSON.parse(r.permissions);
      return c;
    })
  }

  static async findRoleById(uuid) {
    const result =  await RoleModel.findOne({ 
      where: {
        uuid: uuid
      },
      attributes: ["uuid", "faskes_uuid", "code", "name", "permissions", "status", "createdAt", "updatedAt", "deletedAt"]
    });
    if(result) return result.toJSON();
    else return null;
  }

  static async findRoleByCode(code) {
    return await RoleModel.findOne({ 
      where: {
        code: code
      },
      attributes: {
        include: ["uuid", "faskes_uuid", "code", "name", "permissions", "status", "createdAt", "updatedAt", "deletedAt"],
        exclude: ["role_uuid"]
      }
    });
  }

  static async updateRole(request) {
    request.updatedAt = toEpochDate(new Date());
    const result = await RoleModel.update(request, {
      where: {
        faskes_uuid: request.faskes_uuid,
        uuid: request.uuid,
        deletedAt: null
      }
    });
    if(result[0] !== 1){
      throw new HttpException(generateErrorResponse("Gagal update", "internal server error", "gagal update role", HttpStatus.INTERNAL_SERVER_ERROR));
    }
  }

  static async exportRole(faskes_uuid) {
    return await RoleModel.findAll({
      where: {
        deletedAt: null,
        faskes_uuid: faskes_uuid
      },
      attributes: ["uuid", "faskes_uuid", "code", "name", "permissions", "status", "createdAt", "updatedAt", "deletedAt"]
    });
  }

  static async deleteRole(request) {
    request.deletedAt = toEpochDate(new Date());
    const affected = await RoleModel.update(request, {
      where: {
        uuid: request.uuid,
        deletedAt: {
          [Op.is]: null
        },
        faskes_uuid: request.faskes_uuid
      },
      returning: false
    });
    return affected[0];
  }
}
