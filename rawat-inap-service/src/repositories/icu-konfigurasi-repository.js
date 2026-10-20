import { QueryTypes } from "sequelize";
import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../configs/sequelize-instance.js";
import { Context } from "../middlewares/context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import { filterUnitIcu, perbaruiCakupanUnitIcu } from "../middlewares/icu-unit-middleware.js";
import { galatIcu } from "../helpers/icu-modul-helper.js";
import { auditIcu } from "../helpers/icu-audit-helper.js";

export const namaLayanan = { umum: "ICU Umum", burn: "Burn ICU", neuro: "Neuro ICU" };
export const pilihIcu = (sql, replacements = {}, transaction) => sequelizeInstance.query(sql, {
    replacements: { f: Context.get(CTX_AUTHOR).faskesUuid, ...replacements }, transaction, type: QueryTypes.SELECT,
});
export const ubahIcu = (sql, replacements, transaction) => sequelizeInstance.query(sql, {
    replacements: { f: Context.get(CTX_AUTHOR).faskesUuid, pelaku: Context.get(CTX_AUTHOR).username,
        sekarang: Math.floor(Date.now() / 1000), ...replacements }, transaction,
});

export default class IcuKonfigurasiRepository {
    static async kunci(transaction) {
        // Seluruh perubahan konfigurasi dan admisi memakai kunci fasilitas yang sama.
        await pilihIcu("SELECT pg_advisory_xact_lock(hashtext(:f))", {}, transaction);
        await perbaruiCakupanUnitIcu(transaction);
    }
    static async riwayat(jenis, sebelum, sesudah, alasan, transaction) {
        await ubahIcu(`INSERT INTO icu_konfigurasi_riwayats
            (uuid,faskes_uuid,jenis_entitas,entitas_uuid,nilai_sebelum,nilai_sesudah,alasan,pelaku,created_at)
            VALUES(:uuid,:f,:jenis,:entitas,CAST(:sebelum AS jsonb),CAST(:sesudah AS jsonb),:alasan,:pelaku,:sekarang)`,
        { uuid: uuidv7(), jenis, entitas: (sesudah ?? sebelum).uuid, sebelum: JSON.stringify(sebelum), sesudah: JSON.stringify(sesudah), alasan }, transaction);
        auditIcu(transaction, sebelum ? "ubah" : "buat", jenis, (sesudah ?? sebelum).uuid);
    }
    static async layanan(kode, transaction, inisialisasi = false) {
        if (inisialisasi) await ubahIcu(`INSERT INTO icu_layanans(uuid,faskes_uuid,kode,nama,aktif,revisi,dibuat_oleh,created_at)
            VALUES(:uuid,:f,:kode,:nama,:aktif,1,:pelaku,:sekarang) ON CONFLICT DO NOTHING`,
        { uuid: uuidv7(), kode, nama: namaLayanan[kode], aktif: kode === "umum" }, transaction);
        const [baris] = await pilihIcu(`SELECT * FROM icu_layanans WHERE faskes_uuid=:f AND kode=:kode AND deleted_at IS NULL`, { kode }, transaction);
        return baris ?? { kode, nama: namaLayanan[kode], aktif: kode === "umum", revisi: 0 };
    }
    // Unit (ruangan) ICU untuk filter dasbor/laporan: ruangan yang pernah menampung episode ICU atau dipetakan ke layanan.
    static async daftarUnit() {
        const unit = filterUnitIcu("x");
        return pilihIcu(`SELECT DISTINCT x.ruangan_uuid AS uuid, l.name AS nama FROM (
                SELECT ruangan_uuid FROM icu_perawatans WHERE faskes_uuid=:f AND deleted_at IS NULL
                UNION SELECT ruangan_uuid FROM icu_layanan_beds WHERE faskes_uuid=:f AND deleted_at IS NULL) x
            JOIN lokasi l ON l.uuid=x.ruangan_uuid AND l.faskes_uuid=:f WHERE ${unit.sql} ORDER BY l.name`, unit.replacements);
    }
    static async daftarLayanan(untukAdmisi = false) {
        const layanan = await Promise.all(Object.keys(namaLayanan).map((kode) => this.layanan(kode)));
        if (!untukAdmisi) return { layanan, unit: await this.daftarUnit() };
        const unit = filterUnitIcu("b");
        const beds = await pilihIcu(`SELECT l.kode FROM icu_layanan_beds b JOIN icu_layanans l ON l.uuid=b.layanan_uuid AND l.faskes_uuid=b.faskes_uuid
            WHERE b.faskes_uuid=:f AND b.deleted_at IS NULL AND l.deleted_at IS NULL AND b.berlaku_mulai<=:waktu AND (b.berlaku_sampai IS NULL OR b.berlaku_sampai>:waktu)
            AND ${unit.sql}`, { ...unit.replacements, waktu: Math.floor(Date.now() / 1000) });
        return { layanan: layanan.filter((l) => l.aktif && (l.kode === "umum" || beds.some((b) => b.kode === l.kode))) };
    }
    static async konfigurasi() {
        const { layanan } = await this.daftarLayanan();
        const penempatan = await pilihIcu(`SELECT b.*,l.kode AS layanan_kode FROM icu_layanan_beds b JOIN icu_layanans l ON l.uuid=b.layanan_uuid AND l.faskes_uuid=b.faskes_uuid WHERE b.faskes_uuid=:f AND b.deleted_at IS NULL ORDER BY b.berlaku_mulai DESC`);
        const akses = await pilihIcu("SELECT * FROM icu_akses_units WHERE faskes_uuid=:f AND deleted_at IS NULL");
        // Referensi pilihan formulir (nama bed/unit/peran) agar pengelola tidak mengetik UUID.
        const bed = await pilihIcu(`SELECT b.uuid, b.no_bed, b.room_uuid AS ruangan_uuid, l.name AS ruangan_nama FROM room_monitorings b
            JOIN lokasi l ON l.uuid=b.room_uuid AND l.faskes_uuid=b.faskes_uuid AND l.deleted_at IS NULL
            WHERE b.faskes_uuid=:f AND b.deleted_at IS NULL ORDER BY l.name, b.no_bed`);
        const peran = await pilihIcu(`SELECT uuid, name AS nama FROM "role" WHERE (faskes_uuid=:f OR faskes_uuid IS NULL) AND deleted_at IS NULL ORDER BY name`);
        const unit = [...new Map(bed.map((b) => [b.ruangan_uuid, { uuid: b.ruangan_uuid, nama: b.ruangan_nama }])).values()];
        return { layanan, penempatan_bed: penempatan, akses_unit: akses, revisi: Math.max(0, ...layanan.map((l) => l.revisi)), referensi: { bed, peran, unit } };
    }
    static async ubahLayanan(kode, data) {
        return sequelizeInstance.transaction(async (t) => {
            await this.kunci(t);
            const awal = await this.layanan(kode, t);
            if (awal.revisi !== data.revisi) throw galatIcu(409, "Revisi layanan telah berubah");
            const layanan = await this.layanan(kode, t, true);
            if (data.aktif && kode !== "umum") {
                const [syarat] = await pilihIcu(`SELECT 1 FROM icu_layanan_beds b
                    JOIN icu_akses_units a ON a.faskes_uuid=b.faskes_uuid AND a.ruangan_uuid=b.ruangan_uuid AND a.deleted_at IS NULL
                    WHERE b.faskes_uuid=:f AND b.layanan_uuid=:uuid AND b.deleted_at IS NULL AND b.berlaku_mulai<=:waktu
                    AND (b.berlaku_sampai IS NULL OR b.berlaku_sampai>:waktu)
                    AND EXISTS(SELECT 1 FROM icu_template_versis v WHERE v.faskes_uuid=:f AND v.layanan_uuid=:uuid AND v.status='ditetapkan' AND v.deleted_at IS NULL)`,
                { uuid: layanan.uuid, waktu: Math.floor(Date.now() / 1000) }, t);
                if (!syarat) throw galatIcu(409, "Aktivasi memerlukan bed, akses unit, dan template yang ditetapkan");
            }
            const [hasil] = await pilihIcu(`UPDATE icu_layanans SET aktif=:aktif,revisi=revisi+1,diubah_oleh=:pelaku,updated_at=:waktu
                WHERE uuid=:uuid AND faskes_uuid=:f AND deleted_at IS NULL RETURNING *`,
            { uuid: layanan.uuid, aktif: data.aktif, pelaku: Context.get(CTX_AUTHOR).username, waktu: Math.floor(Date.now() / 1000) }, t);
            await this.riwayat("icu_layanans", awal, hasil, data.alasan, t);
            return hasil;
        });
    }
    static async ubahBed(uuid, data) {
        return sequelizeInstance.transaction(async (t) => {
            await this.kunci(t);
            const sekarang = Math.floor(Date.now() / 1000);
            if (data.berlaku_mulai < sekarang) throw galatIcu(400, "Penempatan bed tidak boleh berlaku surut");
            const [bed] = await pilihIcu("SELECT * FROM room_monitorings WHERE uuid=:uuid AND faskes_uuid=:f AND deleted_at IS NULL FOR UPDATE", { uuid }, t);
            if (!bed?.room_uuid) throw galatIcu(404, "Bed atau unit tidak ditemukan");
            const [aktif] = await pilihIcu("SELECT uuid FROM icu_perawatans WHERE room_monitoring_uuid=:uuid AND faskes_uuid=:f AND status='aktif' AND deleted_at IS NULL", { uuid }, t);
            if (aktif) throw galatIcu(409, "Bed masih memiliki episode ICU aktif");
            const [awal] = await pilihIcu(`SELECT * FROM icu_layanan_beds WHERE room_monitoring_uuid=:uuid AND faskes_uuid=:f AND deleted_at IS NULL ORDER BY berlaku_mulai DESC LIMIT 1 FOR UPDATE`, { uuid }, t);
            if ((awal?.revisi ?? 0) !== data.revisi) throw galatIcu(409, "Revisi penempatan bed telah berubah");
            if (awal && Number(awal.berlaku_mulai) >= data.berlaku_mulai) throw galatIcu(409, "Jadwal penempatan bed bertumpang tindih");
            if (awal) await ubahIcu("UPDATE icu_layanan_beds SET berlaku_sampai=:mulai,updated_at=:sekarang WHERE uuid=:uuid AND faskes_uuid=:f AND deleted_at IS NULL", { mulai: data.berlaku_mulai, uuid: awal.uuid }, t);
            const layanan = await this.layanan(data.layanan_kode, t, true);
            const id = uuidv7();
            await ubahIcu(`INSERT INTO icu_layanan_beds(uuid,faskes_uuid,layanan_uuid,room_monitoring_uuid,ruangan_uuid,berlaku_mulai,revisi,dibuat_oleh,created_at)
                VALUES(:id,:f,:layanan,:bed,:unit,:mulai,:revisi,:pelaku,:sekarang)`,
            { id, layanan: layanan.uuid, bed: uuid, unit: bed.room_uuid, mulai: data.berlaku_mulai, revisi: data.revisi + 1 }, t);
            const [hasil] = await pilihIcu("SELECT * FROM icu_layanan_beds WHERE uuid=:id AND faskes_uuid=:f", { id }, t);
            await this.riwayat("icu_layanan_beds", awal ?? null, hasil, data.alasan, t);
            return hasil;
        });
    }
    static async ubahAkses(data) {
        return sequelizeInstance.transaction(async (t) => {
            await this.kunci(t);
            const [role] = await pilihIcu('SELECT uuid FROM "role" WHERE uuid=:id AND (faskes_uuid=:f OR faskes_uuid IS NULL) AND deleted_at IS NULL', { id: data.role_uuid }, t);
            const [unit] = await pilihIcu("SELECT uuid FROM lokasi WHERE uuid=:id AND faskes_uuid=:f AND deleted_at IS NULL", { id: data.ruangan_uuid }, t);
            if (!role || !unit) throw galatIcu(404, "Peran atau unit tidak ditemukan dalam fasilitas");
            const [awal] = await pilihIcu("SELECT * FROM icu_akses_units WHERE faskes_uuid=:f AND role_uuid=:role AND ruangan_uuid=:unit AND deleted_at IS NULL FOR UPDATE", { role: data.role_uuid, unit: data.ruangan_uuid }, t);
            if ((awal?.revisi ?? 0) !== data.revisi) throw galatIcu(409, "Revisi akses unit telah berubah");
            const id = awal?.uuid ?? uuidv7();
            if (awal) await ubahIcu("UPDATE icu_akses_units SET deleted_at=CASE WHEN :aktif THEN NULL ELSE :sekarang END,revisi=revisi+1,updated_at=:sekarang,diubah_oleh=:pelaku WHERE uuid=:id AND faskes_uuid=:f AND deleted_at IS NULL", { id, aktif: data.aktif }, t);
            else if (data.aktif) await ubahIcu("INSERT INTO icu_akses_units(uuid,faskes_uuid,role_uuid,ruangan_uuid,dibuat_oleh,created_at) VALUES(:id,:f,:role,:unit,:pelaku,:sekarang)", { id, role: data.role_uuid, unit: data.ruangan_uuid }, t);
            else throw galatIcu(404, "Akses unit belum dipetakan");
            const [hasil] = await pilihIcu("SELECT * FROM icu_akses_units WHERE uuid=:id AND faskes_uuid=:f", { id }, t);
            await this.riwayat("icu_akses_units", awal ?? null, hasil, data.alasan, t);
            return hasil;
        });
    }
    static async daftarRiwayat({ halaman, batas, dari, sampai }) {
        const kondisi = "faskes_uuid=:f AND (:dari IS NULL OR created_at>=:dari) AND (:sampai IS NULL OR created_at< :sampai)";
        const r = { dari: dari ?? null, sampai: sampai ?? null, batas, offset: (halaman - 1) * batas };
        const [jumlah] = await pilihIcu(`SELECT COUNT(*) AS total FROM icu_konfigurasi_riwayats WHERE ${kondisi}`, r);
        const data = await pilihIcu(`SELECT * FROM icu_konfigurasi_riwayats WHERE ${kondisi} ORDER BY created_at DESC,uuid DESC LIMIT :batas OFFSET :offset`, r);
        return { data, total: Number(jumlah.total), halaman, batas };
    }
}
