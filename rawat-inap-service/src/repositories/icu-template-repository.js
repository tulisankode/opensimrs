import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../configs/sequelize-instance.js";
import Konfigurasi, { pilihIcu, ubahIcu } from "./icu-konfigurasi-repository.js";
import { filterUnitIcu } from "../middlewares/icu-unit-middleware.js";
import { galatIcu } from "../helpers/icu-modul-helper.js";

export default class IcuTemplateRepository {
    static async ambil(uuid, t) {
        if (!uuid) return null;
        const [versi] = await pilihIcu(`SELECT v.*, l.kode AS layanan_kode FROM icu_template_versis v
            JOIN icu_layanans l ON l.faskes_uuid=v.faskes_uuid AND l.uuid=v.layanan_uuid AND l.deleted_at IS NULL
            WHERE v.uuid=:uuid AND v.faskes_uuid=:f AND v.deleted_at IS NULL`, { uuid }, t);
        if (!versi) throw galatIcu(404, "Versi template tidak ditemukan");
        return versi;
    }
    static async daftar(data, klinis = false) {
        const unit = filterUnitIcu("b");
        const kondisi = `v.faskes_uuid=:f AND v.deleted_at IS NULL AND l.deleted_at IS NULL
            AND (:kode IS NULL OR l.kode=:kode) AND (:status IS NULL OR v.status=:status)
            ${klinis ? `AND v.status='ditetapkan' AND l.aktif=true AND EXISTS(SELECT 1 FROM icu_layanan_beds b
                WHERE b.faskes_uuid=:f AND b.layanan_uuid=l.uuid AND b.deleted_at IS NULL
                AND b.berlaku_mulai<=:waktu AND (b.berlaku_sampai IS NULL OR b.berlaku_sampai>:waktu) AND ${unit.sql})` : ""}`;
        const r = { kode: data.layanan_kode ?? null, status: data.status ?? null,
            waktu: Math.floor(Date.now() / 1000), ...unit.replacements, batas: data.batas, offset: (data.halaman - 1) * data.batas };
        const tabel = "icu_template_versis v JOIN icu_layanans l ON l.uuid=v.layanan_uuid AND l.faskes_uuid=v.faskes_uuid";
        const [jumlah] = await pilihIcu(`SELECT COUNT(*) AS total FROM ${tabel} WHERE ${kondisi}`, r);
        const baris = await pilihIcu(`SELECT v.*,l.kode AS layanan_kode FROM ${tabel} WHERE ${kondisi} ORDER BY v.created_at DESC,v.nomor_versi DESC LIMIT :batas OFFSET :offset`, r);
        return { data: baris, total: Number(jumlah.total), halaman: data.halaman, batas: data.batas };
    }
    static async simpan(data, uuid, tindakan = "buat") {
        return sequelizeInstance.transaction(async (t) => {
            await Konfigurasi.kunci(t);
            const awal = uuid ? await this.ambil(uuid, t) : null;
            let hasil;
            if (["buat", "versi"].includes(tindakan)) {
                const layanan = awal ? { uuid: awal.layanan_uuid } : await Konfigurasi.layanan(data.layanan_kode, t, true);
                const kode = awal?.kode_template ?? data.kode_template;
                const [terakhir] = await pilihIcu("SELECT MAX(nomor_versi) AS nomor FROM icu_template_versis WHERE faskes_uuid=:f AND layanan_uuid=:layanan AND kode_template=:kode", { layanan: layanan.uuid, kode }, t);
                if (!awal && terakhir.nomor) throw galatIcu(409, "Kode template sudah ada; buat versi berikutnya");
                const id = uuidv7();
                await ubahIcu(`INSERT INTO icu_template_versis(uuid,faskes_uuid,layanan_uuid,kode_template,nomor_versi,nama,status,definisi,aturan_kelengkapan,dibuat_oleh,created_at)
                    VALUES(:id,:f,:layanan,:kode,:nomor,:nama,'draf',CAST(:definisi AS jsonb),CAST(:aturan AS jsonb),:pelaku,:sekarang)`,
                { id, layanan: layanan.uuid, kode, nomor: Number(terakhir.nomor ?? 0) + 1, nama: data.nama,
                    definisi: JSON.stringify(data.definisi), aturan: JSON.stringify(data.aturan_kelengkapan) }, t);
                hasil = await this.ambil(id, t);
            } else {
                if (awal.revisi !== data.revisi) throw galatIcu(409, "Revisi template telah berubah");
                if (tindakan === "ubah" && awal.status !== "draf") throw galatIcu(409, "Hanya versi draf yang dapat diubah");
                if (tindakan === "tetapkan" && awal.status !== "draf") throw galatIcu(409, "Hanya draf yang dapat ditetapkan");
                if (tindakan === "arsipkan" && awal.status !== "ditetapkan") throw galatIcu(409, "Hanya versi ditetapkan yang dapat diarsipkan");
                const isi = tindakan === "ubah" ? ",nama=:nama,definisi=CAST(:definisi AS jsonb),aturan_kelengkapan=CAST(:aturan AS jsonb)" : "";
                const penetapan = tindakan === "tetapkan" ? ",ditetapkan_oleh=:pelaku,waktu_penetapan=:sekarang" : "";
                await ubahIcu(`UPDATE icu_template_versis SET revisi=revisi+1,updated_at=:sekarang,diubah_oleh=:pelaku,status=:status ${isi} ${penetapan}
                    WHERE uuid=:uuid AND faskes_uuid=:f AND deleted_at IS NULL`,
                { uuid, status: tindakan === "tetapkan" ? "ditetapkan" : tindakan === "arsipkan" ? "diarsipkan" : "draf",
                    nama: data.nama ?? null, definisi: JSON.stringify(data.definisi ?? null), aturan: JSON.stringify(data.aturan_kelengkapan ?? null) }, t);
                hasil = await this.ambil(uuid, t);
            }
            await Konfigurasi.riwayat("icu_template_versis", tindakan === "versi" ? null : awal, hasil, data.alasan ?? "Penyusunan draf template", t);
            return hasil;
        });
    }
}
