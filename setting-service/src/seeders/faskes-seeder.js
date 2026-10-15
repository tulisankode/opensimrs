import {FaskesModel} from "@opensimrs/model-sdk/datamaster";

export default class FaskesSeeder {
    static async seed(transaction) {
        const faskes = [
            {
                "uuid": "0191a18a-22e4-79f7-9da5-a10a6e1a60f9",
                "name": "RSUD Dr. Soetomo",
                "code": "ABC",
                "status": true
            },
            {
                "uuid": "0191a18a-22e4-79f7-9da5-a10a6e1a60f6",
                "name": "RSUD Dr. Soetomo",
                "code": "RSU",
                "status": true
            }
        ];

        await FaskesModel.bulkCreate(faskes, { transaction });
    }
}