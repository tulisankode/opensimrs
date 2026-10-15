import { Op } from "sequelize";
import { toEpochDate } from "../helpers/date-helper.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { PegawaiModel, PractitionerModel, RoleModel, UserModel } from "@opensimrs/model-sdk/datamaster";
import { HttpException } from "../errors/http-exception.js";
import { NotfoundException } from "@opensimrs/model-sdk/exceptions";

export default class UserRepository {

  /**
   * 
   * @param {string} faskes_uuid 
   * @returns {Promise<Array<UserModel>>}
   */
  static async export(faskes_uuid){ 
    UserModel.hasOne(PractitionerModel, {
      foreignKey: "uuid",
      constraints: false,
      sourceKey: "practitioner_uuid"
    });
    PractitionerModel.belongsTo(UserModel, {
      constraints: false,
      foreignKey: "uuid",
      targetKey: "uuid"
    });

    PractitionerModel.hasOne(PegawaiModel, {
      foreignKey: "uuid",
      constraints: false,
      sourceKey: "pegawai_uuid",
    });

    PegawaiModel.belongsTo(PractitionerModel, {
      constraints: false,
      foreignKey: "pegawai_uuid",
      targetKey: "uuid",
    })
    const result = await UserModel.findAll({
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null
            }
          },
          {
            faskes_uuid: faskes_uuid
          }
        ]
      },
      include: [
        {
          model: PractitionerModel,
          required: true,
          attributes: ["sip", "str", "code_bpjs", "satu_sehat_id", "is_doctor", "code_antrian_dokter", "status"],
          include: [
            {
              model: PegawaiModel,
              required: true,
              as: "pegawai",
              attributes: ["name", "nik", "first_title", "last_title", "gender", "tanggal_lahir"],
            }
          ]
        }
      ]
    });

    if(result.length >= 0) return result.map(u => {
      const user = u.toJSON();
      user.permissions = JSON.parse(u.toJSON().permissions);
      delete user.PractitionerModel;
      user.practitioner = u.toJSON().PractitionerModel;
      return user;
    });
    else return [];
  }


  /**
   * 
   * @param {Array<{}>} users 
   */
  static async saveAll(users, transaction){
      await UserModel.bulkCreate(users, { transaction });
  }



  static async findAllAsSuperadmin(page, pageSize, orderby, role, name) {
    UserModel.hasOne(RoleModel, {
      foreignKey: "uuid",
      sourceKey: "roleUuid",
      constraints: false
    });
    RoleModel.belongsTo(UserModel, {
      foreignKey: "uuid",
      targetKey: "roleUuid",
      constraints: false,
    });

    UserModel.hasOne(PractitionerModel, {
      foreignKey: "uuid",
      sourceKey: "practitioner_uuid",
      constraints: false
    })

    PractitionerModel.belongsTo(UserModel, {
      foreignKey: "uuid",
      targetKey: "practitioner_uuid",
      constraints: false,
    })

    let searchName;
    let searchRole;
    if(name){
      searchName = {
        name: {
          [Op.iLike]: `%${name}%`
        }
      }
    }
    if(role){
      searchRole = {
        name: {
          [Op.iLike]: `%${name}%`
        }
      }
    }


    const { count, rows } = await UserModel.findAndCountAll({
      limit: pageSize,
      offset: page,
      order: [["id", orderby]],
      attributes: ["uuid", "username", "email", "phone", "status", "permissions", "faskesUuid", "createdAt"],
      where: {
        [Op.and]: [
          {
            deletedAt: {
              [Op.is]: null
            }
          }
        ]
      },
      include: [
        {
          model: RoleModel,
          attributes: ["name", "uuid"],
          where:searchRole,
          required: true,
        },
        {
          model: PractitionerModel,
          required: true,
          attributes: ["uuid"],
          include: [
            {
              model: PegawaiModel,
              as: "pegawai",
              required: true,
              attributes: ["uuid", "name", "nik", "first_title", "last_title", "gender", "tanggal_lahir"],
              where: searchName
            }
          ]
        }
      ],
    });        
    const payload = rows.map((user) => {
      const practitionerUuid = user.toJSON().PractitionerModel.uuid;
      const { name, nik, first_title, last_title, gender, tanggal_lahir } = user.toJSON().PractitionerModel.pegawai;
      const { name: roleName, uuid: roleUuid} = user.toJSON().RoleModel;
      const { uuid, username, email, phone, createdAt, status, faskesUuid, permissions } = user;
      return {
        faskesUuid, uuid, name, username, email,
        phone, status, createdAt,
        practitioner: {
          uuid: practitionerUuid,
          nik, first_title, last_title,
          gender, tanggal_lahir,
        },
        role: {
          uuid: roleUuid,
          name: roleName
        },
        permissions: JSON.parse(permissions)
      };
    });
    return {
      payload,
      properties: {
        totalItem: count,
        totalPage: Math.ceil(count / pageSize),
        currentPage: page,
      },
    };
  }


  static async countPractitioner(faskesUuid, practitionerUuid){
    return await UserModel.count({
      where: {
        [Op.and]: [
          {
            faskesUuid
          },
          {
            practitionerUuid
          }
        ]
      }
    })
  }
  static async create(request, faskesUuid) {
    return await sequelizeInstance.transaction(async (tr) => {
      const totalPractitioner = await this.countPractitioner(faskesUuid, request.practitionerUuid);
      if(totalPractitioner !== 0){
        throw new HttpException(
          {
            message: "Data gagal disimpan",
            errors: [
              {
                type: "conflict",
                message: "Data yang diinputkan sudah ada"
              }
            ]
          }, 409
        )
      }
      const user =  await UserModel.create(request, {
        transaction: tr,
        returning: true
      });
      const 
      { 
        uuid, roleUuid, practitionerUuid,
        phone, email, username, photo, awalGelar,
        akhirGelar, permissions,
        createdAt
      } = user.toJSON();
      return { 
        uuid, roleUuid, practitionerUuid,
        phone, email, username, photo, awalGelar,
        akhirGelar, permissions,
        createdAt
      }
    });
  }

  static async update(request) {
    return sequelizeInstance.transaction(async (tr) => {
      const { email, faskesUuid, username } = request;
      const [ affectedRow, [userUpdated] ] = await UserModel.update(request, {
        where: {
          [Op.and]: [
            { email },
            { faskesUuid },
            {
              deletedAt: {
                [Op.is]: null,
              },
            },
          ],
        },
        returning: true,
        transaction: tr,
      });
      if(affectedRow !== 1){
        throw new HttpException(
          {
            message: "Data gagal di edit",
          }, 500
        )
      }
      else {
        const { 
          uuid, roleUuid, practitionerUuid,
          phone, username, photo, awalGelar,
          akhirGelar, permissions,
          createdAt
         } = userUpdated.toJSON();
         return {
          uuid, roleUuid, practitionerUuid,
          phone, email, username, photo, awalGelar,
          akhirGelar, permissions,
          createdAt
         }
      }
    });
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
    const offset = page * pageSize;
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

    UserModel.hasOne(PractitionerModel, {
      foreignKey: "uuid",
      sourceKey: "practitioner_uuid",
      constraints: false
    })

    PractitionerModel.belongsTo(UserModel, {
      foreignKey: "practitionerUuid",
      targetKey: "uuid",
      constraints: false
    })
    return await sequelizeInstance.transaction(async (tr) => {
      if (name) {
        const { count, rows } = await UserModel.findAndCountAll({
          limit: pageSize,
          offset: offset,
          order: [["id", order]],
          transaction: tr,
          attributes: ["uuid", "username", "email", "phone", "status", "permissions", "faskesUuid", "createdAt"],
          where: {
            [Op.and]: [
              { faskesUuid },
              {
                deletedAt: {
                  [Op.is]: null
                }
              }
            ]
          },
          include: [
            {
              model: RoleModel,
              attributes: ["name", "uuid"],
              where: role,
              required: true,
            },
            {
              model: PractitionerModel,
              required: true,
              attributes: ["uuid"],
              include: [
                {
                  model: PegawaiModel,
                  as: "pegawai",
                  required: true,
                  attributes: ["uuid", "name", "nik", "first_title", "last_title", "gender", "tanggal_lahir"],
                  where:
                    sequelizeInstance.where(
                      sequelizeInstance.fn("LOWER", sequelizeInstance.col("PractitionerModel->PegawaiModel.name")),
                      Op.like,
                      `%${name.toLowerCase()}%`
                  )
                }
              ]
            }
          ],
        });        
        const payload = rows.map((user) => {
          const practitionerUuid = user.toJSON().PractitionerModel.uuid;
          const { name, nik, first_title, last_title, gender, tanggal_lahir } = user.toJSON().PractitionerModel.pegawai;
          const { name: roleName, uuid: roleUuid} = user.toJSON().RoleModel;
          const { uuid, username, email, phone, createdAt, status, faskesUuid, permissions } = user;
          return {
            faskesUuid, uuid, name, username, email,
            phone, status, createdAt,
            practitioner: {
              uuid: practitionerUuid,
              nik, first_title, last_title,
              gender, tanggal_lahir,
            },
            role: {
              uuid: roleUuid,
              name: roleName
            },
            permissions: JSON.parse(permissions)
          };
        });
        return {
          payload,
          properties: {
            totalItem: count,
            totalPage: Math.ceil(count / pageSize),
            currentPage: page,
          },
        };
      }
      else {
        const { count, rows } = await UserModel.findAndCountAll({
          limit: pageSize,
          offset: offset,
          order: [["id", order]],
          transaction: tr,
          where: {
            [Op.and]: [
              { faskesUuid },
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
              model: RoleModel,
              attributes: ["name", "uuid"],
              where: role,
              required: true,
            },
            {
              model: PractitionerModel,
              required: true,
              attributes: ["uuid"],
              include: [
                {
                  model: PegawaiModel,
                  as: "pegawai",
                  required: true,
                  attributes: ["uuid", "name", "nik", "first_title", "last_title", "gender", "tanggal_lahir"],
                }
              ]
            }
          ],
        });        
        const payload = rows.map((user) => {
          const practitionerUuid = user.toJSON().PractitionerModel.uuid;
          const { name, nik, first_title, last_title, gender, tanggal_lahir } = user.toJSON().PractitionerModel.pegawai;
          const { name: roleName, uuid: roleUuid} = user.toJSON().RoleModel;
          const { uuid, username, email, phone, createdAt, status, faskesUuid, permissions } = user;
          return {
            faskesUuid, uuid, name, username, email,
            phone, status, createdAt,
            practitioner: {
              uuid: practitionerUuid,
              nik, first_title, last_title,
              gender, tanggal_lahir,
            },
            role: {
              uuid: roleUuid,
              name: roleName
            },
            permissions: JSON.parse(permissions)
          };
        });
        return {
          payload,
          properties: {
            totalItem: count,
            totalPage: Math.ceil(count / pageSize),
            currentPage: page,
          },
        };
      }
    });
  }

  static async findByUuid(uuid) {
    return await sequelizeInstance.transaction(async (tr) => {
      const user = await UserModel.findOne({
        where: {
          [Op.and]: [
            { uuid: uuid },
            {
              deletedAt: {
                [Op.is]: null,
              },
            },
          ],
        },
        transaction: tr,
        attributes: ["uuid", "roleUuid", "faskesUuid","username", "email", "phone", "createdAt", "updatedAt"],
      });
      if(user){
        const { uuid, roleUuid, faskesUuid, username, email, phone, createdAt} = user.toJSON();
        return {
          uuid, roleUuid, faskesUuid, username, email,
          phone, createdAt
        }
      }
      else {
        throw new NotfoundException(
          {
            message: `uuid tidak diketahui`
          }
        )
      }
    });
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

  static async findAllDeleted() {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await UserModel.findAll({
        where: {
          deletedAt: {
            [Op.not]: null,
          },
        },
        transaction: tr,
        attributes: ["uuid", ["role_uuid", "roleUuid"], "name", "username", "email", "phone", ["created_at", "createdAt"], ["updated_at", "updatedAt"], ["deleted_at", "deletedAt"]],
      });
    });
    return result !== null ? result.map((userDeleted) => userDeleted.toJSON()) : result;
  }

  static async updatePassword(password, uuid) {
    return await sequelizeInstance.transaction(async (tr) => {
      const afectedRow = await UserModel.update(
        { password },
        {
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
          returning: ["username"],
        }
      );
      return afectedRow[1][0];
    });
  }

  static async delete(uuid) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      const [affectedRow, userDeleted] = await UserModel.update(
        { deletedAt: toEpochDate(new Date()) },
        {
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
          returning: ["username"],
        }
      );
      if(affectedRow !== 1) {
        throw new HttpException(
          {
            message: "Gagal menghapus user"
          }, 500
        )
      }
      else {
        return userDeleted[0].toJSON();
      }
    });
    return result;
  }

  static async findByUuidIncludeRole(uuid) {
    return await sequelizeInstance.transaction(async (tr) => {
      const user = await UserModel.findOne({
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
        attributes: ["name", "email"],
        transaction: tr,
        include: [
          {
            required: true,
            attributes: ["name", "code"],
            association: UserModel.belongsTo(RoleModel, {
              foreignKey: "roleUuid",
              targetKey: "uuid",
            }),
          },
        ],
      });
      return user.toJSON();
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
