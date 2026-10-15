import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";

const antropometriSchema = new Schema({
    lingkar_perut : {
        type: Number,
    },
    berat_badan : {
        type: Number,
    },
    tinggi_badan : {
        type: Number,
    },
    imt : {
        type: Number,
    },
    catatan : {
        type: String,
    },
    petugas : {
        type: String,
        required: true,
    }
});

antropometriSchema.add(baseSchema)

export default antropometriSchema;