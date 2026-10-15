import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";
import ohisSchema from "./ohis-schema.js";

const pemeriksaanFisikSchema = new Schema({
    keadaan_umum : {
        type: String,
    },
    kepala : {
        type: Boolean,
    },
    ket_kepala : {
        type: String,
    },
    gambar_kepala : {
        type: String,
    },
    mata : {
        type: Boolean,
    },
    ket_mata : {
        type: String,
    },
    gambar_mata : {
        type: String,
    },
    telinga_kanan : {
        type: Boolean,
    },
    ket_telinga_kanan : {
        type: String,
    },
    gambar_telinga_kanan : {
        type : String,
    },
    telinga_kiri : {
        type: Boolean,
    },
    ket_telinga_kiri : {
        type: String,
    },
    gambar_telinga_kiri : {
        type : String,
    },
    rongga_mulut : {
        type: Boolean,
    },
    ket_rongga_mulut : {
        type: String,
    },
    gambar_rongga_mulut : {
        type: String,
    },
    hidung : {
        type: Boolean,
    },
    ket_hidung : {
        type: String,
    },
    gambar_hidung : {
        type: String,
    },
    tenggorokan : {
        type: Boolean,
    },
    ket_tenggorokan : {
        type: String,
    },
    gambar_tenggorokan : {
        type: String,
    },
    mulut : {
        type: Boolean,
    },
    ket_mulut : {
        type: String,
    },
    gambar_mulut : {
        type: String,
    },
    leher : {
        type: Boolean,
    },
    ket_leher : {
        type: String,
    },
    gambar_leher : {
        type: String,
    },
    leher_depan : {
        type: Boolean,
    },
    ket_leher_depan : {
        type: String,
    },
    gambar_leher_depan : {
        type: String,
    },
    dada : {
        type: Boolean,
    },
    ket_dada : {
        type: String,
    },
    gambar_dada : {
        type: String,
    },
    jantung : {
        type: Boolean,
    },
    ket_jantung : {
        type: String,
    },
    gambar_jantung : {
        type: String,
    },
    paru : {
        type: Boolean,
    },
    ket_paru : {
        type: String,
    },
    gambar_paru : {
        type: String,
    },
    abdomen : {
        type: Boolean,
    },
    ket_abdomen : {
        type: String,
    },
    gambar_abdomen : {
        type: String,
    },
    anus : {
        type: Boolean,
    },
    ket_anus : {
        type: String,
    },
    gambar_anus : {
        type: String,
    },
    urogenital : {
        type: Boolean,
    },
    ket_urogenital : {
        type: String,
    },
    gambar_urogenital : {
        type: String,
    },
    ekstermitas_atas : {
        type: Boolean,
    },
    ket_ekstermitas_atas : {
        type: String,
    },
    gambar_ekstermitas_atas : {
        type: String,
    },
    ekstermitas_bawah : {
        type: Boolean,
    },
    ket_ekstermitas_bawah : {
        type: String,
    },
    gambar_ekstermitas_bawah : {
        type: String,
    },
    muskuloskeletal : {
        type: Boolean,
    },
    ket_muskuloskeletal : {
        type: String,
    },
    gambar_muskuloskeletal : {
        type: String,
    },
    pemeriksaan_lainnya : {
        type: Boolean,
    },
    ket_pemeriksaan_lainnya : {
        type: String,
    },
    gambar_pemeriksaan_lainnya : {
        type: String,
    },
    ohis : ohisSchema,
    petugas : {
        type: String,
        required: true,
    }
})

pemeriksaanFisikSchema.add(baseSchema)

export default pemeriksaanFisikSchema;