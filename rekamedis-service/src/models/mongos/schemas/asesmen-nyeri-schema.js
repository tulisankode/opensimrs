import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";

const asesmenNyeriSchema = new Schema({
    skala_nyeri : {
        type: Number,
    },
    catatan : {
        type: String,
    },
    petugas : {
        type: String,
        required: true,
    }
})

asesmenNyeriSchema.add(baseSchema)

export default asesmenNyeriSchema;