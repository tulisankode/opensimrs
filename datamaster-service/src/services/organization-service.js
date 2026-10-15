import ValidationException from "../errors/validation-exception.js";
import OrganizationRepository from "../repositories/organization-repository.js";
import OrganizationValidation from "../validations/organization-validation.js";
import ZodValidator from "../validations/validator.js";
import successResponse from "../response/result-response.js";
import { messageSuccessShow } from "../validations/message-validation-error.js";
import ProvinceService from "./province-service.js";
import KabupatenService from "./kabupaten-service.js";
import KecamatanService from "./kecamatan-service.js";
import { isThereDuplicate, parseExcel, validateAddress } from "../helpers/helper.js";
import { uuidv7 } from "uuidv7";
import { AddressRepository } from "../repositories/address-repository.js";
import { generateErrorResponse, generateSuccessResponse } from "../helpers/generate-message.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import KelurahanRepository from "../repositories/kelurahan-repository.js";
import { PartOfOrganizationRepository } from "../repositories/part-of-organization-repository.js";
import { OrganizationModel, PartOfOrganizationModel } from "@opensimrs/model-sdk/datamaster";
import { GlobalValidation } from "../validations/global-validation.js";
import FaskesRepository from "../repositories/faskes-repository.js";
import { PartOfOrganizationService } from "./part-of-organization-service.js";

export default class OrganizationService {
  static async findAllPartOf(request) {
    const { data, properties } = await PartOfOrganizationRepository.findAll(request);
    return generateSuccessResponse("Berhasil menampilkan semua data part of organization", data, properties);
  }
  

  static async findAllIncludePrartOf(request){
    const {data, properties} = await OrganizationRepository.findAllIncludePartOf(request);
    return generateSuccessResponse("Berhasil menampilkan semua organisasi", data, properties);
  }

  static async create(data) {
    const faskes = await FaskesRepository.findByUuid(data.faskes_uuid);
    data.organization_ihs_number = faskes.organization_ihs_number;
    ZodValidator.validate(OrganizationValidation.CREATE, data);
    await validateAddress({
      province_code: data.address.prov,
      distric_code: data.address.city,
      sub_distric_code: data.address.district,
      village_code: data.address.village,
    });
    if(data.part_of_uuid){
      const partOf = await OrganizationRepository.findByUuid(data.part_of_uuid, data.faskes_uuid);
      if(!partOf) {
        throw new HttpException(generateErrorResponse("Gagal", "notfound", `part_of_uuid ${data.part_of_uuid} tidak ditemukan`), HttpStatus.NOT_FOUND)
      }
      data.part_of = partOf.satu_sehat_id;
    }
    await sequelizeInstance.transaction(async (tr) => {
      const address_uuid = uuidv7();
      const address = {
        uuid: address_uuid,
        faskesUuid: data.faskes_uuid,
        prov: data.address.prov,
        city: data.address.city,
        district: data.address.district,
        rt: data.address.rt,
        rw: data.address.rw,
        village: data.address.village,
        postalCode: data.address.postal_code,
        country: data.address.country,
        fullAddress: data.address.full_address
      }
      data.address_uuid = address_uuid;
      await Promise.all([
        OrganizationRepository.save(data, tr),
        AddressRepository.save(address, tr)
      ])
    });
    return generateSuccessResponse(`Berhasil menambahkan organisasi ${data.name}`);
  }

  static async exportOrganization(faskes_uuid) {
    const result = await OrganizationRepository.exportOrganization(faskes_uuid);
    return generateSuccessResponse("Berhasil export organisasi", result);
  }

  static async importOrganization(faskesUuid, filePath) {
    const data = await parseExcel(filePath);
    const organizationList = new Array();
    data.eachRow((row, index) => {
      if (index == 1) return;
      organizationList.push({
        uuid: uuidv7(),
        faskes_uuid: faskesUuid,
        organization_ihs_number: row.values[2].toString(),
        code: row.values[3] !== undefined ? row.values[3].toString() : null,
        name: row.values[4],
        phone: row.values[5],
        email: row.values[6].text == undefined ? row.values[6] : row.values[6].text,
        url: row.values[7].text !== undefined ? row.values[7].text : row.values[7],
        province: row.values[8],
        kabupaten: row.values[9],
        kecamatan: row.values[10],
        keluarahan: row.values[11],
        kode_pos: row.values[12] === undefined ? null : row.values[12].toString(),
        alamat: row.values[13],
        part_of_name: row.values[14],
        status: true,
      });
    });
    ZodValidator.validate(OrganizationValidation.IMPORT, organizationList);
    isThereDuplicate(organizationList.map((o) => {if (o.code) return o.code.toLowerCase()}).filter((d) => d !== undefined), "code");
    const provinceNameList = [];
    const kabupatenNameList = [];
    const kecamatanNameList = [];
    const addressList = [];
    const vilageNameList = [];
    organizationList.forEach((o) => {
      if (!provinceNameList.includes(o.province)) provinceNameList.push(o.province);
      if (!kabupatenNameList.includes(o.kabupaten)) kabupatenNameList.push(o.kabupaten);
      if (!kecamatanNameList.includes(o.kecamatan)) kecamatanNameList.push(o.kecamatan);
      if (!vilageNameList.includes(o.keluarahan)) vilageNameList.push(o.keluarahan);
      return;
    });
    const [kabupatenList, kecamatanList, provinceList, keluarahanList] = await Promise.all([
      KabupatenService.findAllByNameIn(kabupatenNameList),
      KecamatanService.findAllByNameIn(kecamatanNameList),
      ProvinceService.findAllByNameIn(provinceNameList),
      KelurahanRepository.findAllByNameIn(vilageNameList),
    ]);

    const pNameList = provinceList.map((p) => p.name.toLowerCase());
    provinceNameList.forEach((p) => {
      if (!pNameList.includes(p.toLowerCase())) {
        throw new HttpException(generateErrorResponse("Gagal", "bad request", `provinsi ${p} tidak ada dalam sistem`), HttpStatus.BAD_REQUEST);
      }
    });
    const kNameList = kabupatenList.map((k) => k.name.toLowerCase().replace(/kota|kab.?/gi, "").replace(/\s+/g, "").trim());
    kabupatenNameList.forEach((kb) => {
      kNameList.forEach(k => {
        console.log(k, kb)
        if(!k.includes(kb.toLowerCase().replace(/kota|kab.?/gi, "").replace(/\s+/g, "").trim())) {
          throw new HttpException(generateErrorResponse("Gagal", "bad request", `kabupaten/kota ${kb} tidak ada dalam sistem`), HttpStatus.BAD_REQUEST);
        }
      })
    });

    const kcNameList = kecamatanList.map((kcm) => kcm.name.toLowerCase());
    const kcCodeList = kecamatanList.map((kcm) => kcm.code);
    const kbCodeList = kabupatenList.map((kb) => kb.code);
    kecamatanNameList.forEach((kl) => {
      if (!kcNameList.includes(kl.toLowerCase())) {
        kcCodeList.forEach((kc) => {
          if (!kbCodeList.includes(kc)) {
            throw new HttpException(generateErrorResponse("Gagal", "bad request", `kecamatan ${kl} belum ada dalam sistem`));
          }
        });
      }
    });

    organizationList.forEach((o, index) => {
      const addressUuid = uuidv7();
      const province = provinceList.find((p) => p.name.toLowerCase().includes(o.province.toLowerCase()));
      const kabupaten = kabupatenList.find((k) => k.name.toLowerCase().includes(o.kabupaten.toLowerCase()));
      const kecamatan = kecamatanList.find((k) => {
        if (k.name.toLowerCase().includes(o.kecamatan.toLowerCase()) && k.kabupaten_code == kabupaten.code) return k;
        else return;
      });
      const kelurahan = keluarahanList.find((k) => {
        if (k.kecamatan_code == kecamatan.code && k.name.toLowerCase().includes(o.keluarahan.toLowerCase())) {
          return k;
        } else return;
      });

      organizationList[index].address_uuid = addressUuid;
      addressList.push({
        uuid: addressUuid,
        faskesUuid: faskesUuid,
        fullAddress: o.alamat,
        prov: province.code,
        district: kecamatan.code,
        city: kabupaten.code,
        village: kelurahan.code,
        postalCode: o.kode_pos,
        country: "id-ID",
      });
      delete organizationList[index].province;
      delete organizationList[index].kabupaten;
      delete organizationList[index].kecamatan;
    });

    organizationList.forEach((org, index) => {
      if(org.part_of_name){
        const partOf = organizationList.find(o => o.name == org.part_of_name);
        if(!partOf) {
          throw new HttpException(generateErrorResponse("Gagal", "notfound", `part of ${org.name} tidak diketahui`), HttpStatus.NOT_FOUND);
        }
        organizationList[index].part_of_uuid = partOf.uuid
      }
    })

    await sequelizeInstance.transaction(async (tr) => {
      await Promise.all([
        OrganizationRepository.saveAll(organizationList, tr), 
        AddressRepository.saveAll(addressList, tr)
      ]);
    });
    return generateSuccessResponse("Berhasil import organization");
  }

  static async updateOrganization(request) {
    ZodValidator.validate(OrganizationValidation.UPDATE, request);
    await validateAddress({
      province_code: request.address.prov,
      distric_code: request.address.city,
      sub_distric_code: request.address.district,
      village_code: request.address.village
    });
    const organization = await OrganizationRepository.findByUuidIncludeAddress({faskes_uuid: request.faskes_uuid, uuid: request.uuid});
    if(!organization) return await PartOfOrganizationService.create(request);

    if(request.part_of_uuid){
      const partOf = await OrganizationRepository.findByUuid(request.part_of_uuid, request.faskes_uuid);
      if(!partOf){
        throw new HttpException(generateErrorResponse("Gagal", "notfound", `part_of_uuid ${request.part_of_uuid} tidak ditemukan`), HttpStatus.NOT_FOUND)
      }
      request.part_of_uuid = partOf.uuid;
    }

    const address = organization.address;
    const addressUpdated = {
      uuid: address.uuid,
      faskesUuid: request.faskes_uuid,
      fullAddress: request.address.full_address ?? address.fullAddress,
      prov: request.address.prov ?? address.prov,
      city: request.address.city ?? address.city,
      district: request.address.district ?? address.district,
      rt: request.address.rt ?? address.rt,
      rw: request.address.rw?? address.rw,
      village: request.address.village ?? address.village,
      postalCode: request.address.postal_code ?? address.postalCode,
      country: request.address.country ?? address.country,
    }
    await sequelizeInstance.transaction(async tr => {
      const [affected1, affedted2] = await Promise.all([
        OrganizationRepository.update({...organization, ...request}, tr),
        AddressRepository.update(addressUpdated, tr)
      ]);
      if(affected1 !== 1 && affedted2 !== 1) {
        throw new HttpException(
          generateErrorResponse("Gagal", "internal server error", "gagal memperbarui organisasi"), HttpStatus.INTERNAL_SERVER_ERROR
        )
      }
    });
    return generateSuccessResponse("Berhasil memperbarui organisasi");
  }

  static async getAllOrganization(name, page, pageSize, order_by, faskesUuid) {
    const {organizationList, paginationInfo} = await OrganizationRepository.getAllOrganization(name, page, pageSize, order_by, faskesUuid);
    return generateSuccessResponse("Berhasil menampilkan semua data organization", organizationList, paginationInfo);
  }

  static async getAllOrganizationAktif(faskes_uuid) {
    const result = await OrganizationRepository.getAllOrganizationAktif(faskes_uuid);
    return successResponse(messageSuccessShow, result);
  }

  static async getOrganizationById(request) {
    ZodValidator.validate(OrganizationValidation.FIND_BY_UUID, request);
    const organization = await OrganizationRepository.findByUuid(request.uuid, request.faskes_uuid);
    if (!organization) {
      throw new HttpException(generateErrorResponse("Gagal", "notfound", `organisasi dengan uuid ${request.uuid} tidak ditemukan`), HttpStatus.NOT_FOUND);
    }
    return generateSuccessResponse("Berhasil menampilkan organization", organization ?? {});
  }

  static async deleteOrganization(request) {
    ZodValidator.validate(GlobalValidation.UUID_FASKES_UUID, request);
    let org;
    org = await OrganizationRepository.findByUuid(request.uuid, request.faskes_uuid);
    if(org){
      await sequelizeInstance.transaction(async (tr) => {
        await OrganizationRepository.delete(org, OrganizationModel, tr);
      });
      return generateSuccessResponse(`Berhasil menghapus organisasi ${org.name}`);
    }else {
      org = await PartOfOrganizationRepository.findByUuid(request.faskes_uuid, request.uuid);
      if(org){
        await PartOfOrganizationRepository.delete(request)
        return generateSuccessResponse(`Berhasil menghapus organisasi ${org.name}`);
      }else{
        throw new HttpException(generateErrorResponse("Gagal", "notfound", `organisasi dengan uuid ${request.uuid} tidak ditemukan`), HttpStatus.NOT_FOUND);
      }
    }
  }
}
