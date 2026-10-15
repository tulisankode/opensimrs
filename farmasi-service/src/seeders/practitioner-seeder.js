import {PractitionerModel} from "@opensimrs/model-sdk/datamaster";

export default class PractitionerSeeder {
    static async seed(transaction){
        const data = [
            {
                uuid: "0192b31f-365d-731c-8b16-3a4565c9475e",
                faskes_uuid: "0192b31f-365d-731c-8b16-3a4565c9475e",
                pegawai_uuid: '0192b31f-365d-731c-8b16-3a4565c9475e',
                sip: 'SIP002',
                str: 'STR002',
                code_bpjs: 'BPJSSS002',
                satu_sehat_id: 'SEHAT002',
                status: true,
            },
        ];

        await PractitionerModel.bulkCreate(data, {transaction});
    }
}