import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";

const anamnesaIgdSchema = new Schema({
    keluhan_utama : {
        type: String,
    },
    jenis_kasus : {
        type: String,
    },
    cara_datang : {
        type: String,
    },
    kendaraan : {
        type: String,
    },
    keadaan_umum : {
        type: String,
    },
    asal_rujukan : {
        type: String,
    },
    petugas : {
        type: String,
        required: true,
    }
})

anamnesaIgdSchema.add(baseSchema)

export default anamnesaIgdSchema;
