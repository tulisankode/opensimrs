import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";

const petugasSchema = new Schema({
    nama: {
        type: String,
        required: true,
    },
    is_doctor: {
        type: Boolean,
        required: true,
    },
    practitioner_uuid: {
        type: String,
        required: true,
    }
})

const pemeriksaanTindakanSchema = new Schema({
    tarif_uuid: {
        type: String,
        required: true,
    },
    nama_tindakan: {
        type: String,
        required: true,
    },
    harga_tindakan: {
        type: Number,
        required: true,
    },
    qty_tindakan: {
        type: Number,
        required: true,
    },
    is_mcu: {
        type: Boolean,
        required: true,
    },
    lab_order_uuid: {
        type: String,
    },
    petugas_input: {
        type: String,
        required: true,
    },
    petugas: [petugasSchema],

})
pemeriksaanTindakanSchema.add(baseSchema)

export default pemeriksaanTindakanSchema;