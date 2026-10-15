import UserValidation from "../validations/user-validation.js";
import { parseDateString, parseExcel } from "../helpers/helper.js";
import bcrypt from "bcrypt";
import UserRepository from "../repositories/user-repository.js";
import { uuidv7 } from "uuidv7";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { isThereDuplicate } from "../helpers/helper.js";
import { UserModel } from "@opensimrs/model-sdk/datamaster";
import ZodValidator from "../validations/validator.js";
import RoleRepository from "../repositories/role-repository.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import PractitionerRepository from "../repositories/practitioner-repository.js";
import PegawaiRepository from "../repositories/pegawai-repository.js";

export default class UserService {

  static async findAllUser(request){
    const {data, properties} = await UserRepository.findAllUser(request);

    return generateSuccessResponse(`Berhasil menampilkan semua user`, data, properties);
  }

  static async create(request) {
    ZodValidator.validate(UserValidation.CREATE, request);
    request.password = await bcrypt.hash(request.password, 10);
    const user = await UserRepository.findByEmail({ email: request.email, faskes_uuid: request.faskes_uuid });
    if (user) throw new HttpException(generateErrorResponse("Gagal", "conflic", `Email sudah terdaftar`), HttpStatus.CONFLIC);
    
    const userReq = {
      faskesUuid: request.faskes_uuid,
      roleUuid: request.role_uuid,
      practitioner_uuid: request.practitioner_uuid,
      username: request.username,
      phone: request.phone,
      password: request.password,
      email: request.email,
      permissions: JSON.stringify(request.permissions),
      status: request.status,
    };


    await sequelizeInstance.transaction(async (tr) => {
      await UserRepository.create(userReq, tr);
    });
    return generateSuccessResponse("Berhasil menambahkan user");
  }

  static async update(request) {
    ZodValidator.validate(UserValidation.UPDATE, request);
    const user = await UserRepository.findByUuid(request.user_uuid, request.faskes_uuid);
    if (!user) {
      throw new HttpException(generateErrorResponse("Gagal", "not found", `User tidak ditemukan`), HttpStatus.NOT_FOUND);
    }
    await sequelizeInstance.transaction(async (tr) => {
      user.username = request.username;
      user.phone = request.phone;
      user.email = request.email;
      user.status = request.status;
      user.roleUuid = request.role_uuid;
      user.practitionerUuid = request.practitioner_uuid;
      if(request.password){
        user.password = await bcrypt.hash(request.password, 10);
      }
      const affected = await UserRepository.update(user, tr);
      if (affected !== 1) {
        throw new HttpException(generateErrorResponse("Gagal", "internal server error", `gagal update user`), HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
    return generateSuccessResponse("Berhasil mengubah user");
  }

  static async findAll(page, pageSize, order, role, name, author) {
    const { faskesUuid, role: r } = author;
    if (r === "super admin") {
      const data = await UserRepository.findAllAsSuperadmin({page, pageSize, order, role, name, faskesUuid});
      return {
        message: "Berhasil menampilkan semua users",
        payload: data.payload,
        properties: data.properties,
      };
    }
    const { properties, data } = await UserRepository.findAll(page, pageSize, order, role, name, faskesUuid);
    return generateSuccessResponse("Berhasil menampilkan semua user", data, properties);
  }

  static async findAllDeleted(faskes_uuid) {
    return {
      message: "Berhasil menampilkan semua user yang telah dihapus",
      payload: await UserRepository.findAllDeleted(faskes_uuid),
    };
  }

  static async updatePassword(updateRequest) {
    ZodValidator.validate(UserValidation.UPDATE_PASSWORD, updateRequest);
    const user = await UserRepository.findByUuid(updateRequest.uuid, updateRequest.faskesUuid);
    if(!user){
      throw new HttpException(generateErrorResponse("Gagal", "not found", `User tidak ditemukan`), HttpStatus.NOT_FOUND);
    }
    await sequelizeInstance.transaction(async (tr) => {
      updateRequest.new_password = await bcrypt.hash(updateRequest.new_password, 10);
      const affected = await UserRepository.updatePassword(updateRequest, tr);
      if (affected !== 1) {
        throw new HttpException(generateErrorResponse("Gagal", "internal server error", `gagal update password user`), HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
    return generateSuccessResponse("Berhasil mengubah password user");
  }

  static async delete(deleteRequest) {
    ZodValidator.validate(UserValidation.DELETE, deleteRequest);
    const user = await UserRepository.findByUuid(deleteRequest.uuid, deleteRequest.faskesUuid);
    if(!user){
      throw new HttpException(generateErrorResponse("Gagal", "not found", `User tidak ditemukan`), HttpStatus.NOT_FOUND);
    }
    await sequelizeInstance.transaction(async (tr) => { 
      const affected = await UserRepository.delete(deleteRequest, tr);
      if (affected !== 1) {
        throw new HttpException(generateErrorResponse("Gagal", "internal server error", `gagal hapus user`), HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
    return generateSuccessResponse("Berhasil menghapus user");
  }

  static async findByUuidIncludeRole(request) {
    ZodValidator.validate(UserValidation.FIND_BY_UUID, request);
    const result = await UserRepository.findByUuidIncludeRole(request);
    return generateSuccessResponse("Berhasil menampilkan user", result ?? []);
  }

  static async import(filePath, faskesuuid) {
    const data = await parseExcel(filePath);
    let useList = [];
    const practitionerList = [];
    const pegawaiList = [];
    data.eachRow((row, rowNumber) => {
      const pegawaiUuid = uuidv7();
      const practitionerUuid = uuidv7();
      const userUuid = uuidv7();
      if (rowNumber === 1) return;
      useList.push({
        uuid: userUuid,
        faskesUuid: faskesuuid,
        practitioner_uuid: practitionerUuid,
        role: row.values[2],
        username: row.values[3],
        password: row.values[4],
        email: row.values[5].text ? row.values[5].text : row.values[5],
        status: true,
      })
      practitionerList.push({
        uuid: practitionerUuid,
        faskes_uuid: faskesuuid,
        pegawai_uuid: pegawaiUuid,
        is_doctor: row.values[6] === "Dokter" ? true : false,
        code_bpjs: row.values[7] !== undefined ? row.values[7] : null,
        sip: row.values[8].toString(),
        str: row.values[9].toString(),
        code_antrian_dokter: row.values[10],
        status: true,
      });
      pegawaiList.push({
        uuid: pegawaiUuid,
        faskes_uuid: faskesuuid,
        tipe: row.values[11] ? parseInt(row.values[11]) : null,
        first_title: row.values[12],
        last_title: row.values[13],
        name: row.values[14],
        nik: row.values[15].toString(),
        tanggal_lahir: parseDateString(row.values[16]),
        gender: row.values[17],
        status: true,
      });
    });

    
    const passPromises = [];
    const roleNameList = await RoleRepository.finndAllRoleIn(faskesuuid, useList.map(u => u.role).filter(d => d !== null || d !== undefined))
    useList.forEach((u, index) => {
      const isExist = roleNameList.find(r => r.name == u.role);
      if(!isExist){
        throw new HttpException(
          generateErrorResponse("Gagal", "notfound", `role ${u.role} belum ada`), HttpStatus.NOT_FOUND
        )
      }
      delete useList[index].role;
      useList[index].roleUuid = isExist.uuid;  
      useList[index].permissions = isExist.permissions;
      passPromises.push(
        new Promise(async(resolve, reject) => {
          resolve({
            hash_pass: await bcrypt.hash(u.password, 10),
            username: u.username
          })
        })
      );
      
    });
    ZodValidator.validate(UserValidation.IMPORT_USER, useList);
    ZodValidator.validate(UserValidation.IMPORT_PRACTITOR, practitionerList);
    ZodValidator.validate(UserValidation.IMPORT_PEGAWAI, pegawaiList);
    const passHased = await Promise.all(passPromises);
    useList.forEach((u, index) => {
      const passHash = passHased.find(h => h.username === u.username);
      if(!passHased) {
        throw new HttpException(
          generateErrorResponse("Gagal", "internal server error", "gagl import karena password gagal di hash"), HttpStatus.INTERNAL_SERVER_ERROR
        )
      }
      useList[index].password = passHash.hash_pass;
    })

    isThereDuplicate(useList.map(u => {
      if(u.username) return u.username;
    }).filter(d => d !== undefined), "username");


    isThereDuplicate(useList.map(u => {
      if(u.email) return u.email;
    }).filter(d => d !== undefined), "email");
    
    
    isThereDuplicate(practitionerList.map(p => {
      if(p.code_bpjs) return p.code_bpjs;
    }).filter(d => d !== undefined), "kode HFIS/code_bpjs");
    
    
    isThereDuplicate(pegawaiList.map(p => {
      if(p.nik) return p.nik;
    }).filter(d => d !== undefined), "nik");

   
    

    await sequelizeInstance.transaction(async (tr) => {
      await UserRepository.saveAll(useList, tr);
      await PractitionerRepository.saveAll(practitionerList, tr);
      await PegawaiRepository.saveAll(pegawaiList, tr);
    });
    return generateSuccessResponse("Berhasil import user");
  }


  /**
   *
   * @param {string} faskes_uuid
   * @returns {Promise<Array<UserModel>>}
   */
  static async export(faskes_uuid) {
    const userList = await UserRepository.export(faskes_uuid);
    return generateSuccessResponse("Berhasil export user", userList);
  }
}
