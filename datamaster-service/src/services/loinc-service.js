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
import LoincValidation from "../validations/loinc-validation.js";
import LoincRepository from "../repositories/loinc-repository.js";
import { isCodeOrnameAlredyExist, isThereDuplicate, parseExcel } from "../helpers/helper.js";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { generateSuccessResponse } from "../helpers/generate-message.js";
import { LoincModel } from "@opensimrs/model-sdk/datamaster";

export default class LoincService {
  static async createLoinc(data) {
    ZodValidator.validate(LoincValidation.CREATE, data);
    await LoincRepository.addLoinc(data);
    return successResponse(messageSuccessSave);
  }

  static async updateLoinc(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const validationResult = ZodValidator.validate(
      LoincValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingLoinc = await LoincRepository.findLoincById(uuid);
    if (!existingLoinc) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    if (data.code) {
      if (data.code != existingLoinc.code) {
        const existingCodeLoinc = await LoincRepository.findLoincByCode(
          data.code
        );
        if (existingCodeLoinc) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }
    await LoincRepository.updateLoinc(existingLoinc, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllLoinc(name, page, pageSize) {
    const result = await LoincRepository.getAllLoinc(
      name,
      parseInt(page) || 1,
      parseInt(pageSize) || 10
    );
    return successResponse(messageSuccessShow, result.loincList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async exportLoinc() {
    const result = await LoincRepository.exportLoinc();
    return successResponse(messageSuccessExport, result);
  }

  static async importLoinc(filePath) {
    const data = await parseExcel(filePath);
    const loincList = [];
    data.eachRow((l, index) => {
      if(index == 1) return;
      loincList.push({
        uuid: uuidv7(),
        code: l.values[2] !== undefined ? l.values[2].toString() : null,
        name: l.values[3],
        status: true
      })
    });
    isThereDuplicate(loincList.map(l => l.code.toLowerCase()), "code");
    ZodValidator.validate(LoincValidation.IMPORT, loincList);
    await sequelizeInstance.transaction(async tr => {
      await LoincRepository.saveAll(loincList, tr);
    });
    return generateSuccessResponse("Berhasil import loinc");
  }

  static async getAllLoincAktif() {
    const result = await LoincRepository.getAllLoincAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async getLoincById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }

    const existingLoinc = await LoincRepository.findLoincById(uuid);
    if (!existingLoinc) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }
    return successResponse(messageSuccessShow, existingLoinc);
  }

  static async searchLoinc(query, page, pageSize) {
    const result = await LoincRepository.searchLoinc(query, page, pageSize);

    return successResponse(messageSuccessShow, result.LoincList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async deleteLoinc(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorDelete);
    }

    const existingLoinc = await LoincRepository.findLoincById(uuid);
    if (!existingLoinc) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await LoincRepository.deleteLoinc(existingLoinc);
    return successResponse(messageSuccessDelete);
  }
}
