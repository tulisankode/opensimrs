import TindakanRepository from "../repositories/tindakan-repository.js";
import TindakanValidation from "../validations/tindakan-validation.js";
import ZodValidator from "../validations/validator.js";
import ValidationException from "../errors/validation-exception.js";
import successResponse from "../response/result-response.js";
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
import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import Utils from "../helpers/utils.js";
import SnomedService from "./snomed-service.js";
import ICD9Service from "./icd9-service.js";
import Result from "../response/result.js";
import { isCodeOrnameAlredyExist, isCodesAlredyExist, isThereDuplicate, parseExcel } from "../helpers/helper.js";
import { uuidv7 } from "uuidv7";
import SnomedRepository from "../repositories/snomed-repository.js";
import ICD9Repository from "../repositories/icd9-repository.js";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import { TindakanModel } from "@opensimrs/model-sdk/datamaster";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

export default class TindakanService {

  static async createTindakan(data) {
    ZodValidator.validate(TindakanValidation.CREATE, data);
    // await isCodeOrnameAlredyExist(data, TindakanModel);
    if (data.snomed_uuid) {
      const snomed = await SnomedRepository.findByUuid(data.snomed_uuid);
      if (!snomed) {
        throw new HttpException(generateErrorResponse("Gagal", "not found", `Snomed dengan uuid ${data.snomed_uuid} tidak ditemukan`), HttpStatus.NOT_FOUND);
      }
    }

    if (data.icd9_uuid) {
      const icd9 = await ICD9Repository.findByUuid(data.icd9_uuid);
      if (!icd9) {
        throw new HttpException(generateErrorResponse("Gagal", "not found", `ICD9 dengan uuid ${data.icd9_uuid} tidak ditemukan`), HttpStatus.NOT_FOUND);
      }
    }
    await sequelizeInstance.transaction(async (t) => {
      await TindakanRepository.save(data, t);
    });
    return successResponse(messageSuccessSave);
  }

  static async updateTindakan(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const validationResult = ZodValidator.validate(TindakanValidation.UPDATE, data);

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingTindakan = await TindakanRepository.findTindakanById({faskes_uuid: data.faskes_uuid, uuid: uuid});
    if (!existingTindakan) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    if (data.code) {
      if (data.code != existingTindakan.code) {
        const existingCodeTindakan = await TindakanRepository.findTindakanByCode(data.code, data.faskes_uuid);
        if (existingCodeTindakan) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await TindakanRepository.updateTindakan({...existingTindakan, ...validationResult});
    return successResponse(messageSuccessEdit);
  }

  static async getAllTindakanByUuids(uuids) {
    const result = await TindakanRepository.getAllTindakanByUuids(uuids);
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async exportTindakan(faskes_uuid) {
    const result = await TindakanRepository.exportTindakan(faskes_uuid);
    return successResponse(messageSuccessExport, result);
  }

  // Import all Tindakan
  static async importTindakan(faskesUuid, filePath) {
    const data = await parseExcel(filePath);
    const tindakanList = new Array();
    const snomedNamsList = new Array();
    const icd9NamesList = new Array();
    data.eachRow((t, index) => {
      if (index === 1) return;
      snomedNamsList.push(t.values[4]);
      icd9NamesList.push(t.values[5]);
      tindakanList.push({
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        code: t.values[2],
        name: t.values[3],
        snomed: t.values[4],
        icd9: t.values[5],
        status: true,
      });
    });
    const snomedList = await SnomedRepository.findByNameIn(snomedNamsList);
    tindakanList.forEach((t, index) => {
      const snomed = snomedList.find((s) => s.name === t.snomed);
      if (snomed) {
        t.snomed_uuid = snomed.uuid;
        delete tindakanList[index].snomed;
      } else {
        t.snomed_uuid = null;
        delete tindakanList[index].snomed;
      }
    });

    const icd9List = await ICD9Repository.findAllBynameIn(icd9NamesList);
    tindakanList.forEach((t, index) => {
      const icd9 = icd9List.find((i) => i.name === t.icd9);
      if (icd9) {
        t.icd9_uuid = icd9.uuid;
        delete tindakanList[index].icd9;
      } else {
        t.icd9_uuid = null;
        delete tindakanList[index].icd9;
      }
    });
    isThereDuplicate(
      tindakanList.map((t) => {
        if(t.code) return t.code.toLowerCase();
      }).filter(d => d !== undefined), "code");

    await isCodesAlredyExist(tindakanList.map(t => {
      if(t.code) return t.code.toLowerCase();
    }).filter(d => d !== undefined), faskesUuid, TindakanModel);
    ZodValidator.validate(TindakanValidation.IMPORT, tindakanList);
    await TindakanRepository.saveAll(tindakanList);
    return generateSuccessResponse("Tindakan berhasil diimport");
  }

  



  static async getAllTindakan(name, page = 1, pageSize = 10, faskes_uuid) {
    const result = await TindakanRepository.getAllTindakan(name, parseInt(page), parseInt(pageSize), faskes_uuid);

    const listTindakan = Utils.convertSequelizeResultToSnakeCase(result.tindakanList);

    const snomedUuids = new Set(listTindakan.map((t) => t.snomed_uuid));
    const icd9Uuids = new Set(listTindakan.map((t) => t.icd_9_uuid));

    const [listSnomed, listIcd9] = await Promise.all([SnomedService.getAllSnomedByUuids([...snomedUuids]), ICD9Service.getAllICD9ByUuids([...icd9Uuids])]);

    const snomedMap = new Map(listSnomed.map((s) => [s.uuid, s]));
    const icd9Map = new Map(listIcd9.map((i) => [i.uuid, i]));

    const data = listTindakan.map((t) => ({
      id: t.id,
      uuid: t.uuid,
      faskes_uuid: t.faskes_uuid,
      code: t.code,
      name: t.name,
      status: t.status,
      snomed_detail: snomedMap.get(t.snomed_uuid) ?? null,
      icd9_detail: icd9Map.get(t.icd_9_uuid) ?? null,
      created_at: t.created_at,
      updated_at: t.updated_at,
      deleted_at: t.deleted_at,
    }));

    const paginationInfo = {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    };

    return Result.responseWithPaginate(messageSuccessShow, paginationInfo, data);
  }

  static async getAllTindakanAktif(faskes_uuid) {
    const result = await TindakanRepository.getAllTindakanAktif(faskes_uuid);
    return successResponse(messageSuccessShow, result);
  }

  static async getTindakanById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }

    const existingTindakan = await TindakanRepository.findTindakanById(uuid);
    if (!existingTindakan) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    return successResponse(messageSuccessShow, existingTindakan);
  }

  static async deleteTindakan(request) {
    const existingTindakan = await TindakanRepository.findTindakanById(request);
    if (!existingTindakan) throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    await TindakanRepository.deleteTindakan(existingTindakan);
    return successResponse(messageSuccessDelete);
  }
}
