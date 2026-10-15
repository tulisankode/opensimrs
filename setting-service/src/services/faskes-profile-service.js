import ZodValidator from "../validations/zod-validator.js";
import FaskesProfileValidation from "../validations/faskes-profile-validation.js";
import FaskesProfileRepository from "../repositories/faskes-profile-repository.js";
import NotfoundException from "../errors/notfound-exception.js";
import {toEpochDate} from "../helpers/date-helper.js";
import FaskesRepository from "../repositories/faskes-repository.js";
import {uuidv7} from "uuidv7";
import AddressRepository from "../repositories/address-repository.js";
import Utils from "../helpers/utils.js";
import BadRequestException from "../errors/bad-request-exception.js";

export default class FaskesProfileService {
    static async findByFaskesUuid(uuid) {
        const faskes = await FaskesRepository.findByUuid(uuid);
        if (faskes === null) throw new NotfoundException('faskes tidak ditemukan');


        let profile = await FaskesProfileRepository.getByFaskesUuid(uuid);
        if (profile === null) {
            profile = await FaskesProfileRepository.create({
                faskesUuid: uuid,
                code: faskes.dataValues.code,
                name: faskes.dataValues.name,
                addressUuid: uuidv7(),
                phone: "",
                email: "",
                website: "",
                urlGmaps: ""
            });
        }

        const address = await AddressRepository.getOrCreateBy({uuid: profile.dataValues.addressUuid, faskesUuid: uuid});
        return {
            ...Utils.camelToSnakeObject(profile.dataValues),
            address: {
                uuid: address[0].dataValues.uuid,
                prov: address[0].dataValues.prov,
                city: address[0].dataValues.city,
                district: address[0].dataValues.district,
                village: address[0].dataValues.village,
                postal_code: address[0].dataValues.postal_code ?? address[0].dataValues.postalCode,
                full_address : address[0].dataValues. full_address ?? address[0].dataValues.fullAddress
            }
        };
    }

    static async update(req) {
        const validData = ZodValidator.validate(FaskesProfileValidation.UPDATE, Utils.snakeToCamelObject(req));
        validData.updatedAt = toEpochDate(new Date());
        validData.address = {
            uuid: validData.addressUuid,
            prov: validData.prov,
            city: validData.city,
            district: validData.district,
            village: validData.village,
            postal_code: validData.postalCode,
            full_address: validData.fullAddress
        };
        validData.address = Utils.snakeToCamelObject(validData.address);
        const affectedRow = await FaskesProfileRepository.update(validData);
        if (affectedRow === 0) throw new NotfoundException('gagal mengupdate faskes profile, data tidak ditemukan');
        return {message: `berhasil mengupdate ${affectedRow} faskes profile`};
    }

    static async updatePPN(req) {
        const validData = ZodValidator.validate(FaskesProfileValidation.UPDATE_PPN, Utils.snakeToCamelObject(req));
        if (validData.statusPpn === false) {
            validData.valuePpn = 0;
        } else {
            if (req.value_ppn === undefined) {
                throw new BadRequestException('value ppn tidak boleh kosong');
            } else {
                validData.valuePpn = req.value_ppn;
            }
        }
        validData.updatedAt = toEpochDate(new Date());
        const affectedRow = await FaskesProfileRepository.update(validData);
        if (affectedRow === 0) throw new NotfoundException('gagal mengupdate ppn, data tidak ditemukan');
        return {message: `berhasil mengupdate ppn`};
    }

    static async updateBiayaAdministrasi(req) {
        const validData = ZodValidator.validate(FaskesProfileValidation.UPDATE_BIAYA_ADMINISTRASI, Utils.snakeToCamelObject(req));
        if (validData.statusBiayaLain === false) {
            validData.valueBiayaLain = 0;
        } else {
            if (req.value_biaya_lain === undefined) {
                throw new BadRequestException('value biaya lain tidak boleh kosong');
            } else {
                validData.valueBiayaLain = req.value_biaya_lain;
            }
        }
        validData.updatedAt = toEpochDate(new Date());
        const affectedRow = await FaskesProfileRepository.update(validData);
        if (affectedRow === 0) throw new NotfoundException('gagal mengupdate biaya lain, data tidak ditemukan');
        return {message: `berhasil mengupdate biaya lain`};
    }

    static async findPPN(uuid) {
        const faskes = await FaskesRepository.findByUuid(uuid);
        if(faskes === null) throw new NotfoundException('faskes tidak ditemukan');

        let data = await FaskesProfileRepository.findPPN(uuid);

        return Utils.camelToSnakeObject(data.dataValues);
    }

    static async findBiayaAdministrasi(uuid) {
        const faskes = await FaskesRepository.findByUuid(uuid);
        if(faskes === null) throw new NotfoundException('faskes tidak ditemukan');

        let data = await FaskesProfileRepository.findBiayaAdministrasi(uuid);

        return Utils.camelToSnakeObject(data.dataValues);
    }

    static async findProfileByFaskesUuid(request){
        ZodValidator.validate(FaskesProfileValidation.GET_PROFILE_FASKES, {faskesUuid: request});
        const profile = await FaskesProfileRepository.findProfileByUuid(request);
        if(!profile){
            throw new NotfoundException("profile faskes tidak ditemukan")
        }
        return {
            message: "Berhasil menmabpilkan profile faskes",
            payload: profile
        }
    }

    static async findAllFaskesProfileIncludeAddress(page, pageSize, orderBy, search){
        const result = await FaskesProfileRepository.findAllProfileFaskesIncludeAddress(page, pageSize, orderBy, search);
        return {
            message: "Berhasil menampilkan semua profile faskes",
            payload: result.data,
            properties: result.properties
        }
    }
}