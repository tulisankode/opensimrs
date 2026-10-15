import RuanganRepository from "../repositories/ruangan-repository.js";
import RuanganValidation from "../validations/ruangan-validation.js";
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
import { ZodError } from "zod";
import Result from "../response/result.js";
import KategoriRuanganService from "./kategori_ruangan-service.js";
import { log } from "console";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import { isCodeOrnameAlredyExist, isThereDuplicate } from "../helpers/helper.js";
import { RuanganModel } from "@opensimrs/model-sdk/datamaster";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

export default class RuanganService {



  static async createRuangan(data) {
    ZodValidator.validate(RuanganValidation.CREATE, data);
    await RuanganRepository.addRuangan(data);
    return successResponse(messageSuccessSave);
  }

  static async updateRuangan(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const validationResult = ZodValidator.validate(
      RuanganValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingRuangan = await RuanganRepository.findRuanganById(uuid);
    if (!existingRuangan) {
      throw new NotFoundException(messageErrorEdit, messageErrorDataNotFound);
    }

    if (data.code) {
      if (data.code != existingRuangan.code) {
        const existingCodeRuangan = await RuanganRepository.findRuanganByCode(
          data.code
        );
        if (existingCodeRuangan) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await RuanganRepository.updateRuangan(existingRuangan, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllRuanganByUuids(uuids) {
    const result = await RuanganRepository.getAllRuanganByUuids(uuids);
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async findAll(faskes_uuid){
    const ruanganList = await RuanganRepository.findAll(faskes_uuid);
    return ruanganList;
  }


  static async getAllRuangan(name, kategori_ruangan_uuid, kelas_ruangan, page, pageSize, faskes_uuid, order_by) {
    if (kategori_ruangan_uuid) {
      const checkUUID = Utils.validateUUID(kategori_ruangan_uuid);
      if (!checkUUID) {
        throw new BadRequestException(
          messageErrorShow,
          messageErrorUuidNotValid
        );
      }
    }
    const result = await RuanganRepository.getAllRuangan(name, kategori_ruangan_uuid, kelas_ruangan, parseInt(page) || 1, parseInt(pageSize) || 10, faskes_uuid, order_by);
    const resultRuangan = Utils.convertSequelizeResultToSnakeCase(
      result.ruanganList
    );

    const katRuanganUuids = resultRuangan.map((r) => r.kategori_ruangan_uuid);

    const katRuanganList =
      await KategoriRuanganService.getAllKategoriRuanganByUuids(
        katRuanganUuids
      );

    const data = resultRuangan.map((r) => {
      const katRuanganName = katRuanganList.find(
        (kr) => r.kategori_ruangan_uuid == kr.uuid
      );
      return {
        ...r,
        kategori_ruangan_name: katRuanganName ? katRuanganName.name : "Unknown",
      };
    });

    const paginationInfo = {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    };

    return Result.responseWithPaginate(messageErrorShow, paginationInfo, data);
  }

  static async getAllRuanganAktif(faskes_uuid) {
    const result = await RuanganRepository.getAllRuanganAktif(faskes_uuid);
    return successResponse(messageSuccessShow, result);
  }

  static async exportRuangan() {
    const result = await RuanganRepository.exportRuangan();
    return successResponse(messageSuccessExport, result);
  }

  // Import all Ruangan
  static async importRuangan(faskesUuid, filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    data[0].data.shift();
    let categoryNames = new Array();

    const ruanganList = data[0].data.map(r => {
      categoryNames.push(r[3]);


      return {
        faskes_uuid: faskesUuid ?? null,
        code: r[1] ?? null,
        name: r[2] ?? null,
        no_room: r[4] != null? parseInt(r[4]) : null,
        kategori_ruangan: r[3] ?? null,
        kelas_ruangan: r[5] ? transformKelasRuangan(r[5]) : null,
        status: true
      }


    });
    isThereDuplicate(ruanganList.map(r => {
      if(r.code){
        return r.code.toLowerCase()
      }
      return null
}).filter(c => c !== null), "code");
    
    isThereDuplicate(ruanganList.map(r => {
      if(r.name){
        return r.name.toLowerCase()
      }
      return null
    }).filter(n => n !== null), "name");

    ZodValidator.validate(RuanganValidation.IMPORT, ruanganList);
    categoryNames = categoryNames.filter(c => (c !== undefined));
    const categoryRooms = await RuanganRepository.findCategoryRoomByNameIn(faskesUuid, categoryNames);
    const categories = categoryRooms.map(c => c.name);
    categoryNames = categoryNames.filter(c => (c !== undefined));
    let index = 0;
    for(const c of categoryNames) {
      if(!categories.includes(c)){
        throw new HttpException(
          generateErrorResponse("Gagal", "invalid", `ruangan category ${c} tidak ada`), HttpStatus.NOT_FOUND
        )
      }else {
        ruanganList[index].kategori_ruangan_uuid = categoryRooms.find(cr => cr.name === c).uuid;
        delete ruanganList[index].kategori_ruangan;
        index++;
      }
    }
    await RuanganRepository.saveAll(ruanganList);
    return generateSuccessResponse("Berhasil import ruangan");
  }


  static async getRuanganById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }

    const existingRuangan = await RuanganRepository.findRuanganById(uuid);
    if (!existingRuangan) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }

    return successResponse(messageSuccessShow, existingRuangan);
  }

  static async deleteRuangan(request) {
    ZodValidator.validate(RuanganValidation.DELETE, request);
    const ruangan = await RuanganRepository.findByUuid(request.uuid, request.faskes_uuid);
    if(!ruangan){
      throw new HttpException(
        generateErrorResponse("Gagal", "notfound", "gagal menghapus ruangan"), HttpStatus.NOT_FOUND
      )
    }
    await sequelizeInstance.transaction(async tr => {
      const affected = await RuanganRepository.deleteRuangan(ruangan, tr);
      if(affected !== 1) {
        throw new HttpException(
          generateErrorResponse("Gagal", "internal server error", "gagal menghapus ruangan"), HttpStatus.INTERNAL_SERVER_ERROR
        )
      }
    })
    return generateSuccessResponse(`Berhasil menghapus ruangan ${ruangan.name}`);
  }
}

function transformKelasRuangan(data){
  switch (data.toLowerCase()) {
    case "kelas 1":
      return 1
    case "kelas 2":
      return 2
    case "kelas 3":
      return 3
    case "vip":
      return 4
    case "vvip":
      return 5
    default:
      throw new HttpException(generateErrorResponse("Gagal", "invalid", `kelas ${data} tidak ada`), HttpStatus.NOT_FOUND)
  }
}