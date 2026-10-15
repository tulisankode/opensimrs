import LokasiRepository from "../repositories/lokasi-repository.js";
import LokasiValidation from "../validations/lokasi-validation.js";
import ZodValidator from "../validations/validator.js";
import successResponse from "../response/result-response.js";
import {
  messageErrorDataNotFound,
  messageErrorShow,
  messageSuccessExport,
  messageSuccessShow,
} from "../validations/message-validation-error.js";
import Utils from "../helpers/utils.js";
import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import {
  findDuplicateElement,
  parseExcel,
  uniqueCodeXFaskes,
} from "../helpers/helper.js";
import {
  generateErrorResponse,
  generateSuccessResponse,
} from "../helpers/generate-message.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import {
  LokasiModel,
  PartOfLocationModel,
} from "@opensimrs/model-sdk/datamaster";
import { PartOfLocationRepository } from "../repositories/part-of-location-repository.js";
import FaskesRepository from "../repositories/faskes-repository.js";
import { GlobalValidation } from "../validations/global-validation.js";
import { PartOfLokasiService } from "./part-of-lokasi-service.js";

export default class LokasiService {
  static async findByCode(request) {
    const { code, faskes_uuid } = ZodValidator.validate(
      LokasiValidation.FIND_BY_CODE,
      request
    );
    let lokasi = await LokasiRepository.findByCode({ code, faskes_uuid });
    if (!lokasi) {
      lokasi = await PartOfLocationRepository.findByCode({ code, faskes_uuid });
    }
    if (!lokasi) {
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `lokasi dengan kode ${code} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    }
    return generateSuccessResponse(
      `Berhasil menampilkan lokasi dengan kode ${code}`,
      lokasi
    );
  }

  static async findAllPartOf(request) {
    const { data, properties } = await PartOfLocationRepository.findAll(
      request
    );
    return {
      message: "Berhasil menampilkan semua part of lokasi",
      payload: data ?? [],
      properties: properties,
    };
  }

  static async findAllByPartOfUuid(request) {
    const data = await PartOfLocationRepository.findAllByPartOfUuid(request);
    return {
      message: "Berhasil menampilkan semua part of lokasi",
      payload: data ?? [],
    };
  }

  static async createLokasi(data) {
    console.table(data);
    const faskes = await FaskesRepository.findFaskesById(data.faskes_uuid);
    data.organization_ihs_number = faskes.toJSON().organization_ihs_number;
    ZodValidator.validate(LokasiValidation.CREATE, data);
    if (data.part_of_uuid) {
      const partOf = await LokasiRepository.findByUuid({
        uuid: data.part_of_uuid,
        faskes_uuid: data.faskes_uuid,
      });
      if (!partOf) {
        throw new HttpException(
          generateErrorResponse(
            "Gagal",
            "notfound",
            `part_of_uuid ${data.part_of_uuid} tidak ditemukan`
          ),
          HttpStatus.NOT_FOUND
        );
      }
      console.log(partOf);
      data.part_of_uuid = partOf.uuid;
    }
    await sequelizeInstance.transaction(async (tr) => {
      await LokasiRepository.save(data, tr);
    });
    return generateSuccessResponse(`Berhasil menambahkan lokasi ${data.name}`);
  }

  static async findAllIncludePartOf(request) {
    const { payload, properties } =
      await LokasiRepository.findAllLokasiIncludePartOf(request);
    return generateSuccessResponse(
      "Berhasil menampilkan semua lokasi",
      payload,
      properties
    );
  }

  static async updateLokasi(request) {
    ZodValidator.validate(LokasiValidation.UPDATE, request);
    const lokasi = await LokasiRepository.findByUuid(request, LokasiModel);
    if (!lokasi) {
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `lokasi dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    }
    if (request.part_of_uuid) {
      const partOf = await LokasiRepository.findByUuid({
        faskes_uuid: request.faskes_uuid,
        uuid: request.uuid,
      });
      if (!partOf) {
        throw new HttpException(
          generateErrorResponse(
            "Gagal",
            "notfound",
            `part_of_uuid ${request.part_of_uuid} tidak ditemukan`
          ),
          HttpStatus.NOT_FOUND
        );
      }
      request.part_of_uuid = partOf.uuid;
    }
    await sequelizeInstance.transaction(async (tr) => {
      const affected = await LokasiRepository.update(
        { ...lokasi, ...request },
        tr
      );
      if (affected !== 1) {
        throw new HttpException(
          generateErrorResponse(
            "Gagal",
            "internal server error",
            `Gagal memperbarui lokasi`
          ),
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    });
    return generateSuccessResponse(`Berhasil update loksi ${request.name}`);
  }

  static async getAllLokasi(request) {
    const { data, properties } = await LokasiRepository.getAllLokasi(request);
    return {
      message: "Berhasil menampilkan semua lokasi",
      payload: data ?? [],
      properties: properties,
    };
  }

  static async getAllLokasiAktif(request) {
    const { data, properties } = await LokasiRepository.getAllLokasiAktif(
      request
    );
    return {
      message: "Berhasil menampilkan semua lokasi",
      payload: data ?? [],
      properties: properties,
    };
  }

  static async getAllLokasiPoliAktif(request) {
    const data = await LokasiRepository.getAllLokasiPoliAktif(request);
    return {
      message: "Berhasil menampilkan semua lokasi",
      payload: data ?? [],
    };
  }

  static async getLokasiById(uuid) {
    const checkUUID = Utils.validateUUID(uuid);
    if (!checkUUID) {
      throw new BadRequestException(messageErrorShow);
    }
    const result = await LokasiRepository.findLokasiByUuid(uuid);
    if (!result) {
      throw new NotFoundException(messageErrorShow, messageErrorDataNotFound);
    }
    return successResponse(messageSuccessShow, result);
  }

  static async getLokasiNameByUuids(uuids) {
    const result = await LokasiRepository.getAllLokasiByUuids(uuids);
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async getLokasiByName(name) {
    const result = await LokasiRepository.getLokasiByName(name);
    return Utils.convertSequelizeResultToSnakeCase(result);
  }

  static async importLokasi(faskesUuid, filePath) {
    const data = await parseExcel(filePath);
    let locationList = [];
    data.eachRow((l, index) => {
      if (index == 1) return;
      if (l.values[2] !== undefined) {
        let is_poli = null;
        if (typeof l.values[13] == "string") {
          if (l.values[13].toLowerCase() == "true") {
            is_poli = true;
          } else {
            is_poli = false;
          }
        } else {
          is_poli = l.values[13];
        }
        locationList.push({
          uuid: uuidv7(),
          faskes_uuid: faskesUuid,
          organization_ihs_number: l.values[2].toString(),
          code: l.values[3],
          name: l.values[4],
          description: l.values[5],
          phone: l.values[6],
          email: l.values[7],
          url: l.values[8].text ? l.values[8].text : l.values[8],
          location_type: l.values[9],
          class_name: l.values[11] !== undefined ? l.values[11] : null,
          part_of_name: l.values[12] || null,
          status: true,
          is_poli: is_poli,
          code_antrian_poli: l.values[14] ? l.values[14] : null,
        });
      }
    });
    const duplicatCodeList = findDuplicateElement(
      locationList.map((l) => l.code.toLowerCase())
    );
    if (duplicatCodeList.length !== 0) {
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "conflic",
          `kode lokasi ${duplicatCodeList
            .toString()
            .toLocaleUpperCase()} sudah ada, gunakan kdoe lain`
        ),
        HttpStatus.BAD_REQUEST
      );
    }

    const duplicateAntrianCode = findDuplicateElement(
      locationList
        .map((l) => l.code_antrian_poli)
        .filter((d) => d !== null)
        .map((d) => d.toLowerCase())
    );
    if (duplicateAntrianCode.length !== 0) {
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "conflic",
          `kode antrian ${duplicateAntrianCode
            .toString()
            .toLocaleUpperCase()} sudah ada, gunakan kdoe lain`
        ),
        HttpStatus.BAD_REQUEST
      );
    }

    locationList.forEach((item, index) => {
      if (item.part_of_name) {
        const partOf = locationList.find((ls) => ls.name === item.part_of_name);
        if (!partOf) {
          throw new HttpException(
            generateErrorResponse(
              "Gagal",
              "notfound",
              `partOf lokasi ${item.part_of_name} tidak ditemukan`
            ),
            HttpStatus.NOT_FOUND
          );
        }
        locationList[index].part_of_uuid = partOf.uuid;
      }
    });
    ZodValidator.validate(LokasiValidation.IMPORT, locationList);
    await sequelizeInstance.transaction(async (tr) => {
      await LokasiRepository.saveAll(locationList, tr);
    });
    return generateSuccessResponse("Berhasil import lokasi");
  }

  // Export all Lokasi
  static async exportLokasi() {
    const result = await LokasiRepository.exportLokasi();
    return successResponse(messageSuccessExport, result);
  }

  // Delete a Lokasi by UUID
  static async deleteLokasi(request) {
    ZodValidator.validate(GlobalValidation.UUID_FASKES_UUID, request);
    let location = await LokasiRepository.findByUuid(request, LokasiModel);
    if (!location) {
      return await PartOfLokasiService.delete(request);
    }
    await sequelizeInstance.transaction(async (tr) => {
      const affected = await LokasiRepository.delete(location, LokasiModel, tr);
      if (affected !== 1) {
        throw new HttpException(
          generateErrorResponse(
            "Gagal",
            "internal server error",
            "gagal menghapus lokasi"
          ),
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    });
    return generateSuccessResponse(
      `Berhasil menghapus lokasi ${location.name}`
    );
  }
}
