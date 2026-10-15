import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";

const alergiSchema = new Schema({
    is_alergi: {
        type: Boolean,
    },
    pemicu_alergi: {
        type: String,
    },
    nama_alergi: {
        type: String,
    },
    reaksi_alergi: {
        type: String,
    },
    tingkat_keparahan_alergi: {
        type: String,
    },
    efek_samping_alergi: {
        type: String,
    },
    tanggal_kejadian_alergi: {
        type: Number,
    },
    petugas: {
        type: String,
        required: true,
    }
});

alergiSchema.add(baseSchema)

export default alergiSchema;

