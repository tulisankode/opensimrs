import {Schema} from "mongoose";
import {toEpochDate} from "../../../helpers/date-helper.js";

const baseSchema = new Schema({
    created_at: {
        type: Number,
        required: true,
        default : () => toEpochDate(new Date())
    },
    updated_at: {
        type: Number,
        default : () => toEpochDate(new Date())
    },
    deleted_at: {
        type: Number,
    },
});

export default baseSchema;