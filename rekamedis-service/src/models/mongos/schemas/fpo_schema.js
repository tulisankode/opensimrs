import baseSchema from "./base-schema.js";
import {Schema} from "mongoose";

const fpoSchema = new Schema({
    prescription_item_uuid : {
        type: String,
        required: true,
    },
    tgl_pemberian : {
        type: Number,
    },
    pemberian_obat : {
        type: Object,
    },
    petugas : {
        type: String,
        required: true,
    }
})

fpoSchema.add(baseSchema)

export default fpoSchema;