import ZodValidator from "../validations/validator.js";
import ValidationException from "../errors/validation-exception.js";
import DatabaseException from "../errors/database-exception.js";
import successResponse from "../response/result-response.js";
import xlsx from "node-xlsx";
import fs from "fs/promises";
import {
  messageErrorConflict,
  messageErrorDataNotFound,
  messageErrorDelete,
  messageErrorEdit,
  messageErrorShow,
  messageSuccessDelete,
  messageSuccessEdit,
  messageSuccessImport,
  messageSuccessSave,
  messageSuccessShow,
} from "../validations/message-validation-error.js";
import ConflictException from "../errors/conflict-exception.js";
import Utils from "../helpers/utils.js";
import NotFoundException from "../errors/notfound-exception.js";
import ProvinceValidation from "../validations/province-validation.js";
import ProvinceRepository from "../repositories/province-repository.js";
import Result from "../response/result.js";
import { z } from "zod";
import { log } from "console";
import { generateSuccessResponse } from "../helpers/generate-message.js";
import { isCodeAlredyExistIn, isCodesAlredyExist, isCodeUnique, isThereDuplicate } from "../helpers/helper.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { ProvinceModel } from "@opensimrs/model-sdk/datamaster";

export default class ProvinceService {
  static async createProvince(data) {
    const validationResult = ZodValidator.validate(
      ProvinceValidation.CREATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingCodeProvince = await ProvinceRepository.findProvinceByCode(
      data.code
    );
    if (existingCodeProvince) {
      throw new ConflictException();
    }

    await ProvinceRepository.addProvince(data);
    return successResponse(messageSuccessSave);
  }

  static async updateProvince(id, data) {
    const validationResult = ZodValidator.validate(
      ProvinceValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingProvince = await ProvinceRepository.findProvinceById(id);
    if (!existingProvince) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    if (data.code) {
      if (data.code != existingProvince.code) {
        const existingCodeProvince =
          await ProvinceRepository.findProvinceByCode(data.code);
        if (existingCodeProvince) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await ProvinceRepository.updateProvince(existingProvince, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllProvince() {
    const result = await ProvinceRepository.getAllProvince();
    return successResponse(messageSuccessShow, result);
  }

  static async getAllProvincePaginate(name, page, pageSize) {
    const result = await ProvinceRepository.getAllProvincePaginate(
      name,
      page,
      pageSize
    );
    return successResponse(messageSuccessShow, result.provinceList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  // Import all Province
  static async importProvince(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    data[0].data.shift();
    const provinceList = data[0].data.map(prov => {
      return {
        code: prov[0] !== undefined ? prov[0].toString() : null,
        name: prov[1]
      }
    }).filter(d => d !== undefined);
    ZodValidator.validate(ProvinceValidation.IMPORT_PROVINCE, provinceList);
    isThereDuplicate(provinceList.map(p => p.code.toLowerCase()), "code");
    await isCodeAlredyExistIn(provinceList.map(p => p.code), null, ProvinceModel);
    await sequelizeInstance.transaction(async (t) => {
      await ProvinceRepository.saveAll(provinceList, t);
    });
    return generateSuccessResponse("Berhasil import data provinsi")
    
  }

  static async getProvinceById(id) {
    const existingProvince = await ProvinceRepository.findProvinceById(id);
    if (!existingProvince) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }

    return successResponse(messageSuccessShow, existingProvince);
  }

  static async getProvinceByCode(code) {
    const result = await ProvinceRepository.findProvinceByCode(code);
    if (!result) {
      return;
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getProvinceByName(name) {
    const result = await ProvinceRepository.findProvinceByName(name);
    if (!result) {
      return;
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async deleteProvince(id) {
    const existingProvince = await ProvinceRepository.findProvinceById(id);
    if (!existingProvince) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await ProvinceRepository.deleteProvince(existingProvince);
    return successResponse(messageSuccessDelete);
  }

  /**
   * 
   * @param {Array<string>} nameList 
   * @returns {Promise<{id: number, name: string, code: string}>}
   */
  static async findAllByNameIn(nameList){
    return await ProvinceRepository.findAllByNameIn(nameList);
  }
}
