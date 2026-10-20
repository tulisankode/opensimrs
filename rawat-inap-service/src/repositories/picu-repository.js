import { createHash } from "node:crypto";
import { validasiIsi, jenisDokumentasi } from "../validations/picu-request.js";
import { statusModulIntensif } from "../helpers/modul-intensif.js";

export class PicuError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}
const gagal = (status, pesan) => { throw new PicuError(status, pesan); };
const kanonis = (v) => Array.isArray(v) ? v.map(kanonis) : v && typeof v === "object"
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, kanonis(v[k])])) : v;

// Dependensi disuntikkan agar uji tidak memuat konfigurasi koneksi maupun kredensial.
export default class PicuRepository {
    constructor(db, author, buatUuid, bolehDokumentasi = () => false) {
        this.db = db;
        this.author = author;
        this.buatUuid = buatUuid;
        this.bolehDokumentasi = bolehDokumentasi;
        if (!author?.faskesUuid || !author?.user_uuid) gagal(401, "Konteks pengguna dan faskes diperlukan.");
    }
    async q(sql, data = {}, transaction) {
        return this.db.query(sql, {
            replacements: { ...data, f: this.author.faskesUuid, aktor: this.author.user_uuid },
            type: "SELECT", transaction,
        });
    }
    async satu(sql, data, transaction, pesan = "Data PICU tidak ditemukan.") {
        const [hasil] = await this.q(sql, data, transaction);
        if (!hasil) gagal(404, pesan);
        return hasil;
    }
    async tulis(lingkup, kunci, data, proses) {
        if (typeof kunci !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(kunci)) gagal(422, "Idempotency-Key wajib diisi (8–100 karakter).");
        const ringkasan = createHash("sha256").update(JSON.stringify(kanonis(data))).digest("hex");
        try {
            return await this.db.transaction(async (t) => {
                await this.q(`INSERT INTO picu_idempotensi (faskes_uuid, lingkup, kunci, ringkasan, dibuat_oleh, created_at)
                    VALUES (:f, :lingkup, :kunci, :ringkasan, :aktor, :waktu) ON CONFLICT DO NOTHING RETURNING kunci`,
                { lingkup, kunci, ringkasan, waktu: Math.floor(Date.now() / 1000) }, t);
                const lama = await this.satu(`SELECT * FROM picu_idempotensi WHERE faskes_uuid = :f AND lingkup = :lingkup
                    AND kunci = :kunci AND deleted_at IS NULL FOR UPDATE`, { lingkup, kunci }, t);
                if (lama.ringkasan !== ringkasan || lama.dibuat_oleh !== this.author.user_uuid) gagal(409, "Kunci permintaan telah digunakan dengan isi atau pengguna berbeda.");
                if (lama.hasil) {
                    if (lama.hasil.konfigurasi_uuid && !this.bolehDokumentasi(lama.hasil.jenis,
                        lingkup.endsWith("/finalisasi") ? "FINALISASI" : data.koreksi_uuid ? "KOREKSI" : "CREATE")) {
                        gagal(403, "Izin jenis dokumentasi tidak tersedia.");
                    }
                    if (lama.hasil.konfigurasi_uuid) await this.pastikanFiturDokumentasi(lama.hasil.jenis, t);
                    return lama.hasil;
                }
                const hasil = await proses(t);
                await this.q(`UPDATE picu_idempotensi SET hasil = CAST(:hasil AS jsonb) WHERE faskes_uuid = :f
                    AND lingkup = :lingkup AND kunci = :kunci AND deleted_at IS NULL RETURNING kunci`,
                { lingkup, kunci, hasil: JSON.stringify(hasil) }, t);
                return hasil;
            });
        } catch (e) {
            if (e.name === "SequelizeUniqueConstraintError" || e.original?.code === "23505") gagal(409, "Episode, tempat tidur, atau revisi telah digunakan. Muat ulang data.");
            throw e;
        }
    }
    episode(uuid, t, aktif = false) {
        return this.satu(`SELECT * FROM picu_episode WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL${t ? " FOR UPDATE" : ""}`,
            { uuid }, t).then((e) => {
            if (aktif && e.status !== "aktif") gagal(409, "Episode PICU telah selesai.");
            return e;
        });
    }
    async riwayat(e, jenis, referensi, asal, tujuan, alasan, t) {
        await this.q(`INSERT INTO picu_riwayat (uuid, faskes_uuid, episode_uuid, jenis, referensi_uuid, asal_uuid,
            tujuan_uuid, alasan, dibuat_oleh, created_at) VALUES (:uuid, :f, :episode, :jenis, :referensi,
            :asal, :tujuan, :alasan, :aktor, :waktu) RETURNING uuid`, {
            uuid: this.buatUuid(), episode: e.uuid, jenis, referensi: referensi ?? null, asal: asal ?? null,
            tujuan: tujuan ?? null, alasan, waktu: Math.floor(Date.now() / 1000),
        }, t);
    }
    async tempatTidur(t) {
        return this.q(`SELECT b.uuid, b.no_bed, b.room_uuid, l.name AS lokasi, b.status_operasional,
            CASE WHEN b.status = false OR COALESCE(b.status_operasional, '') NOT IN ('Tersedia', 'Penuh') THEN 'tidak_operasional'
                 WHEN b.patient_uuid IS NOT NULL THEN 'terpakai'
                 WHEN b.status_operasional = 'Tersedia' THEN 'tersedia' ELSE 'tidak_operasional' END AS status
            FROM picu_tempat_tidur p JOIN room_monitorings b ON b.uuid = p.tempat_tidur_uuid
              AND b.faskes_uuid = p.faskes_uuid AND b.deleted_at IS NULL
            LEFT JOIN lokasi l ON l.uuid = b.room_uuid AND l.faskes_uuid = b.faskes_uuid AND l.deleted_at IS NULL
            WHERE p.faskes_uuid = :f AND p.deleted_at IS NULL ORDER BY b.no_bed`, {}, t);
    }
    sumberTempatTidur() {
        return this.q(`SELECT b.uuid, b.no_bed, l.name AS lokasi FROM room_monitorings b
            LEFT JOIN lokasi l ON l.uuid = b.room_uuid AND l.faskes_uuid = b.faskes_uuid AND l.deleted_at IS NULL
            WHERE b.faskes_uuid = :f AND b.deleted_at IS NULL AND b.status = true
            AND NOT EXISTS (SELECT 1 FROM picu_tempat_tidur p WHERE p.tempat_tidur_uuid = b.uuid
                AND p.faskes_uuid = :f AND p.deleted_at IS NULL) ORDER BY l.name, b.no_bed LIMIT 500`);
    }
    calonPenerimaan() {
        return this.q(`SELECT p.uuid AS referensi_penerimaan_uuid, r.uuid AS kunjungan_uuid, r.patient_uuid AS pasien_uuid,
            b.uuid AS tempat_tidur_uuid, r.name AS nama_pasien, r.no_rm, r.no_reg, b.no_bed
            FROM perpindahans p JOIN rawat_inaps r ON r.uuid = p.admission_ri_uuid AND r.faskes_uuid = p.faskes_uuid
                AND r.deleted_at IS NULL AND r.status_ri = 3
            JOIN patients ps ON ps.uuid = r.patient_uuid AND ps.faskes_uuid = r.faskes_uuid AND ps.deleted_at IS NULL
            JOIN room_monitorings b ON b.uuid = p.destination_monitoring_room_uuid AND b.uuid = r.monitoring_room_uuid
                AND b.patient_uuid = r.patient_uuid AND b.faskes_uuid = p.faskes_uuid AND b.deleted_at IS NULL
            JOIN picu_tempat_tidur m ON m.tempat_tidur_uuid = b.uuid AND m.faskes_uuid = b.faskes_uuid AND m.deleted_at IS NULL
            WHERE p.faskes_uuid = :f AND p.deleted_at IS NULL AND p.status_pindah = 'approve'
                AND NOT EXISTS (SELECT 1 FROM picu_episode e WHERE e.faskes_uuid = :f AND e.deleted_at IS NULL
                    AND (e.referensi_penerimaan_uuid = p.uuid OR (e.pasien_uuid = r.patient_uuid AND e.status = 'aktif')))
            ORDER BY p.waktu_pindah DESC LIMIT 100`);
    }
    async transaksiSumber(uuid, sumber, boleh) {
        const kontrak = {
            laboratorium: { tabel: "order_lab", registrasi: "noreg", status: "order_status", modul: "Laboratorium", sub: "Order Lab", rute: "/laboratorium/order-lab" },
            farmasi: { tabel: "prescriptions", registrasi: "no_reg", status: "order_status", modul: "Farmasi", sub: "Resep Dokter", rute: "/farmasi/resep-dokter" },
            radiologi: { tabel: "rad_order", registrasi: "no_reg", status: "status", modul: "Radiologi", sub: "Order Radiologi", rute: "/radiologi/order" },
        }[sumber];
        if (!kontrak || !boleh(kontrak.modul, kontrak.sub)) gagal(403, "Izin membaca transaksi modul sumber diperlukan.");
        const sumberAktif = await statusModulIntensif((sql, data) => this.q(sql, data), this.author.faskesUuid, sumber);
        if (!sumberAktif.modul) gagal(403, "Modul sumber tidak aktif pada faskes ini.");
        const e = await this.episode(uuid);
        // Nama tabel dan kolom hanya berasal dari daftar kontrak tetap, bukan dari masukan pengguna.
        const items = await this.q(`SELECT o.uuid AS transaksi_uuid, o.${kontrak.status} AS status FROM ${kontrak.tabel} o
            JOIN rawat_inaps r ON r.no_reg = o.${kontrak.registrasi} AND r.patient_uuid = o.patient_uuid
                AND r.faskes_uuid = o.faskes_uuid AND r.deleted_at IS NULL
            WHERE r.uuid = :kunjungan AND o.patient_uuid = :pasien AND o.faskes_uuid = :f
                AND o.deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 100`, { kunjungan: e.kunjungan_uuid, pasien: e.pasien_uuid });
        return { sumber, rute: kontrak.rute, items };
    }
    async dashboard(periode) {
        const tempatTidur = await this.tempatTidur();
        const ringkasan = await this.satu(`SELECT COUNT(*) FILTER (WHERE waktu_masuk BETWEEN :mulai_at AND :selesai_at) AS masuk,
            COUNT(*) FILTER (WHERE jenis_keluar = 'transfer' AND waktu_keluar BETWEEN :mulai_at AND :selesai_at) AS transfer_keluar,
            COUNT(*) FILTER (WHERE jenis_keluar = 'pulang' AND waktu_keluar BETWEEN :mulai_at AND :selesai_at) AS pulang
            FROM picu_episode WHERE faskes_uuid = :f AND deleted_at IS NULL`, periode);
        return { periode, kapasitas: tempatTidur.length,
            tersedia: tempatTidur.filter((b) => b.status === "tersedia").length,
            terpakai: tempatTidur.filter((b) => b.status === "terpakai").length,
            tidak_operasional: tempatTidur.filter((b) => b.status === "tidak_operasional").length,
            ...ringkasan, tempat_tidur: tempatTidur };
    }
    async daftarEpisode(halaman) {
        const data = { offset: (halaman - 1) * 25 };
        const items = await this.q(`SELECT e.*, r.name AS nama_pasien, r.no_rm, b.no_bed FROM picu_episode e
            JOIN rawat_inaps r ON r.uuid = e.kunjungan_uuid AND r.faskes_uuid = e.faskes_uuid AND r.deleted_at IS NULL
            LEFT JOIN room_monitorings b ON b.uuid = e.tempat_tidur_uuid AND b.faskes_uuid = e.faskes_uuid AND b.deleted_at IS NULL
            WHERE e.faskes_uuid = :f AND e.deleted_at IS NULL ORDER BY e.waktu_masuk DESC, e.uuid DESC LIMIT 25 OFFSET :offset`, data);
        const total = await this.satu(`SELECT COUNT(*) AS jumlah FROM picu_episode WHERE faskes_uuid = :f AND deleted_at IS NULL`);
        return { items, total: Number(total.jumlah), halaman, ukuran_halaman: 25 };
    }
    async detail(uuid, halamanDokumentasi = 1) {
        const episode = await this.episode(uuid);
        const pasien = await this.satu(`SELECT r.patient_uuid, r.no_rm, r.name AS nama_pasien, r.no_reg, bd.birth_date AS tanggal_lahir FROM rawat_inaps r
            JOIN patients p ON p.uuid = r.patient_uuid AND p.faskes_uuid = r.faskes_uuid AND p.deleted_at IS NULL
            LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid AND bd.faskes_uuid = p.faskes_uuid AND bd.deleted_at IS NULL
            WHERE r.uuid = :kunjungan AND r.faskes_uuid = :f AND r.deleted_at IS NULL`, { kunjungan: episode.kunjungan_uuid });
        const riwayat = await this.q(`SELECT * FROM picu_riwayat WHERE episode_uuid = :uuid AND faskes_uuid = :f
            AND deleted_at IS NULL ORDER BY created_at, uuid`, { uuid });
        const jenis = jenisDokumentasi.filter((j) => this.bolehDokumentasi(j, "READ"));
        const semua = await this.q(`SELECT d.*, k.nama AS nama_formulir, k.definisi FROM picu_dokumentasi d
            JOIN picu_konfigurasi k ON k.uuid = d.konfigurasi_uuid AND k.faskes_uuid = d.faskes_uuid AND k.deleted_at IS NULL
            WHERE d.episode_uuid = :uuid AND d.faskes_uuid = :f AND d.deleted_at IS NULL AND d.jenis IN (:jenis)
            ORDER BY d.waktu_catatan DESC, d.uuid DESC LIMIT 51 OFFSET :offset`,
        { uuid, jenis: jenis.length ? jenis : ["__tidak_ada__"], offset: (halamanDokumentasi - 1) * 50 });
        return { episode, pasien, riwayat, dokumentasi: semua.slice(0, 50), halaman_dokumentasi: halamanDokumentasi,
            dokumentasi_berikutnya: semua.length > 50 };
    }
    async calonPerpindahan(uuid) {
        const e = await this.episode(uuid);
        return this.q(`SELECT p.uuid, b.no_bed AS tujuan, l.name AS lokasi, p.waktu_pindah FROM perpindahans p
            JOIN rawat_inaps r ON r.uuid = p.admission_ri_uuid AND r.faskes_uuid = p.faskes_uuid AND r.deleted_at IS NULL
            JOIN room_monitorings b ON b.uuid = p.destination_monitoring_room_uuid AND b.uuid = r.monitoring_room_uuid
                AND b.faskes_uuid = p.faskes_uuid AND b.deleted_at IS NULL
            LEFT JOIN lokasi l ON l.uuid = b.room_uuid AND l.faskes_uuid = b.faskes_uuid AND l.deleted_at IS NULL
            WHERE p.admission_ri_uuid = :kunjungan AND p.faskes_uuid = :f AND p.deleted_at IS NULL
                AND p.origin_monitoring_room_uuid = :asal AND p.status_pindah = 'approve'
                AND p.waktu_pindah >= :masuk ORDER BY p.waktu_pindah DESC LIMIT 25`,
        { kunjungan: e.kunjungan_uuid, asal: e.tempat_tidur_uuid, masuk: e.waktu_masuk });
    }
    async mulai(data, t) {
        // Kunci identitas sumber terlebih dahulu untuk menyerialkan penerimaan pasien yang sama.
        await this.satu(`SELECT uuid FROM patients WHERE uuid = :pasien_uuid AND faskes_uuid = :f AND deleted_at IS NULL FOR UPDATE`, data, t);
        const ri = await this.satu(`SELECT * FROM rawat_inaps WHERE uuid = :kunjungan_uuid AND patient_uuid = :pasien_uuid
            AND faskes_uuid = :f AND deleted_at IS NULL FOR UPDATE`, data, t);
        const pindah = await this.satu(`SELECT * FROM perpindahans WHERE uuid = :referensi_penerimaan_uuid AND admission_ri_uuid = :kunjungan_uuid
            AND faskes_uuid = :f AND deleted_at IS NULL FOR UPDATE`, data, t);
        if (pindah.status_pindah !== "approve" || pindah.destination_monitoring_room_uuid !== data.tempat_tidur_uuid ||
            ri.monitoring_room_uuid !== data.tempat_tidur_uuid || ri.status_ri !== 3) gagal(409, "Penerimaan memerlukan perpindahan sumber yang selesai dan penempatan yang sesuai.");
        const bed = await this.satu(`SELECT b.* FROM room_monitorings b JOIN picu_tempat_tidur p ON p.tempat_tidur_uuid = b.uuid
            AND p.faskes_uuid = b.faskes_uuid AND p.deleted_at IS NULL WHERE b.uuid = :tempat_tidur_uuid
            AND b.faskes_uuid = :f AND b.deleted_at IS NULL FOR UPDATE OF b, p`, data, t);
        if (bed.patient_uuid !== data.pasien_uuid || bed.status === false || bed.status_operasional !== "Penuh") gagal(409, "Penempatan atau status operasional tempat tidur tidak sesuai.");
        await this.cekBentrokIntensif(data.pasien_uuid, data.tempat_tidur_uuid, t);
        const e = await this.satu(`INSERT INTO picu_episode (uuid, faskes_uuid, pasien_uuid, kunjungan_uuid, tempat_tidur_uuid,
            referensi_penerimaan_uuid, sumber_penerimaan, status, waktu_masuk, dibuat_oleh, created_at)
            VALUES (:uuid, :f, :pasien_uuid, :kunjungan_uuid, :tempat_tidur_uuid, :referensi_penerimaan_uuid,
            'rawat_inap', 'aktif', :waktu, :aktor, :waktu) RETURNING *`,
        { ...data, uuid: this.buatUuid(), waktu: Math.floor(Date.now() / 1000) }, t);
        await this.riwayat(e, "masuk", pindah.uuid, pindah.origin_monitoring_room_uuid, bed.uuid, "Penerimaan melalui perpindahan rawat inap.", t);
        return e;
    }
    async transisi(uuid, data, tutup, t) {
        const e = await this.episode(uuid, t, true);
        if (e.versi !== data.versi) gagal(409, "Versi episode berubah. Muat ulang data.");
        const ri = await this.satu(`SELECT * FROM rawat_inaps WHERE uuid = :kunjungan AND patient_uuid = :pasien
            AND faskes_uuid = :f AND deleted_at IS NULL FOR UPDATE`, { kunjungan: e.kunjungan_uuid, pasien: e.pasien_uuid }, t);
        let tujuan = null;
        if (tutup && data.jenis_keluar === "pulang") {
            if (ri.status_ri !== 4 || !ri.discharge_date) gagal(409, "Selesaikan pemulangan pada admisi sumber terlebih dahulu.");
            const asal = await this.satu(`SELECT * FROM room_monitorings WHERE uuid = :asal AND faskes_uuid = :f
                AND deleted_at IS NULL FOR UPDATE`, { asal: e.tempat_tidur_uuid }, t);
            if (asal.patient_uuid === e.pasien_uuid) gagal(409, "Tempat tidur belum dilepas oleh proses pemulangan sumber.");
        } else {
            if (!data.referensi_uuid) gagal(422, "Referensi perpindahan wajib diisi.");
            const p = await this.satu(`SELECT * FROM perpindahans WHERE uuid = :referensi_uuid AND admission_ri_uuid = :kunjungan
                AND faskes_uuid = :f AND deleted_at IS NULL FOR UPDATE`, { ...data, kunjungan: e.kunjungan_uuid }, t);
            if (p.status_pindah !== "approve" || p.origin_monitoring_room_uuid !== e.tempat_tidur_uuid ||
                p.destination_monitoring_room_uuid === e.tempat_tidur_uuid || ri.monitoring_room_uuid !== p.destination_monitoring_room_uuid ||
                Number(p.waktu_pindah) < Number(e.waktu_masuk) || ri.status_ri !== 3) gagal(409, "Perpindahan sumber tidak sesuai dengan episode dan penempatan terkini.");
            tujuan = p.destination_monitoring_room_uuid;
            const beds = await this.q(`SELECT * FROM room_monitorings WHERE uuid IN (:asal, :tujuan) AND faskes_uuid = :f
                AND deleted_at IS NULL ORDER BY uuid FOR UPDATE`, { asal: e.tempat_tidur_uuid, tujuan }, t);
            const bed = beds.find((b) => b.uuid === tujuan);
            if (beds.length !== 2 || !bed || bed.patient_uuid !== e.pasien_uuid || beds.find((b) => b.uuid === e.tempat_tidur_uuid)?.patient_uuid === e.pasien_uuid ||
                bed.status === false || bed.status_operasional !== "Penuh") gagal(409, "Okupansi atau status tempat tidur sumber belum sesuai.");
            const pemetaan = await this.q(`SELECT uuid FROM picu_tempat_tidur WHERE tempat_tidur_uuid = :tujuan AND faskes_uuid = :f AND deleted_at IS NULL FOR UPDATE`, { tujuan }, t);
            if (tutup ? pemetaan.length > 0 : pemetaan.length === 0) gagal(409, tutup ? "Tujuan transfer masih berada di PICU." : "Tujuan perpindahan harus tempat tidur PICU.");
            if (!tutup) await this.cekBentrokIntensif(e.pasien_uuid, tujuan, t);
        }
        if (tutup && !data.jenis_keluar) gagal(422, "Jenis keluar wajib diisi.");
        const hasil = await this.satu(`UPDATE picu_episode SET tempat_tidur_uuid = :bed, status = :status,
            jenis_keluar = :jenis, waktu_keluar = :keluar, versi = versi + 1, updated_at = :waktu
            WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL RETURNING *`, {
            uuid, bed: tutup ? e.tempat_tidur_uuid : tujuan, status: tutup ? "selesai" : "aktif",
            jenis: tutup ? data.jenis_keluar : null, keluar: tutup ? Math.floor(Date.now() / 1000) : null, waktu: Math.floor(Date.now() / 1000),
        }, t);
        await this.riwayat(e, tutup ? data.jenis_keluar : "pindah", data.referensi_uuid ?? ri.uuid, e.tempat_tidur_uuid, tujuan, data.alasan, t);
        return hasil;
    }
    // Episode intensif modul lain (ICU, NICU, HDU) untuk pasien atau tempat tidur yang sama — fungsi bersama di database
    // (migrasi integritas_episode_intensif_*), dengan kunci advisory yang sama dengan modul intensif lain.
    async cekBentrokIntensif(pasien, bed, t) {
        const [hasil] = await this.q("SELECT intensif_cek_bentrok(:f, :pasien, :bed, 'picu') AS modul", { pasien, bed }, t);
        if (hasil?.modul) gagal(409, `Pasien atau tempat tidur masih digunakan episode ${hasil.modul} aktif. Selesaikan melalui modul ${hasil.modul} terlebih dahulu.`);
    }
    konfigurasi() {
        return this.q(`SELECT * FROM picu_konfigurasi WHERE faskes_uuid = :f AND deleted_at IS NULL ORDER BY created_at DESC, uuid DESC`);
    }
    async buatKonfigurasi(data, t) {
        return this.satu(`INSERT INTO picu_konfigurasi (uuid, faskes_uuid, jenis, nama, definisi, status, dibuat_oleh, created_at)
            VALUES (:uuid, :f, :jenis, :nama, CAST(:definisi AS jsonb), 'draf', :aktor, :waktu) RETURNING *`,
        { ...data, definisi: JSON.stringify(data.definisi), uuid: this.buatUuid(), waktu: Math.floor(Date.now() / 1000) }, t);
    }
    async sahkan(uuid, data, t) {
        const konfigurasi = await this.satu(`UPDATE picu_konfigurasi SET status = 'berlaku', referensi_penetapan = :referensi_penetapan,
            disahkan_oleh = :aktor, disahkan_at = :waktu, updated_at = :waktu
            WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL AND status = 'draf' RETURNING *`,
        { ...data, uuid, waktu: Math.floor(Date.now() / 1000) }, t, "Draf konfigurasi tidak ditemukan.");
        return konfigurasi;
    }
    async petakan(data, t) {
        await this.satu(`SELECT uuid FROM room_monitorings WHERE uuid = :tempat_tidur_uuid AND faskes_uuid = :f
            AND deleted_at IS NULL FOR UPDATE`, data, t);
        return this.satu(`INSERT INTO picu_tempat_tidur (uuid, faskes_uuid, tempat_tidur_uuid, dibuat_oleh, created_at)
            VALUES (:uuid, :f, :tempat_tidur_uuid, :aktor, :waktu) RETURNING *`,
        { ...data, uuid: this.buatUuid(), waktu: Math.floor(Date.now() / 1000) }, t);
    }
    async catat(uuid, data, t) {
        const e = await this.episode(uuid, t, !data.koreksi_uuid);
        const k = await this.satu(`SELECT * FROM picu_konfigurasi WHERE uuid = :konfigurasi_uuid AND faskes_uuid = :f
            AND deleted_at IS NULL AND status = 'berlaku'`, data, t, "Konfigurasi dokumentasi perlu dilengkapi oleh pihak berwenang.");
        if (!this.bolehDokumentasi(k.jenis, data.koreksi_uuid ? "KOREKSI" : "CREATE")) gagal(403, "Izin jenis dokumentasi tidak tersedia.");
        await this.pastikanFiturDokumentasi(k.jenis, t);
        if (data.waktu_catatan < Number(e.waktu_masuk) || data.waktu_catatan > Math.floor(Date.now() / 1000) ||
            (e.waktu_keluar && data.waktu_catatan > Number(e.waktu_keluar))) gagal(422, "Waktu catatan harus berada dalam periode episode dan tidak di masa depan.");
        try { validasiIsi(k.definisi, data.isi); } catch (err) { gagal(422, err.message); }
        if (data.koreksi_uuid) {
            await this.satu(`SELECT uuid FROM picu_dokumentasi WHERE uuid = :koreksi_uuid AND episode_uuid = :episode
                AND konfigurasi_uuid = :konfigurasi_uuid AND status = 'final' AND faskes_uuid = :f AND deleted_at IS NULL FOR UPDATE`,
            { ...data, episode: uuid }, t, "Dokumen final dengan versi formulir yang sama tidak ditemukan.");
        }
        const d = await this.satu(`INSERT INTO picu_dokumentasi (uuid, faskes_uuid, episode_uuid, konfigurasi_uuid,
            jenis, isi, waktu_catatan, status, koreksi_uuid, alasan, dibuat_oleh, created_at)
            VALUES (:uuid, :f, :episode, :konfigurasi_uuid, :jenis, CAST(:isi AS jsonb), :waktu_catatan, 'draf',
            :koreksi_uuid, :alasan, :aktor, :waktu) RETURNING *`, {
            ...data, uuid: this.buatUuid(), episode: uuid, jenis: k.jenis, isi: JSON.stringify(data.isi),
            koreksi_uuid: data.koreksi_uuid ?? null, alasan: data.alasan ?? null, waktu: Math.floor(Date.now() / 1000),
        }, t);
        await this.riwayat(e, data.koreksi_uuid ? "koreksi_dokumentasi" : "dokumentasi", d.uuid, null, null, data.alasan ?? "Pencatatan dokumentasi.", t);
        return d;
    }
    async finalisasi(uuid, dokumen, t) {
        const e = await this.episode(uuid, t);
        const d = await this.satu(`SELECT * FROM picu_dokumentasi WHERE uuid = :dokumen AND episode_uuid = :uuid
            AND faskes_uuid = :f AND deleted_at IS NULL FOR UPDATE`, { dokumen, uuid }, t);
        if (!this.bolehDokumentasi(d.jenis, "FINALISASI")) gagal(403, "Izin finalisasi jenis dokumentasi tidak tersedia.");
        if (d.status !== "draf") gagal(409, "Dokumen telah difinalisasi.");
        await this.pastikanFiturDokumentasi(d.jenis, t);
        const hasil = await this.satu(`UPDATE picu_dokumentasi SET status = 'final', finalisasi_oleh = :aktor,
            finalisasi_at = :waktu, updated_at = :waktu WHERE uuid = :dokumen AND faskes_uuid = :f
            AND deleted_at IS NULL RETURNING *`, { dokumen, waktu: Math.floor(Date.now() / 1000) }, t);
        await this.riwayat(e, "finalisasi", dokumen, null, null, "Finalisasi dokumentasi sesuai kewenangan.", t);
        return hasil;
    }
    async pastikanFiturDokumentasi(jenis, t) {
        const fitur = jenis === "antropometri" ? "picu_antropometri" : jenis === "observasi" ? "picu_observasi" : "picu_dokumentasi";
        const status = await statusModulIntensif((sql, data) => this.q(sql, data, t), this.author.faskesUuid, "picu", fitur);
        if (!status.fitur) gagal(403, "Fitur dokumentasi PICU belum aktif.");
    }
}
