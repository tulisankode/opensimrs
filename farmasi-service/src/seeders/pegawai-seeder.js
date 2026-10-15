import {PegawaiModel} from "@opensimrs/model-sdk/datamaster";


export default class PegawaiSeeder {
    static async seed(transaction) {
        const data = [
            {
                faskes_uuid: "0192b31f-365d-731c-8b16-3a4565c9475e",
                uuid: '0192b31f-365d-731c-8b16-3a4565c9475e',
                name: 'oji one kenobi',
                status: true,
                nik: '1234567880',
                tipe: 1,
                title: 'Ir',
                tanggal_lahir: '1990-01-01',
                gender: 'L',
            }
        ]


        return PegawaiModel.bulkCreate(data, {transaction});
    }
}