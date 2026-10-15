import baseSchema from "./base-schema.js";
import {Schema} from "mongoose";

const diagnosaPerawatSchema = new Schema({
    diagnosa_perawat : {
        type: String,
    },
    petugas : {
        type: String,
        required: true,
    }
})

diagnosaPerawatSchema.add(baseSchema)

export default diagnosaPerawatSchema;