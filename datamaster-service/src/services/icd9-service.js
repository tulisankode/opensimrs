import ICD9Repository from "../repositories/icd9-repository.js";
import ICD9Validation from "../validations/icd9-validation.js";
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
import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import Utils from "../helpers/utils.js";
import { ZodError } from "zod";
import Result from "../response/result.js";
import { uuidv7 } from "uuidv7";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import { isCodeOrnameAlredyExist, isThereDuplicate } from "../helpers/helper.js";
import { Icd9Model } from "@opensimrs/model-sdk/datamaster";
import { GlobalValidation } from "../validations/global-validation.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

export default class ICD9Service {

  static async createICD9(data) {
    ZodValidator.validate(ICD9Validation.CREATE, data);
    await ICD9Repository.addICD9(data);
    return successResponse(messageSuccessSave);
  }

  static async updateICD9(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const validationResult = ZodValidator.validate(ICD9Validation.UPDATE, data);

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingIcd9 = await ICD9Repository.findICD9ById(uuid);
    if (!existingIcd9) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    if (data.code) {
      if (data.code != existingIcd9.code) {
        const existingCodeIcd9 = await ICD9Repository.findICD9ByCode(data.code);
        if (existingCodeIcd9) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }
    await ICD9Repository.updateICD9(existingIcd9, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllICD9(name, page, pageSize) {
    const result = await ICD9Repository.getAllICD9(name, page, pageSize);
    return successResponse(messageSuccessShow, result.icd9List, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllICD9ByUuids(uuids) {
    const result = await ICD9Repository.getAllICD9ByUuids(uuids);
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getICD9ByName(name) {
    const result = await ICD9Repository.getICD9ByName(name);
    if (!result) {
      return;
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async exportICD9() {
    const result = await ICD9Repository.exportICD9();
    return successResponse(messageSuccessExport, result);
  }

  static async importICD9(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    data[0].data.shift();
    const icd9s = data[0].data.map(icd9 => {
      return {
        uuid: uuidv7(),
        code: icd9[1],
        name: icd9[2],
        status: true
      }
    });
    isThereDuplicate(icd9s.map(ic => {
      if("code" in ic){
        return ic.code.toLowerCase()
      } else {
        return null;
      }
    }).filter(d => d !== null), "code");
    ZodValidator.validate(ICD9Validation.IMPORT, icd9s);
    await ICD9Repository.saveAll(icd9s);
    return generateSuccessResponse("Berhasil import Icd9");
  }

  static async getAllICD9Aktif() {
    const result = await ICD9Repository.getAllICD9Aktif();
    return successResponse(messageSuccessShow, result);
  }

  static async getICD9ById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }

    const existingIcd9 = await ICD9Repository.findICD9ById(uuid);
    if (!existingIcd9) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }
    return successResponse(messageSuccessShow, existingIcd9);
  }

  static async searchICD9(query, page, pageSize) {
    const result = await ICD9Repository.searchICD9(query, page, pageSize);

    return successResponse(messageSuccessShow, result.icd9List, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async deleteICD9(uuid) {
    ZodValidator.validate(GlobalValidation.UUID, {uuid});
    const icd9 = await ICD9Repository.findByUuid(uuid);
    if(!icd9) {
      throw new HttpException(
        generateErrorResponse("Gagal", "notfound", `gagal menghapus icd9 dengan uuid ${uuid}`), HttpStatus.NOT_FOUND
      )
    }
    await sequelizeInstance.transaction(async tr => {
      await ICD9Repository.delete(icd9, tr)
    });
    return generateSuccessResponse(`Berhasil menghapus ${icd9.name}`);
  }
}
