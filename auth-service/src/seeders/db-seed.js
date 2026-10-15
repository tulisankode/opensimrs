import { Op } from "sequelize";
import * as bcrypt from "bcryptjs";
import { FaskesModel, PegawaiModel, PractitionerModel, RoleModel, UserModel } from "@opensimrs/model-sdk/datamaster";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { admisiPermission, antrianPermission, dashboardPermission, datamasterPermission, farmasiPermission, fisioTerapiPermission, igdPermission, inventoryPermission, laboraturiumPermission, laporanPermission, pembayaranPermission, rawatInapPermission, rawatJalanPermission, settingPermission, stokPermission, trainingPermission } from "../helpers/permission-list.js";

export async function initSueprAdmin() {
  await sequelizeInstance.transaction(async (tr) => {
    // create super admin
    const permissions = [antrianPermission, admisiPermission, rawatInapPermission, rawatJalanPermission, igdPermission, farmasiPermission, laboraturiumPermission, fisioTerapiPermission, trainingPermission, pembayaranPermission, stokPermission, inventoryPermission, datamasterPermission, laporanPermission, settingPermission, dashboardPermission];
    const [roleSuperAdmin, ] = await RoleModel.findOrCreate({
      where: {
        [Op.and]: [
          {
            name: "super admin",
          },
          {
            code: "SPR-ADM",
          },
        ],
      },
      defaults: {
        name: "super admin",
        code: "SPR-ADM",
        permissions: JSON.stringify(permissions),
        status: true,
      },
      transaction: tr,
    });
    await UserModel.findOrCreate({
      where: {
        [Op.and]: [
          {
            email: "pengguna1@contoh.id",
          }
        ],
      },
      defaults: {
        roleUuid: roleSuperAdmin.toJSON().uuid,
        phone: "080000000000",
        email: "pengguna1@contoh.id",
        username: "opensimrs-service-center",
        permissions: JSON.stringify(permissions),
        password: await bcrypt.hash("admin123", 10),
        first_title: "spr",
        last_title: ".ad",
        status: true,
      },
      transaction: tr,
    });
  });
}

export async function initAdmin() {
  await sequelizeInstance.transaction(async (tr) => {
    const permissions = [antrianPermission, admisiPermission, rawatInapPermission, rawatInapPermission, igdPermission, farmasiPermission, laboraturiumPermission, fisioTerapiPermission, trainingPermission, pembayaranPermission, stokPermission, inventoryPermission, laporanPermission, settingPermission, dashboardPermission]
    const [ faskes, ] = await FaskesModel.findOrCreate({
      where: {
        [Op.and]: [
          { code: "AMBA" },
          { name: "Cliic Ambatukem" }
        ]
      },
      defaults: {
        code: "AMBA",
        name: "Cliic Ambatukem",
        organization_ihs_number: "328017872r91",
        client_id: "203991290803u08ru2304823-29e9ei9191338",
        client_secret: "00291380e81e981231d791ye791555391g",
        status: true
      },
      transaction: tr,
      attributes: ["uuid", "name", "code", "status"],
    });
    const [roleAdmin, ] = await RoleModel.findOrCreate({
      where: {
        [Op.and]: [{ name: "admin" }, { code: "ADM" }],
      },
      defaults: {
        name: "admin",
        faskes_uuid: faskes.toJSON().uuid,
        permissions: JSON.stringify(permissions),
        code: "ADM",
        status: true,
      },
      transaction: tr
    });
    
    
    

    const [pegawai, ] = await PegawaiModel.findOrCreate(
      {
        where: {
          nik: "9999999999999999"
        },
        defaults: {
          faskes_uuid: faskes.toJSON().uuid,
          name: "Alliano",
          nik: "9999999999999999",
          tanggal_lahir: new Date(),
          gender: "Laki-laki",
          status: true
         },
         transaction: tr
      }
    )

    const [practitioner, ] = await PractitionerModel.findOrCreate(
      {
        where: {
          [Op.and]: [
            {
              code_bpjs: "cd_bpj",
            },
            {
              deletedAt: {
                [Op.is]: null
              }
            }
          ]
        },
        transaction: tr,
        defaults: {
          faskes_uuid: faskes.toJSON().uuid,
          pegawai_uuid: pegawai.toJSON().uuid,
          is_doctor: true,
          status: true,
        }
      }
    )

    await UserModel.findOrCreate({
      where: {
        [Op.and]: [{ email: "pengguna2@contoh.id", username: "khabib77" }],
      },
      transaction: tr,
      defaults: {
        roleUuid: roleAdmin.toJSON().uuid,
        faskesUuid: faskes.toJSON().uuid,
        practitionerUuid: practitioner.toJSON().uuid,
        phone: "080000000000",
        username: "khabib77",
        email: "pengguna2@contoh.id",
        password: await bcrypt.hash("khabib123", 10),
        status: true,
        permissions: JSON.stringify(permissions),
      },
    });
  });
}