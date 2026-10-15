import FileRepository from "../repositories/file-repository.js";
import ZodValidator from "../validations/zod-validator.js";
import FileValidation from "../validations/file-validation.js";
import NotfoundException from "../errors/notfound-exception.js";
import { z } from "zod";
import Utils from "../helpers/utils.js";
import PelayananService from "./pelayanan-service.js";
import FaskesRepository from "../repositories/faskes-repository.js";
import moment from "moment";


export default class FileService {
    static async getAll(rekamMedisUuid) {
        ZodValidator.validate(z.string().min(1, "rekam_medis_uuid tidak boleh kosong"), rekamMedisUuid);

        const files = await FileRepository.getAllByRekamMedisUuid(rekamMedisUuid);
        // if (files == null || files.length === 0) {
        //     throw new NotfoundException("File tidak ditemukan");
        // }

        return files;
    }

    static async upload(request) {
        console.log("service upload request:",request);
        try {

            if (Array.isArray(request)) {
                const payloads = request;
                let createdFiles;

                console.log("Uploading multiple files:", payloads);
                ZodValidator.validate(FileValidation.UPLOAD_MULTI, payloads);
                console.log("Validated multiple file upload payloads.", payloads);
                
                // validasi & buat rawat inap dari SPRI lebih dulu: bila gagal, surat tidak ikut tersimpan
                for (const p of payloads) {
                    if (p.file_type !== "berkas") {
                        ZodValidator.validate(FileValidation.NOMOR_SURAT, p);
                    }
                    
                    if (p.file_type === "surat_permohonan_rawat_inap") {
                        console.log("Creating rawat inap from srpi for payload:", p);
                        const rawatInap = await PelayananService.createRiFromSrpi(p);
                        if (!rawatInap) {
                            throw new Error("Gagal membuat rawat inap dari surat permohonan rawat inap");
                        }
                    }
                }

                createdFiles = await FileRepository.create(payloads);
                
                return createdFiles;
            }
            
            if (request.file_type !== "berkas") {
                ZodValidator.validate(FileValidation.NOMOR_SURAT, request);
            }

            if (request.file_type === "surat_permohonan_rawat_inap") {
                await PelayananService.createRiFromSrpi(request);
            }
            
            return await FileRepository.create(request);

        } catch (error) {
            console.log("Error in FileService.upload:", error);
            throw error;
        }
    }

    static async delete(uuid) {
        ZodValidator.validate(z.string().min(1), uuid);

        const affectedRow = await FileRepository.deleteByUuid(uuid);
        if (affectedRow === 0) {
            throw new NotfoundException("File tidak ditemukan");
        }

        return affectedRow;
    }

    static async update(request) {
        ZodValidator.validate(FileValidation.UPDATE, request);

        request.updatedAt = moment().unix();
        const affectedRow = await FileRepository.updateByUuid(request);
        if (affectedRow === 0) {
            throw new NotfoundException("File tidak ditemukan");
        }

        return affectedRow;
    }

    static async getLetters(rekamMedisUuid) {
        ZodValidator.validate(z.string().min(1, "rekam_medis_uuid tidak boleh kosong"), rekamMedisUuid);

        const files = await FileRepository.getLetters(rekamMedisUuid);
        // if (files == null || files.length === 0) {
        //     throw new NotfoundException("File tidak ditemukan");
        // }

        return files;
    }

    static async downloadLetter(uuid) {
        const file = await FileRepository.downloadLetter(uuid);
        if (file == null) {
            throw new NotfoundException("File tidak ditemukan");
        }
        return file;
    }

    static async generateCode(request) {
        ZodValidator.validate(FileValidation.GENERATE_CODE, request);

        let fileTypeKey;
        let orderCode;
        let provinceCode;
        let districtCode;
        let monthCode;
        let faskesCode;
        let yearCode;

        fileTypeKey = await Utils.generateCodeFileType(request.file_type);
        const lastLetter = await FileRepository.getLastLetterByType(request.faskes_uuid, request.file_type);

        if (lastLetter == null) {
            orderCode = "001";
        } else {
            orderCode = (parseInt(lastLetter.dataValues.nomor_surat.slice(-3)) + 1).toString().padStart(3, "0");
        }

        const faskes = await FaskesRepository.getByUuid(request.faskes_uuid);
        if (faskes == null) {
            throw new NotfoundException("Faskes tidak ditemukan");
        } else {
            faskesCode = faskes.dataValues.code;
        }

        const now = new Date();
        monthCode = (now.getMonth() + 1).toString().padStart(2, "0");
        yearCode = now.getFullYear().toString().slice(-2);

        const faskesProfile = await FaskesRepository.getProfile(request.faskes_uuid);
        if (faskesProfile == null) {
            throw new NotfoundException("Profile Faskes tidak ditemukan");
        } else {
            provinceCode = faskesProfile.dataValues.codeProvinsi;
            districtCode = faskesProfile.dataValues.codeKabupaten;
        }

        return {
            "data" : `${provinceCode}${districtCode}${faskesCode}${monthCode}${yearCode}${fileTypeKey}${orderCode}`
        };
    }
}