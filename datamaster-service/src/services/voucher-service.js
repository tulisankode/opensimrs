import ZodValidator from "../validations/validator.js";
import ValidationException from "../errors/validation-exception.js";
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
import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import Utils from "../helpers/utils.js";
import VoucherRepository from "../repositories/voucher-repository.js";
import VoucherValidation from "../validations/voucher-validation.js";
import { parseDateString } from "../helpers/date-parsing.js"
import { findDuplicateElement, isCodeOrnameAlredyExist, isCodesAlredyExist, isCodeUnique, isThereDuplicate, parseExcel } from '../helpers/helper.js';
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js"
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { VoucherModel } from "@opensimrs/model-sdk/datamaster";
import { GlobalValidation } from "../validations/global-validation.js";

export default class VoucherService {

  static async createVoucher(data) {
    ZodValidator.validate(VoucherValidation.CREATE, data);
    await VoucherRepository.addVoucher(data);
    return successResponse(messageSuccessSave);
  }

  static async updateVoucher(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const validationResult = ZodValidator.validate(
      VoucherValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingVoucher = await VoucherRepository.findVoucherById(uuid);
    if (!existingVoucher) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    if (data.code) {
      if (data.code != existingVoucher.code) {
        const existingCodeVoucher = await VoucherRepository.findVoucherByCode(
          data.code
        );
        if (existingCodeVoucher) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await VoucherRepository.updateVoucher(existingVoucher, data);
    return successResponse(messageSuccessEdit);
  }

  static async exportVoucher() {
    const result = await VoucherRepository.exportVoucher();
    return successResponse(messageSuccessExport, result);
  }

  // Import all Voucher
  static async importVoucher(faskesUuid, filePath) {
    const data = await parseExcel(filePath);
    const vocherList = new Array();
    data.eachRow((v, index) => {
      if(index == 1) return;
      vocherList.push({
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        code: v.values[2],
        name: v.values[3],
        start_date: v.values[4],
        end_date: v.values[5],
        qty: v.values[6]? parseInt(v.values[6]) : null,
        type: v.values[7],
        value: v.values[8] ? parseInt(v.values[8]) : null,
        status: true,
      })
    });
    ZodValidator.validate(VoucherValidation.IMPORT, vocherList);
    isThereDuplicate(vocherList.map(v => v.code.toLowerCase()), "code");
    vocherList.forEach((vl, index) => {
      if(vl.start_date !== undefined && vl.start_date !== null){
        vocherList[index].start_date = new Date(vl.start_date).getTime() / 1000.0;
      }
      if(vl.end_date !== undefined && vl.end_date !== null){
        vocherList[index].end_date = new Date(vl.end_date).getTime() / 1000.0;
      }
    });
    await sequelizeInstance.transaction(async tr => {
      await VoucherRepository.saveAll(vocherList, tr);
    });
    return generateSuccessResponse("Berhasil import voucher");
  }

  static async getAllVoucher(request) {
    const result = await VoucherRepository.getAllVoucher(request);
    return successResponse(messageSuccessShow, result.voucherList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllVoucherAktif(faskes_uuid) {
    const result = await VoucherRepository.getAllVoucherAktif(faskes_uuid);
    return successResponse(messageSuccessShow, result);
  }

  static async getVoucherById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }

    const existingVoucher = await VoucherRepository.findVoucherById(uuid);
    if (!existingVoucher) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    return successResponse(messageSuccessShow, existingVoucher);
  }

  static async deleteVoucher(request) {
    ZodValidator.validate(GlobalValidation.UUID_FASKES_UUID, request);
    const voucher = await VoucherRepository.findByUuid(request, VoucherModel);
    if(!voucher) {
      throw new HttpException(
        generateErrorResponse("Gagal", "notfound", `voucher dengan uuid ${request.uuid} tidak ditemukan`), HttpStatus.NOT_FOUND
      )
    }
    await sequelizeInstance.transaction(async tr => {
      await VoucherRepository.delete(voucher, VoucherModel, tr);
    })
    return generateSuccessResponse(`Berhasil menghapus voucher ${voucher.name}`)
  }
}
