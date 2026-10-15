import { LokasiModel, PartOfLocationModel } from "@opensimrs/model-sdk/datamaster";
import FaskesRepository from "../repositories/faskes-repository.js";
import { PartOfLocationRepository } from "../repositories/part-of-location-repository.js";
import ZodValidator from "../validations/validator.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { GlobalValidation } from "../validations/global-validation.js";
import { PartOfLocationValidation } from "../validations/part-of-location-validation.js";
import { findPartOf } from "../helpers/helper.js";
import { LokasiStokModel } from "@opensimrs/model-sdk/farmasi";

export class PartOfLokasiService {
  static async create(request) {
    const faskes = await FaskesRepository.findFaskesById(request.faskes_uuid);
    request.organization_ihs_number = faskes.organization_ihs_number;
    ZodValidator.validate(PartOfLocationValidation.CREATE, request);
    const parentLocation = await findPartOf({faskes_uuid: request.faskes_uuid, uuid: request.part_of}, LokasiModel);
    await sequelizeInstance.transaction(async (tr) => {
      request.part_of_name = parentLocation.name;
      request.part_of = null;
      await PartOfLocationRepository.save(request, tr);
    });
    return generateSuccessResponse(`Berhasil menambahkan lokasi ${request.name} part of dari ${parentLocation.name}`);
  }

  static async delete(request) {
    ZodValidator.validate(GlobalValidation.UUID_FASKES_UUID, request);
    const partOfLocation = await PartOfLocationRepository.findByUuid({faskes_uuid: request.faskes_uuid, uuid: request.uuid}, PartOfLocationModel);
    if (!partOfLocation) {
      throw new HttpException(generateErrorResponse("Gagal", "notfound", `part of lokasi dengan uuid ${request.uuid} tidak ditemukan`), HttpStatus.NOT_FOUND);
    }
    await sequelizeInstance.transaction(async (tr) => {
      const affected = await PartOfLocationRepository.delete(request, PartOfLocationModel, tr);
      if (affected !== 1) {
        throw new HttpException(generateErrorResponse("Gagal", "internal server error", "gagal menghapus part of lokasi"), HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
    return generateSuccessResponse(`Berhasil menghapus lokasi ${partOfLocation.name}`);
  }

  static async update(request) {
    const faskes = await FaskesRepository.findFaskesById(request.faskes_uuid);
    request.organization_ihs_number = faskes.organization_ihs_number;
    ZodValidator.validate(PartOfLocationValidation.UPDATE, request);
    await findPartOf({faskes_uuid: request.faskes_uuid, uuid: request.part_of}, LokasiStokModel);
    const locationUpdate = await PartOfLocationRepository.findByUuid({faskes_uuid: request.faskes_uuid, uuid: request.uuid}, PartOfLocationModel);
    if(!locationUpdate) {
        throw new HttpException(generateErrorResponse("Gagal", "notfound", `lokasi ${request.part_of} tidak ditemukan`), HttpStatus.NOT_FOUND);
    }
    await sequelizeInstance.transaction(async (tr) => {
      request.part_of = null;
      const affected = await PartOfLocationRepository.update({ ...locationUpdate, ...request }, tr);
      if (affected !== 1) {
        throw new HttpException(generateErrorResponse("Gagal", "internal server error", "gagal memperbarui part of lokasi"), HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
    return generateSuccessResponse("Berhasil memperbarui part of lokasi");
  }

  static async delete(request){
    ZodValidator.validate(GlobalValidation.UUID_FASKES_UUID, request);
    const partOfLokasi = await PartOfLocationRepository.findByUuid({uuid: request.uuid, faskes_uuid: request.faskes_uuid}, PartOfLocationModel);
    if(!partOfLokasi){
      throw new HttpException(
        generateErrorResponse("Gagal", "notfound", `lokasi dengan uuid ${request.uuid} tidak ditemukan`), HttpStatus.NOT_FOUND
      )
    }
    await sequelizeInstance.transaction(async tr => {
      await PartOfLocationRepository.delete(partOfLokasi, PartOfLocationModel, tr);
    });
    return generateSuccessResponse(`Berhasil menghapus lokasi ${partOfLokasi.name}`);
  }
}
