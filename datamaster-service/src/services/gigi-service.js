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
import GigiRepository from "../repositories/gigi-repository.js";
import GigiValidation from "../validations/gigi-validation.js";

import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import { isCodeOrnameAlredyExist, isThereDuplicate } from "../helpers/helper.js";
import { GigiModel } from "@opensimrs/model-sdk/datamaster";
import { GlobalValidation } from "../validations/global-validation.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

export default class GigiService {
  static async createGigi(data) {
    data.name = `${data.name}`;
    ZodValidator.validate(GigiValidation.CREATE, data);
    await GigiRepository.addGigi(data);
    return successResponse(messageSuccessSave);
  }

  static async updateGigi(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }
    data.name = `${data.name}`;
    const validationResult = ZodValidator.validate(GigiValidation.UPDATE, data);

    data.name = `${data.name}`;
    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingGigi = await GigiRepository.findGigiByUuid(uuid);
    if (!existingGigi) {
      throw new NotFoundException(messageErrorEdit, messageErrorIdNotFound);
    }

    if (data.code) {
      if (data.code != existingGigi.code) {
        const existingCodeGigi = await GigiRepository.findGigiByCode(data.code);
        if (existingCodeGigi) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }
    if (data.display) {
      if (data.display != existingGigi.display) {
        const existingDisplayGigi = await GigiRepository.findGigiByCode(data.display);
        if (existingDisplayGigi) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }
    if (data.name) {
      if (data.name != existingGigi.name) {
        const existingNameGigi = await GigiRepository.findGigiByName(data.name);
        if (existingNameGigi) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await GigiRepository.updateGigi(existingGigi, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllGigi(display, page, pageSize) {
    const result = await GigiRepository.getAllGigi(display, parseInt(page) || 1, parseInt(pageSize) || 10);
    return successResponse(messageSuccessShow, result.gigiList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllGigiAktif() {
    const result = await GigiRepository.getAllGigiAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async getGigiByUuid(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }
    const existingGigi = await GigiRepository.findGigiByUuid(uuid);
    if (!existingGigi) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }

    return successResponse(messageSuccessShow, existingGigi);
  }

  static async getAllGigiAktif() {
    const GigiList = await GigiRepository.getAllGigiAktif();
    return successResponse(messageSuccessShow, GigiList);
  }

  static async exportGigi() {
    const result = await GigiRepository.exportGigi();
    return successResponse(messageSuccessExport, result);
  }

  static async importGigi(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    data[0].data.shift();
    let gigi = data[0].data
      .map((gi) => {
        if (gi[1] !== undefined) {
          return {
            code: gi[1] !== undefined ? gi[1].toString() : null,
            display: gi[2],
            name: gi[3] !== undefined ? gi[3].toString() : null,
          };
        }
      })
      .filter((gi) => gi !== undefined);
    isThereDuplicate(
      gigi
        .map((g) => {
          if (g.code !== undefined) {
            return g.code;
          }
        })
        .filter((d) => d !== undefined),
      "code"
    );

    isThereDuplicate(
      gigi
        .map((g) => {
          if (g.name !== undefined) {
            return g.name;
          }
        })
        .filter((d) => d !== undefined),
      "name"
    );

    isThereDuplicate(
      gigi
        .map((g) => {
          if (g.display !== undefined) {
            return g.display;
          }
        })
        .filter((d) => d !== undefined),
      "display"
    );
    gigi = gigi.map(g => ({code: g.code, display: g.display, name: `${g.name}` }));
    ZodValidator.validate(GigiValidation.IMPORT, gigi);
    await GigiRepository.saveAll(gigi);
    return generateSuccessResponse("Berhasil import gigi");
  }

  static async deleteGigi(uuid) {
    ZodValidator.validate(GlobalValidation.UUID, { uuid });
    const gigi = await GigiRepository.findByUuid({ uuid }, GigiModel);
    if (!gigi) {
      throw new HttpException(generateErrorResponse("Gagal", "notfound", `gigi dengan uuid ${uuid} tidak ditemukan`), HttpStatus.NOT_FOUND);
    }
    await sequelizeInstance.transaction(async (tr) => {
      await GigiRepository.delete(gigi, GigiModel, tr);
    });
    return successResponse(messageSuccessDelete);
  }
}
