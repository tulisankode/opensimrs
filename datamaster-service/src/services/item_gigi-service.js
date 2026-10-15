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
import ItemGigiValidation from "../validations/item_gigi-validation.js";
import ItemGigiRepository from "../repositories/item_gigi-repository.js";
import KategoriGigiService from "./kategori_gigi-service.js";
import Result from "../response/result.js";
import excelJs from "exceljs";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import { isCodeOrnameAlredyExist, isThereDuplicate } from "../helpers/helper.js";
import { ItemGigiModel } from "@opensimrs/model-sdk/datamaster";
import KategoriGigiRepository from "../repositories/kategori_gigi-repository.js";
import { HttpException } from "../errors/http-exception.js";

export default class ItemGigiService {
  
  static async createItemGigi(data) {
    ZodValidator.validate(ItemGigiValidation.CREATE, data);
    await ItemGigiRepository.save(data);
    return successResponse(messageSuccessSave);
  }

  static async updateItemGigi(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    const validationResult = ZodValidator.validate(
      ItemGigiValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    let existingItemGigi = await ItemGigiRepository.findItemGigiByUuid(uuid);
    existingItemGigi = existingItemGigi.toJSON();


    if (!existingItemGigi) {
      throw new NotFoundException(messageErrorEdit, messageErrorIdNotFound);
    }

    if (data.code) {
      if (data.code != existingItemGigi.code) {
        const existingCodeItemGigi =
          await ItemGigiRepository.findItemGigiByCode(data.code);
        if (existingCodeItemGigi) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }
    // if (data.display) {
    //   if (data.display != existingItemGigi.display) {
    //     const existingDisplayItemGigi =
    //       await ItemGigiRepository.findItemGigiByCode(data.display);
    //     if (existingDisplayItemGigi) {
    //       throw new ConflictException(messageErrorEdit, messageErrorConflict);
    //     }
    //   }
    // }
    // if (data.name) {
    //   if (data.name != existingItemGigi.name) {
    //     const existingNameItemGigi =
    //       await ItemGigiRepository.findItemGigiByName(data.name);
    //     if (existingNameItemGigi) {
    //       throw new ConflictException(messageErrorEdit, messageErrorConflict);
    //     }
    //   }
    // }

    await ItemGigiRepository.updateItemGigi({...existingItemGigi, ...data});
    return successResponse(messageSuccessEdit);
  }



  
  static async getAllItemGigi(name, page, pageSize) {
    const {payload, properies} = await ItemGigiRepository.getAllItemGigi(name, parseInt(page) || 1, parseInt(pageSize) || 10);
    return generateSuccessResponse("berhasil menampilkan item gigi", payload, properies);
  }

  static async getAllItemGigiAktif() {
    const result = await ItemGigiRepository.getAllItemGigiAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async getItemGigiByUuid(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }

    const existingItemGigi = await ItemGigiRepository.findItemGigiByUuid(uuid);
    if (!existingItemGigi) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }
    const existingItemGigiResult =
      Utils.convertSequelizeResultToSnakeCase(existingItemGigi);

    const nameKategoriGigi =
      await KategoriGigiService.getKategoriGigiNameByUuid(
        existingItemGigiResult.kategori_gigi_uuid
      );

    const result = {
      ...existingItemGigiResult,
      kategori_gigi_name: nameKategoriGigi ? nameKategoriGigi : null,
    };

    return Result.responseMessagePayload(messageSuccessShow, result);
  }

  static async getAllItemGigiAktif() {
    const result = await ItemGigiRepository.getAllItemGigiAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async exportItemGigi() {
    const result = await ItemGigiRepository.exportItemGigi();
    return successResponse(messageSuccessExport, result);
  }

  static async importItemGigi(filePath) {
    const workbook = new excelJs.Workbook();
    await workbook.xlsx.readFile(filePath);
    const workSheet = workbook.getWorksheet(1);
    const itemGigi = new Array();

    workSheet.eachRow((row) => {
      itemGigi.push({
        kategori: row.values[2],
        system: row.values[3].text !== undefined? row.values[3].text : row.values[3],
        code: row.values[4] !== undefined ? row.values[4].toString() : row.values[4],
        display: row.values[5] !== undefined ? row.values[5] : null,
        name: row.values[6] !== undefined ? row.values[6] : null,
        catatan: row.values[7] !== undefined ? row.values[7] : null,
      })
    });
    itemGigi.shift();
    for (let index = 0; index < workSheet.getImages().length; index++) {
      const imageId = workSheet.getImages()[index].imageId;
      const buffer = Buffer.from(workbook.getImage(imageId).buffer, "utf-8");
      itemGigi[index].image = `data:image/png;base64,${buffer.toString("base64")}`;
    }
    isThereDuplicate(itemGigi.map(it => {
      if (it.code) return it.code;
    }).filter(d => d !== undefined), "code");

    isThereDuplicate(itemGigi.map(it => {
      if (it.name) return it.name;
    }).filter(d => d !== undefined), "name");

    ZodValidator.validate(ItemGigiValidation.IMPORT, itemGigi);
    const kategoriGigiList = await KategoriGigiRepository.findAllByNameIn(itemGigi.map(it => it.kategori).filter(d => d !== undefined));
    itemGigi.forEach((it, index) => {
      const kategoriGigi = kategoriGigiList.find(k => k.name === it.kategori);
      if (kategoriGigi) {
        itemGigi[index].kategori_gigi_uuid = kategoriGigi.uuid;
        delete itemGigi[index].kategori;
      }
      else {
        throw new HttpException(generateErrorResponse("Gagal", "notfound", "Kategori Gigi tidak ditemukan"));
      }
    });
    await ItemGigiRepository.saveAll(itemGigi);
    return generateSuccessResponse("Berhasil import item gigi");
  }

  static async deleteItemGigi(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(
        messageErrorDelete,
        messageErrorUuidNotValid
      );
    }

    const existingItemGigi = await ItemGigiRepository.findItemGigiByUuid(uuid);
    if (!existingItemGigi) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await ItemGigiRepository.deleteItemGigi(existingItemGigi);
    return successResponse(messageSuccessDelete);
  }
}
