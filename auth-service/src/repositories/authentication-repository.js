import { PegawaiModel, PractitionerModel, RoleModel, UserModel } from "@opensimrs/model-sdk/datamaster";
import { NotfoundException } from "@opensimrs/model-sdk/exceptions";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { Op } from "sequelize";
import UnauthorizeException from "../errors/unauthorize-exception.js";

export default class AuthenticationRepository {
  
  static async login(username) {
    return await sequelizeInstance.transaction(async tr => {
      UserModel.hasOne(RoleModel, {
        foreignKey: "uuid",
        sourceKey: "roleUuid",
        constraints: false
      });
      RoleModel.belongsTo(UserModel, {
        foreignKey: "uuid",
        targetKey: "roleUuid",
        constraints: false
      });

      UserModel.hasOne(PractitionerModel, {
        constraints: false,
        foreignKey: "uuid",
        sourceKey: "practitioner_uuid"
      })

      PractitionerModel.belongsTo(UserModel, {
        constraints: false,
        foreignKey: "uuid",
        targetKey: "practitioner_uuid"
      });
      const user = await UserModel.findOne({
        where: {
          [Op.and]: [
            {
              [Op.or]: [
                { username },
                {
                  email: username
                }
              ]
            },
            {
              deletedAt: {
                [Op.is]: null
              }
            }
          ]
        },
        attributes: ["uuid", ["faskes_uuid", "faskesUuid"], "username", "email", "phone", ["role_uuid", "roleUuid"], "password", "permissions"],
        transaction: tr,
        include: [
          {
            model: RoleModel,
            required: true,
            attributes: ["name"]
          },
          {
            model: PractitionerModel,
            required: true,
            attributes: ["pegawai_uuid"],
            include: [
              {
                model: PegawaiModel,
                as: "pegawai",
                required: true,
                attributes: ["name"]
              }
            ]
          }
        ]
      });
      if(user) {
        const 
          {
            uuid, faskesUuid, username, email, password, phone,
            RoleModel: role, PractitionerModel: practitioner, permissions
          } = user.toJSON();
          console.log(permissions)
        return {
          uuid, faskesUuid, username, email, password, phone,
          role: role.name, name: practitioner.pegawai.name,
          permissions: JSON.parse(permissions)
        }
      }
      else {
        const user = await UserModel.findOne(
          {
            transaction: tr,
            where: {
              [Op.and]: [
                {
                  [Op.or]: [
                    { username },
                    { email: username}
                  ]
                },
                {
                  deletedAt: {
                    [Op.is]: null
                  }
                }
              ]
            },
            attributes: ["uuid", ["faskes_uuid", "faskesUuid"], "username", "email", "phone", ["role_uuid", "roleUuid"], "password", "permissions"],
            include: [
              {
                required: true,
                attributes: ["name"],
                model: RoleModel
              }
            ]
          }
        );
        if(user){
          const { 
            uuid, faskesUuid, username, email, password, phone,
            RoleModel: role, permissions
           } = user.toJSON();
           return {
            uuid, faskesUuid, username, email, password, phone,
            role: role.name, permissions: JSON.parse(permissions)
           }
        }
        else {
          throw new UnauthorizeException(
            {
              message: `gagal login`,
              errors: [
                {
                  message: `username ${username} belum terdaftar`
                }
              ]
            }
          )  
        }
      }
    });
  }

  static async findByUsername(username){
    return await sequelizeInstance.transaction(async tr => {
      const user = await UserModel.findOne({
        where: {
          [Op.and]: [
            {
              [Op.or]: [
                { username },
                { email: username}
              ]
            },
            {
              deletedAt: {
                [Op.is]: null
              }
            }
          ]
        },
        transaction: tr
      })
      if(user){
        return user.toJSON();
      }
      else {
        throw new NotfoundException(
          {
            message: "Faskes tidak ditemukan",
            errors: [
              {
                message: `faskes tidak ditemukan, pastikan uuid atau nama faskes benar`
              }
            ]
          }
        )
      }
    })
  }
}
