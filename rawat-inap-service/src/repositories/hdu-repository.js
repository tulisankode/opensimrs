import { QueryTypes } from "sequelize";
import { uuidv7 } from "uuidv7";
import { createHash } from "node:crypto";
import { gagal, periksaVersi, periksaWaktu, pilihInstruksi } from "../services/hdu-aturan.js";
import HduPerpindahanAdapter from "../services/hdu-perpindahan-adapter.js";

// Koneksi diberikan pemanggil agar aturan transaksi dapat diuji tanpa membuka database.
export default class HduRepository {
    constructor(db, author) { this.db = db; this.author = author; }

    query(sql, data = {}, transaction) {
        return this.db.query(sql, { replacements: { f: this.author.faskesUuid, pelaku: this.author.user_uuid, sekarang: Math.floor(Date.now() / 1000), ...data }, type: QueryTypes.SELECT, transaction });
    }

    async tulis(operasi, data, kunci, jalankan) {
        return this.db.transaction(async (transaction) => {
            const q = (sql, nilai) => this.query(sql, nilai, transaction);
            await q(`SELECT pg_advisory_xact_lock(hashtext(:f))`);
            const sidik = createHash("sha256").update(JSON.stringify(data)).digest("hex");
            const [lama] = await q(`SELECT * FROM hdu_operasi WHERE faskes_uuid = :f AND pelaku = :pelaku AND kunci = :kunci`, { kunci });
            if (lama) {
                if (lama.operasi !== operasi || lama.sidik !== sidik) gagal("Kunci pengiriman telah dipakai untuk masukan berbeda.");
                return lama.hasil;
            }
            const hasil = await jalankan(q);
            await q(`INSERT INTO hdu_operasi (faskes_uuid, pelaku, kunci, operasi, sidik, hasil, created_at) VALUES (:f, :pelaku, :kunci, :operasi, :sidik, CAST(:hasil AS JSONB), :sekarang)`, {
                kunci, operasi, sidik, hasil: JSON.stringify(hasil),
            });
            return hasil;
        });
    }

    async satu(q, tabel, uuid, kunci = false) {
        // Nama tabel hanya berasal dari konstanta internal.
        const [baris] = await q(`SELECT * FROM ${tabel} WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`, { uuid });
        if (!baris) gagal("Data HDU tidak ditemukan.", 404);
        return baris;
    }

    async konfigurasi() {
        return this.query(`SELECT k.*, l.name AS nama_ruangan FROM hdu_konfigurasi k JOIN lokasi l ON l.uuid = k.ruangan_uuid AND l.faskes_uuid = k.faskes_uuid AND l.deleted_at IS NULL WHERE k.faskes_uuid = :f AND k.deleted_at IS NULL ORDER BY k.nama`);
    }

    async simpanKonfigurasi(q, data, uuid) {
        if (uuid) {
            const lama = await this.satu(q, "hdu_konfigurasi", uuid, true);
            periksaVersi(lama, data.versi);
            const dipakai = await q(`SELECT uuid FROM hdu_episode WHERE konfigurasi_uuid = :uuid AND faskes_uuid = :f AND status = 'aktif' AND deleted_at IS NULL`, { uuid });
            if (!data.aktif && dipakai.length) gagal("Konfigurasi masih digunakan episode aktif.");
            await q(`UPDATE hdu_konfigurasi SET nama = :nama, aktif = :aktif, versi = versi + 1, updated_at = :sekarang, pencatat = :pelaku WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, { ...data, uuid });
        } else {
            const [ruangan] = await q(`SELECT uuid FROM lokasi WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, { uuid: data.ruangan_uuid });
            if (!ruangan) gagal("Ruangan tidak ditemukan pada fasilitas kesehatan ini.", 404);
            const lama = await q(`SELECT uuid FROM hdu_konfigurasi WHERE ruangan_uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, { uuid: data.ruangan_uuid });
            if (lama.length) gagal("Ruangan telah dipetakan ke HDU.");
            uuid = uuidv7();
            await q(`INSERT INTO hdu_konfigurasi (uuid, faskes_uuid, ruangan_uuid, nama, aktif, pencatat, created_at) VALUES (:uuid, :f, :ruangan_uuid, :nama, :aktif, :pelaku, :sekarang)`, { ...data, uuid });
        }
        return this.satu(q, "hdu_konfigurasi", uuid);
    }

    async tempatTidur() {
        return this.query(`SELECT b.uuid, b.no_bed, b.room_uuid AS ruangan_uuid, b.status_operasional,
            b.patient_uuid IS NULL AND b.status_operasional = 'Tersedia' AND NOT EXISTS (
                SELECT 1 FROM rawat_inaps ri WHERE ri.monitoring_room_uuid = b.uuid AND ri.faskes_uuid = b.faskes_uuid
                AND ri.deleted_at IS NULL AND ri.discharge_date IS NULL AND ri.status_ri IN (1, 2, 3)) AS tersedia,
            k.uuid AS konfigurasi_uuid, k.nama AS nama_unit
            FROM room_monitorings b JOIN hdu_konfigurasi k ON k.ruangan_uuid = b.room_uuid AND k.faskes_uuid = b.faskes_uuid AND k.aktif AND k.deleted_at IS NULL
            JOIN lokasi l ON l.uuid = b.room_uuid AND l.faskes_uuid = b.faskes_uuid AND l.deleted_at IS NULL
            WHERE b.faskes_uuid = :f AND b.deleted_at IS NULL ORDER BY k.nama, b.no_bed`);
    }

    async daftar({ halaman, batas, status, konfigurasi_uuid }) {
        const filter = `e.faskes_uuid = :f AND e.deleted_at IS NULL AND (:status IS NULL OR e.status = :status) AND (:unit IS NULL OR e.konfigurasi_uuid = :unit)`;
        const data = { status: status ?? null, unit: konfigurasi_uuid ?? null, batas, offset: (halaman - 1) * batas };
        const sumber = `FROM hdu_episode e JOIN rawat_inaps ri ON ri.uuid = e.rawat_inap_uuid AND ri.faskes_uuid = e.faskes_uuid AND ri.deleted_at IS NULL
            JOIN patients p ON p.uuid = e.pasien_uuid AND p.faskes_uuid = e.faskes_uuid AND p.deleted_at IS NULL`;
        const items = await this.query(`SELECT e.*, ri.name AS nama_pasien, ri.no_rm ${sumber} WHERE ${filter} ORDER BY e.waktu_masuk DESC, e.uuid DESC LIMIT :batas OFFSET :offset`, data);
        const [jumlah] = await this.query(`SELECT COUNT(*) AS jumlah ${sumber} WHERE ${filter}`, data);
        return { items, paginasi: { halaman, batas, jumlah: Number(jumlah.jumlah) } };
    }

    async serahTerima({ halaman, batas, arah, status_penerimaan }) {
        const sumber = `FROM hdu_serah_terima st
            JOIN perpindahans p ON p.uuid = st.perpindahan_uuid AND p.faskes_uuid = st.faskes_uuid AND p.deleted_at IS NULL
            JOIN rawat_inaps ri ON ri.uuid = p.admission_ri_uuid AND ri.faskes_uuid = st.faskes_uuid AND ri.deleted_at IS NULL
            JOIN patients pt ON pt.uuid = ri.patient_uuid AND pt.faskes_uuid = st.faskes_uuid AND pt.deleted_at IS NULL`;
        const filter = `st.faskes_uuid = :f AND st.deleted_at IS NULL AND (:arah IS NULL OR st.arah = :arah)
            AND (:status IS NULL OR (:status = 'menunggu' AND st.penerima IS NULL)
                OR (:status = 'dikonfirmasi' AND st.penerima IS NOT NULL))`;
        const data = { arah: arah ?? null, status: status_penerimaan ?? null, batas, offset: (halaman - 1) * batas };
        const items = await this.query(`SELECT st.*, p.status_pindah ${sumber} WHERE ${filter}
            ORDER BY st.created_at DESC, st.uuid DESC LIMIT :batas OFFSET :offset`, data);
        const [jumlah] = await this.query(`SELECT COUNT(*) AS jumlah ${sumber} WHERE ${filter}`, data);
        return { items, paginasi: { halaman, batas, jumlah: Number(jumlah.jumlah) } };
    }

    async detail(uuid) {
        const q = (sql, data) => this.query(sql, data);
        const episode = await this.satu(q, "hdu_episode", uuid);
        await this.satu(q, "rawat_inaps", episode.rawat_inap_uuid);
        await this.satu(q, "patients", episode.pasien_uuid);
        const instruksi = await q(`SELECT * FROM hdu_instruksi_observasi WHERE faskes_uuid = :f AND konfigurasi_uuid = :unit AND (episode_uuid = :uuid OR episode_uuid IS NULL) AND deleted_at IS NULL ORDER BY berlaku_mulai DESC, versi DESC`, { uuid, unit: episode.konfigurasi_uuid });
        const serahTerima = await q(`SELECT * FROM hdu_serah_terima WHERE episode_uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL ORDER BY created_at`, { uuid });
        const konteks = pilihInstruksi(instruksi.filter((r) => r.episode_uuid), instruksi.filter((r) => !r.episode_uuid), Math.floor(Date.now() / 1000));
        return { episode, instruksi, instruksi_berlaku: konteks, serah_terima: serahTerima };
    }

    async instruksi(q, uuid, data, tingkat) {
        const tabel = tingkat === "unit" ? "hdu_konfigurasi" : "hdu_episode";
        const induk = await this.satu(q, tabel, uuid, true);
        periksaVersi(induk, data.versi);
        if (tingkat === "episode" && induk.status !== "aktif") gagal("Episode telah selesai.");
        const sekarang = Math.floor(Date.now() / 1000);
        if (data.berlaku_mulai < Number(induk.created_at) || data.berlaku_mulai < sekarang) gagal("Instruksi baru harus berlaku sejak waktu pencatatan atau sesudahnya.", 422);
        const konfigurasiUuid = tingkat === "unit" ? uuid : induk.konfigurasi_uuid;
        await q(`INSERT INTO hdu_instruksi_observasi (uuid, faskes_uuid, konfigurasi_uuid, episode_uuid, interval_detik, berlaku_mulai, alasan, versi, pencatat, created_at)
            VALUES (:id, :f, :unit, :episode, :interval_detik, :berlaku_mulai, :alasan, :versi, :pelaku, :sekarang)`, {
            ...data, id: uuidv7(), unit: konfigurasiUuid, episode: tingkat === "unit" ? null : uuid, versi: data.versi + 1,
        });
        await q(`UPDATE ${tabel} SET versi = versi + 1, updated_at = :sekarang WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, { uuid });
        return this.satu(q, tabel, uuid);
    }

    async siapkanSerahTerima(q, data) {
        periksaWaktu(data.waktu_kejadian, Math.floor(Date.now() / 1000));
        const { p, ri, asal, tujuan } = await new HduPerpindahanAdapter(q).kunci(data.perpindahan_uuid);
        periksaWaktu(data.waktu_kejadian, Math.floor(Date.now() / 1000), Number(ri.tanggal_dirawat || ri.created_at));
        if (p.status_pindah !== "pending") gagal("Perpindahan tidak lagi menunggu penerimaan.");
        const [konfigurasi] = await q(`SELECT * FROM hdu_konfigurasi WHERE ruangan_uuid = :room AND faskes_uuid = :f AND aktif AND deleted_at IS NULL`, { room: data.arah === "masuk" ? tujuan.room_uuid : asal.room_uuid });
        if (!konfigurasi) gagal("Ruangan HDU belum dikonfigurasi atau tidak aktif.");
        const [episode] = await q(`SELECT * FROM hdu_episode WHERE rawat_inap_uuid = :ri AND faskes_uuid = :f AND status = 'aktif' AND deleted_at IS NULL`, { ri: ri.uuid });
        if (data.arah === "keluar" && (!episode || episode.room_monitoring_uuid !== asal.uuid)) gagal("Episode aktif tidak cocok dengan tempat tidur asal.");
        if (data.arah === "masuk" && (episode || data.tujuan_icu)) gagal("Penerimaan HDU tidak valid untuk episode atau tujuan ini.");
        const [lama] = await q(`SELECT uuid FROM hdu_serah_terima WHERE perpindahan_uuid = :p AND faskes_uuid = :f AND arah = :arah AND deleted_at IS NULL`, { p: p.uuid, arah: data.arah });
        if (lama) gagal("Serah terima untuk perpindahan ini telah dicatat.");
        const uuid = uuidv7();
        await q(`INSERT INTO hdu_serah_terima (uuid, faskes_uuid, episode_uuid, perpindahan_uuid, arah, ringkasan, tujuan_icu, pengirim, waktu_kejadian, created_at)
            VALUES (:uuid, :f, :episode, :perpindahan_uuid, :arah, CAST(:ringkasan AS JSONB), :tujuan_icu, :pelaku, :waktu_kejadian, :sekarang)`, {
            ...data, uuid, episode: episode?.uuid ?? null, ringkasan: JSON.stringify(data.ringkasan),
        });
        return this.satu(q, "hdu_serah_terima", uuid);
    }

    async konfirmasi(q, uuid, data, bolehIcu) {
        const st = await this.satu(q, "hdu_serah_terima", uuid, true);
        periksaVersi(st, data.versi);
        if (st.penerima) gagal("Serah terima telah dikonfirmasi.");
        if (st.pengirim === this.author.user_uuid) gagal("Konfirmasi harus dilakukan petugas penerima yang berbeda.", 403);
        periksaWaktu(data.waktu_kejadian, Math.floor(Date.now() / 1000), Number(st.waktu_kejadian));
        const adapter = new HduPerpindahanAdapter(q);
        const perpindahan = await adapter.kunci(st.perpindahan_uuid);
        const { p, ri, asal, tujuan } = perpindahan;
        let episodeUuid = st.episode_uuid;
        if (st.arah === "masuk") {
            const [konfigurasi] = await q(`SELECT * FROM hdu_konfigurasi WHERE ruangan_uuid = :room AND faskes_uuid = :f AND aktif AND deleted_at IS NULL FOR UPDATE`, { room: tujuan.room_uuid });
            if (!konfigurasi) gagal("Tujuan bukan ruangan HDU aktif.");
            const ganda = await q(`SELECT uuid FROM hdu_episode WHERE pasien_uuid = :pasien AND faskes_uuid = :f AND status = 'aktif' AND deleted_at IS NULL`, { pasien: ri.patient_uuid });
            if (ganda.length) gagal("Pasien masih memiliki episode HDU aktif.");
            const icu = await q(`SELECT uuid FROM icu_perawatans WHERE rawat_inap_uuid = :ri AND faskes_uuid = :f AND status = 'aktif' AND deleted_at IS NULL`, { ri: ri.uuid });
            if (icu.length) gagal("Selesaikan serah terima keluar ICU sebelum menerima di HDU.");
            episodeUuid = uuidv7();
            await adapter.pindahkan(perpindahan, data.waktu_kejadian);
            await q(`INSERT INTO hdu_episode (uuid, faskes_uuid, konfigurasi_uuid, pasien_uuid, rawat_inap_uuid, rekam_medis_uuid, room_monitoring_uuid, perpindahan_masuk_uuid, status, waktu_masuk, pencatat, created_at)
                VALUES (:uuid, :f, :unit, :pasien, :ri, :rm, :bed, :p, 'aktif', :waktu, :pelaku, :sekarang)`, {
                uuid: episodeUuid, unit: konfigurasi.uuid, pasien: ri.patient_uuid, ri: ri.uuid, rm: ri.rekam_medis_uuid, bed: tujuan.uuid, p: p.uuid, waktu: data.waktu_kejadian,
            });
        } else {
            const episode = await this.satu(q, "hdu_episode", episodeUuid, true);
            if (episode.status !== "aktif" || episode.rawat_inap_uuid !== ri.uuid || episode.room_monitoring_uuid !== asal.uuid) gagal("Episode tidak cocok dengan perpindahan keluar.");
            periksaWaktu(data.waktu_kejadian, Math.floor(Date.now() / 1000), Number(episode.waktu_masuk));
            const [tujuanHdu] = await q(`SELECT uuid FROM hdu_konfigurasi WHERE ruangan_uuid = :room AND faskes_uuid = :f AND aktif AND deleted_at IS NULL`, { room: tujuan.room_uuid });
            if (tujuanHdu) gagal("Perpindahan antarunit HDU perlu serah terima keluar dan masuk yang terkoordinasi; gunakan tujuan di luar HDU.");
            if (st.tujuan_icu && !bolehIcu) gagal("Aktivasi dan izin penerimaan ICU diperlukan.", 403);
            await adapter.pindahkan(perpindahan, data.waktu_kejadian);
            if (st.tujuan_icu) {
                const id = uuidv7();
                await q(`INSERT INTO icu_perawatans (uuid, faskes_uuid, rawat_inap_uuid, perpindahan_masuk_uuid, room_monitoring_uuid, ruangan_uuid, status, waktu_masuk, dibuat_oleh, created_at)
                    VALUES (:uuid, :f, :ri, :p, :bed, :room, 'aktif', :waktu, :pelaku, :sekarang)`, { uuid: id, ri: ri.uuid, p: p.uuid, bed: tujuan.uuid, room: tujuan.room_uuid, waktu: data.waktu_kejadian });
                await q(`INSERT INTO icu_serah_terimas (uuid, faskes_uuid, perawatan_uuid, perpindahan_uuid, jenis, kondisi, terapi_berjalan, tindak_lanjut, pencatat, waktu_konfirmasi, dikonfirmasi_oleh, created_at)
                    VALUES (:uuid, :f, :icu, :p, 'masuk', :kondisi, :terapi_berjalan, :tindak_lanjut, :pengirim, :waktu, :pelaku, :sekarang)`, { ...st.ringkasan, uuid: uuidv7(), icu: id, p: p.uuid, pengirim: st.pengirim, waktu: data.waktu_kejadian });
            }
            await q(`UPDATE hdu_episode SET status = 'selesai', waktu_keluar = :waktu, perpindahan_keluar_uuid = :p, jenis_keluar = 'pindah', versi = versi + 1, updated_at = :sekarang WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, { uuid: episodeUuid, waktu: data.waktu_kejadian, p: p.uuid });
        }
        await q(`UPDATE hdu_serah_terima SET episode_uuid = :episode, penerima = :pelaku, waktu_penerimaan = :waktu, waktu_konfirmasi = :sekarang, versi = versi + 1, updated_at = :sekarang WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, { uuid, episode: episodeUuid, waktu: data.waktu_kejadian });
        return { serah_terima: await this.satu(q, "hdu_serah_terima", uuid), episode: await this.satu(q, "hdu_episode", episodeUuid) };
    }

    // Penutupan episode tanpa perpindahan bed: pasien meninggal di HDU, atau pulang langsung setelah pemulangan
    // admisi selesai (bed dilepas oleh proses pemulangan sumber). Pindah ruangan tetap wajib lewat serah terima keluar.
    async selesai(q, uuid, data) {
        const episode = await this.satu(q, "hdu_episode", uuid, true);
        periksaVersi(episode, data.versi);
        if (episode.status !== "aktif") gagal("Episode telah selesai.");
        periksaWaktu(data.waktu_kejadian, Math.floor(Date.now() / 1000), Number(episode.waktu_masuk));
        const ri = await this.satu(q, "rawat_inaps", episode.rawat_inap_uuid, true);
        const [menunggu] = await q(`SELECT st.uuid FROM hdu_serah_terima st JOIN perpindahans p ON p.uuid = st.perpindahan_uuid AND p.faskes_uuid = st.faskes_uuid
            AND p.deleted_at IS NULL AND p.status_pindah = 'pending' WHERE st.episode_uuid = :uuid AND st.faskes_uuid = :f AND st.arah = 'keluar'
            AND st.penerima IS NULL AND st.deleted_at IS NULL`, { uuid });
        if (menunggu) gagal("Masih ada serah terima keluar yang menunggu konfirmasi; selesaikan atau batalkan perpindahannya terlebih dahulu.");
        if (data.jenis_keluar === "pulang" && (Number(ri.status_ri) !== 4 || !ri.discharge_date)) gagal("Selesaikan pemulangan pasien di Rawat Inap terlebih dahulu.");
        await q(`UPDATE hdu_episode SET status = 'selesai', waktu_keluar = :waktu, jenis_keluar = :jenis, catatan_keluar = :catatan, versi = versi + 1, updated_at = :sekarang
            WHERE uuid = :uuid AND faskes_uuid = :f AND status = 'aktif' AND deleted_at IS NULL`, { uuid, waktu: data.waktu_kejadian, jenis: data.jenis_keluar, catatan: data.catatan });
        return this.satu(q, "hdu_episode", uuid);
    }
}
