import {FaskesModel} from "@opensimrs/model-sdk/datamaster";

export default class FaskesSeeder {
    static async seed(transaction) {
        const faskes = [
            {
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "name": "RSUD Dr. Fauzy & Fauziah",
                "code": "ABCDD",
                "status": true,
                "organization_ihs_number": "1234567890",
                "client_id": "1234567890",
                "client_secret": "123hfgy4g7gr927fgbfygyg",
            }
        ];

        await FaskesModel.bulkCreate(faskes, { transaction });
    }
}