import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { PartOfOrganizationRepository } from "../repositories/part-of-organization-repository.js";
import ZodValidator from "../validations/validator.js";
import { PartOfOrganizationValidation } from "../validations/part-of-organization-validation.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import { GlobalValidation } from "../validations/global-validation.js";
import { OrganizationModel, PartOfOrganizationModel } from "@opensimrs/model-sdk/datamaster";
import OrganizationRepository from "../repositories/organization-repository.js";
import FaskesRepository from "../repositories/faskes-repository.js";
import { findPartOf, validateAddress } from "../helpers/helper.js";
import { uuidv7 } from "uuidv7";
import { AddressRepository } from "../repositories/address-repository.js";

export class PartOfOrganizationService {


  static async create(request) {
    const faskes = await FaskesRepository.findByUuid(request.faskes_uuid);
    request.organization_ihs_number = faskes.organization_ihs_number;
    ZodValidator.validate(PartOfOrganizationValidation.CREATE, request);
    await validateAddress({
      province_code: request.address.prov,
      distric_code: request.address.city,
      sub_distric_code: request.address.district,
      village_code: request.address.village,
    });
    let partOfValid = await OrganizationRepository.findByUuid(request.part_of, request.faskes_uuid);
    if (!partOfValid) {
      partOfValid = await PartOfOrganizationRepository.findByUuid(request.faskes_uuid, request.part_of);
      if (!partOfValid) {
        throw new HttpException(generateErrorResponse("Gagal", "notfound", "part_of tidak ditemukan"), HttpStatus.NOT_FOUND);
      }
      request.part_of_name = partOfValid.name;
    }
    await sequelizeInstance.transaction(async (tr) => {
      request.part_of = null;
      const address_uuid = uuidv7();
      const address = {
        uuid: address_uuid,
        faskesUuid: request.faskes_uuid,
        fullAddress: request.address.full_address,
        prov: request.address.prov,
        city: request.address.city,
        district: request.address.district,
        rt: request.address.rt,
        rw: request.address.rw,
        village: request.address.village,
        postalCode: request.address.postal_code,
        country: request.address.country,
      };
      request.address_uuid = address_uuid;
      request.part_of_name = partOfValid.name;
      await Promise.all([PartOfOrganizationRepository.save(request, tr), AddressRepository.save(address, tr)]);
    });
    return generateSuccessResponse("Berhasil membuat part of organisasi");
  }


  static async update(request) {
    ZodValidator.validate(PartOfOrganizationValidation.UPDATE, request);
    await validateAddress({
      province_code: request.address.prov,
      distric_code: request.address.city,
      sub_distric_code: request.address.district,
      village_code: request.address.village,
    });
    const organization = await PartOfOrganizationRepository.findByUuidIncludeAddress({faskes_uuid: request.faskes_uuid, uuid: request.uuid});
    if(!organization){
      throw new HttpException(
        generateErrorResponse("Gagal", "notfound", `uuid ${request.uuid} tidak ditemukan`), HttpStatus.NOT_FOUND
      )
    }
    const partOf = await findPartOf({faskes_uuid: request.faskes_uuid, uuid: request.part_of}, OrganizationModel);
    await sequelizeInstance.transaction(async (tr) => {
      const address = organization.address;
      const addressUpdated = {
        uuid: address.uuid,
        faskesUuid: request.faskes_uuid,
        fullAddress: request.address.full_address ?? address.fullAddress,
        prov: request.address.prov ?? address.prov,
        city: request.address.city ?? address.city,
        district: request.address.district ?? address.district,
        rt: request.address.rt ?? address.rt,
        rw: request.address.rw ?? address.rw,
        village: request.address.village ?? address.village,
        postalCode: request.address.postal_code ?? address.postalCode,
        country: request.address.country ?? address.country,
      };
      request.address_uuid = address.uuid;
      request.part_of_name = partOf.name;
      const [affected1, affected2] = await Promise.all([
        PartOfOrganizationRepository.update({ ...organization, ...request }, tr),
        AddressRepository.update(addressUpdated, tr)
      ]);
      if (affected1 !== 1 || affected2 !== 1) {
        throw new HttpException(generateErrorResponse("Gagal", "internal server error", "gagal memperbarui organisasi"), HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
    return generateSuccessResponse(`Berhasil memperbarui part of organisasi`);
  }

  static async delete(request) {
    ZodValidator.validate(GlobalValidation.UUID_FASKES_UUID, request);
    const isExist = await PartOfOrganizationRepository.findByUuidIncludeAddress({faskes_uuid: request.faskes_uuid, uuid: request.uuid});
    if (!isExist) {
      throw new HttpException(generateErrorResponse("Gagal", "notfound", `uuid ${request.uuid} tidak ditemukan`), HttpStatus.NOT_FOUND);
    }
    await sequelizeInstance.transaction(async (tr) => {
      const [affected1, affected2] = await Promise.all([
        PartOfOrganizationRepository.delete(isExist, PartOfOrganizationModel, tr),
        AddressRepository.deleteByUuid(isExist.address, tr)
      ]);
      if (affected1 !== 1 || affected2 !== 1) {
        throw new HttpException(generateErrorResponse("Gagal", "internal server error", "Gagal menghapus part of organisasi"), HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
    return generateSuccessResponse("Berhasil menghapus part of organisasi");
  }
}
