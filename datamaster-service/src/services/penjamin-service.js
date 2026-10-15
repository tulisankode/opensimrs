import PenjaminRepository from "../repositories/penjamin-repository.js";
import PenjaminValidation from "../validations/penjamin-validation.js";
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
import Utils from "../helpers/utils.js";
import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import { uuidv7 } from "uuidv7";
import { generateSuccessResponse } from "../helpers/generate-message.js"
import { isThereDuplicate } from "../helpers/helper.js";

export default class PenjaminService {

  static async createPenjamin(data) {
    ZodValidator.validate(PenjaminValidation.CREATE, data);
    await PenjaminRepository.addPenjamin(data);
    return successResponse(messageSuccessSave);
  }

  static async updatePenjamin(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit);
    }

    const validationResult = ZodValidator.validate(
      PenjaminValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({
        message: messageErrorSave,
        errors: validationResult.errors,
      });
    }

    const existingPenjamin = await PenjaminRepository.findPenjaminById(uuid);
    if (!existingPenjamin) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    if (data.code) {
      if (data.code != existingPenjamin.code) {
        const existingCodePenjamin =
          await PenjaminRepository.findPenjaminByCode(data.code);
        if (existingCodePenjamin) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await PenjaminRepository.updatePenjamin(existingPenjamin, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllPenjaminByUuids(allPenjaminUuids) {
    const result = await PenjaminRepository.getAllPenjaminByUuids(
      allPenjaminUuids
    );
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getAllPenjamin(name, page, pageSize, faskes_uuid, order_by) {
    const result = await PenjaminRepository.getAllPenjamin(
      name,
      parseInt(page) || 1,
      parseInt(pageSize) || 10,
      faskes_uuid, order_by
    );
    return successResponse(messageSuccessShow, result.penjaminList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllPenjaminAktif(faskes_uuid) {

    const result = await PenjaminRepository.getAllPenjaminAktif(faskes_uuid);
    return successResponse(messageSuccessShow, result);
  }

  static async getPenjaminById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }

    const result = await PenjaminRepository.findPenjaminById(uuid);
    if (!result) {
      throw new NotFoundException(messageErrorShow);
    }
    return successResponse(messageSuccessShow, result);
  }

  static async getAllPenjaminAktif(faskes_uuid) {
    const penjaminList = await PenjaminRepository.getAllPenjaminAktif(faskes_uuid);
    return successResponse(messageSuccessShow, penjaminList);
  }

  static async searchPenjamin(query, page, pageSize) {
    const result = await PenjaminRepository.searchPenjamin(
      query,
      page,
      pageSize
    );
    return successResponse(messageSuccessShow, result.penjaminList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async exportPenjamin() {
    const result = await PenjaminRepository.exportPenjamin();
    return successResponse(messageSuccessExport, result);
  }

  static async importPenjamin(faskesUuid, filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    data[0].data.shift();
    const penjaminList = data[0].data.map((penjamin) => { 
      return {
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        code: penjamin[1],
        name: penjamin[2],
        phone: penjamin[3],
        address: penjamin[4],
        status: true,
      }
    }).filter(d  => d !== undefined);

    isThereDuplicate(penjaminList.map(pl => {
      if(pl.code) return pl.code.toLowerCase();
    }).filter(d => d !== undefined), "code");

    isThereDuplicate(penjaminList.map(pl => {
      if(pl.name) return pl.name.toLowerCase();
    }).filter(d => d !== undefined), "name");


    ZodValidator.validate(PenjaminValidation.IMPORT, penjaminList);
    await PenjaminRepository.saveAll(penjaminList);
    return generateSuccessResponse("Berhasil mengimport data penjamin");
  }

  static async deletePenjamin(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(
        messageErrorDelete,
        messageErrorUuidNotValid
      );
    }

    const dataPenjamin = await PenjaminRepository.findPenjaminById(uuid);
    if (!dataPenjamin) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }
    await PenjaminRepository.deletePenjamin(dataPenjamin);
    return successResponse(messageSuccessDelete);
  }
}
