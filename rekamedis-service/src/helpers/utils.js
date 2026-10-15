import moment from "moment";
import {Op} from "sequelize";
import BadRequestException from "../errors/bad-request-exception.js";
import {InstalasiGawatDaruratModel, RawatInapModel, RawatJalanModel} from "@opensimrs/model-sdk/pelayanan";
import { checkNoIdentity } from "../configurations/axios-instance.js";

export default class Utils {
    static camelToSnakeObject(obj, exclude = []) {
        const newObj = {};

        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {

                if(exclude.includes(key)){
                    newObj[key] = obj[key];
                    continue;
                }

                const snakeCaseKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
                newObj[snakeCaseKey] = obj[key];
            }
        }

        return newObj;
    }

    static snakeToCamelObject(obj) {
        const newObj = {};

        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                const camelCaseKey = key.replace(/_([a-z])/g, (match, p1) => p1.toUpperCase());
                newObj[camelCaseKey] = obj[key];
            }
        }

        return newObj;
    }

    static bannerChannel = (channel, data) => {
        console.log('Event Received');
        console.log(`Channel : ${channel}`);
        console.log('Data : ', data);
        console.log('========================================');
    }

    static generateNoPelayanan = async (service, faskesUuid) => {
        const today = moment().format('YYMMDD');
        const { model, prefix } = {
            'IGD': { model: InstalasiGawatDaruratModel, prefix: 'IGD' },
            'RI': { model: RawatInapModel, prefix: 'RI' },
            'RJ': { model: RawatJalanModel, prefix: 'RJ' }
        }[service] || {};

        if (!model) throw new Error('Service not found');

        const count = await model.count({
            where: { faskesUuid, createdAt: { [Op.between]: [today, today + 86400] } }
        });

        return `${prefix}${today}${(count + 1).toString().padStart(4, '0')}`;
    };

    static generateCodeFileType = async (surat) => {
        switch (surat) {
            case 'surat_kontrol_rawat_jalan':
                return 'K';
            case 'surat_permohonan_rawat_inap':
                return 'R';
            case 'surat_keterangan_sakit':
                return 'S';
            case 'surat_keterangan_sehat':
                return 'H';
            case 'surat_rujuk_keluar_faskes':
                return 'J';
            case 'surat_keterangan_meninggal':
                return 'M';
            case 'resep_kacamata':
                return 'T';
            default:
                throw new BadRequestException('Tipe surat tidak ada');
        }
    }

    static serviceName = async (serviceType, layanan) => {
        switch (serviceType) {
            case "RJ":
                return "Rawat Jalan";
            case "RI":
                switch (layanan.patient.is_new_born){
                    case true:
                        return "Rawat Inap (Bayi)";
                    case false:
                        return "Rawat Inap";
                }
            case "IGD":
                return "IGD";
        }
    }

    static buildTindakanItems(tindakans) {
        return tindakans.map(t => ({
            item_name: t.nama_tindakan,
            qty: t.qty_tindakan,
            price: t.harga_tindakan,
            category_code: "1"
        }));
    }

    static buildFarmasiItems(obats, code) {
        return obats.map(o => ({
            item_name: o.nama_item,
            qty: o.qty,
            price: o.harga,
            category_code: code
        }));
    }

}