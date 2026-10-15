import {
    fileFortmatRequired,
    fileTypeRequired,
    rekamMedisUuidRequired,
    required
} from "./message-validation-error.js";
import { z } from "zod";

export default class FileValidation {
    static UPDATE = z.object({
        file_uuid : z.string().min(1, required),
        file : z.string().min(1, required)
    });

    static UPLOAD = z.object({
        faskes_uuid: z.string().min(1, required),
        rekam_medis_uuid: z.string().min(1, rekamMedisUuidRequired),
        // file : z.string().min(1, required),
        file_type : z.string().min(1, fileTypeRequired),
        file_format : z.string().min(1, fileFortmatRequired),
        admission_type : z.string().min(1, required),
        nama_file : z.string().optional(),
        token: z.string().optional(),
    })

    static UPLOAD_MULTI = z.array(this.UPLOAD);

    static NOMOR_SURAT = z.object({
        nomor_surat: z.string().min(1, required),
    })

    static GENERATE_CODE = z.object({
        faskes_uuid: z.string().min(1, required),
        file_type: z.string().min(1, fileTypeRequired),
    })
}