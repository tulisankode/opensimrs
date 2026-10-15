import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";

const tandaVitalSchema = new Schema({
    kriteria_pemantauan : {
        type: String,
    },
    frekuensi_nafas : {
        type: Number,
    },
    frekuensi_nadi : {
        type: Number,
    },
    suhu : {
        type: Number,
    },
    crt : {
        type: Boolean,
    },
    blood_oxygen : {
        type: Number,
    },
    gula_darah : {
        type: Number,
    },
    oksigen_tambahan : {
        type: Boolean,
    },
    waktu_asesmen : {
        type : Number
    },
    respirasi_anak : {
        type : String
    },
    kardiovaskuler_anak : {
        type : String
    },
    keadaan_umum : {
        type : String
    },
    petugas : {
        type: String,
        required: true,
    },
    tekanan_darah_sistole : {
        type: Number,
    },
    tekanan_darah_diastole : {
        type: Number,
    },

})

tandaVitalSchema.add(baseSchema)

export default tandaVitalSchema;