import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";


const odontogramItemSchema = new Schema({
    gigi_uuid: {
        type: String,
        required: true,
    },
    no_gigi : {
        type: Number,
        required: true,
    },
    keadaan_gigi: {
        type: Array,
        required: true,
    },
    gambar_odontogram: {
        type: String,
        required: true,
    }
})

const pemeriksaanGigiSchema = new Schema({
    odontogram_items : [odontogramItemSchema],
    oklusi_gigi_uuid: {
        type: String,
    },
    torus_palatinus: {
        type: String,
    },
    torus_mandibularis: {
        type: String,
    },
    palatum: {
        type: String,
    },
    diastema: {
        type: Boolean,
    },
    diastema_ket: {
        type: String,
    },
    gigi_anomali: {
        type: Boolean,
    },
    gigi_anomali_ket: {
        type: String,
    },
    frenulum_labialis: {
        type: String,
    },
    frenulum_lingualis: {
        type: String,
    },
    gigi_decayed: {
        type: Number,
    },
    gigi_missing: {
        type: Number,
    },
    gigi_filled: {
        type: Number,
    },
    temuan_lain: {
        type: String,
    },
    ket_tindakan_gigi: {
        type: String,
    },
    petugas: {
        type: String,
        required: true,
    }
});

pemeriksaanGigiSchema.add(baseSchema)

export default pemeriksaanGigiSchema;

