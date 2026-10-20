import { createHash } from "node:crypto";
import { NicuError, pastikanVersi, pastikanAktif, validasiIdentitas, validasiPerpindahan, jsonStabil } from "../helpers/nicu-aturan.js";
import { validasiIsi } from "../validations/nicu-request.js";
import { statusModulIntensif } from "../helpers/modul-intensif.js";

// Adaptor disuntikkan agar pengujian memakai penyimpanan tiruan tanpa memuat konfigurasi database.
export default class NicuRepository {
    constructor({ query, transaction, uuid, sekarang }, author) {
        this.query = query;
        this.transaction = transaction;
        this.uuid = uuid;
        this.sekarang = sekarang;
        this.author = author;
    }

    async q(sql, data = {}, transaction) {
        return this.query(sql, { ...data, faskes: this.author.faskesUuid }, transaction);
    }

    async satu(tabel, uuid, transaction, kunci = false) {
        const [row] = await this.q(`SELECT * FROM ${tabel} WHERE uuid = :uuid AND faskes_uuid = :faskes AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`, { uuid }, transaction);
        if (!row) throw new NicuError("Data tidak ditemukan.", 404);
        return row;
    }

    async simpan(tabel, data, transaction) {
        const row = { ...data, uuid: this.uuid(), faskes_uuid: this.author.faskesUuid, pencatat: this.author.user_uuid, created_at: this.sekarang() };
        const kolom = Object.keys(row);
        const [hasil] = await this.q(`INSERT INTO ${tabel} (${kolom.join(", ")}) VALUES (${kolom.map((k) => `:${k}`).join(", ")}) RETURNING *`, row, transaction);
        return hasil;
    }

    async ubah(tabel, row, data, transaction) {
        const kolom = Object.keys(data);
        const [hasil] = await this.q(`UPDATE ${tabel} SET ${kolom.map((k) => `${k} = :${k}`).join(", ")}, updated_at = :waktu
            WHERE uuid = :uuid AND faskes_uuid = :faskes AND deleted_at IS NULL RETURNING *`, { ...data, uuid: row.uuid, waktu: this.sekarang() }, transaction);
        return hasil;
    }

    async operasi(jenis, kunci, data, proses) {
        if (!/^[a-zA-Z0-9_-]{8,100}$/.test(kunci ?? "")) throw new NicuError("Kunci idempotensi wajib diisi (8–100 huruf, angka, tanda hubung atau garis bawah).");
        const hash = createHash("sha256").update(jsonStabil(data)).digest("hex");
        return this.transaction(async (t) => {
            // Semua penulisan NICU satu faskes berurutan; penguncian sumber rawat inap tetap dilakukan.
            await this.q("SELECT pg_advisory_xact_lock(hashtextextended(:faskes, 43))", {}, t);
            const [lama] = await this.q(`SELECT * FROM nicu_operasi WHERE faskes_uuid = :faskes AND jenis = :jenis AND kunci = :kunci AND deleted_at IS NULL`, { jenis, kunci }, t);
            if (lama) {
                if (lama.hash_permintaan !== hash || lama.pencatat !== this.author.user_uuid) throw new NicuError("Kunci idempotensi telah digunakan untuk permintaan lain.", 409);
                return lama.hasil;
            }
            const hasil = await proses(t);
            await this.simpan("nicu_operasi", { jenis, kunci, hash_permintaan: hash, hasil: JSON.stringify(hasil) }, t);
            return hasil;
        });
    }

    async tempat(filter = {}) {
        return this.q(`SELECT t.*, r.no_bed AS kode, l.name AS lokasi, r.patient_uuid AS pasien_sumber_uuid,
            p.episode_uuid, e.pasien_uuid, e.status AS status_episode
            FROM nicu_tempat t
            JOIN room_monitorings r ON r.uuid = t.room_monitoring_uuid AND r.faskes_uuid = t.faskes_uuid AND r.deleted_at IS NULL
            JOIN lokasi l ON l.uuid = t.unit_uuid AND l.faskes_uuid = t.faskes_uuid AND l.deleted_at IS NULL
            LEFT JOIN nicu_penempatan p ON p.tempat_uuid = t.uuid AND p.faskes_uuid = t.faskes_uuid AND p.selesai_at IS NULL AND p.deleted_at IS NULL
            LEFT JOIN nicu_episode e ON e.uuid = p.episode_uuid AND e.faskes_uuid = t.faskes_uuid AND e.deleted_at IS NULL
            WHERE t.faskes_uuid = :faskes AND t.deleted_at IS NULL ${filter.unit_uuid ? "AND t.unit_uuid = :unit_uuid" : ""}
            ORDER BY l.name, r.no_bed LIMIT 50 OFFSET :offset`, { ...filter, offset: ((filter.halaman ?? 1) - 1) * 50 });
    }

    async sumberTempat(filter) {
        return this.q(`SELECT r.uuid, r.no_bed AS kode, r.room_uuid AS unit_uuid, l.name AS lokasi FROM room_monitorings r
            JOIN lokasi l ON l.uuid = r.room_uuid AND l.faskes_uuid = r.faskes_uuid AND l.deleted_at IS NULL
            WHERE r.faskes_uuid = :faskes AND r.deleted_at IS NULL ${filter.unit_uuid ? "AND r.room_uuid = :unit_uuid" : ""}
            ORDER BY l.name, r.no_bed LIMIT 50 OFFSET :offset`, { ...filter, offset: (filter.halaman - 1) * 50 });
    }

    async unit(filter) {
        return this.q(`SELECT DISTINCT l.uuid, l.name AS nama FROM lokasi l JOIN nicu_tempat t
            ON t.unit_uuid = l.uuid AND t.faskes_uuid = l.faskes_uuid AND t.deleted_at IS NULL
            WHERE l.faskes_uuid = :faskes AND l.deleted_at IS NULL ORDER BY l.name, l.uuid LIMIT 50 OFFSET :offset`, { offset: (filter.halaman - 1) * 50 });
    }

    async tambahTempat(data, t) {
        const sumber = await this.satu("room_monitorings", data.room_monitoring_uuid, t, true);
        await this.satu("lokasi", data.unit_uuid, t, true);
        if (sumber.room_uuid !== data.unit_uuid) throw new NicuError("Unit harus sesuai ruangan tempat sumber.");
        return this.simpan("nicu_tempat", data, t);
    }

    async statusAlat(uuid, data, t) {
        const tempat = await this.satu("nicu_tempat", uuid, t, true);
        pastikanVersi(tempat, data.versi);
        return this.ubah("nicu_tempat", tempat, { status_alat: data.status_alat, versi: tempat.versi + 1 }, t);
    }

    async konfigurasi(filter) {
        return this.q(`SELECT * FROM nicu_konfigurasi_versi WHERE faskes_uuid = :faskes AND deleted_at IS NULL
            ${filter.unit_uuid ? "AND unit_uuid = :unit_uuid" : ""} ORDER BY created_at DESC, uuid DESC LIMIT 50 OFFSET :offset`,
        { ...filter, offset: (filter.halaman - 1) * 50 });
    }

    async tambahKonfigurasi(data, t) {
        await this.satu("lokasi", data.unit_uuid, t, true);
        return this.simpan("nicu_konfigurasi_versi", { ...data, definisi: JSON.stringify(data.definisi) }, t);
    }

    async terbitkan(uuid, data, t) {
        const config = await this.satu("nicu_konfigurasi_versi", uuid, t, true);
        pastikanVersi(config, data.versi);
        if (config.status !== "draf") throw new NicuError("Konfigurasi terbit tidak dapat ditimpa.", 409);
        return this.ubah("nicu_konfigurasi_versi", config, {
            status: "terbit", versi: config.versi + 1, referensi_pengesahan: data.referensi_pengesahan,
            diterbitkan_oleh: this.author.user_uuid, diterbitkan_at: this.sekarang(),
        }, t);
    }

    async penerimaan(filter) {
        return this.q(`SELECT ri.uuid AS rawat_inap_uuid, ri.patient_uuid AS pasien_uuid, ri.name AS nama_pasien, ri.no_rm,
            p.uuid AS perpindahan_masuk_uuid, t.uuid AS tempat_uuid, r.no_bed AS kode
            FROM rawat_inaps ri
            JOIN patients b ON b.uuid = ri.patient_uuid AND b.faskes_uuid = ri.faskes_uuid AND b.deleted_at IS NULL AND b.is_new_born = true
            JOIN perpindahans p ON p.admission_ri_uuid = ri.uuid AND p.faskes_uuid = ri.faskes_uuid AND p.deleted_at IS NULL
                AND p.status_pindah = 'approve' AND p.destination_monitoring_room_uuid = ri.monitoring_room_uuid
            JOIN nicu_tempat t ON t.room_monitoring_uuid = ri.monitoring_room_uuid AND t.faskes_uuid = ri.faskes_uuid AND t.deleted_at IS NULL
            JOIN room_monitorings r ON r.uuid = t.room_monitoring_uuid AND r.faskes_uuid = ri.faskes_uuid AND r.deleted_at IS NULL
            WHERE ri.faskes_uuid = :faskes AND ri.deleted_at IS NULL AND ri.status_ri = 3 AND ri.discharge_date IS NULL
                AND NOT EXISTS (SELECT 1 FROM nicu_episode e WHERE e.faskes_uuid = ri.faskes_uuid AND e.deleted_at IS NULL
                    AND (e.perpindahan_masuk_uuid = p.uuid OR (e.rawat_inap_uuid = ri.uuid AND e.status = 'aktif')))
                ${filter.unit_uuid ? "AND t.unit_uuid = :unit_uuid" : ""}
            ORDER BY p.waktu_pindah DESC, p.uuid DESC LIMIT 50 OFFSET :offset`, { ...filter, offset: (filter.halaman - 1) * 50 });
    }

    async episode(filter) {
        return this.q(`SELECT e.*, b.name AS nama_pasien, b.no_rm, p.tempat_uuid, t.unit_uuid
            FROM nicu_episode e
            JOIN patients b ON b.uuid = e.pasien_uuid AND b.faskes_uuid = e.faskes_uuid AND b.deleted_at IS NULL
            LEFT JOIN nicu_penempatan p ON p.episode_uuid = e.uuid AND p.faskes_uuid = e.faskes_uuid AND p.selesai_at IS NULL AND p.deleted_at IS NULL
            LEFT JOIN nicu_tempat t ON t.uuid = p.tempat_uuid AND t.faskes_uuid = e.faskes_uuid AND t.deleted_at IS NULL
            WHERE e.faskes_uuid = :faskes AND e.deleted_at IS NULL ${filter.status ? "AND e.status = :status" : ""}
            ${filter.unit_uuid ? "AND EXISTS (SELECT 1 FROM nicu_penempatan h JOIN nicu_tempat x ON x.uuid = h.tempat_uuid AND x.faskes_uuid = h.faskes_uuid AND x.deleted_at IS NULL WHERE h.episode_uuid = e.uuid AND h.faskes_uuid = e.faskes_uuid AND h.deleted_at IS NULL AND x.unit_uuid = :unit_uuid)" : ""}
            ORDER BY e.masuk_at DESC, e.uuid DESC LIMIT 50 OFFSET :offset`, { ...filter, offset: (filter.halaman - 1) * 50 });
    }

    async detail(uuid) {
        const episode = await this.satu("nicu_episode", uuid);
        const pasien = await this.satu("patients", episode.pasien_uuid);
        return { episode, pasien: { uuid: pasien.uuid, nama: pasien.name, no_rm: pasien.no_rm } };
    }

    async identitas(uuid) {
        const episode = await this.satu("nicu_episode", uuid);
        const pasien = await this.satu("patients", episode.pasien_uuid);
        const registrasi = await this.q("SELECT uuid, identifier_mom, name_mom, birth_detail_uuid, multiple_birth FROM new_borns WHERE no_rm_baby = :rm AND faskes_uuid = :faskes AND deleted_at IS NULL", { rm: pasien.no_rm });
        validasiIdentitas({ patient_uuid: pasien.uuid }, pasien, registrasi);
        return { registrasi_bayi: registrasi[0] ?? null };
    }

    async penempatan(uuid, t, kunci = false) {
        const [row] = await this.q(`SELECT * FROM nicu_penempatan WHERE episode_uuid = :uuid AND faskes_uuid = :faskes AND selesai_at IS NULL AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`, { uuid }, t);
        if (!row) throw new NicuError("Penempatan aktif tidak ditemukan.", 409);
        return row;
    }

    async histori(uuid, filter) {
        await this.satu("nicu_episode", uuid);
        return this.q(`SELECT p.*, r.no_bed AS kode FROM nicu_penempatan p
            JOIN nicu_tempat t ON t.uuid = p.tempat_uuid AND t.faskes_uuid = p.faskes_uuid AND t.deleted_at IS NULL
            JOIN room_monitorings r ON r.uuid = t.room_monitoring_uuid AND r.faskes_uuid = p.faskes_uuid AND r.deleted_at IS NULL
            WHERE p.episode_uuid = :uuid AND p.faskes_uuid = :faskes AND p.deleted_at IS NULL
            ORDER BY p.mulai_at DESC, p.uuid DESC LIMIT 50 OFFSET :offset`, { uuid, offset: (filter.halaman - 1) * 50 });
    }

    async perpindahan(uuid) {
        const episode = await this.satu("nicu_episode", uuid);
        const penempatan = await this.penempatan(uuid);
        const tempat = await this.satu("nicu_tempat", penempatan.tempat_uuid);
        return this.q(`SELECT p.uuid, p.waktu_pindah, r.no_bed AS kode_tujuan, t.uuid AS tempat_tujuan_uuid
            FROM perpindahans p JOIN rawat_inaps ri ON ri.uuid = p.admission_ri_uuid AND ri.faskes_uuid = p.faskes_uuid AND ri.deleted_at IS NULL
            JOIN room_monitorings r ON r.uuid = p.destination_monitoring_room_uuid AND r.faskes_uuid = p.faskes_uuid AND r.deleted_at IS NULL
            LEFT JOIN nicu_tempat t ON t.room_monitoring_uuid = r.uuid AND t.faskes_uuid = p.faskes_uuid AND t.deleted_at IS NULL
            WHERE p.faskes_uuid = :faskes AND p.deleted_at IS NULL AND p.admission_ri_uuid = :ri AND p.status_pindah = 'approve'
                AND p.origin_monitoring_room_uuid = :asal AND p.destination_monitoring_room_uuid = ri.monitoring_room_uuid
                AND p.waktu_pindah >= :mulai ORDER BY p.waktu_pindah DESC, p.uuid DESC LIMIT 50`,
        { ri: episode.rawat_inap_uuid, asal: tempat.room_monitoring_uuid, mulai: penempatan.mulai_at });
    }

    async cekTujuan(tempatUuid, ri, t) {
        const tempat = await this.satu("nicu_tempat", tempatUuid, t, true);
        const sumber = await this.satu("room_monitorings", tempat.room_monitoring_uuid, t, true);
        await this.satu("lokasi", tempat.unit_uuid, t, true);
        if (tempat.status_alat !== "siap" || sumber.room_uuid !== tempat.unit_uuid || sumber.patient_uuid !== ri.patient_uuid) {
            throw new NicuError("Tempat belum siap atau hunian sumber tidak sesuai pasien.", 409);
        }
        const bentrok = await this.q(`SELECT uuid FROM rawat_inaps WHERE faskes_uuid = :faskes AND deleted_at IS NULL
            AND monitoring_room_uuid = :bed AND uuid <> :ri AND status_ri IN (2, 3) AND discharge_date IS NULL
            UNION ALL SELECT uuid FROM nicu_penempatan WHERE faskes_uuid = :faskes AND deleted_at IS NULL AND selesai_at IS NULL AND tempat_uuid = :tempat`,
        { bed: sumber.uuid, ri: ri.uuid, tempat: tempatUuid }, t);
        if (bentrok.length) throw new NicuError("Tempat atau rawat inap telah digunakan episode aktif lain.", 409);
        // Episode intensif modul lain (ICU, PICU, HDU) untuk pasien atau tempat yang sama — fungsi bersama di database.
        const [lintas] = await this.q("SELECT intensif_cek_bentrok(:faskes, :pasien, :bed, 'nicu') AS modul", { pasien: ri.patient_uuid, bed: sumber.uuid }, t);
        if (lintas?.modul) throw new NicuError(`Pasien atau tempat masih digunakan episode ${lintas.modul} aktif. Selesaikan melalui modul ${lintas.modul} terlebih dahulu.`, 409);
        return tempat;
    }

    async masuk(data, t) {
        const ri = await this.satu("rawat_inaps", data.rawat_inap_uuid, t, true);
        const bayi = await this.satu("patients", ri.patient_uuid, t, true);
        if (bayi.uuid !== data.pasien_uuid) throw new NicuError("Identitas bayi tidak sesuai rawat inap.");
        const registrasi = await this.q("SELECT * FROM new_borns WHERE faskes_uuid = :faskes AND no_rm_baby = :rm AND deleted_at IS NULL FOR UPDATE", { rm: bayi.no_rm }, t);
        validasiIdentitas(ri, bayi, registrasi);
        const tempat = await this.cekTujuan(data.tempat_uuid, ri, t);
        const pindah = await this.satu("perpindahans", data.perpindahan_masuk_uuid, t, true);
        validasiPerpindahan(ri, pindah, tempat.room_monitoring_uuid);
        await this.pastikanTransaksiTerakhir(ri.uuid, pindah.uuid, t);
        const episode = await this.simpan("nicu_episode", {
            pasien_uuid: bayi.uuid, rawat_inap_uuid: ri.uuid, perpindahan_masuk_uuid: pindah.uuid,
            masuk_at: this.sekarang(), serah_terima_masuk: data.serah_terima,
        }, t);
        await this.simpan("nicu_penempatan", { episode_uuid: episode.uuid, tempat_uuid: tempat.uuid, perpindahan_uuid: pindah.uuid, mulai_at: episode.masuk_at }, t);
        return episode;
    }

    async pindah(uuid, data, t) {
        const episode = await this.satu("nicu_episode", uuid, t, true);
        pastikanAktif(episode);
        pastikanVersi(episode, data.versi);
        const ri = await this.satu("rawat_inaps", episode.rawat_inap_uuid, t, true);
        const lama = await this.penempatan(uuid, t, true);
        const asal = await this.satu("nicu_tempat", lama.tempat_uuid, t, true);
        const tujuan = await this.cekTujuan(data.tempat_tujuan_uuid, ri, t);
        const pindah = await this.satu("perpindahans", data.perpindahan_uuid, t, true);
        validasiPerpindahan(ri, pindah, tujuan.room_monitoring_uuid, asal.room_monitoring_uuid);
        await this.pastikanTransaksiTerakhir(ri.uuid, pindah.uuid, t);
        if (ri.patient_uuid !== episode.pasien_uuid || Number(pindah.waktu_pindah) < Number(lama.mulai_at)) throw new NicuError("Konteks perpindahan tidak sesuai episode.", 409);
        await this.ubah("nicu_penempatan", lama, { selesai_at: this.sekarang() }, t);
        await this.simpan("nicu_penempatan", { episode_uuid: uuid, tempat_uuid: tujuan.uuid, perpindahan_uuid: pindah.uuid, mulai_at: this.sekarang() }, t);
        return this.ubah("nicu_episode", episode, { versi: episode.versi + 1 }, t);
    }

    async selesai(uuid, data, t) {
        const episode = await this.satu("nicu_episode", uuid, t, true);
        pastikanAktif(episode);
        pastikanVersi(episode, data.versi);
        const ri = await this.satu("rawat_inaps", episode.rawat_inap_uuid, t, true);
        if (ri.patient_uuid !== episode.pasien_uuid) throw new NicuError("Identitas rawat inap telah berubah.", 409);
        const penempatan = await this.penempatan(uuid, t, true);
        const tempat = await this.satu("nicu_tempat", penempatan.tempat_uuid, t, true);
        if (data.perpindahan_keluar_uuid) {
            const pindah = await this.satu("perpindahans", data.perpindahan_keluar_uuid, t, true);
            validasiPerpindahan(ri, pindah, pindah.destination_monitoring_room_uuid, tempat.room_monitoring_uuid);
            await this.pastikanTransaksiTerakhir(ri.uuid, pindah.uuid, t);
            if (!pindah.destination_monitoring_room_uuid || pindah.destination_monitoring_room_uuid === tempat.room_monitoring_uuid || Number(pindah.waktu_pindah) < Number(penempatan.mulai_at)) throw new NicuError("Tujuan atau waktu transfer keluar tidak valid.", 409);
            const tujuan = await this.satu("room_monitorings", pindah.destination_monitoring_room_uuid, t, true);
            if (tujuan.patient_uuid !== episode.pasien_uuid) throw new NicuError("Hunian tujuan transfer tidak sesuai pasien.", 409);
            const tujuanNicu = await this.q("SELECT uuid FROM nicu_tempat WHERE faskes_uuid = :faskes AND room_monitoring_uuid = :bed AND deleted_at IS NULL", { bed: pindah.destination_monitoring_room_uuid }, t);
            if (tujuanNicu.length) throw new NicuError("Gunakan perpindahan tempat untuk tujuan dalam NICU.", 409);
        } else if (ri.status_ri !== 4 || !ri.discharge_date || Number(ri.discharge_date) < Number(episode.masuk_at) || Number(ri.discharge_date) > this.sekarang()) {
            throw new NicuError("Pemulangan rawat inap belum selesai.", 409);
        }
        const keluarAt = this.sekarang();
        await this.ubah("nicu_penempatan", penempatan, { selesai_at: keluarAt }, t);
        return this.ubah("nicu_episode", episode, { status: "selesai", keluar_at: keluarAt, versi: episode.versi + 1,
            perpindahan_keluar_uuid: data.perpindahan_keluar_uuid ?? null, serah_terima_keluar: data.serah_terima }, t);
    }

    async pastikanTransaksiTerakhir(rawatInapUuid, perpindahanUuid, t) {
        const [terakhir] = await this.q(`SELECT uuid FROM perpindahans WHERE faskes_uuid = :faskes AND admission_ri_uuid = :ri
            AND status_pindah = 'approve' AND deleted_at IS NULL ORDER BY waktu_pindah DESC, uuid DESC LIMIT 1`, { ri: rawatInapUuid }, t);
        if (terakhir?.uuid !== perpindahanUuid) throw new NicuError("Transaksi perpindahan telah berubah. Muat ulang kondisi rawat inap.", 409);
    }

    async dokumen(uuid, filter) {
        await this.satu("nicu_episode", uuid);
        return this.q(`SELECT d.*, k.jenis, k.definisi FROM nicu_dokumen d JOIN nicu_konfigurasi_versi k
            ON k.uuid = d.konfigurasi_versi_uuid AND k.faskes_uuid = d.faskes_uuid AND k.deleted_at IS NULL
            WHERE d.episode_uuid = :uuid AND d.faskes_uuid = :faskes AND d.deleted_at IS NULL
            ORDER BY d.waktu_pencatatan DESC, d.uuid DESC LIMIT 50 OFFSET :offset`, { uuid, offset: (filter.halaman - 1) * 50 });
    }

    async tambahDokumen(uuid, data, t) {
        const episode = await this.satu("nicu_episode", uuid, t, true);
        pastikanAktif(episode);
        const penempatan = await this.penempatan(uuid, t);
        const tempat = await this.satu("nicu_tempat", penempatan.tempat_uuid, t);
        const config = await this.satu("nicu_konfigurasi_versi", data.konfigurasi_versi_uuid, t);
        if (config.status !== "terbit" || config.unit_uuid !== tempat.unit_uuid) throw new NicuError("Konfigurasi belum terbit atau tidak sesuai unit.");
        await this.cekFiturDokumen(config.jenis, t);
        if (data.waktu_pencatatan < Number(episode.masuk_at) || data.waktu_pencatatan > this.sekarang()) throw new NicuError("Waktu pencatatan harus berada dalam episode yang berjalan.");
        return this.simpan("nicu_dokumen", { ...data, episode_uuid: uuid, isi: JSON.stringify(validasiIsi(config.definisi, data.isi)) }, t);
    }

    async koreksi(uuid, data, t) {
        const dokumen = await this.satu("nicu_dokumen", uuid, t, true);
        pastikanAktif(await this.satu("nicu_episode", dokumen.episode_uuid, t, true));
        pastikanVersi(dokumen, data.versi);
        const config = await this.satu("nicu_konfigurasi_versi", dokumen.konfigurasi_versi_uuid, t);
        await this.cekFiturDokumen(config.jenis, t);
        const isi = validasiIsi(config.definisi, data.isi);
        await this.simpan("nicu_dokumen_revisi", { dokumen_uuid: uuid, nomor_revisi: dokumen.versi,
            sebelum: JSON.stringify(dokumen.isi), sesudah: JSON.stringify(isi), alasan: data.alasan }, t);
        return this.ubah("nicu_dokumen", dokumen, { isi: JSON.stringify(isi), versi: dokumen.versi + 1 }, t);
    }

    async revisi(uuid, filter) {
        await this.satu("nicu_dokumen", uuid);
        return this.q(`SELECT * FROM nicu_dokumen_revisi WHERE dokumen_uuid = :uuid AND faskes_uuid = :faskes AND deleted_at IS NULL
            ORDER BY nomor_revisi DESC LIMIT 50 OFFSET :offset`, { uuid, offset: (filter.halaman - 1) * 50 });
    }

    async cekFiturDokumen(jenis, t) {
        const fitur = jenis === "neonatal" ? "nicu_data_neonatal" : jenis === "observasi" ? "nicu_observasi" : "nicu_dokumentasi";
        const status = await statusModulIntensif((sql, data) => this.q(sql, data, t), this.author.faskesUuid, "nicu", fitur);
        if (!status.fitur) throw new NicuError("Fitur dokumentasi ini belum diaktifkan.", 403);
    }

    async laporan(filter) {
        if (!filter.dari || !filter.sampai) throw new NicuError("Periode dari dan sampai wajib diisi (epoch detik).");
        return this.q(`SELECT t.unit_uuid, l.name AS nama_unit, COUNT(DISTINCT t.uuid)::integer AS kapasitas,
            COUNT(DISTINCT t.uuid) FILTER (WHERE t.status_alat = 'siap')::integer AS alat_siap,
            COUNT(p.uuid) FILTER (WHERE p.selesai_at IS NULL AND e.uuid IS NOT NULL)::integer AS terisi,
            COUNT(p.uuid) FILTER (WHERE p.mulai_at BETWEEN :dari AND :sampai AND p.perpindahan_uuid = e.perpindahan_masuk_uuid)::integer AS masuk,
            COUNT(p.uuid) FILTER (WHERE p.mulai_at BETWEEN :dari AND :sampai AND p.perpindahan_uuid <> e.perpindahan_masuk_uuid)::integer AS pindah,
            COUNT(p.uuid) FILTER (WHERE e.keluar_at BETWEEN :dari AND :sampai AND p.selesai_at = e.keluar_at AND e.perpindahan_keluar_uuid IS NOT NULL)::integer AS transfer,
            COUNT(p.uuid) FILTER (WHERE e.keluar_at BETWEEN :dari AND :sampai AND p.selesai_at = e.keluar_at AND e.perpindahan_keluar_uuid IS NULL)::integer AS pulang
            FROM nicu_tempat t
            JOIN lokasi l ON l.uuid = t.unit_uuid AND l.faskes_uuid = t.faskes_uuid AND l.deleted_at IS NULL
            JOIN room_monitorings r ON r.uuid = t.room_monitoring_uuid AND r.faskes_uuid = t.faskes_uuid AND r.deleted_at IS NULL
            LEFT JOIN nicu_penempatan p ON p.tempat_uuid = t.uuid AND p.faskes_uuid = t.faskes_uuid AND p.deleted_at IS NULL
            LEFT JOIN nicu_episode e ON e.uuid = p.episode_uuid AND e.faskes_uuid = t.faskes_uuid AND e.deleted_at IS NULL
            WHERE t.faskes_uuid = :faskes AND t.deleted_at IS NULL ${filter.unit_uuid ? "AND t.unit_uuid = :unit_uuid" : ""}
            GROUP BY t.unit_uuid, l.name ORDER BY l.name, t.unit_uuid LIMIT 50 OFFSET :offset`, { ...filter, offset: (filter.halaman - 1) * 50 });
    }
}
