import PractitionerValidation from "../validations/practitioner-validation.js";
import ZodValidator from "../validations/validator.js";
import successResponse from "../response/result-response.js";
import PractitionerRepository from "../repositories/practitioner-repository.js";
import { messageSuccessExport } from "../validations/message-validation-error.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { uuidv7 } from "uuidv7";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import {
  generateErrorResponse,
  generateSuccessResponse,
} from "../helpers/generate-message.js";
import LokasiRepository from "../repositories/lokasi-repository.js";
import { PegawaiModel } from "@opensimrs/model-sdk/datamaster";
import { affectedRowMustBeOne } from "../helpers/helper.js";
import PegawaiRepository from "../repositories/pegawai-repository.js";
import { GlobalValidation } from "../validations/global-validation.js";
import { PartOfLocationRepository } from "../repositories/part-of-location-repository.js";

export default class PractitionerService {
  /**
   *
   * @param {*} data
   * @returns
   */
  static async createPractitioner(data) {
    data.uuid = uuidv7();
    ZodValidator.validate(PractitionerValidation.CREATE_DOKTER, data);
    const [isPractitioenrExist, isPegawaiExist] = await Promise.all([
      PractitionerRepository.findByBpjsCode(data.code_bpjs, data.faskes_uuid),
      PegawaiRepository.findByUuid({
        faskes_uuid: data.faskes_uuid,
        uuid: data.pegawai_uuid,
      }),
    ]);
    if (isPractitioenrExist)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "conflic",
          `practisioner dengan kode bpjs ${data.code_bpjs} sudah terdaftar`
        ),
        HttpStatus.CONFLIC
      );
    if (!isPegawaiExist)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `pegawai dengan uuid ${data.pegawai_uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );

    const lokasiUuidList = data.poli_pelayanan.map((p) => p.lokasi_uuid);
    let [masterLokasi, partOfLokasi] = await Promise.all([
      LokasiRepository.findAllByUuidIn(lokasiUuidList, data.faskes_uuid),
      PartOfLocationRepository.findAllByUuidIn(
        lokasiUuidList,
        data.faskes_uuid
      ),
    ]);

    lokasiUuidList.forEach((l, index) => {
      let isExist = masterLokasi.find((m) => m.uuid == l);
      if (!isExist) {
        isExist = partOfLokasi.find((prl) => prl.uuid == l);
        if (!isExist) {
          throw new HttpException(
            generateErrorResponse(
              "Gagal",
              "notfound",
              `lokasi_uuid ${l} tidak ditemukan`
            ),
            HttpStatus.NOT_FOUND
          );
        }
        data.poli_pelayanan[index].name = isExist.name;
      }
      data.poli_pelayanan[index].name = isExist.name;
    });
    data.poli_pelayanan = JSON.stringify(data.poli_pelayanan);
    await sequelizeInstance.transaction(async (tr) => {
      await Promise.all([PractitionerRepository.save(tr, data)]);
    });
    return generateSuccessResponse(`Berhasil menambahkan practitioner`);
  }

  /**
   *
   * @param {*} data
   * @returns
   */
  // Poli tugas non-dokter (opsional) → JSON [{lokasi_uuid, name}] dengan nama dari master lokasi.
  static async poliTugasNonDokter(poli, faskesUuid) {
    if (!Array.isArray(poli) || poli.length === 0) return "[]";
    const uuids = poli.map((p) => p.lokasi_uuid);
    const [masterLokasi, partOfLokasi] = await Promise.all([
      LokasiRepository.findAllByUuidIn(uuids, faskesUuid),
      PartOfLocationRepository.findAllByUuidIn(uuids, faskesUuid),
    ]);
    return JSON.stringify(
      uuids.map((uuid) => {
        const lokasi = masterLokasi.find((m) => m.uuid == uuid) ?? partOfLokasi.find((m) => m.uuid == uuid);
        if (!lokasi)
          throw new HttpException(
            generateErrorResponse("Gagal", "notfound", `lokasi_uuid ${uuid} tidak ditemukan`),
            HttpStatus.NOT_FOUND
          );
        return { lokasi_uuid: uuid, name: lokasi.name };
      })
    );
  }

  static async createPractitionerNonDoctor(data) {
    ZodValidator.validate(PractitionerValidation.CREATE_NON_DOKTER, data);
    const pegawai = await PegawaiRepository.findByUuid(
      { faskes_uuid: data.faskes_uuid, uuid: data.pegawai_uuid },
      PegawaiModel
    );
    if (!pegawai) {
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `pegawai_uuid ${data.pegawai_uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    }
    data.poli_pelayanan = await this.poliTugasNonDokter(data.poli_pelayanan, data.faskes_uuid);
    await sequelizeInstance.transaction(async (tr) => {
      await PractitionerRepository.save(tr, data);
    });
    return generateSuccessResponse("Berhasil menambahkan praktisioner");
  }

  /**
   *
   * @param {*} request
   * @returns
   */
  static async updatePractitioner(request) {
    console.log("update dokter", request);
    ZodValidator.validate(PractitionerValidation.UPDATE_DOKTER, request);
    const [practitioner, pegawai] = await Promise.all([
      PractitionerRepository.findByUuidIncludePractitionerPoli({
        uuid: request.uuid,
        faskes_uuid: request.faskes_uuid,
      }),
      PegawaiRepository.findByUuid(
        { faskes_uuid: request.faskes_uuid, uuid: request.pegawai_uuid },
        PegawaiModel
      ),
    ]);
    if (!practitioner)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `practitioner dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    if (!pegawai)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `pegawai dengan uuid ${request.pegawai_uuid} tiidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    const lokasiUuidList = request.poli_pelayanan.map((p) => p.lokasi_uuid);

    let [masterLokasi, partOfLokasi] = await Promise.all([
      LokasiRepository.findAllByUuidIn(lokasiUuidList, request.faskes_uuid),
      PartOfLocationRepository.findAllByUuidIn(
        lokasiUuidList,
        request.faskes_uuid
      ),
    ]);

    lokasiUuidList.forEach((l, index) => {
      let isExist = masterLokasi.find((m) => m.uuid == l);
      if (!isExist) {
        isExist = partOfLokasi.find((prl) => prl.uuid == l);
        if (!isExist) {
          throw new HttpException(
            generateErrorResponse(
              "Gagal",
              "notfound",
              `lokasi_uuid ${l} tidak ditemukan`
            ),
            HttpStatus.NOT_FOUND
          );
        }
        request.poli_pelayanan[index].name = isExist.name;
      }
      request.poli_pelayanan[index].name = isExist.name;
    });
    request.poli_pelayanan = JSON.stringify(request.poli_pelayanan);
    await sequelizeInstance.transaction(async (tr) => {
      affectedRowMustBeOne(await PractitionerRepository.update(request, tr));
    });
    return generateSuccessResponse("Berhasil update practisioner");
  }

  /**
   *
   * @param {*} updateRequest
   * @returns
   */
  static async updatePractitionerNonDokter(updateRequest) {
    ZodValidator.validate(
      PractitionerValidation.UPDATE_NON_DOKTER,
      updateRequest
    );
    const { uuid, faskes_uuid } = updateRequest;
    const practitioner = await PractitionerRepository.findByUuid({
      faskes_uuid,
      uuid,
    });
    if (!practitioner) {
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `practisioner dengan uuid ${updateRequest.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    }
    await sequelizeInstance.transaction(async (tr) => {
      console.log({ ...practitioner, ...updateRequest });
      const affected = await PractitionerRepository.update(
        {
          ...practitioner,
          ...updateRequest,
          poli_pelayanan: await PractitionerService.poliTugasNonDokter(updateRequest.poli_pelayanan, faskes_uuid),
        },
        tr
      );
      if (affected !== 1) {
        throw new HttpException(
          generateErrorResponse(
            "Gagal",
            "internal server error",
            "gagal update practisioner non dokter"
          ),
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      console.log(affected);
    });
    return generateSuccessResponse("Berhasil update practisioner non dokter");
  }

  static async getAllPractitioner(request) {
    const { data, properties } = await PractitionerRepository.findAll(request);
    return generateSuccessResponse(
      "Berhasil menampilkan semua praktisioner",
      data,
      properties
    );
  }

  static mapPoli = (poli, lokasi) => {
    return poli.map((p) => {
      const lokasiInfo = lokasi.find((l) => l.uuid === p.lokasi_uuid);
      return {
        uuid: p.uuid,
        lokasi_uuid: p.lokasi_uuid,
        lokasi_name: lokasiInfo ? lokasiInfo.name : null,
      };
    });
  };

  static paginateResults(result, page, pageSize) {
    const totalItems = result.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = page * pageSize;
    const paginatedResult = result.slice(startIndex, endIndex);
    const paginationInfo = { page, page_size: pageSize, total: totalItems };

    return { paginatedResult, paginationInfo };
  }

  static async exportPractitioner() {
    const result = await PractitionerRepository.exportPractitioner();
    return successResponse(messageSuccessExport, result);
  }

  static async getAllPractitionerAktif(request) {
    const result = await PractitionerRepository.getAllPractitionerAktif(
      request
    );
    return generateSuccessResponse(
      "Berhasil menampilkan practitioner aktif",
      result
    );
  }

  static async getAllPractitionerAktifByPoli(request) {
    const result = await PractitionerRepository.getAllPractitionerAktifByPoli(
      request
    );
    if (!result) {
      generateErrorResponse(
        "Gagal",
        "notfound",
        "practitioner tidak ditemukan"
      ),
        HttpStatus.NOT_FOUND;
    }
    return generateSuccessResponse("Berhasil menampilkan practitioner", result);
  }

  static async getPractitionerById(request) {
    ZodValidator.validate(GlobalValidation.UUID_FASKES_UUID, request);
    const practitioner = await PractitionerRepository.findByUuid(request);
    if (!practitioner)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `practitioner dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    return generateSuccessResponse(
      "Berhasil menampilkan practitioner",
      practitioner
    );
  }

  static async deletePractitioner(request) {
    ZodValidator.validate(GlobalValidation.UUID_FASKES_UUID, request);
    const practitioner = await PractitionerRepository.findByUuid(request);
    if (!practitioner)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `practitioner dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    await sequelizeInstance.transaction(async (tr) => {
      affectedRowMustBeOne(await PractitionerRepository.delete(practitioner));
    });
    return generateSuccessResponse(`Berhasil menghapus practitioner`);
  }

  static async findPractitionerByCodeAntrianByFaskes(req) {
    const practitioner =
      await PractitionerRepository.findPractitionerByCodeAntrianByFaskes(req);
    if (!practitioner)
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "notfound",
          `practitioner dengan uuid ${request.uuid} tidak ditemukan`
        ),
        HttpStatus.NOT_FOUND
      );
    return generateSuccessResponse(
      "Berhasil menampilkan practitioner",
      practitioner
    );
  }
}
