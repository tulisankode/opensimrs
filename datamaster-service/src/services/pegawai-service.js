import ZodValidator from "../validations/validator.js";
import ValidationException from "../errors/validation-exception.js";
import successResponse from "../response/result-response.js";
import xlsx from "node-xlsx";
import fs from "fs/promises";
import { convertDateFormat, parseDateString } from "../helpers/date-parsing.js";
import PegawaiRepository from "../repositories/pegawai-repository.js";
import PegawaiValidation from "../validations/pegawai-validation.js";
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
import Result from "../response/result.js";
import { ZodError } from "zod";
import { error } from "console";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import { isThereDuplicate } from "../helpers/helper.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
export default class PegawaiService {

  static async createPegawai(data) {
    const tanggal_lahir = parseDateString(data.tanggal_lahir);
    data.tanggal_lahir = tanggal_lahir;
    ZodValidator.validate(PegawaiValidation.CREATE, data);
    const isExist = await PegawaiRepository.findPegawaiByNIK(data.nik, data.faskes_uuid);
    if(isExist){
      throw new HttpException(
        generateErrorResponse("Gagal", 'conflic', `nik ${data.nik} sudah terdaftar sebagai pegawai`), HttpStatus.CONFLIC
      )
    }
    await PegawaiRepository.addPegawai(data);
    return successResponse(messageSuccessSave);
  }

  static async updatePegawai(uuid, data) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorEdit, messageErrorUuidNotValid);
    }

    if (data.tanggal_lahir) {
      const tanggal_lahir = parseDateString(data.tanggal_lahir);
      data.tanggal_lahir = tanggal_lahir;
    }

    const validationResult = ZodValidator.validate(
      PegawaiValidation.UPDATE,
      data
    );

    if (validationResult.errors) {
      throw new ValidationException({ errors: validationResult.errors });
    }

    const existingPegawai = await PegawaiRepository.findPegawaiById(uuid);
    if (!existingPegawai) {
      throw new NotFoundException(messageErrorEdit, messageErrorIdNotFound);
    }

    if (data.nik) {
      if (data.nik != existingPegawai.nik) {
        const existingNikPegawai = await PegawaiRepository.findPegawaiByNIK(data.nik, data.faskes_uuid);
        if (existingNikPegawai) {
          throw new ConflictException(messageErrorEdit, messageErrorConflict);
        }
      }
    }

    await PegawaiRepository.updatePegawai(existingPegawai, data);
    return successResponse(messageSuccessEdit);
  }

  static async getAllPegawai(name, type, page, pageSize, order_by, faskes_uuid) {
    const result = await PegawaiRepository.getAllPegawai(name, parseInt(type), parseInt(page) || 1, parseInt(pageSize) || 10, order_by, faskes_uuid);
    const data = result.pegawaiList.map((pegawai) => {
      const updatedPegawai = { ...pegawai.dataValues };
      updatedPegawai.tanggal_lahir = convertDateFormat(
        updatedPegawai.tanggal_lahir
      );

      return updatedPegawai;
    });

    return Result.responseWithPaginate(
      messageSuccessShow,
      {
        page: result.paginationInfo.currentPage,
        page_size: result.paginationInfo.limit,
        total: result.totalItems,
      },
      data
    );
  }

  static async getAllPegawaiAktif(request) {
    const result = await PegawaiRepository.getAllPegawaiAktif(request);
    const data = this.convertAllPegawaiDates(result);
    return Result.responseMessagePayload(messageSuccessShow, data);
  }

  static async getPegawaiByUuid(uuid) {
    const result = await PegawaiRepository.findPegawaiByUuid(uuid);
    if (!result) {
      return;
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getPegawaiByName(name) {
    const result = await PegawaiRepository.findPegawaiName(name);
    if (!result) {
      throw new NotFoundException(
        "Pegawai tidak ditemukan atau belum terdaftar",
        messageErrorDataNotFound
      );
    }
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getPegawaiById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }
    const pegawai = await PegawaiRepository.findPegawaiById(uuid);
    if (!pegawai) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }

    const dataPegawai = { ...pegawai.dataValues };
    const tanggal_lahir = convertDateFormat(dataPegawai.tanggal_lahir);
    dataPegawai.tanggal_lahir = tanggal_lahir;

    return Result.responseMessagePayload(messageSuccessShow, dataPegawai);
  }

  static async exportPegawai(faskes_uuid) {
    const result = await PegawaiRepository.exportPegawai(faskes_uuid);
    return generateSuccessResponse("Berhasil export pegawai", result);
  }

  static async importPegawai(faskesUuid, filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const data = xlsx.parse(fileBuffer);
    data[0].data.shift();
    const pegawaiList = data[0].data.map((pegawai) => {
      return {
        faskes_uuid: faskesUuid,
        tipe: pegawai[1] === "Nakes" ? 1 : 2,
        first_title: pegawai[2],
        name: pegawai[3],
        last_title: pegawai[4],
        nik: pegawai[5].toString(),
        tanggal_lahir: parseDateString(pegawai[6]),
        gender: pegawai[7],
        status: true
      };
    }).filter(d => d !== undefined);
    isThereDuplicate(pegawaiList.map(p => p.nik), "nik");
    ZodValidator.validate(PegawaiValidation.IMPORT, pegawaiList);
    await PegawaiRepository.saveAll(pegawaiList);
    return generateSuccessResponse("Berhasil import pegawai");
  }

  static async deletePegawai(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorDelete);
    }

    const existingPegawai = await PegawaiRepository.findPegawaiById(uuid);
    if (!existingPegawai) {
      throw new NotFoundException(messageErrorDelete, messageErrorDataNotFound);
    }

    await PegawaiRepository.deletePegawai(existingPegawai);
    return successResponse(messageSuccessDelete);
  }

  static convertAllPegawaiDates(pegawaiList) {
    return pegawaiList.map((pegawai) => {
      // Membuat salinan objek pegawai untuk menghindari mutasi objek asli
      const updatedPegawai = { ...pegawai.dataValues };

      // Mengonversi tanggal lahir
      updatedPegawai.tanggal_lahir = convertDateFormat(
        updatedPegawai.tanggal_lahir
      );

      return updatedPegawai;
    });
  }
}
