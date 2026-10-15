import dayjs from "dayjs";
import {
    createAntrianCall,
    createAntrianCallMobile,
    getAllAntrianCall,
    updateAntrianCall
} from "../configurations/axios-instance.js";
import ServiceUnavailableException from "../exception/service-unavailable-exception.js";

const toAntrianServiceError = (error) => {
    const responseMessage =
        error.response?.data?.errors?.[0]?.message ||
        error.response?.data?.message ||
        error.message ||
        error.code ||
        error.cause?.code ||
        "unknown error";

    if (!error.response) {
        return new ServiceUnavailableException(
            `Antrian service tidak dapat dihubungi: ${responseMessage}`
        );
    }

    return new ServiceUnavailableException(
        `Antrian service gagal merespons (${error.response.status}): ${responseMessage}`
    );
};

export default class AntrianCallRepository {
    static async createAntrianCall(data, patient, rawatJalan){
        const jenisPasien = data.paymentMethod === "ASURANSI" ? "JKN" : "NON-JKN";
        const pasienBaru = !data.patientData.patient_uuid;
        const pelayanan = pasienBaru == false || rawatJalan.dataValues.platform == "ADMISI" ? "poli" : "admisi"

        try {
            await createAntrianCall.post("/", {
                patient_uuid: patient.uuid,
                rawat_jalan_uuid: rawatJalan.dataValues.uuid,
                pelayanan: pelayanan,
                jenis_pasien: jenisPasien,
                pasien_baru: pasienBaru
            });
        } catch (error) {
            console.error("Error membuat no antrian:", error);
            throw toAntrianServiceError(error);
        }
    }

    static async createAntrianCallMobile(data, patient, rawatJalan, faskesUuid){
        const jenisPasien = data.paymentMethod === "ASURANSI" ? "JKN" : "NON-JKN";
        const pasienBaru = !data.patientData.no_rm;
        const pelayanan = pasienBaru == false ? "poli" : "admisi";
        
        try {
            await createAntrianCallMobile.post("", {
                patient_uuid: patient.uuid,
                rawat_jalan_uuid: rawatJalan.dataValues.uuid,
                pelayanan: pelayanan,
                jenis_pasien: jenisPasien,
                pasien_baru: pasienBaru
            }, {
                headers: {
                    "faskes-uuid": faskesUuid
                }
            });
        } catch (error) {
            console.error("Error membuat no antrian:", error);
            throw toAntrianServiceError(error);
        }
    }

    static async getAllAntrianCall(args){
        try {
            const result = await getAllAntrianCall.get("/all", { params: args });
            const payload = Array.isArray(result.data?.payload) ? result.data.payload : [];
            const startOfDay = dayjs().startOf("day").format("YYYY-MM-DD");

            const antrian = payload
                .filter((item) => {
                    const jadwalPeriksa = item.patient_data?.jadwal_periksa;
                    if (!jadwalPeriksa) return false;

                    const tanggalPeriksa = dayjs.unix(jadwalPeriksa).format("YYYY-MM-DD");
                    return (
                        item.pelayanan === "admisi" &&
                        tanggalPeriksa >= startOfDay &&
                        tanggalPeriksa <= startOfDay
                    );
                })
                .sort(
                    (a, b) =>
                        (a.patient_data?.antrian?.no_antrian_admisi || 0) -
                        (b.patient_data?.antrian?.no_antrian_admisi || 0)
                );

            return antrian;

        } catch (error) {
            console.error("Error fetching all antrian:", error);
            throw toAntrianServiceError(error);
        }
    }

    static async updateAntrianCall(uuid, data){
        try{
            
            const statusMessages = {
                1: "Antrian berhasil dipanggil",
                2: "Antrian berhasil dilewati",
                3: "Antrian berhasil diproses",
                4: "Antrian berhasil diselesaikan",
            };

            const result = await updateAntrianCall.put(`/${uuid}`, {
                status_panggilan: data.status_panggilan
            });

            const antrian = result.data.payload;

            if (antrian.status_panggilan === 4){
                try {
                    await createAntrianCall.post("/", {
                        patient_uuid: antrian.patient_data.patient_uuid,
                        rawat_jalan_uuid: antrian.rawat_jalan_uuid,
                        pelayanan: "poli",
                        jenis_pasien: antrian.jenis_pasien,
                        pasien_baru: antrian.pasien_baru,
                    });
                } catch (error) {
                    console.error("Error membuat no antrian:", error);
                    throw toAntrianServiceError(error);
                }
            }

            return { message: statusMessages[antrian.status_panggilan] };

        }catch(error){
            console.error("Error updating antrian:", error);
            throw toAntrianServiceError(error);
        }
    }

}
