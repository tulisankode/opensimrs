import baseSchema from "./base-schema.js";
import {Schema} from "mongoose";

const diagnosisDokterSchema = new Schema({
    diagnosis_uuid : {
        type: String,
        required: true,
    },
    diagnosis : {
        type: String,
        required: true,
    },
    diferensial : {
        type: String,
        required: true,
    },
    diferensial_uuid : {
        type: String,
        required: true,
    },
    tipe : {
        type: String,
    },
    petugas : {
        type: String,
        required: true,
    }
})

diagnosisDokterSchema.add(baseSchema)

export default diagnosisDokterSchema;