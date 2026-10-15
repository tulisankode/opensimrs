import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";

const pemeriksaanMataSchema = new Schema({
    gambar_oftalmologis: {
        type: String,
    },
    gambar_anterior: {
        type: String,
    },
    ket_od: {
        type: String,
    },
    ket_os: {
        type: String,
    },
    gambar_posterior: {
        type: String,
    },
    od_visus_denominator: {
        type: Number,
    },
    od_visus_numerator: {
        type: Number,
    },
    od_pinhole_denominator: {
        type: Number,
    },
    od_pinhole_numerator: {
        type: Number,
    },
    od_hasil_pinhole: {
        type: String,
    },
    od_pupil_is_katarak: {
        type: Boolean,
    },
    od_snomed: {
        type: String,
    },
    snomed_uuid: {
        type: String,
    },
    od_fundus: {
        type: String,
    },
    od_shadow_test: {
        type: String,
    },
    od_sph_jauh: {
        type: Number,
    },
    od_cyl: {
        type: Number,
    },
    od_axis: {
        type: Number,
    },
    od_visus_tajam_denominator: {
        type: Number,
    },
    od_visus_tajam_numerator: {
        type: Number,
    },
    od_hasil_visus_tajam: {
        type: String,
    },
    od_pemeriksaan_lanjutan: {
        type: String,
    },
    od_sph_dekat: {
        type: Number,
    },
    od_glaukoma: {
        type: Number,
    },
    od_hasil_glaukoma: {
        type: String,
    },
    od_is_retinopati: {
        type: Boolean,
    },
    os_visus_denominator: {
        type: Number,
    },
    os_visus_numerator: {
        type: Number,
    },
    os_pinhole_denominator: {
        type: Number,
    },
    os_pinhole_numerator: {
        type: Number,
    },
    os_hasil_pinhole: {
        type: String,
    },
    os_pupil_is_katarak: {
        type: Boolean,
    },
    os_snomed: {
        type: String,
    },
    os_snomed_uuid: {
        type: String,
    },
    os_fundus: {
        type: String,
    },
    os_shadow_test: {
        type: String,
    },
    os_sph_jauh: {
        type: Number,
    },
    os_cyl: {
        type: Number,
    },
    os_axis: {
        type: Number,
    },
    os_visus_tajam_denominator: {
        type: Number,
    },
    os_visus_tajam_numerator: {
        type: Number,
    },
    os_hasil_visus_tajam: {
        type: String,
    },
    os_pemeriksaan_lanjutan: {
        type: String,
    },
    os_sph_dekat: {
        type: Number,
    },
    os_glaukoma: {
        type: Number,
    },
    os_hasil_glaukoma: {
        type: String,
    },
    os_is_retinopati: {
        type: Boolean,
    },
    temuan_lainnya: {
        type: String,
    },
    petugas : {
        type: String,
        required: true,
    }
})

pemeriksaanMataSchema.add(baseSchema)

export default pemeriksaanMataSchema;