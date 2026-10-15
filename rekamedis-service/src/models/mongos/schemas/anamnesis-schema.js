import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";

const anamnesisSchema = new Schema({
    anamnesis : {
        type: String,
    },
    keluhan_utama : {
        type: String,
    },
    riwayat_penyakit : {
        type: String,
    },
    riwayat_pengobatan : {
        type: String,
    },
    pernah_dirawat : {
        type: Boolean,
    },
    riwayat_keluarga : {
        type: String,
    },
    catatan : {
        type: String,
    },
    petugas : {
        type: String,
        required: true,
    }
})

anamnesisSchema.add(baseSchema)

export default anamnesisSchema;