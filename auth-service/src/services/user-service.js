import UserValidation from "../validations/user-validation.js";
import ZodValidator from "../validations/zod-validator.js";
import { parseDateString, toEpochDate } from "../helpers/date-helper.js";
import bcrypt from "bcryptjs";
import UserRepository from "../repositories/user-repository.js";
import BadRequestException from "../errors/bad-request-exception.js";
import excelJs from "exceljs";
import { uuidv7 } from "uuidv7";
import { RoleRepository } from "../repositories/role-repository.js";
import { checkRole } from "../helpers/permission-list.js";
import { generateErrorMessage, generateSuccessMessage } from "../helpers/generate-message.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { isThereDuplicate } from "../helpers/helper.js";
import { UserModel } from "@opensimrs/model-sdk/datamaster";

export default class UserService {
  
  static async create(author, request) { 
    ZodValidator.validate(UserValidation.CREATE, request);
    request.password = await bcrypt.hash(request.password, 10);
    request.faskesUuid = author.faskesUuid;
    const result = await UserRepository.create(request, author.faskesUuid);
    return {
      message: "Berhasil menambahkan user baru",
      payload: result
    }
  }

  static async update(author, request){
    ZodValidator.validate(UserValidation.UPDATE, request);
    const user = await UserRepository.findByUuid(request.uuid);
    await UserRepository.update({...user, ...request, updatedAt: toEpochDate(new Date())});
    return { 
      message: `Data berhasil di edit`,
    }
  }

  static async findAll(page, pageSize, order, role, name, author){
    const { faskesUuid, role: r } = author;
    if(r === "super admin"){
      const data =  await UserRepository.findAllAsSuperadmin(page, pageSize, order, role, name);
      return {
        message: "Berhasil menampilkan semua users",
        payload: data.payload,
        properties: data.properties
      }
    }
    const { properties, payload } =  await UserRepository.findAll(page, pageSize, order, role, name, faskesUuid)
    return {
      message: "Berhasil menampilkan semua user",
      payload,
      properties
    }
  }
 
  static async findAllDeleted() {
    return {
      message: "Berhasil menampilkan semua user yang telah dihapus",
      payload: await UserRepository.findAllDeleted()
    };
  }
  
  static async updatePassword(author, userReq) {
    userReq = ZodValidator.validate(UserValidation.UPDATE_PASSWORD, userReq);
    const { newPassword: password, uuid } = userReq;
    const user = await UserRepository.updatePassword(password, uuid);
    if(!user) throw new BadRequestException(`password gagal di perbarui`);
    return { message: `password ${user.username} berhasil di update` }
  }

  static async delete(author, uuid){
    const uuidValid = ZodValidator.validate(UserValidation.DELETE, uuid);
    await UserRepository.delete(uuidValid);
    return { message: `berhasil menghapus user` }
  }

  static async findByUuidIncludeRole(uuid) {
    return await UserRepository.findByUuidIncludeRole(uuid);
  }

  static async import(filePath, faskesuuid){
    const workbook = new excelJs.Workbook();
    await workbook.xlsx.readFile(filePath);
    const workSheet = workbook.getWorksheet(1);
    let userPromises = [];
    const practitionerPromises = [];
    const pegawaiPromises = [];
    workSheet.eachRow(async (row, rowNumber) => {
      const pegawaiUuid = uuidv7();
      const practitionerUuid = uuidv7();
      const userUuid  = uuidv7();
      if(rowNumber === 1) return;
      const user = (async () => {
        return  {
          uuid: userUuid,
          faskesUuid: faskesuuid,
          practitionerUuid: practitionerUuid,
          role: row.values[2],  
          username: row.values[3],
          password: await bcrypt.hash(row.values[4], 10),
          email: row.values[5],
          status: true
        }
      });
      practitionerPromises.push({
        uuid: practitionerUuid,
        faskes_uuid: faskesuuid,
        pegawai_uuid: pegawaiUuid,
        is_doctor: row.values[6] === "Dokter" ? true : false,
        code_bpjs: row.values[7] !== undefined? row.values[7] : null,
        sip: row.values[8].toString(),
        str: row.values[9].toString(),
        code_antrian_dokter: row.values[10],
        status: true
      });

      pegawaiPromises.push({ 
        uuid: pegawaiUuid,
        faskes_uuid: faskesuuid,
        tipe: row.values[11],
        first_title: row.values[12],
        last_title: row.values[13],
        name: row.values[14],
        nik: row.values[15],
        tanggal_lahir: parseDateString(row.values[16]),
        gender: row.values[17],
        status: true
      });
      userPromises.push(user());
    });
    const users = await Promise.all(userPromises);
    const roleList = await RoleRepository.findAllRoleByName(faskesuuid, users.map(user => user.role));
    if(roleList.length !== users.length) {
      const roleSet = new Set(roleList.map(r => r.name));
      const roleNotExists = users.filter(user => !roleSet.has(user.role));
      throw new HttpException(HttpStatus.BAD_REQUEST, generateErrorMessage(`Role ${roleNotExists.map(r => r.role).join(", ")} tidak ditemukan`), HttpStatus.BAD_REQUEST);
    }
    const userRoleList = users.map(u => u.role);
    checkRole(userRoleList, roleList.map(r => r.name));
    users.forEach((user, index) => {
      delete user.role;
      user.permissions = roleList[index].permissions;
      user.roleUuid = roleList[index].uuid;
    });
    isThereDuplicate(pegawaiPromises.map(p => p.nik), "nik");
    isThereDuplicate(practitionerPromises.map(p => {
      if(p.code_bpjs){
        return p.code_bpjs.toString().toLowerCase();
      }
      else {
        return
      }
    }).filter(d => d !== undefined), "code HFIS");
    isThereDuplicate(users.map(u => u.username.toLowerCase()), "username");
    isThereDuplicate(users.map(u => u.email.toLowerCase()), "email");
    ZodValidator.validate(UserValidation.IMPORT_USER, users);
    ZodValidator.validate(UserValidation.IMPORT_PRACTITOR, practitionerPromises);
    ZodValidator.validate(UserValidation.IMPORT_PEGAWAI, pegawaiPromises);
    await UserRepository.importUser(users, practitionerPromises, pegawaiPromises);
    return generateSuccessMessage("Berhasil import user");
  }


  /**
   * 
   * @param {string} faskes_uuid 
   * @returns {Promise<Array<UserModel>>}
   */
  static async export(faskes_uuid){
    const userList = await UserRepository.export(faskes_uuid);
    return {
      message: "Berhasil menampilkan semua user",
      payload: userList
    }
  }

}
