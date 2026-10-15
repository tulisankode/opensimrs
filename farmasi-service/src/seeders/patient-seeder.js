import {PatientModel} from "@opensimrs/model-sdk/admisi";

export default class PatientSeeder {
    static async seed(transaction) {
        const item = [
            {
                "faskesUuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "noRm" : "REG1234",
                "title" : "string",
                "name" : "joko widodo",
                "identity" : "ktp",
                "noIdentity" : "123456789",
                "birthDetailUuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "gender" : "Laki",
                "phone" : "080000000000",
                "religion" : "islam",
                "addressUuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "language" : "ID",
                "motherName" : "Mama muda",
                "maritialStatus" : "single",
                "isNewBorn" : false,
            },
        ];

        await PatientModel.bulkCreate(item, { transaction });
    }
}