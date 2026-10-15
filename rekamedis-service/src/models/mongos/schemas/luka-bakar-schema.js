import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";

const lukaBakarSchema = new Schema({
    bodies : [{
        grade : {
            type: Number,
        },
        anggota_tubuh : {
            type: String,
        },
    }],
    persentase_luka : {
        type: Number,
    },
    lpt : {
        type: Number,
    },
    petugas : {
        type: String,
        required: true,
    }
})

lukaBakarSchema.add(baseSchema)

export default lukaBakarSchema;