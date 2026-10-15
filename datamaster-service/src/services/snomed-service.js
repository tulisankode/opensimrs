import ZodValidator from "../validations/validator.js";
import successResponse from "../response/result-response.js";
import xlsx from "node-xlsx";
import fs from "fs/promises";
import {
  messageErrorDataNotFound,
  messageErrorDelete,
  messageErrorShow,
  messageSuccessDelete,
  messageSuccessExport,
  messageSuccessSave,
  messageSuccessShow,
} from "../validations/message-validation-error.js";
import ConflictException from "../errors/conflict-exception.js";
import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import Utils from "../helpers/utils.js";
import { ZodError } from "zod";
import Result from "../response/result.js";
import SnomedValidation from "../validations/snomed-validation.js";
import SnomedRepository from "../repositories/snomed-repository.js";
import { uuidv7 } from "uuidv7";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js"
import { isCodeOrnameAlredyExist, isThereDuplicate } from "../helpers/helper.js";
import { SnomedModel } from "@opensimrs/model-sdk/datamaster";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

export default class SnomedService {
  static async createSnomed(data) {
    ZodValidator.validate(SnomedValidation.CREATE, data);
    await SnomedRepository.addSnomed(data);
    return successResponse(messageSuccessSave);
  }

  static async updateSnomed(request) {
    ZodValidator.validate(SnomedValidation.UPDATE, request);
    const snomed = await SnomedRepository.findByuuid(request.uuid);
    if(!snomed) {
      throw new HttpException(
        generateErrorResponse("Gagal", "notfound", `snomed tidak ditemukan dalam sistem`), HttpStatus.NOT_FOUND
      )
    }
    await sequelizeInstance.transaction(async tr => {
      await SnomedRepository.update({...snomed, ...request}, tr);
    });
    return generateSuccessResponse(`Berhasil memperbarui snomed`);
  }

  static async getAllSnomed(name, page, pageSize) {
    const result = await SnomedRepository.getAllSnomed(name, page, pageSize);
    return successResponse(messageSuccessShow, result.snomedList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllSnomedByUuids(uuids) {
    const result = await SnomedRepository.getAllSnomedByUuids(uuids);
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getSnomedByName(name) {
    const result = await SnomedRepository.getSnomedByName(name);
    if (!result) {
      return;
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async exportSnomed() {
    const result = await SnomedRepository.exportSnomed();
    return successResponse(messageSuccessExport, result);
  }

  static async importSnomed(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    data[0].data.shift();
    const snomedList = data[0].data.map(snomed => {
      return {
        uuid: uuidv7(),
        code: `${snomed[1]}`,
        name: snomed[2], 
        status: true
      }
    });
    isThereDuplicate(snomedList.map(s => {
      if("code" in s){
        return `${s.code}`.toLowerCase();
      }
    }).filter(d => d !== undefined), "code");
    
    isThereDuplicate(snomedList.map(s => {
      if("name" in s){
        return `${s.name}`.toLowerCase();
      }
    }).filter(d => d !== undefined), "name");
    ZodValidator.validate(SnomedValidation.IMPORT, snomedList);
    await SnomedRepository.saveAll(snomedList);
    return generateSuccessResponse("Berhasil import snomed", snomedList);
  }

  static async getAllSnomedAktif() {
    const result = await SnomedRepository.getAllSnomedAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async getSnomedById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }

    const existingSnomed = await SnomedRepository.findSnomedById(uuid);
    if (!existingSnomed) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }
    return successResponse(messageSuccessShow, existingSnomed);
  }

  static async searchSnomed(query, page, pageSize) {
    const result = await SnomedRepository.searchSnomed(query, page, pageSize);

    return successResponse(messageSuccessShow, result.SnomedList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async deleteSnomed(uuid) {
    if(!uuid){
      throw new HttpException(
        generateErrorResponse("Gagal", "badrequest", "uuid tidak boleh kosong"), HttpStatus.BAD_REQUEST
      )
    }
    const snomed = await SnomedRepository.findByuuid(uuid);
    if(!snomed){
      throw new HttpException(
        generateErrorResponse("Gagal", "notfound", "snomed tidak ada didalam sistem"), HttpStatus.NOT_FOUND
      )
    }
    await sequelizeInstance.transaction(async tr => {
      await SnomedRepository.delete(snomed, tr);
    })
    return successResponse(messageSuccessDelete);
  }
}
