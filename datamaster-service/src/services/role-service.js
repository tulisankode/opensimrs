import ZodValidator from "../validations/validator.js";
import ValidationException from "../errors/validation-exception.js";
import successResponse from "../response/result-response.js";
import xlsx from "node-xlsx";
import fs from "fs/promises";
import {
  messageErrorConflict,
  messageErrorDataNotFound,
  messageErrorDelete,
  messageErrorEdit,
  messageErrorSave,
  messageErrorShow,
  messageErrorUuidNotValid,
  messageSuccessDelete,
  messageSuccessEdit,
  messageSuccessExport,
  messageSuccessImport,
  messageSuccessSave,
  messageSuccessShow,
} from "../validations/message-validation-error.js";
import ConflictException from "../errors/conflict-exception.js";
import Utils from "../helpers/utils.js";
import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import RoleValidation from "../validations/role-validation.js";
import RoleRepository from "../repositories/role-repository.js";
import Result from "../response/result.js";
import { mapPermission } from "../helpers/permission-list.js";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js"
import { HttpException, HttpStatus } from "../errors/http-exception.js"
import { isCodeOrnameAlredyExist, isThereDuplicate } from "../helpers/helper.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { RoleModel } from "@opensimrs/model-sdk/datamaster";

export default class RoleService {

  static async createRole(data) {
    ZodValidator.validate(RoleValidation.CREATE, data);
    await sequelizeInstance.transaction(async tr => {
      data.permissions = JSON.stringify(data.permissions);
      await RoleRepository.save(data, tr);
    })
    return generateSuccessResponse(`Berhasil menambahkan role ${data.name}`);
  }




  static async updateRole(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }
    if (data.permissions) {
      data.permissions = JSON.stringify(data.permissions);
    }
    const validationResult = ZodValidator.validate(RoleValidation.UPDATE, data);

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingRole = await RoleRepository.findRoleById(uuid);
    if (!existingRole) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    await RoleRepository.updateRole({...existingRole, ...data});
    return successResponse(messageSuccessEdit);
  }

  static async getAllRole(name, page, pageSize, order_by, faskes_uuid) {
    const { data, properties } = await RoleRepository.getAllRole(name, parseInt(page) || 1, parseInt(pageSize) || 10, order_by, faskes_uuid);
    return {
      message: "Berhasil menampilkan semua role",
      payload: data ?? [],
      properties
    }
  }

  static async getAllRoleAktif(faskes_uuid) {
    const roles = await RoleRepository.getAllRoleAktif(faskes_uuid);
    return generateSuccessResponse("Berhasil menampilkan semua roles", roles);
  }

  static async exportRole(faskes_uuid) {
    const result = await RoleRepository.exportRole(faskes_uuid);
    return generateSuccessResponse(messageSuccessShow, result);
  }

  static async importRole(faskesUuid, filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    data[0].data.shift();
    const roleNameList = new Array();
    let roleList = data[0].data.map((role) => {
      if(role.length == 0 || role == undefined || role == null) return;
        roleNameList.push(role[2]);
        return {
          faskes_uuid: faskesUuid,
          code: role[1],
          name: role[2],
          permissions: role[3] !== undefined ? JSON.stringify(mapPermission(role[3].split(","))) : [],
          status: true,
        };
    });
    roleList = roleList.filter((role) => role != undefined);
    isThereDuplicate(roleList.map(r => r.code.toLowerCase()), "code");
    const roleAlredyExist = await RoleRepository.finndAllRoleIn(faskesUuid, roleNameList);
    if(roleAlredyExist.length !== 0){
      throw new HttpException(
        generateErrorResponse("Gagal import", "conflic", roleAlredyExist.map(r => {
          return `role ${r.name} sudah ada`
        })), HttpStatus.CONFLIC
      )
    }
    await RoleRepository.saveAll(roleList);
    return generateSuccessResponse("Berhasil import role");
  }

  static async getRoleById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }

    const existingRole = await RoleRepository.findRoleById(uuid);
    if (!existingRole) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }

    if (existingRole.permissions) {
      existingRole.permissions = JSON.parse(existingRole.permissions); // Parse JSON jika ada
    }

    return successResponse(messageSuccessShow, existingRole);
  }

  static async deleteRole(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(
        messageErrorDelete,
        messageErrorUuidNotValid
      );
    }

    const existingRole = await RoleRepository.findRoleById(uuid);
    if (!existingRole) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await RoleRepository.deleteRole(existingRole);
    return successResponse(messageSuccessDelete);
  }
}
