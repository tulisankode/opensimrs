import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";

const fisioterapiSchema = new Schema({
    value: {
        type: String,
    },
    petugas: {
        type: String,
        required: true,
    }
});

fisioterapiSchema.add(baseSchema)

export default fisioterapiSchema;

