import PrescriptionRepository from "../repositories/prescription-repository.js";
import ZodValidator from "../validations/zod-validator.js";
import ReportValidation from "../validations/report-validation.js";
import {setRangeDate} from "../helpers/date-helper.js";
import PenjualanObatRepository from "../repositories/penjualan-obat-repository.js";
import BadRequestException from "../errors/bad-request-exception.js";
import FaskesRepository from "../repositories/faskes-repository.js";
import Utils from "../helpers/utils.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { QueryTypes } from "sequelize";

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default class ReportService {
    static async getPendapatan(req){
        setRangeDate(req);

        // Tanpa pilihan jenis pendapatan sebelumnya mengembalikan payload kosong; kini bawaan = Resep Dokter.
        if(!req.pendapatan){
            req.pendapatan = "prescription";
        }

        ZodValidator.validate(ReportValidation.GET_PENDAPATAN, req);

        req.start_date = Number(req.start_date);
        req.end_date = Number(req.end_date);
        if (req.payment_method){
            req.payment_method = Number(req.payment_method);
        }

        let result;
        let grandTotal;
        if (req.pendapatan === "prescription"){
            result = await PrescriptionRepository.getPendapatan(req);
            grandTotal = await PrescriptionRepository.getPendapatan(req, { total: true });
            await this.isiNamaDokter(result.data, req.faskes_uuid);
        } else if (req.pendapatan === "penjualan_obat"){
            result = await PenjualanObatRepository.getPendapatan(req);
            grandTotal = await PenjualanObatRepository.getTotalPendapatan(req);
            // Samakan bentuk baris dengan resep agar tabel & ekspor Excel di layar Laporan Pendapatan terisi.
            result.data = result.data.map((row) => ({
                order_date: row.tanggal_pembelian,
                no_resep: row.no_transaksi,
                no_rm: "-",
                no_reg: "-",
                payment_method: 1,
                dokter_order: row.dokter_pemberi_resep,
                total_harga: row.total_harga,
                jenis_pelayanan: "otc",
                no_invoice: row.no_transaksi,
                patient: { name: row.nama_pembeli },
                lokasi: { name: row.lokasi_stok?.name ?? "-" },
            }));
        } else {
            throw new BadRequestException("Invalid pendapatan type");
        }

        const faskes = await FaskesRepository.getFaskes(req.faskes_uuid);
        const faskesProfile = await FaskesRepository.getFaskesProfile(req.faskes_uuid);

        if (result.data){
            result.data.forEach((element) => {
                element.payment_method = element.payment_method === 1 ? "Tunai" : "Asuransi";
            });
        }

        const now = new Date();

        result.data = {
            items : result.data,
            grand_total : grandTotal,
            faskes : faskes.name,
            message : `DICETAK OLEH: ${req.user}, ${Utils.convertDateInReport()}`,
            address : faskesProfile?.address?.full_address ?? "",
        }

        return result;
    }

    // dokter_order resep bisa berisi UUID practitioner (resep dari pelayanan) atau username; tampilkan nama dokter.
    static async isiNamaDokter(rows, faskesUuid){
        const uuids = [...new Set((rows ?? []).map((r) => r.dokter_order).filter((d) => POLA_UUID.test(d ?? "")))];
        if (!uuids.length) return;
        const daftar = await sequelizeInstance.query(
            `SELECT p.uuid::text AS uuid, CONCAT_WS(' ', NULLIF(pg.first_title, ''), pg.name, NULLIF(pg.last_title, '')) AS nama
             FROM practitioner p JOIN pegawai pg ON pg.uuid = p.pegawai_uuid
             WHERE p.uuid::text IN (:uuids) AND p.faskes_uuid = :faskes`,
            { replacements: { uuids, faskes: faskesUuid }, type: QueryTypes.SELECT }
        );
        const peta = new Map(daftar.map((d) => [d.uuid, d.nama]));
        rows.forEach((r) => {
            if (peta.has(r.dokter_order)) r.dokter_order = peta.get(r.dokter_order);
        });
    }

    static async getTat(req){
        setRangeDate(req);

        ZodValidator.validate(ReportValidation.GET_TAT, req);

        const result = await PrescriptionRepository.getTat(req);

        if (result.data){
            result.data.forEach((element) => {
                element.jumlah_racikan = element.obat.filter(item => item.is_compound === true).length;
                element.payment_method = element.payment_method === 1 ? "Tunai" : "Asuransi";
                element.patient = element.patient?.name || "-";
                element.asal_resep = element.lokasi?.name || "-";
                element.lokasi = undefined;
                // Waktu tunggu = diserahkan - diverifikasi; data tidak lengkap/terbalik ditampilkan 0 (sebelumnya "-1.-3.-48").
                element.waktu_pelayanan = element.waktu_pemberian && element.waktu_verifikasi
                    ? Math.max(0, Number(element.waktu_pemberian) - Number(element.waktu_verifikasi))
                    : 0
                element.jenis_resep = element.jumlah_racikan > 0 ? element.jumlah_racikan === element.obat.length ? "Racikan" : "Racikan & Non-Racikan" : "Non-Racikan"
                element.obat = undefined;

                const hours = Math.floor(element.waktu_pelayanan / 3600);
                const minutes = Math.floor((element.waktu_pelayanan % 3600) / 60);
                const remainingSeconds = element.waktu_pelayanan % 60;

                element.waktu_pelayanan = `${String(hours).padStart(2, '0')}.${String(minutes).padStart(2, '0')}.${String(remainingSeconds).padStart(2, '0')}`;
            });
        }

        const faskesProfile = await FaskesRepository.getFaskesProfile(req.faskes_uuid);
        const faskes = await FaskesRepository.getFaskes(req.faskes_uuid);

        result.data = {
            items : result.data,
            faskes : faskes.name,
            message : `DICETAK OLEH: ${req.user}, ${Utils.convertDateInReport()}`,
            address : faskesProfile?.address?.full_address ?? "",
        }

        return result;
    }

    static async getPendapatanPerApotik(req){
        setRangeDate(req);

        ZodValidator.validate(ReportValidation.GET_TAT, req);

        const result = await PrescriptionRepository.getPendapatanPerApotik(req);

        if (result.data){
            result.data.forEach((element) => {
                element.payment_method = element.payment_method === 1 ? "Tunai" : "Asuransi";
                element.lokasi_stok_uuid = undefined;
                element.lokasi_stok = element.lokasi_stok?.name || "-";
            });
        }

        const faskesProfile = await FaskesRepository.getFaskesProfile(req.faskes_uuid);
        const faskes = await FaskesRepository.getFaskes(req.faskes_uuid);

        result.data = {
            items : result.data,
            faskes : faskes.name,
            message : `DICETAK OLEH: ${req.user}, ${Utils.convertDateInReport()}`,
            address : faskesProfile?.address?.full_address ?? "",
        }

        return result;
    }
}