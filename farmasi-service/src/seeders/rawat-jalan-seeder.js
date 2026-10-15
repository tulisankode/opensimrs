import {RawatJalanModel} from "@opensimrs/model-sdk/pelayanan";
import {toEpochDate} from "../helpers/date-helper.js";

export default class RawatJalanSeeder {
    static async seed(transaction) {
        const item = [
            {
                "faskesUuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "payment_method" : 1,
                "noReg" : "123",
                "patientUuid" : "0194f3e6-403a-7df6-b8ab-79456e02e041",
                "noAntrianAdmisi" : "123",
                "noAntrianPoli" : "123",
                "name" : "joko widodo",
                "noRm" : "00-00-24",
                "birthDetailUuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "gender" : "Laki",
                "tanggalDaftar" : toEpochDate(new Date()),
                "tanggalPeriksa" : toEpochDate(new Date()),
                "practitionerUuid" : "0194fe43-05d7-7590-83e4-29b878347ed6",
                "maternity" : false,
                "note" : "string",
                "complaint" : "string",
                "lokasiUuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "tanggalCheckin" : toEpochDate(new Date()),
                "platform" : "string",
                "kodeBooking" : "string",
                "alasanBatal" : "string",
                "statusRj" : 5,
                "edukasi" : "string",
                "edukasiText" : "string",
                "prognosis" : "string",
                "kondisiPasienPulang" : "string",
                "statusPulang" : "string",
                "statusPulangKeterangan" : "string",
                "tujuanRujuk" : "string",
                "tujuanRujukLainnya" : "string",
                "instruksiNoDarurat" : "string",
                "transportRujuk" : "string",
                "transportRujukLainnya" : "string",
                "isInternal" : false,
                "rujukInternal" : "string",
                "rujukInternalText" : "string",
                "rujukEksternal" : "string",
                "instruksiTindakLanjut" : "string",
                "dischargeDate" : toEpochDate(new Date()),
                "petugas" : "string",
                "rekamMedisUuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "noPelayanan" : "admakd"
            }
        ];

        await RawatJalanModel.bulkCreate(item, { transaction });

    }
}
