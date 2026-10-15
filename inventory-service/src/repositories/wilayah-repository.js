import {
    KabupatenModel,
    KecamatanModel,
    KelurahanModel,
    ProvinceModel,
} from "@opensimrs/model-sdk/datamaster";
import { Op, fn, col, where } from "sequelize";

export default class WilayahRepository {
    
    static async findProvinsiByNames(names) {
        if (!names || names.length === 0) return new Map();
        const lowerNames = names.map(n => n.toLowerCase());
        const data = await ProvinceModel.findAll({ 
            where: where(fn("LOWER", col("name")), { [Op.in]: lowerNames }),
            attributes: ["name", "code"], 
            raw: true 
        });
        return new Map(data.map(p => [p.name.toLowerCase(), p.code]));
    }

    static async findKabupatenByNames(names) {
        if (!names || names.length === 0) return new Map();
        const lowerNames = names.map(n => n.toLowerCase());
        const data = await KabupatenModel.findAll({ 
            where: where(fn("LOWER", col("name")), { [Op.in]: lowerNames }),
            attributes: ["name", "code"], 
            raw: true 
        });
        return new Map(data.map(k => [k.name.toLowerCase(), k.code]));
    }

    static async findKecamatanByNames(names) {
        if (!names || names.length === 0) return new Map();
        const lowerNames = names.map(n => n.toLowerCase());
        const data = await KecamatanModel.findAll({ 
            where: where(fn("LOWER", col("name")), { [Op.in]: lowerNames }),
            attributes: ["name", "code"], 
            raw: true 
        });
        return new Map(data.map(k => [k.name.toLowerCase(), k.code]));
    }

    static async findKelurahanByNames(names) {
        if (!names || names.length === 0) return new Map();
        const lowerNames = names.map(n => n.toLowerCase());
        const data = await KelurahanModel.findAll({ 
            where: where(fn("LOWER", col("name")), { [Op.in]: lowerNames }),
            attributes: ["name", "code"], 
            raw: true 
        });
        return new Map(data.map(k => [k.name.toLowerCase(), k.code]));
    }
}