import mongoose, {Schema} from "mongoose";

const catatanPerawatSchema = new Schema({
    message : {
        type: String,
        required: true,
    },
    name : {
        type: String,
        required: true,
    },
    user_uuid : {
        type: String,
        required: true,
    },
    time : {
        type: Number,
        required: true,
    },
    session_uuid : {
        type : String,
        required : true
    },
    reply : {
        type : Schema.Types.ObjectId,
        ref : 'catatan_perawats',
        default : null
    }
})

const CatatanPerawatModel = mongoose.model("catatan_perawats", catatanPerawatSchema);

export default CatatanPerawatModel;