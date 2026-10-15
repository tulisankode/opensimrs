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
  messageErrorShow,
  messageSuccessDelete,
  messageSuccessEdit,
  messageSuccessImport,
  messageSuccessSave,
  messageSuccessShow,
} from "../validations/message-validation-error.js";
import ConflictException from "../errors/conflict-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import KabupatenValidation from "../validations/kabupaten-validation.js";
import KabupatenRepository from "../repositories/kabupaten-repository.js";
import Result from "../response/result.js";
import { z } from "zod";
import Utils from "../helpers/utils.js";
import { generateSuccessResponse } from "../helpers/generate-message.js";
import { isCodeAlredyExistIn, isCodesAlredyExist, isThereDuplicate } from "../helpers/helper.js";
import { KabupatenModel } from "@opensimrs/model-sdk/datamaster";

export default class KabupatenService {

  /**
   * 
   * @param {Array<string>} nameList 
   * @returns { Promise<Array<{}>>}
   */
  static async findAllByNameIn(nameList){
    return await KabupatenRepository.findAllByNameIn(nameList);
  }

  static async createKabupaten(data) {
    const validationResult = ZodValidator.validate(
      KabupatenValidation.CREATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingCodeKabupaten = await KabupatenRepository.findKabupatenByCode(
      data.code
    );
    if (existingCodeKabupaten) {
      throw new ConflictException();
    }

    await KabupatenRepository.addKabupaten(data);
    return successResponse(messageSuccessSave);
  }

  static async updateKabupaten(id, data) {
    const validationResult = ZodValidator.validate(
      KabupatenValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingKabupaten = await KabupatenRepository.findKabupatenById(id);
    if (!existingKabupaten) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    if (data.code) {
      if (data.code != existingKabupaten.code) {
        const existingCodeKabupaten =
          await KabupatenRepository.findKabupatenByCode(data.code);
        if (existingCodeKabupaten) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await KabupatenRepository.updateKabupaten(existingKabupaten, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllKabupaten(name, page, pageSize) {
    const result = await KabupatenRepository.getAllKabupaten(
      name,
      page,
      pageSize
    );
    return successResponse(messageSuccessShow, result.kabupatenList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllKabupatenByProvinceCode(provinsiCode) {
    const result = await KabupatenRepository.getKabupatenByProvinceCode(
      provinsiCode
    );
    return successResponse(messageSuccessShow, result);
  }

  // Import all Kabupaten
  static async importKabupaten(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    data[0].data.shift();
    const kabupatenList = data[0].data.map(kab => {
      return {
        code: kab[0] !== undefined ? kab[0].toString() : null,
        provinsi_code: kab[1] !== undefined ? kab[1].toString() : null,
        name: kab[2]
      }
    });
    ZodValidator.validate(KabupatenValidation.IMPORT, kabupatenList);
    isThereDuplicate(kabupatenList.map(k => k.code.toLowerCase(), "code"));
    await isCodeAlredyExistIn(kabupatenList.map(k => k.code), null, KabupatenModel);
    await KabupatenRepository.saveAll(kabupatenList);
    return generateSuccessResponse("Berhasil import data kabupaten");
  }

  static async getKabupatenById(id) {
    const existingKabupaten = await KabupatenRepository.findKabupatenById(id);
    if (!existingKabupaten) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }

    return successResponse(messageSuccessShow, existingKabupaten);
  }

  static async getKabupatenByCode(code) {
    const result = await KabupatenRepository.findKabupatenByCode(code);
    if (!result) {
      return;
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getKabupatenByName(name, provCode) {
    const result = await KabupatenRepository.findKabupatenByName(
      name,
      provCode
    );
    if (!result) {
      return;
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async deleteKabupaten(id) {
    const existingKabupaten = await KabupatenRepository.findKabupatenById(id);
    if (!existingKabupaten) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await KabupatenRepository.deleteKabupaten(existingKabupaten);
    return successResponse(messageSuccessDelete);
  }
}
