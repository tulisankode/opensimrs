import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";

const triaseSchema = new Schema({
    kasus : {
        type: String,
    },
    eye : {
        type: Number,
    },
    verbal : {
        type: Number,
    },
    keadaan_umum : {
        type: String,
    },
    asal_rujukan : {
        type: String,
    },
    motorik : {
        type: Number,
    },
    gcs_score : {
        type: Number,
    },
    gcs_kesimpulan : {
        type: String,
    },
    tekanan_darah_sistole : {
        type: Number,
    },
    tekanan_darah_diastole : {
        type: Number,
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
    kesimpulan_triase : {
        type: String,
    },
    petugas : {
        type: String,
        required: true,
    },
    warna_triase : {
        type: String,
    },
    cara_datang : {
        type: String,
    },
    kendaraan : {
        type: String,
    },
})

triaseSchema.add(baseSchema)

export default triaseSchema;
