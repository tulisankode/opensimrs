import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";

const catatanPenunjangSchema = new Schema({
    catatan : {
        type: String,
    },
    petugas : {
        type: String,
        required: true,
    }
})

catatanPenunjangSchema.add(baseSchema)

export default catatanPenunjangSchema;