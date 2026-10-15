import {Schema} from "mongoose";
import baseSchema from "./base-schema.js";


const ohisItemSchema = new Schema({
    gigi_uuid: {
        type: String,
        required: true,
    },
    no_gigi : {
        type: Number,
        required: true,
    },
    debris_indeks: {
        type: String,
    },
    kalkulus_indeks: {
        type: String,
    },
})

const ohisSchema = new Schema({
    ohis_item : [ohisItemSchema],
    skor_di: {
        type: Number,
    },
    skor_ci: {
        type: Number,
    },
    skor_total: {
        type: Number,
    },
    interpretasi_ohis: {
        type: String,
    }
});

ohisSchema.add(baseSchema)

export default ohisSchema;

