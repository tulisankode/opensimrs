import mongoose, {Schema} from "mongoose";
import alergiSchema from "./schemas/alergi-schema.js";
import anamnesisSchema from "./schemas/anamnesis-schema.js";
import anamnesaIgdSchema from "./schemas/anamnesa-igd-schema.js";
import antropometriSchema from "./schemas/antropometri-schema.js";
import asesmenNyeriSchema from "./schemas/asesmen-nyeri-schema.js";
import catatanPenunjangSchema from "./schemas/catatan-penunjang-schema.js";
import diagnosisDokterSchema from "./schemas/diagnosis-dokter-schema.js";
import diagnosaPerawatSchema from "./schemas/diagnosa-perawat-schema.js";
import kesadaranSchema from "./schemas/kesadaran-schema.js";
import lukaBakarSchema from "./schemas/luka-bakar-schema.js";
import pemeriksaanFisikSchema from "./schemas/pemeriksaan-fisik-schema.js";
import pemeriksaanTindakanSchema from "./schemas/pemeriksaan-tindakan-schema.js";
import tandaVitalSchema from "./schemas/tanda-vital-schema.js";
import triaseSchema from "./schemas/triase-schema.js";
import fpoSchema from "./schemas/fpo_schema.js";
import pemeriksaanGigiSchema from "./schemas/pemeriksaan-gigi-schema.js";
import pemeriksaanMataSchema from "./schemas/pemeriksaan-mata-schema.js";
import fisioterapiSchema from "./schemas/fisioterapi-schema.js";

const sessionSchema = new Schema(
    {
        deleted_at: {
            type: Number,
        },
        alasan: {
            type: String
        },
        alergi: alergiSchema,
        anamnesis: anamnesisSchema,
        anemsis_igd: anamnesaIgdSchema,
        antropometri: antropometriSchema,
        asesmen_nyeri: asesmenNyeriSchema,
        catatan_penunjang: catatanPenunjangSchema,
        catatan_perawat: [{type: Schema.Types.ObjectId, ref: 'catatan_perawats'}],
        diagnosis_dokter: [diagnosisDokterSchema],
        diagnosa_perawat: diagnosaPerawatSchema,
        instruksi_medis: [{type: Schema.Types.ObjectId, ref: 'instruksi_medises'}],
        kesadaran: kesadaranSchema,
        luka_bakar: lukaBakarSchema,
        pemeriksaan_fisik: pemeriksaanFisikSchema,
        pemeriksaan_tindakan: [pemeriksaanTindakanSchema],
        tanda_vital: tandaVitalSchema,
        triase: triaseSchema,
        fpo: fpoSchema,
        pemeriksaan_gigi: pemeriksaanGigiSchema,
        pemeriksaan_mata: pemeriksaanMataSchema,
        implementation: fisioterapiSchema,
        evaluation: fisioterapiSchema,
        reassessment: fisioterapiSchema,
        obat_uuides : [String],
    }
)

const SessionModel = mongoose.model("sessions", sessionSchema);

export default SessionModel;