import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";

const kesadaranSchema = new Schema({
    eye : {
        type: Number,
    },
    motorik : {
        type: Number,
    },
    verbal : {
        type: Number,
    },
    gcs_score : {
        type: Number,
    },
    gcs_kesimpulan : {
        type: String,
    },
    petugas : {
        type: String,
        required: true,
    }
})

kesadaranSchema.add(baseSchema)

export default kesadaranSchema;