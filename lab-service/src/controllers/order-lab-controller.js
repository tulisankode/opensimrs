import successResponse from "../response/success-response.js";
import OrderLabService from "../services/order-lab-service.js";

export default class OrderLabController{
    static async create(req, res, next){
        try {
            const data = req.body;
            data.faskes_uuid = req.author.faskesUuid; 
            data.petugas_order = req.author.username;
            const order = await OrderLabService.create(data);
            res.status(201).json(successResponse("Data berhasil disimpan", order));
        } catch (error) {
            next(error);
        }
    }

    static async show(req, res, next){
        try {
            const faskesUuid = req.author.faskesUuid;
            const data = await OrderLabService.findOne(req.params.uuid, faskesUuid);
            res.status(200).json(successResponse("Data berhasil ditampilkan",data));
        } catch (error) {
            next(error);
        }
    }

    static async findAll(req, res, next){
        try {
            const data = req.query;
            data.faskes_uuid = req.author.faskesUuid;
            const result = await OrderLabService.findAll(data);
            res.status(200).json(successResponse("Data berhasil ditampilkan", result));
        } catch (error) {
            next(error);
        }
    }

    static async update(req, res, next){
        try {
            const data = req.body;
            data.faskes_uuid = req.author.faskesUuid;
            await OrderLabService.update(req.params.uuid, data);
            res.status(200).json(successResponse("Data berhasil diupdate"));
        } catch (error) {
            next(error);
        }
    }

    static async updateBatalOrder(req, res, next){
        try {
            const data = req.body;
            data.faskes_uuid = req.author.faskesUuid;
            data.token = req.headers.authorization;
            await OrderLabService.updateBatalOrder(data);
            res.status(200).json(successResponse("Data berhasil diupdate"));
        } catch (error) {
            next(error);
        }
    }

    static async selesaiPeriksa(req,res,next){
        try {
            const faskesUuid = req.author.faskesUuid;
            const uuid = req.params.uuid
            await OrderLabService.selesaiPeriksa(uuid, faskesUuid);
            res.status(200).json(successResponse("Data berhasil diupdate"));
        } catch (error) {
            next(error);
        }
    }

    static async validasi(req,res,next){
        try {
            const data = req.body;
            data.faskes_uuid = req.author.faskesUuid;
            data.token = req.headers.authorization; // untuk mengirim tagihan ke Pembayaran
            const uuid = req.params.uuid
            // "Validasi & Kirim ke LIS": registrasi LIS wajib berhasil; bila gagal, validasi dibatalkan (galat 400).
            const { lis } = await OrderLabService.validasi(uuid, data, {
                kirim: Boolean(data.kirim_lis),
                koneksiUuid: data.koneksi_uuid,
                pengguna: req.author?.username,
            });
            res.status(200).json(successResponse("Data berhasil diupdate", lis ? { lis } : undefined));
        } catch (error) {
            next(error);
        }
    }

    static async batalValidasi(req,res,next){
        try {
            const data = req.body;
            data.faskes_uuid = req.author.faskesUuid;
            data.token = req.headers.authorization;
            await OrderLabService.batalValidasi(data);
            res.status(200).json(successResponse("Data berhasil diupdate"));
        } catch (error) {
            next(error);
        }
    }
}