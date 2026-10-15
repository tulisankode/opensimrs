import {ManufactureModel} from "@opensimrs/model-sdk/farmasi";
import {KabupatenModel, KecamatanModel, KelurahanModel, ProvinceModel} from "@opensimrs/model-sdk/datamaster";

export default class ManufacureSeeder {
    static async seed(transaction) {
        const item = [
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "code" : "MN1",
                "name" : "manufaktur 1",
                "status" : true,
                "alamat" : "Jl. Jalan",
                "kode_pos" : "12345",
                "kecamatan_code" : "kec1",
                "provinsi_code" : "prov1",
                "kabupaten_code" : "kab1",
                "kelurahan_code" : "kel1"
            }
        ];

        await ManufactureModel.bulkCreate(item, { transaction });

        const kecamatan = [
            {
                "code" : "kec1",
                "name" : "kecamatan 1",
                "kabupaten_code" : "kab1"
            }
        ];

        await KecamatanModel.bulkCreate(kecamatan, { transaction });

        const kabupaten = [
            {
                "code" : "kab1",
                "name" : "kabupaten 1",
                "provinsi_code" : "prov1"
            }
        ];

        await KabupatenModel.bulkCreate(kabupaten, { transaction });

        const province = [
            {
                "code" : "prov1",
                "name" : "provinsi 1"
            }
        ];

        await ProvinceModel.bulkCreate(province, { transaction });

        const kelurahan = [
            {
                "code" : "kel1",
                "name" : "kelurahan 1",
                "kecamatan_code" : "kec1"
            }
        ];

        await KelurahanModel.bulkCreate(kelurahan, { transaction});
    }
}
