import ZodValidator from "../validations/validator.js";
import ValidationException from "../errors/validation-exception.js";
import successResponse from "../response/result-response.js";
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
import xlsx from "node-xlsx";
import fs from "fs/promises";
import Utils from "../helpers/utils.js";
import NotFoundException from "../errors/notfound-exception.js";
import BadRequestException from "../errors/bad_request-exception.js";
import ConflictException from "../errors/conflict-exception.js";
import OklusiGigiValidation from "../validations/oklusi_gigi-validation.js";
import OklusiGigiRepository from "../repositories/oklusi_gigi-validation.js";
import { ZodError } from "zod";
import Result from "../response/result.js";

import { generateSuccessResponse } from "../helpers/generate-message.js";
import { isCodeOrnameAlredyExist, isCodeUnique, isThereDuplicate } from "../helpers/helper.js";
import { OklusiGigiModel } from "@opensimrs/model-sdk/datamaster";

export default class OklusiGigiService {

  static async createOklusiGigi(data) {
    ZodValidator.validate(OklusiGigiValidation.CREATE, data);
    await OklusiGigiRepository.addOklusiGigi(data);
    return successResponse(messageSuccessSave);
  }

  static async updateOklusiGigi(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const validationResult = ZodValidator.validate(OklusiGigiValidation.UPDATE, data);

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingOklusiGigi = await OklusiGigiRepository.findOklusiGigiByUuid(uuid);
    if (!existingOklusiGigi) {
      throw new NotFoundException(messageErrorEdit, messageErrorIdNotFound);
    }

    if (data.code) {
      if (data.code != existingOklusiGigi.code) {
        const existingCodeOklusiGigi = await OklusiGigiRepository.findOklusiGigiByCode(data.code);
        if (existingCodeOklusiGigi) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }
    if (data.display) {
      if (data.display != existingOklusiGigi.display) {
        const existingDisplayOklusiGigi = await OklusiGigiRepository.findOklusiGigiByCode(data.display);
        if (existingDisplayOklusiGigi) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }
    if (data.name) {
      if (data.name != existingOklusiGigi.name) {
        const existingNameOklusiGigi = await OklusiGigiRepository.findOklusiGigiByName(data.name);
        if (existingNameOklusiGigi) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await OklusiGigiRepository.updateOklusiGigi(existingOklusiGigi, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllOklusiGigi(display, page, pageSize) {
    const result = await OklusiGigiRepository.getAllOklusiGigi(display, parseInt(page) || 1, parseInt(pageSize) || 10);
    return successResponse(messageSuccessShow, result.oklusiGigiList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllOklusiGigiAktif() {
    const result = await OklusiGigiRepository.getAllOklusiGigiAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async getOklusiGigiByUuid(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }
    const existingOklusiGigi = await OklusiGigiRepository.findOklusiGigiByUuid(uuid);
    if (!existingOklusiGigi) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }

    return successResponse(messageSuccessShow, existingOklusiGigi);
  }

  static async getAllOklusiGigiAktif() {
    const result = await OklusiGigiRepository.getAllOklusiGigiAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async exportOklusiGigi() {
    const result = await OklusiGigiRepository.exportOklusiGigi();
    return successResponse(messageSuccessExport, result);
  }

  static async importOklusiGigi(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    data[0].data.shift();
    const oklusiGigiList = data[0].data
      .map((oklGi) => {
        return {
          system: oklGi[1].text || oklGi[1],
          code: oklGi[2].toString(),
          display: oklGi[3],
          name: oklGi[4],
        };
      })
      .filter((d) => d !== undefined);

    isThereDuplicate(
      oklusiGigiList.map((ok) => {
        if(ok.code) {
          return ok.code.toLowerCase();
        }
      }).filter(d => d !== undefined),
      "code");
    ZodValidator.validate(OklusiGigiValidation.IMPORT, oklusiGigiList);
    await OklusiGigiRepository.saveAll(oklusiGigiList);
    return generateSuccessResponse("Berhasil import oklusi gigi");
  }

  static async deleteOklusiGigi(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorDelete, messageErrorUuidNotValid);
    }

    const existingOklusiGigi = await OklusiGigiRepository.findOklusiGigiByUuid(uuid);
    if (!existingOklusiGigi) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await OklusiGigiRepository.deleteOklusiGigi(existingOklusiGigi);
    return successResponse(messageSuccessDelete);
  }
}
