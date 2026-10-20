import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../configs/sequelize-instance.js";
import IcuRepository from "./icu-repository.js";
import Template from "./icu-template-repository.js";
import Konfigurasi, { pilihIcu, ubahIcu } from "./icu-konfigurasi-repository.js";
import TemplateService from "../services/icu-template-service.js";
import Kelengkapan from "../services/icu-kelengkapan-service.js";
import { Context } from "../middlewares/context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import { filterUnitIcu } from "../middlewares/icu-unit-middleware.js";
import { galatIcu } from "../helpers/icu-modul-helper.js";
import { auditIcu } from "../helpers/icu-audit-helper.js";

export default class IcuDokumentasiRepository {
    static async episode(uuid, t) {
        const p = await IcuRepository.GetPerawatanByUuid(uuid, Context.get(CTX_AUTHOR).faskesUuid, t);
        if (!p) throw galatIcu(404, "Perawatan ICU tidak ditemukan");
        return p;
    }
    static async validasi(p, data, t) {
        const template = await Template.ambil(p.template_versi_uuid, t);
        const dokumen = template?.definisi.dokumen.find((d) => d.kode_dokumen === data.kode_dokumen);
        if (!dokumen) throw galatIcu(400, "Dokumen tidak tersedia pada versi template episode");
        const akhir = Number(p.waktu_keluar ?? Math.floor(Date.now() / 1000));
        if (data.waktu_pencatatan < Number(p.waktu_masuk) || data.waktu_pencatatan > akhir) throw galatIcu(400, "Waktu dokumentasi di luar episode");
        try { TemplateService.nilai(dokumen.elemen, data.nilai); }
        catch (error) { throw galatIcu(400, error.message); }
    }
    static async tambah(uuid, data) {
        return sequelizeInstance.transaction(async (t) => {
            await Konfigurasi.kunci(t);
            const p = await this.episode(uuid, t);
            if (p.status !== "aktif") throw galatIcu(409, "Episode sudah selesai");
            await this.validasi(p, data, t);
            const id = uuidv7();
            await ubahIcu(`INSERT INTO icu_dokumentasis(uuid,faskes_uuid,perawatan_uuid,template_versi_uuid,kode_dokumen,waktu_pencatatan,nilai,pencatat,created_at)
                VALUES(:id,:f,:episode,:versi,:kode,:waktu,CAST(:nilai AS jsonb),:pelaku,:sekarang)`,
            { id, episode: uuid, versi: p.template_versi_uuid, kode: data.kode_dokumen, waktu: data.waktu_pencatatan, nilai: JSON.stringify(data.nilai) }, t);
            auditIcu(t, "buat", "icu_dokumentasis", id);
            const [hasil] = await pilihIcu("SELECT * FROM icu_dokumentasis WHERE uuid=:id AND faskes_uuid=:f AND deleted_at IS NULL", { id }, t);
            return hasil;
        });
    }
    static async daftar(uuid, kueri) {
        await this.episode(uuid);
        const r = { id: uuid, dari: kueri.dari ?? null, sampai: kueri.sampai ?? null, kode: kueri.kode_dokumen ?? null, batas: kueri.batas, offset: (kueri.halaman - 1) * kueri.batas };
        const kondisi = `faskes_uuid=:f AND perawatan_uuid=:id AND deleted_at IS NULL AND (:dari IS NULL OR waktu_pencatatan>=:dari)
            AND (:sampai IS NULL OR waktu_pencatatan<:sampai) AND (:kode IS NULL OR kode_dokumen=:kode)`;
        const [jumlah] = await pilihIcu(`SELECT COUNT(*) AS total FROM icu_dokumentasis WHERE ${kondisi}`, r);
        const data = await pilihIcu(`SELECT * FROM icu_dokumentasis WHERE ${kondisi} ORDER BY waktu_pencatatan DESC,uuid DESC LIMIT :batas OFFSET :offset`, r);
        return { data, total: Number(jumlah.total), halaman: kueri.halaman, batas: kueri.batas };
    }
    static async koreksi(uuid, data) {
        return sequelizeInstance.transaction(async (t) => {
            await Konfigurasi.kunci(t);
            const [awal] = await pilihIcu("SELECT * FROM icu_dokumentasis WHERE uuid=:id AND faskes_uuid=:f AND deleted_at IS NULL FOR UPDATE", { id: uuid }, t);
            if (!awal) throw galatIcu(404, "Dokumentasi tidak ditemukan");
            const p = await this.episode(awal.perawatan_uuid, t);
            if (awal.revisi !== data.revisi) throw galatIcu(409, "Revisi dokumentasi telah berubah");
            await this.validasi(p, { ...awal, nilai: data.nilai_baru }, t);
            const id = uuidv7();
            await ubahIcu(`INSERT INTO icu_dokumentasi_koreksis(uuid,faskes_uuid,dokumentasi_uuid,nilai_sebelum,nilai_sesudah,alasan,pelaku,created_at)
                VALUES(:id,:f,:uuid,CAST(:awal AS jsonb),CAST(:baru AS jsonb),:alasan,:pelaku,:sekarang)`,
            { id, uuid, awal: JSON.stringify(awal.nilai), baru: JSON.stringify(data.nilai_baru), alasan: data.alasan }, t);
            await ubahIcu("UPDATE icu_dokumentasis SET nilai=CAST(:nilai AS jsonb),revisi=revisi+1,updated_at=:sekarang WHERE uuid=:uuid AND faskes_uuid=:f AND deleted_at IS NULL", { uuid, nilai: JSON.stringify(data.nilai_baru) }, t);
            const [hasil] = await pilihIcu("SELECT * FROM icu_dokumentasis WHERE uuid=:uuid AND faskes_uuid=:f AND deleted_at IS NULL", { uuid }, t);
            const koreksi = await pilihIcu("SELECT * FROM icu_dokumentasi_koreksis WHERE dokumentasi_uuid=:uuid AND faskes_uuid=:f ORDER BY created_at,uuid", { uuid }, t);
            auditIcu(t, "ubah", "icu_dokumentasis", uuid);
            return { dokumentasi: hasil, koreksi };
        });
    }
    static async kelengkapan(uuid, rentang = {}) {
        const p = await this.episode(uuid);
        const template = await Template.ambil(p.template_versi_uuid);
        if (!template) return Kelengkapan.evaluasi(p, null, []);
        const observasi = await pilihIcu("SELECT waktu_pengukuran,parameter_tambahan FROM icu_observasis WHERE faskes_uuid=:f AND perawatan_uuid=:id AND deleted_at IS NULL", { id: uuid });
        const dokumen = await pilihIcu("SELECT waktu_pencatatan,kode_dokumen,nilai FROM icu_dokumentasis WHERE faskes_uuid=:f AND perawatan_uuid=:id AND deleted_at IS NULL", { id: uuid });
        return Kelengkapan.evaluasi(p, template, [
            ...observasi.map((o) => ({ sumber: "observasi", waktu: Number(o.waktu_pengukuran), nilai: o.parameter_tambahan })),
            ...dokumen.map((o) => ({ sumber: "dokumentasi", waktu: Number(o.waktu_pencatatan), kode_dokumen: o.kode_dokumen, nilai: o.nilai })),
        ], Math.floor(Date.now() / 1000), rentang);
    }
    static async riwayat(uuid, kueri) {
        const p = await this.episode(uuid);
        const unit = filterUnitIcu();
        const r = { ri: p.rawat_inap_uuid, ...unit.replacements, batas: kueri.batas, offset: (kueri.halaman - 1) * kueri.batas };
        const kondisi = `faskes_uuid=:f AND rawat_inap_uuid=:ri AND deleted_at IS NULL AND ${unit.sql}`;
        const [jumlah] = await pilihIcu(`SELECT COUNT(*) AS total FROM icu_perawatans WHERE ${kondisi}`, r);
        const data = await pilihIcu(`SELECT uuid,rawat_inap_uuid,layanan_kode,ruangan_uuid,perawatan_sebelumnya_uuid,perpindahan_masuk_uuid,perpindahan_keluar_uuid,waktu_masuk,waktu_keluar
            FROM icu_perawatans WHERE ${kondisi} ORDER BY waktu_masuk,uuid LIMIT :batas OFFSET :offset`, r);
        const tersedia = new Set((await pilihIcu(`SELECT uuid FROM icu_perawatans WHERE ${kondisi}`, r)).map((e) => e.uuid));
        for (const e of data) if (!tersedia.has(e.perawatan_sebelumnya_uuid)) e.perawatan_sebelumnya_uuid = null;
        return { data, total: Number(jumlah.total), halaman: kueri.halaman, batas: kueri.batas };
    }
    static async laporan(kueri) {
        const unit = filterUnitIcu();
        const r = { ...unit.replacements, dari: kueri.dari, sampai: kueri.sampai, kode: kueri.layanan_kode ?? null, unit: kueri.ruangan_uuid ?? null };
        const episode = await pilihIcu(`SELECT uuid,layanan_kode FROM icu_perawatans WHERE faskes_uuid=:f AND deleted_at IS NULL AND ${unit.sql}
            AND waktu_masuk<:sampai AND (waktu_keluar IS NULL OR waktu_keluar>=:dari)
            AND (:kode IS NULL OR COALESCE(layanan_kode,'belum_diklasifikasikan')=:kode) AND (:unit IS NULL OR ruangan_uuid=:unit) ORDER BY waktu_masuk,uuid`, r);
        const ringkasan = { lengkap: 0, belum_lengkap: 0, belum_dikonfigurasi: 0 };
        const data = [];
        // Evaluasi seluruh populasi untuk ringkasan; hanya rincian halaman yang dikembalikan.
        for (let i = 0; i < episode.length; i++) {
            const hasil = await this.kelengkapan(episode[i].uuid, kueri);
            ringkasan[hasil.status]++;
            if (i >= (kueri.halaman - 1) * kueri.batas && data.length < kueri.batas) data.push({ perawatan_uuid: episode[i].uuid, layanan_kode: episode[i].layanan_kode, ...hasil });
        }
        return { ringkasan, data, total: episode.length, halaman: kueri.halaman, batas: kueri.batas };
    }
}
