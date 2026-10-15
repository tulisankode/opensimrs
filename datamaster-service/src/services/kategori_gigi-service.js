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
  messageErrorIdNotFound,
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
import NotFoundException from "../errors/notfound-exception.js";
import BadRequestException from "../errors/bad_request-exception.js";
import ConflictException from "../errors/conflict-exception.js";
import KategoriGigiValidation from "../validations/kategori_gigi-validation.js";
import KategoriGigiRepository from "../repositories/kategori_gigi-repository.js";
import { ZodError } from "zod";
import Result from "../response/result.js";
import { uuidv7 } from "uuidv7";
import { generateSuccessResponse } from "../helpers/generate-message.js";
import { isCodeOrnameAlredyExist, isThereDuplicate } from "../helpers/helper.js";
import { CategoriGigiModel } from "@opensimrs/model-sdk/datamaster";

export default class KategoriGigiService {

  static async createKategoriGigi(data) {
    ZodValidator.validate(KategoriGigiValidation.CREATE, data);
    await KategoriGigiRepository.addKategoriGigi(data);
    return successResponse(messageSuccessSave);
  }

  static async updateKategoriGigi(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const validationResult = ZodValidator.validate(
      KategoriGigiValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingKategoriGigi =
      await KategoriGigiRepository.findKategoriGigiByUuid(uuid);
    if (!existingKategoriGigi) {
      throw new NotFoundException(messageErrorEdit, messageErrorIdNotFound);
    }

    if (data.code) {
      if (data.code != existingKategoriGigi.code) {
        const existingCodeKategoriGigi =
          await KategoriGigiRepository.findKategoriGigiByCode(data.code);
        if (existingCodeKategoriGigi) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }
    if (data.display) {
      if (data.display != existingKategoriGigi.display) {
        const existingDisplayKategoriGigi =
          await KategoriGigiRepository.findKategoriGigiByCode(data.display);
        if (existingDisplayKategoriGigi) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }
    if (data.name) {
      if (data.name != existingKategoriGigi.name) {
        const existingNameKategoriGigi =
          await KategoriGigiRepository.findKategoriGigiByName(data.name);
        if (existingNameKategoriGigi) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await KategoriGigiRepository.updateKategoriGigi(existingKategoriGigi, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllKategoriGigi(display, page, pageSize) {
    const result = await KategoriGigiRepository.getAllKategoriGigi(
      display,
      parseInt(page) || 1,
      parseInt(pageSize) || 10
    );
    return successResponse(messageSuccessShow, result.kategoriGigiList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllKategoriGigiAktif() {
    const result = await KategoriGigiRepository.getAllKategoriGigiAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async getKategoriGigiByUuid(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }
    const existingKategoriGigi =
      await KategoriGigiRepository.findKategoriGigiByUuid(uuid);
    if (!existingKategoriGigi) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }

    return successResponse(messageSuccessShow, existingKategoriGigi);
  }

  static async getKategoriGigiNameByUuid(uuid) {
    const existingKategoriGigi =
      await KategoriGigiRepository.findKategoriGigiNameByUuid(uuid);

    return Utils.convertSequelizeResultToSnakeCase(existingKategoriGigi).name;
  }

  static async getKategoriGigiUuidByName(name) {
    const result = await KategoriGigiRepository.findKategoriGigiUuidByName(
      name
    );

    return Utils.convertSequelizeResultToSnakeCase(result).uuid;
  }

  static async getAllKategoriGigiAktif() {
    const result = await KategoriGigiRepository.getAllKategoriGigiAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async exportKategoriGigi() {
    const result = await KategoriGigiRepository.exportKategoriGigi();
    return successResponse(messageSuccessExport, result);
  }

  static async importKategoriGigi(faskesUuid, filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    data[0].data.shift();
    let kategoriGigiList = data[0].data.map(kategori => {
      if(kategori.length == 0) return;
      return {
        faske_uuid: faskesUuid ?? null,
        uuid: uuidv7(),
        system: kategori[1] ?? null,
        code: kategori[2] !== undefined ? kategori[2].toString() : null,
        display: kategori[3],
        name: kategori[4] !== undefined ? kategori[4].toString() : null,
        status: true
      }
    });
    kategoriGigiList = kategoriGigiList.filter(c => c !== undefined);
    isThereDuplicate(kategoriGigiList.map(k => {
      if(k.code) return k.code.toLowerCase();
    }).filter(c => c !== undefined), "code");

    isThereDuplicate(kategoriGigiList.map(k => {
      if(k.name) return k.name.toLowerCase();
    }).filter(c => c !== undefined), "name");

    ZodValidator.validate(KategoriGigiValidation.IMPORT, kategoriGigiList);
    await KategoriGigiRepository.saveAll(kategoriGigiList);
    return generateSuccessResponse("Berhasil import kategori gigi");
  }

  static async deleteKategoriGigi(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(
        messageErrorDelete,
        messageErrorUuidNotValid
      );
    }

    const existingKategoriGigi =
      await KategoriGigiRepository.findKategoriGigiByUuid(uuid);
    if (!existingKategoriGigi) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await KategoriGigiRepository.deleteKategoriGigi(existingKategoriGigi);
    return successResponse(messageSuccessDelete);
  }
}
