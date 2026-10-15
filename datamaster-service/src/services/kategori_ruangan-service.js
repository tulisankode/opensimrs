import KategoriRuanganRepository from "../repositories/kategori_ruangan-repository.js";
import KategoriRuanganValidation from "../validations/kategori_ruangan-validation.js";
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
import Result from "../response/result.js";
import { ZodError } from "zod";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import { isCodeOrnameAlredyExist, isThereDuplicate } from "../helpers/helper.js";
import { KategoriRuanganModel } from "@opensimrs/model-sdk/datamaster";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

export default class KategoriRuanganService {
  static async createKategoriRuangan(data) {

    ZodValidator.validate(KategoriRuanganValidation.CREATE, data);
    await KategoriRuanganRepository.addKategoriRuangan(data);
    return successResponse(messageSuccessSave);
  }

  static async updateKategoriRuangan(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    const validationResult = ZodValidator.validate(KategoriRuanganValidation.UPDATE, data);

    if (validationResult.errors) throw new ValidationException({ errors: validationResult.errors });
    const existingKR = await KategoriRuanganRepository.findKategoriRuanganById({uuid, faskes_uuid: data.faskes_uuid});
    if (!existingKR) throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);

    if (data.code) {
      if (data.code != existingKR.code) {
        const existingCodeKR = await KategoriRuanganRepository.findKategoriRuanganByCode(data.code, data.faskes_uuid);
        if (existingCodeKR) throw new ConflictException(messageErrorEdit, messageErrorConflict);
      }
    } 
  
    await KategoriRuanganRepository.updateKategoriRuangan({...existingKR, ...data});
    return successResponse(messageSuccessEdit);
  }

  static async getAllKategoriRuanganByUuids(uuids) {
    const result = await KategoriRuanganRepository.getAllKategoriRuanganByUuids(
      uuids
    );

    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getKategoriRuanganByName(name) {
    const result = await KategoriRuanganRepository.getKategoriRuanganByName(
      name
    );
    if (!result) {
      throw new NotFoundException(messageErrorDataNotFound);
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getAllKategoriRuangan(name, page, pageSize, faskes_uuid, order_by) {
    const result = await KategoriRuanganRepository.getAllKategoriRuangan(name, parseInt(page) || 1, parseInt(pageSize) || 10, faskes_uuid, order_by);
    return successResponse(messageSuccessShow, result.kategoriRuanganList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllKategoriRuanganAktif(request) {
    const { data, properties } = await KategoriRuanganRepository.getAllKategoriRuanganAktif(request);
    return {
      message: "Berhasil menampilkan kategori ruangan aktif",
      payload: data ?? [],
      properties: properties
    }
  }

  static async exportKategoriRuangan() {
    const result = await KategoriRuanganRepository.exportKategoriRuangan();
    return successResponse(messageSuccessExport, result);
  }

  // Import all KategoriRuangan
  static async importKategoriRuangan(faskesUuid, filePath) {
    const fileBuffer = await fs.readFile(filePath);
    let data = xlsx.parse(fileBuffer);
    data[0].data.shift();
    data = data[0].data.filter(d => d.length !==0);
    const kategoriRuanganList = data.map(r => {
      return {
        faskes_uuid: faskesUuid,
        code: r[1],
        name: r[2],
        status: true
      }
    });
    isThereDuplicate(kategoriRuanganList.map(kl => {
      if(kl.code){
        return kl.code.toLowerCase();
      }
      return null;
    }).filter(d => d !== null), "code");

    isThereDuplicate(kategoriRuanganList.map(kl => {
      if(kl.name){
        return kl.name.toLowerCase();
      }
      return null;
    }).filter(d => d !== null), "name");
    ZodValidator.validate(KategoriRuanganValidation.IMPORT, kategoriRuanganList);
    await KategoriRuanganRepository.saveAll(kategoriRuanganList);
    return generateSuccessResponse("Berhasil import kategori ruangan");
  }

  static async getKategoriRuanganById(request) {
   const kategoriruangan = await KategoriRuanganRepository.findKategoriRuanganById(request);
   if(!kategoriruangan) {
    throw new HttpException(
      generateErrorResponse("Gagal", "notfound", "kategori ruangan tidak ada dalam sistem"), HttpStatus.NOT_FOUND
    )
   }
   return generateSuccessResponse("Berhasil menampilkan ruangan", kategoriruangan);
  }

  static async deleteKategoriRuangan(request) {
   const ruangan = await KategoriRuanganRepository.findKategoriRuanganById(request);
    if(!ruangan) {
      throw new HttpException(
        generateErrorResponse("Gagal", "notfound", "kategori ruangan tidak ada dalam sistem"), HttpStatus.NOT_FOUND
      )
    }
    await sequelizeInstance.transaction(async tr => {
      const affected = await KategoriRuanganRepository.delete(ruangan, tr);
      if(affected !== 1){
        throw new HttpException(
          generateErrorResponse("Gagal", "internal server error", "gagal menghapus kategori ruangan"), HttpStatus.INTERNAL_SERVER_ERROR
        )
      }
    })
    return generateSuccessResponse("Berhasil menghapus kategori ruangan")
  }
}
