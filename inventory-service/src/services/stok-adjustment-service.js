import KartuStokService from "./kartu-stok-service.js";
import ItemMedisJenisStokRepository from "../repositories/item-medis-jenis-stok-repository.js";
import ZodValidator from "../validations/zod-validator.js";
import StokAdjustmentValidation from "../validations/stok-adjustment-validation.js";
import BadRequestException from "../errors/bad-request-exception.js";
import StockMedisRepository from "../repositories/stock-medis-repository.js";
import RiwayatMutasiService from "./riwayat-mutasi-service.js";
import Utils from "../helpers/utils.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import NotfoundException from "../errors/notfound-exception.js";

export default class StokAdjustmentService {
    static async getAll(req) {
        return await KartuStokService.getAll(req);
    }

    static async getDetail(req) {
        ZodValidator.validate(StokAdjustmentValidation.GET_DETAIL, req);
        const data = await ItemMedisJenisStokRepository.getDetailForStokAdjustment(req);
        if (!data) throw new NotfoundException("UUID tidak ditemukan");
        const { stocks, item_medis, detail_stok } = data.dataValues;
        const total_stok = stocks.reduce((total, item) => total + parseInt(item.sisa_stok, 10), 0);
        const commonData = {
            nama: item_medis?.name,
            kategori: "Medis",
            jenis_stok: detail_stok?.name,
            jenis_item: item_medis?.jenis_item,
            kategori_obat: item_medis?.kategori_obat?.name,
        };
        const items = stocks.map((item) => ({
            exp_date: item.exp_date,
            sisa_stok: item.sisa_stok,
            uuid: item.uuid,
            ...commonData
        }));
        return { total_stok, items };
    }

    static async update(req) {
        const validatedData = await ZodValidator.validate(StokAdjustmentValidation.UPDATE, req);
        const stock = await StockMedisRepository.getDetail(validatedData); 
        if (!stock) throw new BadRequestException("Data not found");
        
        const transaction = await sequelizeInstance.transaction();

        const new_exp_date_as_date = validatedData.exp_date;
        const old_exp_date_as_date = stock.exp_date ? new Date(stock.exp_date) : null;

        const updatePayload = {
            uuid: validatedData.uuid,
            faskes_uuid: validatedData.faskes_uuid,
            sisa_stok: validatedData.sisa_stok,
            exp_date: new_exp_date_as_date
        };
        
        try {
            await StockMedisRepository.update(updatePayload, transaction); 
            
            await RiwayatMutasiService.create({
                faskes_uuid: validatedData.faskes_uuid,
                sumber_mutasi: "inventory",
                with_check_stock: true,
                petugas: validatedData.petugas_sa,
                code: Utils.generate4Code("SAD"),
                keterangan: {
                    description: "Stok Adjustment",
                    ed_before: old_exp_date_as_date,
                    ed_after: new_exp_date_as_date,
                },
                items: [{
                    item_uuid: stock.item_medis_jenis_stok.item_medis_uuid,
                    exp_date: old_exp_date_as_date,
                    stok_awal: stock.sisa_stok,
                    stok_mutasi: validatedData.sisa_stok,
                    jenis_stok_uuid: stock.item_medis_jenis_stok.jenis_stok_uuid,
                    lokasi_stok_uuid: stock.lokasi_stok_uuid,
                    type: stock.sisa_stok > validatedData.sisa_stok ? "defisit" : "surplus"
                }]
            }, { transaction }); 

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}