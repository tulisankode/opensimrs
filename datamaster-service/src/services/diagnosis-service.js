import ValidationException from "../errors/validation-exception.js";
import DiagnosisRepository from "../repositories/diagnosis-repository.js";
import DiagnosisValidation from "../validations/diagnosis-validation.js";
import ZodValidator from "../validations/validator.js";
import successResponse from "../response/result-response.js";
import xlsx from "node-xlsx";
import fs from "fs/promises";
import ConflictException from "../errors/conflict-exception.js";
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
import Utils from "../helpers/utils.js";
import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import { ZodError } from "zod";
import Result from "../response/result.js";
import { uuidv7 } from "uuidv7";
import { extracAllSheet, isCodeOrnameAlredyExist, parseExcel } from '../helpers/helper.js';
import { DiagnosisModel } from "@opensimrs/model-sdk/datamaster";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { GlobalValidation } from "../validations/global-validation.js";

export default class DiagnosisService {

  static async createDiagnosis(data) {
    ZodValidator.validate(DiagnosisValidation.CREATE, data);
    await DiagnosisRepository.addDiagnosis(data);
    return successResponse(messageSuccessSave);
  }

  static async updateDiagnosis(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const validationResult = ZodValidator.validate(
      DiagnosisValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingDiagnosis = await DiagnosisRepository.findDiagnosisById(uuid);
    if (!existingDiagnosis) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    if (data.code) {
      if (data.code != existingDiagnosis.code) {
        const existingCodeDiagnosis =
          await DiagnosisRepository.findDiagnosisByCode(data.code);
        if (existingCodeDiagnosis) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await DiagnosisRepository.updateDiagnosis(existingDiagnosis, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllDiagnosis(request) {
    const result = await DiagnosisRepository.getAllDiagnosis(request);
    return successResponse(messageSuccessShow, result.diagnosisList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit, 
      total: result.totalItems,
    });
  }

  static async getAllDiagnosisAktif() {
    const result = await DiagnosisRepository.getAllDiagnosisAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async exportDiagnosis() {
    const result = await DiagnosisRepository.exportDiagnosis();
    return successResponse(messageSuccessExport, result);
  }

  static async importDiagnosis(filePath) {
    const diagnosisList = [];
    const seets = await extracAllSheet(filePath);
    seets.forEach(s => {
      s.eachRow((d, index) => {
        if(index == 1) return;
        const [ , category, code, english_name, indonesian_name] = d.values;
        diagnosisList.push({
          code: `${code !== undefined? `${category}.${code}` : category}`,
          name: `${english_name.trim().replace(/\s+/g, ' ')}~${indonesian_name? indonesian_name.trim().replace(/\s+/g, ' ') : ""}`,
          status: true,
        })
      })
    });

    ZodValidator.validate(DiagnosisValidation.IMPORT, diagnosisList);
    await sequelizeInstance.transaction(async tr => {
      await DiagnosisRepository.saveAll(diagnosisList, tr);
    });
    return generateSuccessResponse("Data berhasil di import");
  }

  static async getDiagnosisById(uuid) {
    ZodValidator.validate(GlobalValidation.UUID, {uuid})
    const diagnosis = await DiagnosisRepository.findDiagnosisById(uuid);

    if (!diagnosis) {
      throw new NotFoundException(messageErrorEdit, messageErrorUuidNotValid);
    }
    return successResponse(messageSuccessShow, diagnosis);
  }

  static async searchDiagnosis(query, page, pageSize) {
    const result = await DiagnosisRepository.searchDiagnosis(
      query,
      page,
      pageSize
    );
    return successResponse(messageSuccessShow, result.diagnosisList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async deleteDiagnosis(uuid) {
    ZodValidator.validate(GlobalValidation.UUID,  {uuid})
    const diagnosis = await DiagnosisRepository.findByuuid(uuid);
    if(!diagnosis){
      throw new HttpException(
        generateErrorResponse("Gagal", "notfound", "diagnosis/icd10 tidak ada dalam sistem"), HttpStatus.NOT_FOUND
      )
    }
    await sequelizeInstance.transaction(async tr => {
      const affected = await DiagnosisRepository.delete(diagnosis, tr);
      if(affected !== 1) {
        throw new HttpException(
          generateErrorResponse("Gagal", "internal server error", "gagal hapus diagnosis/icd10"), HttpStatus.INTERNAL_SERVER_ERROR
        )
      }
    })
    return successResponse(messageSuccessDelete);
  }
}
