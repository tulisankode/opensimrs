import SuratRepository from "../repositories/surat-repository.js";
import SuratValidation from "../validations/surat-validation.js";
import ZodValidator from "../validations/validator.js";
import ValidationException from "../errors/validation-exception.js";
import successResponse from "../response/result-response.js";
import {
  messageErrorConflict,
  messageErrorDataNotFound,
  messageErrorDelete,
  messageErrorEdit,
  messageErrorUuidNotValid,
  messageSuccessDelete,
  messageSuccessEdit,
  messageSuccessExport,
  messageSuccessSave,
  messageSuccessShow,
} from "../validations/message-validation-error.js";
import ConflictException from "../errors/conflict-exception.js";
import Utils from "../helpers/utils.js";
import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import { isCodeOrnameAlredyExist, isThereDuplicate, parseExcel } from "../helpers/helper.js";
import { GeneralConsenMasterModel, SuratModel } from "@opensimrs/model-sdk/datamaster";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

export default class SuratService {

  static async createSurat(data) {
    ZodValidator.validate(SuratValidation.CREATE, data);
    await SuratRepository.addSurat(data);
    return successResponse(messageSuccessSave);
  }

  static async updateSurat(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const validationResult = ZodValidator.validate(SuratValidation.UPDATE, data);

    if (validationResult.errors) throw new ValidationException({ errors: validationResult.errors });


    let existingSurat = await SuratRepository.findSuratById(data.uuid, data.faskes_uuid);
    if (!existingSurat) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    if (data.code) {
      if (data.code != existingSurat.code) {
        const existingCodeSurat = await SuratRepository.findSuratByCode(data.code);
        if (existingCodeSurat) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await SuratRepository.updateSurat({...existingSurat, ...data});
    return successResponse(messageSuccessEdit);
  }

  static async getAllSurat(request) {
    const result = await SuratRepository.getAllSurat(request);
    return successResponse(messageSuccessShow, result.suratList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllSuratAktif(faskes_uuid) {
    const result = await SuratRepository.getAllSuratAktif(faskes_uuid);
    return successResponse(messageSuccessShow, result);
  }

  static async exportSurat() {
    const result = await SuratRepository.exportSurat();
    return successResponse(messageSuccessExport, result);
  }

  static async getSuratById(request) {
   ZodValidator.validate(SuratValidation.FIND_BY_UUID,request);
    const generalCnsen = await SuratRepository.findSuratById(request.uuid, request.faskes_uuid);
    if(!generalCnsen){
      throw new HttpException(
        generateErrorResponse("Gagal", "not_found", `Genral consen dengan uuid ${uuid} tidak ditemukan`), HttpStatus.NOT_FOUND
      )
    }
    return generateSuccessResponse("Berhasil menampilkan data", generalCnsen);
  }

  static async deleteSurat(request) {
    ZodValidator.validate(SuratValidation.FIND_BY_UUID, request);
    const generalConsen = await SuratRepository.findSuratById(request.uuid, request.faskes_uuid);
    if(!generalConsen){
      throw new HttpException(
        generateErrorResponse("Gagal", "not_found", `General consen dengan uuid ${uuid} tidak ditemukan`), HttpStatus.NOT_FOUND
      )
    }

    await sequelizeInstance.transaction(async tr => {
      await SuratRepository.delete(generalConsen, tr);
    });
    return generateSuccessResponse("Berhasil menghapus general consen");
  }
}
