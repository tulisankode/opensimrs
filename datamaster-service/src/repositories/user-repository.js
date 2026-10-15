import { Op, QueryTypes, Sequelize, Transaction } from "sequelize";
import { toEpochDate } from "../helpers/helper.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { PegawaiModel, PractitionerModel, RoleModel, UserModel } from "@opensimrs/model-sdk/datamaster";



UserModel.hasOne(RoleModel, {
  foreignKey: "uuid",
  sourceKey: "roleUuid",
  constraints: false,
});
RoleModel.belongsTo(UserModel, {
  foreignKey: "roleUuid",
  targetKey: "uuid",
  constraints: false,
});

UserModel.hasOne(PractitionerModel, {
  foreignKey: "uuid",
  sourceKey: "practitioner_uuid",
  constraints: false,
});

PractitionerModel.belongsTo(UserModel, {
  foreignKey: "practitioner_uuid",
  targetKey: "uuid",
  constraints: false,
});
export default class UserRepository {

  /**
   * 
   * @param {{limit: number, offset: number, order_by: string, search: string}} request 
   */
  static async findAllUser(request){
    let whereClause = {
      [Op.and]: [
        {
          deletedAt: {
            [Op.is]: null
          }
        },
        {
          faskesUuid: request.faskes_uuid
        }
      ]
    };
    if(request.search) whereClause.name = { [Op.iLike]: `%${request.search}%` };
    const {count, rows} = await UserModel.findAndCountAll({
      where: whereClause,
      limit: request.limit,
      offset: request.offset - 1
    });

    return {
      data: rows.map(u => u.toJSON()),
      properties: {
        total_item: count,
        limit: request.limit,
        offset: request.offset,
        total_page: Math.ceil(count / (request.offset - 1)),
      }
    }
  }


  /**
   *
   * @param {string} faskes_uuid
   * @returns {Promise<Array<UserModel>>}
   */
  static async export(faskes_uuid) {
    UserModel.hasOne(PractitionerModel, {
      foreignKey: "uuid",
      constraints: false,
      sourceKey: "practitioner_uuid",
    });
    PractitionerModel.belongsTo(UserModel, {
      constraints: false,
      foreignKey: "uuid",
      targetKey: "uuid",
    });

    PractitionerModel.hasOne(PegawaiModel, {
      foreignKey: "uuid",
      constraints: false,
      sourceKey: "pegawai_uuid",
    });

    PegawaiModel.belongsTo(PractitionerModel, {
      constraints: false,
      foreignKey: "uuid",
      targetKey: "pegawai_uuid",
    });
    const result = await UserModel.findAll({
      where: {
        [Op.and]: [
          {
            faskesUuid: faskes_uuid
          },
          {
            deletedAt: {
              [Op.is]: null
            }
          }
        ]
      },
      attributes: ["uuid", "username", "email", "phone", "status", "permissions", "faskesUuid", "createdAt"],
      include: [
        {
          model: PractitionerModel,
          required: false,
          attributes: ["uuid", "pegawai_uuid", "faskes_uuid", "status", "created_at", "updated_at", "deleted_at"],
          include: [
            {
              model: PegawaiModel,
              as: "pegawai",
              required: false,
              attributes: ["uuid", "faskes_uuid", "name", "nik", "tipe", "first_title", "last_title", "tanggal_lahir", "gender", "status", "created_at", "updated_at", "deleted_at"],
            }
          ]
        }
      ]
    });
    return result.map(d => {
      const usr = d.toJSON();
      usr.permissions = JSON.parse(d.toJSON().permissions);
      return usr;
    });
  }

  /**
   *
   * @param {Array<{}>} users
   */
  static async saveAll(users, transaction) {
    await UserModel.bulkCreate(users, {
      transaction: transaction,
      returning: ["uuid", "username", "email", "phone", "status", "permissions", "faskesUuid", "createdAt"],
    });
  }

  /**
   * @param {
   * 
   *  {
   *   page: number,
   *   pageSize: number,
   *   orderby: string,
   *   faskesUuid: string,
   *   name: string,
   *   role: string,
   * }
   * 
   * } request
   * @returns {Promise<{payload: Array<{}>, properties: {totalItem: number, totalPage: number, currentPage: number}}>}
   */
  static async findAllAsSuperadmin(request) {


    let whereClause = {
      deletedAt: {
        [Op.is]: null
      }
    }

    let filterByName = {
      deletedAt: null
    }

    let filterByRole = {
      deletedAt: null
    }



    if(request.faskesUuid) whereClause.faskesUuid = request.faskesUuid;
    if(request.name) filterByName.name = { [Op.iLike]: `%${request.name}%` };
    if(request.role) filterByRole.name = { [Op.iLike]: `%${request.role.name}%` };

    const { count, rows } = await UserModel.findAndCountAll({
      limit: request.pageSize,
      offset: request.page,
      order: [["id", request.order]],
      attributes: ["uuid", "username", "email", "phone", "status", "permissions", "faskesUuid", "createdAt"],
      where: whereClause,
      include: [
        {
          model: RoleModel,
          attributes: ["name", "uuid"],
          required: true,
          where: filterByRole
        },
        {
          model: PractitionerModel,
          required: true,
          attributes: ["uuid"],
          include: [
            {
              model: PegawaiModel,
              where: filterByName,
              as: "pegawai",
              required: true,
              attributes: ["uuid", "name", "nik", "first_title", "last_title", "gender", "tanggal_lahir"],
            },
          ],
        },
      ],
    });
    let payload = rows.map((user) => {
      let name, nik, first_title, last_title, gender, tanggal_lahir, practitioner_uuid;
      if(user.toJSON().PractitionerModel) practitioner_uuid = user.toJSON().PractitionerModel.uuid;
      if(user.toJSON()?.PractitionerModel?.pegawai){
        const pegawai = user.toJSON().PractitionerModel?.pegawai;
        name = pegawai.name;
        nik = pegawai.nik;
        first_title = pegawai.first_title;
        last_title = pegawai.last_title;
        gender = pegawai.gender;
        tanggal_lahir = pegawai.tanggal_lahir;
      }
      const { name: roleName, uuid: roleUuid } = user.toJSON().RoleModel;
      const { uuid, username, email, phone, createdAt, status, faskesUuid, permissions } = user;
      return {
        faskesUuid, uuid, name, username, email, phone, status, createdAt,
        practitioner: {
          uuid: practitioner_uuid,
          nik: nik,
          first_title: first_title,
          last_title: last_title,
          gender: gender,
          tanggal_lahir: tanggal_lahir,
        },
        role: {
          uuid: roleUuid,
          name: roleName,
        },
        permissions: JSON.parse(permissions),
      };
    });
    return {
      payload,
      properties: {
        totalItem: count,
        totalPage: Math.ceil(count / request.pageSize),
        currentPage: request.page,
      },
    };
  }

  static async countPractitioner(faskesUuid, practitionerUuid) {
    return await UserModel.count({
      where: {
        [Op.and]: [
          {
            faskesUuid,
          },
          {
            practitionerUuid,
          },
        ],
      },
    });
  }
  /**
   *
   * @param {UserModel} request
   * @param {Transaction} transaction
   * @returns
   */
  static async create(request, transaction) {
    const user = await UserModel.create(request, { transaction });
    if (user) return user.toJSON();
    else return null;
  }

  /**
   *
   * @param {{email: string, faskes_uuid: string}} request
   */
  static async findByEmail(request) {
    const user = await UserModel.findOne({
      where: {
        [Op.and]: [
          {
            email: request.email,
          },
          {
            faskesUuid: request.faskes_uuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          }
        ],
      },
    });
    if (user) return user.toJSON();
    else return null;
  }

  static async update(request, transaction) {
    request.updatedAt = toEpochDate(new Date());
    const affected = await UserModel.update(request, {
      where: {
        [Op.and]: [
          {
            faskesUuid: request.faskesUuid,
          },
          {
            uuid: request.uuid,
          },
          {
            id: request.id,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
      transaction: transaction,
    });
    return affected[0];
  }

  static async countUserByUuid(uuid) {
    return await sequelizeInstance.transaction(async (tr) => {
      return await UserModel.count({
        where: {
          [Op.and]: [
            { uuid },
            {
              deletedAt: {
                [Op.is]: null,
              },
            },
          ],
        },
        transaction: tr,
      });
    });
  }

  static async findAll(page, pageSize, order, role, name, faskesUuid) {  
    const filterByName = { deletedAt: null }
    const filterByRole = { deletedAt: null }

    if(name) filterByName.name = {[Op.iLike]: `%${name}%`}
    if(role) filterByRole.name = {[Op.iLike]: `%${role.name}%`}
    const { count, rows } = await UserModel.findAndCountAll({
      limit: pageSize,
      offset: page,
      order: [["id", order]],
      where: {
        deletedAt: null,
        faskesUuid: faskesUuid
      },
      attributes: ["uuid", "username", "email", "phone", "status", "permissions", "faskesUuid", "createdAt"],
      include: [
        {
          model: RoleModel,
          attributes: ["name", "uuid"],
          where: filterByRole,
          required: true,
        },
        {
          model: PractitionerModel,
          required: true,
          attributes: ["uuid"],
          include: [
            {
              model: PegawaiModel,
              where: filterByName,
              as: "pegawai",
              required: true,
              attributes: ["uuid", "name", "nik", "first_title", "last_title", "gender", "tanggal_lahir"],
            },
          ],
        },
      ],
    });

    const payload = rows.map((user) => {
      const practitionerUuid = user.toJSON().PractitionerModel.uuid;
      const { name, nik, first_title, last_title, gender, tanggal_lahir } = user.toJSON().PractitionerModel.pegawai;
      const { name: roleName, uuid: roleUuid } = user.toJSON().RoleModel;
      const { uuid, username, email, phone, createdAt, status, faskesUuid, permissions } = user;
      return {
        faskesUuid, uuid, name, username, email, phone, status, createdAt,
        practitioner: {
          uuid: practitionerUuid, nik, first_title, last_title, gender, tanggal_lahir,
        },
        role: {
          uuid: roleUuid,
          name: roleName,
        },
        permissions: JSON.parse(permissions),
      };
    });
    return {
      data: payload,
      properties: {
        totalItem: count,
        totalPage: Math.ceil(count / (pageSize - 0)),
        currentPage: page,
      },
    };
  }

  static async findByUuid(uuid, faskes_uuid) {
    const user = await UserModel.findOne({
      where: {
        [Op.and]: [
          { uuid },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            faskesUuid: faskes_uuid,
          },
        ],
      },
    });
    return user ? user.toJSON() : null;
  }

  static async findByUsername(username) {
    try {
      const result = await sequelizeInstance.transaction(async (tr) => {
        return await UserModel.findOne({
          where: { username },
          transaction: tr,
          attributes: ["uuid", ["role_uuid", "roleUuid"], "username", "email", "phone", ["created_at", "createdAt"], ["updated_at", "updatedAt"]],
        });
      });
      return result.get();
    } catch (error) {
      throw error;
    }
  }

  static async findAllDeleted(faskes_uuid) {
    const userList = await UserModel.findAll({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.not]: null,
            },
          },
          {
            faskesUuid: faskes_uuid,
          },
        ],
      },
      transaction: tr,
      attributes: ["uuid", ["role_uuid", "roleUuid"], "name", "username", "email", "phone", ["created_at", "createdAt"], ["updated_at", "updatedAt"], ["deleted_at", "deletedAt"]],
    });
    if (userList.length > 0) return userList.map((user) => user.toJSON());
    else return [];
  }

  static async updatePassword(request, transaction) {
    const afectedRow = await UserModel.update(
      { 
        password: request.new_password,
        updatedAt: toEpochDate(new Date()),
      },
      {
        where: {
          [Op.and]: [
            { 
              uuid: request.uuid
            },
            {
              faskesUuid: request.faskesUuid
            },
            {
              deletedAt: {
                [Op.is]: null,
              },
            },
          ],
        },
        transaction: transaction,
      }
    );
    return afectedRow[0];
  }

  static async delete(userModel, transaction) {
    userModel.deletedAt = toEpochDate(new Date());
    const affected = await UserModel.update(userModel, {
      transaction: transaction,
      where: {
        [Op.and]: [
          {
            faskesUuid: userModel.faskesUuid,
          },
          {
            uuid: userModel.uuid,
          }
        ]
      }
    });
    return affected[0]
  }

  static async findByUuidIncludeRole(request) {
    UserModel.hasOne(RoleModel, {
      foreignKey: "uuid",
      sourceKey: "roleUuid",
      constraints: false,
    });
    RoleModel.belongsTo(UserModel, {
      foreignKey: "uuid",
      targetKey: "roleUuid",
      constraints: false,
    });
    return await sequelizeInstance.transaction(async (tr) => {
      const user = await UserModel.findOne({
        where: {
          [Op.and]: [
            { 
              uuid: request.uuid
            },
            {
              faskesUuid: request.faskesUuid
            },
            {
              deletedAt: {
                [Op.is]: null,
              },
            },
          ],
        },
        attributes: ["uuid", "username", "email", "phone"],
        transaction: tr,
        include: [
          {
            required: false,
            attributes: ["name", "code"],
            model: RoleModel,
          },
        ],
      });
      if(user) {
        const res = user.toJSON();
        delete res.RoleModel;
        res.role = user.toJSON().RoleModel;
        return res;
      }
      else return null;
    });
  }

  /**
   *
   * @param {Array<{}>} usersList
   * @param {Array<{}>} practitionerList
   * @param {Array<{}>} pegawaiList
   */
  static async importUser(usersList, practitionerList, pegawaiList) {
    return await sequelizeInstance.transaction(async (tr) => {
      await PegawaiModel.bulkCreate(pegawaiList, {
        transaction: tr,
        returning: true,
      });
      await PractitionerModel.bulkCreate(practitionerList, {
        transaction: tr,
        returning: true,
      });
      await UserModel.bulkCreate(usersList, {
        transaction: tr,
        returning: true,
      });
    });
  }
}
