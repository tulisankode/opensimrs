import FaskesValidation from "../validations/faskes-validation.js";
import FaskesRepository from "../repositories/faskes-repository.js";
import ZodValidator from "../validations/validator.js";
import ValidationException from "../errors/validation-exception.js";
import successResponse from "../response/result-response.js";
import xlsx from "node-xlsx";
import fs from "fs/promises";
import ConflictException from "../errors/conflict-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import Utils from "../helpers/utils.js";
import BadRequestException from "../errors/bad_request-exception.js";
import {
  messageErrorConflict,
  messageErrorDataNotFound,
  messageErrorEdit,
  messageSuccessEdit,
  messageSuccessExport,
  messageSuccessSave,
  messageSuccessShow,
} from "../validations/message-validation-error.js";
import { uuidv7 } from "uuidv7";
import {
  generateErrorResponse,
  generateSuccessResponse,
} from "../helpers/generate-message.js";
import {
  isThereDuplicate,
  parseExcel,
  uniqueCodeXFaskes,
} from "../helpers/helper.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { FaskesModel } from "@opensimrs/model-sdk/datamaster";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { GlobalValidation } from "../validations/global-validation.js";

// Jarak belum tersedia karena tidak ada sumber perhitungan jarak faskes dengan pasien.
export const petakanFaskesUntukPasien = (faskes) => {
  if (!faskes) return [];
  const profil = faskes.faskes_profile ?? null;
  return [
    {
      uuid: faskes.uuid,
      name: faskes.name,
      distance: null,
      address: profil?.address?.fullAddress ?? null,
      phone: profil?.phone ?? null,
      image: profil?.logo ?? null,
    },
  ];
};

export default class FaskesService {
  static async createFaskes(data) {
    ZodValidator.validate(FaskesValidation.CREATE, data);
    await uniqueCodeXFaskes(data, FaskesModel);
    await sequelizeInstance.transaction(async (tr) => {
      await FaskesRepository.addFaskes(data, tr);
    });
    return successResponse(messageSuccessSave);
  }

  static async updateFaskes(request) {
    ZodValidator.validate(FaskesValidation.UPDATE, request);
    const faskes = await FaskesRepository.findByUuid(request.uuid);
    if (!faskes) {
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `faskes dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    }
    await sequelizeInstance.transaction(async (tr) => {
      const affected = await FaskesRepository.update(
        { ...faskes, ...request },
        tr
      );
      if (affected !== 1) {
        throw new HttpException(
          generateErrorResponse(
            "Gagal",
            "internal server error",
            `gagal update faskes ${request.name}`
          ),
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    });
    return generateSuccessResponse(
      `Berhasil memperbarui faskes ${faskes.name}`
    );
  }

  static async getAllFaskes(name, page, pageSize) {
    const pages = Number(page) || 1;
    const limit = Number(pageSize) || 10;
    const result = await FaskesRepository.getAllFaskes(name, pages, limit);
    return successResponse(messageSuccessShow, result.faskesList, {
      page: result.paginationInfo.currentPage,
      page_size: result.paginationInfo.limit,
      total: result.totalItems,
    });
  }

  static async getAllFaskesAktif() {
    const result = await FaskesRepository.getAllFaskesAktif();
    return successResponse(messageSuccessShow, result);
  }

  static async fidnByUuid(request) {
    ZodValidator.validate(FaskesValidation.FIND_BY_UUID, request);
    const faskes = await FaskesRepository.findByUuid(request.uuid);
    if (!faskes) {
      throw new HttpException(
        generateErrorResponse("Gagal", "notfound", "fakes tidak ditemukan"),
        HttpStatus.NOT_FOUND
      );
    }
    return generateSuccessResponse(messageSuccessShow, faskes);
  }

  static async exportFaskes() {
    const result = await FaskesRepository.exportFaskes();
    return successResponse(messageSuccessExport, result);
  }

  static async importFaskes(filePath) {
    const data = await parseExcel(filePath);
    const faskesList = [];
    data.eachRow((row, index) => {
      if (index == 1) return;
      faskesList.push({
        uuid: uuidv7(),
        code: row.values[2],
        name: row.values[3],
        organization_ihs_number:
          row.values[4] !== undefined ? row.values[4].toString() : null,
        client_id: row.values[5],
        client_secret: row.values[6],
        status: true,
      });
    });
    ZodValidator.validate(FaskesValidation.IMPORT, faskesList);
    isThereDuplicate(
      faskesList.map((f) => f.code.toLowerCase()),
      "code"
    );
    await sequelizeInstance.transaction(async (tr) => {
      await FaskesRepository.saveAll(faskesList, tr);
    });
    return generateSuccessResponse("Berhasil import faskes");
  }

  static async deleteFaskes(uuid) {
    ZodValidator.validate(GlobalValidation.UUID, { uuid });
    const faskes = await FaskesRepository.findByUuid(uuid);
    if (!faskes) {
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `faskes dengan ${uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    }
    await sequelizeInstance.transaction(async (tr) => {
      await FaskesRepository.delete(faskes, tr);
    });
    return generateSuccessResponse(`Berhasil menghapus faskes ${faskes.name}`);
  }

  static async findAllFaskesIncludeAddressAndPoli(request) {
    const faskesList =
      await FaskesRepository.findAllFaskesIncludePoliAndAddress(request);
    return {
      message: "Berhasil menampilkan semua faskes",
      payload: faskesList.faskesList,
      properties: faskesList.paginationInfo,
    };
  }

  static async getActiveForPatient(faskesUuid) {
    if (!faskesUuid) {
      throw new HttpException({ message: "Konteks faskes tidak tersedia", payload: null }, HttpStatus.UNAUTHORIZED);
    }
    const faskes = await FaskesRepository.findActiveProfileForPatient(faskesUuid);
    return generateSuccessResponse("Berhasil menampilkan faskes aktif", petakanFaskesUntukPasien(faskes));
  }

  static async getDetailForPatient(request) {
    ZodValidator.validate(FaskesValidation.FIND_BY_UUID, request);
    const result = await FaskesRepository.findFaskesIncludePoliAndAddress(
      request
    );
    if (!result) {
      throw new NotFoundException(messageErrorDataNotFound);
    }
    return generateSuccessResponse(messageSuccessShow, result);
  }
}
