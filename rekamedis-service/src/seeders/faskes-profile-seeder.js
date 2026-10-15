import FaskesProfilesModel from "../models/postgreses/faskes-profiles-model.js";

export default class FaskesProfileSeeder {
    static async seed(transaction) {
        const faskesProfile = [
            {
                "uuid": "9d403ufjh43ufh3uf8430ihg",
                "faskesUuid": "9d403ufjh43ufh3uf8430ihf",
                "code": "ABC",
                "name": "DR SUTOMO",
                "addressUuid" : "9d403ufjh43ufh3uf8430iww",
                "phone" : "080000000000",
                "email" : "pengguna6@contoh.id",
                "website" : "drsutomo.com",
                "urlGmaps" : "www.url.com",
                "codeProvinsi" : "35",
                "codeKabupaten" : "35.01",
            },
        ];

        await FaskesProfilesModel.bulkCreate(faskesProfile, { transaction });
    }
}