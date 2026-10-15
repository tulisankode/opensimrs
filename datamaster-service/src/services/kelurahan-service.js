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
import KelurahanValidation from "../validations/kelurahan-validation.js";
import KelurahanRepository from "../repositories/kelurahan-repository.js";
import { z } from "zod";
import Result from "../response/result.js";
import Utils from "../helpers/utils.js";
import { log } from "console";
import { isCodeAlredyExistIn, isThereDuplicate } from "../helpers/helper.js";
import { KelurahanModel } from "@opensimrs/model-sdk/datamaster";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

export default class KelurahanService {
  static async createKelurahan(data) {
    const validationResult = ZodValidator.validate(
      KelurahanValidation.CREATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingCodeKelurahan = await KelurahanRepository.findKelurahanByCode(
      data.code
    );
    if (existingCodeKelurahan) {
      throw new ConflictException();
    }

    await KelurahanRepository.addKelurahan(data);
    return successResponse(messageSuccessSave);
  }

  static async updateKelurahan(id, data) {
    const validationResult = ZodValidator.validate(
      KelurahanValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingKelurahan = await KelurahanRepository.findKelurahanById(id);
    if (!existingKelurahan) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    if (data.code) {
      if (data.code != existingKelurahan.code) {
        const existingCodeKelurahan =
          await KelurahanRepository.findKelurahanByCode(data.code);
        if (existingCodeKelurahan) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await KelurahanRepository.updateKelurahan(existingKelurahan, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllKelurahan(name, page, pageSize) {
    const result = await KelurahanRepository.getAllKelurahan(
      name,
      page,
      pageSize
    );
    return successResponse(messageSuccessShow, result.kelurahanList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllKelurahanByKecamatnCode(kecamatanCode) {
    const result = await KelurahanRepository.getKelurahanByKecamatanCode(
      kecamatanCode
    );
    return successResponse(messageSuccessShow, result);
  }

  // Import all Kelurahan
  static async importKelurahan(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    data[0].data.shift()
    const kelurahanList = data[0].data.map(kelurahan => {
      return {
        code: kelurahan[0],
        kecamatan_code: kelurahan[1],
        name: kelurahan[2]
      }
    })
    ZodValidator.validate(KelurahanValidation.CREATE, kelurahanList);
    isThereDuplicate(kelurahanList.map(kl => kl.code.toString().toLowerCase()), "code");
    await isCodeAlredyExistIn(kelurahanList.map(k => k.code.toString().toLowerCase()), null, KelurahanModel);
    await sequelizeInstance.transaction(async tr => {
      await KelurahanRepository.saveAll(kelurahanList, tr);
    })
    return {
      message: "Berhasil import kelurahan",
    }
  }

  static async getKelurahanById(id) {
    const existingKelurahan = await KelurahanRepository.findKelurahanById(id);
    if (!existingKelurahan) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }

    return successResponse(messageSuccessShow, existingKelurahan);
  }

  static async getKelurahanByName(name, kecamatanCode) {
    const result = await KelurahanRepository.findKelurahanByName(
      name,
      kecamatanCode
    );
    if (!result) {
      return;
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getKelurahanByCode(code) {
    const result = await KelurahanRepository.findKelurahanByCode(code);
    if (!result) {
      return;
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async deleteKelurahan(id) {
    const existingKelurahan = await KelurahanRepository.findKelurahanById(id);
    if (!existingKelurahan) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await KelurahanRepository.deleteKelurahan(existingKelurahan);
    return successResponse(messageSuccessDelete);
  }
}
