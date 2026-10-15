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
import NameTarifKomponenValidation from "../validations/name_tarif_komponen-validation.js";
import NameTarifKomponenRepository from "../repositories/name_tarif_komponen-repository.js";
import { affectedRowMustBeOne, isCodeUnique, isThereDuplicate, parseExcel, uniqueCodeXFaskes } from "../helpers/helper.js"
import { uuidv7 } from "uuidv7";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { NameTarifKomponenModel } from "@opensimrs/model-sdk/datamaster";
import { GlobalValidation } from "../validations/global-validation.js";

export default class NameTarifKomponenService {
  static async createNameTarifKomponen(data) {
    ZodValidator.validate(NameTarifKomponenValidation.CREATE, data);
    await uniqueCodeXFaskes(data, NameTarifKomponenModel);
    await NameTarifKomponenRepository.addNameTarifKomponen(data);
    return successResponse(messageSuccessSave);
  }

  static async updateNameTarifKomponen(request) {
    ZodValidator.validate(NameTarifKomponenValidation.UPDATE, request);
    const tarifKomponen = await NameTarifKomponenRepository.findByUuid({faskes_uuid: request.faskes_uuid, uuid: request.uuid}, NameTarifKomponenModel);
    if(!tarifKomponen){
      throw new HttpException(
        generateErrorResponse("Gagal", "notfound", `komponen tarif dengan uuid ${request.uuid} tidak ditemukan`), HttpStatus.NOT_FOUND
      )
    }
    await sequelizeInstance.transaction(async tr => {
      affectedRowMustBeOne(await NameTarifKomponenRepository.update({...tarifKomponen, ...request}, tr));
    });
    return generateSuccessResponse(`Berhasil memperbarui komponen tarif ${tarifKomponen.name}`);
  }

  static async getAllNameTarifKomponen(name, page, pageSize, faskesUuid) {
    const result = await NameTarifKomponenRepository.getAllNameTarifKomponen(
      name,
      parseInt(page) || 1,
      parseInt(pageSize) || 10, faskesUuid
    );
    return successResponse(messageSuccessShow, result.nameTarifKomponenList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getNameTarifKomponenById(request) {
    ZodValidator.validate(GlobalValidation.UUID_FASKES_UUID, request)
    const nameKomponenTarif = await NameTarifKomponenRepository.findByUuid(request, NameTarifKomponenModel);
    if(!nameKomponenTarif){
      throw new HttpException(
        generateErrorResponse("Gagal", "notfound", `komponen tarif dengan uuid ${request.uuid} tidak ditemukan`), HttpStatus.NOT_FOUND
      )
    }
    return generateSuccessResponse(`Berhasil menampilkan komponen tarif`, nameKomponenTarif);
  }

  static async getAllNameTarifKomponenAktif(faskes_uuid) {
    const result = await NameTarifKomponenRepository.getAllNameTarifKomponenAktif(faskes_uuid);
    return successResponse(messageSuccessShow, result);
  }

  static async getAllTarifKomponenByUuids(uuids) {
    const result = await NameTarifKomponenRepository.getAllTarifKomponenByUuids(
      uuids
    );
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async exportNameTarifKomponen() {
    const result = await NameTarifKomponenRepository.exportNameTarifKomponen();
    return successResponse(messageSuccessExport, result);
  }
  static async importNameTarifKomponen(faskesUuid, filePath) {
    const data = await parseExcel(filePath);
    const tarifKomponenList = new Array();
    data.eachRow((row, index) => {
      if(index == 1) return;
      tarifKomponenList.push({
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        code: row.values[2],
        name: row.values[3],
        status: true,
      })
    });
    ZodValidator.validate(NameTarifKomponenValidation.IMPORT, tarifKomponenList);
    await NameTarifKomponenRepository.saveAll(tarifKomponenList);
    return generateSuccessResponse("Berhasil import komponen tarif");
  }

  static async deleteNameTarifKomponen(request) {
    ZodValidator.validate(GlobalValidation.UUID_FASKES_UUID, request)
    const nameKomponenTarif = await NameTarifKomponenRepository.findByUuid(request, NameTarifKomponenModel);
    if(!nameKomponenTarif){
      throw new HttpException(
        generateErrorResponse("Gagal", "notfound", `komponen tarif dengan uuid ${request.uuid} tidak ditemukan`), HttpStatus.NOT_FOUND
      )
    }
    await sequelizeInstance.transaction(async tr => {
      affectedRowMustBeOne(await NameTarifKomponenRepository.delete(nameKomponenTarif, NameTarifKomponenModel, tr), "menghapus tarif komponen");
    });
    return generateSuccessResponse(`Berhasil menghapus ${nameKomponenTarif.name}`);
  }
}
