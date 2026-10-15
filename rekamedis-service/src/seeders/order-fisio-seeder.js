import OrderFisioModel from "../models/postgreses/order-fisio-model.js";

export default class OrderFisioSeeder {
    static async seed(transaction){
        const data = [
            {
                uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a60f9",
                faskes_uuid: "9d403ufjh43ufh3uf8430ihf",
                no_order: "0001",
                no_reg: "0001",
                patient_uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a60f5",
                no_rm: "1234a",
                rekam_medis_uuid: "66d81d6845871723afbfe42d",
                rekam_medis_pelayanan_uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a60f3",
                rekam_medis_pelayanan_date: "2021-01-01",
                payment_method: 1,
                asuransi_uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a60f1",
                pelayanan: "rajal",
                lokasi_uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a60f2",
                dokter_pengirim_uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a60f9",
                pasien_maternitas: false,
                keluhan_utama: "Sakit kepala",
                catatan: "Catatan",
                diagnosis : "Diagnosis",
                tanggal_terapi: "2021-01-01",
                jenis_fisio : 1,
                petugas_order : "joko",
                status_fisio: 5,
                bed_ruangan_uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a60f0",
                jam_terapi : 18,
                petugas_fisio : "budi",
            },
        ];


        await OrderFisioModel.bulkCreate(data, {transaction});
    }
}