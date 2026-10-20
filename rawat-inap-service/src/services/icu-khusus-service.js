import { z } from "zod";
import Request from "../validations/icu-request.js";
import Konfigurasi from "../repositories/icu-konfigurasi-repository.js";
import Template from "../repositories/icu-template-repository.js";
import Dokumentasi from "../repositories/icu-dokumentasi-repository.js";
import TemplateService from "./icu-template-service.js";
import { galatIcu } from "../helpers/icu-modul-helper.js";

export default class IcuKhususService {
    static async jalankan(tindakan, params, body, query) {
        for (const [k, v] of Object.entries(params)) if (k.endsWith("uuid")) z.string().uuid().parse(v);
        const q = Request.KUERI.parse(query);
        switch (tindakan) {
            case "layanan": return Konfigurasi.daftarLayanan(query.untuk_admisi === "true");
            case "konfigurasi": return Konfigurasi.konfigurasi();
            case "aktivasi": return Konfigurasi.ubahLayanan(z.enum(["umum", "burn", "neuro"]).parse(params.kode), Request.AKTIVASI.parse(body));
            case "bed": return Konfigurasi.ubahBed(params.bed_uuid, Request.BED.parse(body));
            case "akses": return Konfigurasi.ubahAkses(Request.AKSES.parse(body));
            case "riwayat-konfigurasi": return Konfigurasi.daftarRiwayat(q);
            case "daftar-template": return Template.daftar(q);
            case "pilihan-template": return Template.daftar(q, true);
            case "buat-template": case "versi-template": case "ubah-template": {
                const data = (tindakan === "buat-template" ? Request.TEMPLATE : tindakan === "versi-template" ? Request.DRAF : Request.UBAH_DRAF).parse(body);
                try { TemplateService.validasi(data.definisi, data.aturan_kelengkapan); }
                catch (error) { throw galatIcu(400, error.message); }
                return Template.simpan(data, params.versi_uuid, tindakan === "buat-template" ? "buat" : tindakan === "versi-template" ? "versi" : "ubah");
            }
            case "tetapkan": case "arsipkan": return Template.simpan(Request.PENETAPAN.parse(body), params.versi_uuid, tindakan);
            case "dokumentasi": return Dokumentasi.daftar(params.perawatan_uuid, q);
            case "tambah-dokumentasi": return Dokumentasi.tambah(params.perawatan_uuid, Request.DOKUMENTASI.parse(body));
            case "koreksi-dokumentasi": return Dokumentasi.koreksi(params.dokumentasi_uuid, Request.KOREKSI_DOKUMENTASI.parse(body));
            case "kelengkapan": return Dokumentasi.kelengkapan(params.perawatan_uuid, q);
            case "riwayat": return Dokumentasi.riwayat(params.perawatan_uuid, q);
            case "laporan-kelengkapan":
                if (!q.dari || !q.sampai) throw galatIcu(400, "Periode laporan wajib diisi");
                return Dokumentasi.laporan(q);
            default: throw galatIcu(404, "Operasi ICU tidak ditemukan");
        }
    }
}
