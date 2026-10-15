import { LogPelayananModel } from "@opensimrs/model-sdk/pelayanan";
import Utils from "../helpers/utils.js";

export default class LogPelayananRepository {
    static async LogPelayanan(data) {

        data = Utils.snakeToCamelObject(data);
        console.log("LogPelayananRepository data:", data);
        try {
            const logPelayanan = await LogPelayananModel.findOne({
                where: {
                faskesUuid: data.faskesUuid,
                noreg: data.noreg,
                noPelayanan: data.noPelayanan,
                deletedAt: null,
                },
            });
            if (logPelayanan) {
                return await logPelayanan.update({
                patientUuid: data.patientUuid,
                jenisKunjungan: data.jenisKunjungan,
                lokasiUuid: data.lokasiUuid,
                practitionerUuid: data.practitionerUuid,
                dischargeDate: data.dischargeDate
                });
            }
            
            return await LogPelayananModel.create({ faskesUuid, ...data });

        } catch (error) {
            throw error;
        }
    }
}