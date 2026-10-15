import mongoose, {Schema} from "mongoose";

const instruksiMedisSchema = new Schema({
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
    dokter_name : {
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
        ref : 'instruksi_medises',
        default : null
    }
})

const InstruksiMedisModel = mongoose.model("instruksi_medises", instruksiMedisSchema);

export default InstruksiMedisModel;