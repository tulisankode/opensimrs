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
import KecamatanValidation from "../validations/kecamatan-validation.js";
import KecamatanRepository from "../repositories/kecamatan-repository.js";
import { z } from "zod";
import Result from "../response/result.js";
import Utils from "../helpers/utils.js";
import { generateSuccessResponse } from "../helpers/generate-message.js";
import { log } from "console";
import { isCodeAlredyExistIn, isCodesAlredyExist, isThereDuplicate } from "../helpers/helper.js";
import { KecamatanModel } from "@opensimrs/model-sdk/datamaster";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

export default class KecamatanService {

  /**
   * 
   * @param {Array<string>} nameList 
   * @returns { Promise<Array<{}>> }
   */
  static async findAllByNameIn(nameList){
    return await KecamatanRepository.findAllByNameIn(nameList);
  }

  static async createKecamatan(data) {
    const validationResult = ZodValidator.validate(
      KecamatanValidation.CREATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingCodeKecamatan = await KecamatanRepository.findKecamatanByCode(
      data.code
    );
    if (existingCodeKecamatan) {
      throw new ConflictException();
    }

    await KecamatanRepository.addKecamatan(data);
    return successResponse(messageSuccessSave);
  }

  static async updateKecamatan(id, data) {
    const validationResult = ZodValidator.validate(
      KecamatanValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingKecamatan = await KecamatanRepository.findKecamatanById(id);
    if (!existingKecamatan) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    if (data.code) {
      if (data.code != existingKecamatan.code) {
        const existingCodeKecamatan =
          await KecamatanRepository.findKecamatanByCode(data.code);
        if (existingCodeKecamatan) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await KecamatanRepository.updateKecamatan(existingKecamatan, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllKecamatan(name, page, pageSize) {
    const result = await KecamatanRepository.getAllKecamatan(
      name,
      page,
      pageSize
    );
    return successResponse(messageSuccessShow, result.kecamatanList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllKecamatanByKabupatenCode(kabupatenCode) {
    const result = await KecamatanRepository.getKecamatanByKabupatenCode(
      kabupatenCode
    );
    return successResponse(messageSuccessShow, result);
  }

  static async importKecamatan(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    data[0].data.shift();
    const kecamatanList = data[0].data.map(k => {
      return {
        code: k[0].toString(),
        kabupaten_code: k[1].toString(),
        name: k[2]
      }
    });
    ZodValidator.validate(KecamatanValidation.IMPORT, kecamatanList);
    isThereDuplicate(kecamatanList.map(k => k.code.toLowerCase()), "code");
    await isCodeAlredyExistIn(kecamatanList.map(k => k.code), null, KecamatanModel);
    await sequelizeInstance.transaction(async tr => {
      await KecamatanRepository.saveAll(kecamatanList, tr);
    })
    return generateSuccessResponse("Berhasil import data kecamatan");
  }

  static async getKecamatanById(id) {
    const existingKecamatan = await KecamatanRepository.findKecamatanById(id);
    if (!existingKecamatan) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }

    return successResponse(messageSuccessShow, existingKecamatan);
  }

  static async getKecamatanByCode(code) {
    const result = await KecamatanRepository.findKecamatanByCode(code);
    if (!result) {
      return;
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getKecamatanByName(name, kabupatenCode) {
    const result = await KecamatanRepository.findKecamatanByName(
      name,
      kabupatenCode
    );
    if (!result) {
      return;
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async deleteKecamatan(id) {
    const existingKecamatan = await KecamatanRepository.findKecamatanById(id);
    if (!existingKecamatan) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await KecamatanRepository.deleteKecamatan(existingKecamatan);
    return successResponse(messageSuccessDelete);
  }
}
