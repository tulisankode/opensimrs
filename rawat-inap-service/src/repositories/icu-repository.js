import { hitungLaporanIcu } from "../services/icu-laporan-service.js";
import Konfigurasi, { pilihIcu } from "./icu-konfigurasi-repository.js";
import Template from "./icu-template-repository.js";
import IcuTemplateService from "../services/icu-template-service.js";
import IcuRequest from "../validations/icu-request.js";
import { filterUnitIcu, pastikanUnitIcu, unitDiizinkan, CTX_ICU_UNIT } from "../middlewares/icu-unit-middleware.js";
import { pastikanModulIcu, galatIcu } from "../helpers/icu-modul-helper.js";
import { auditIcu } from "../helpers/icu-audit-helper.js";
import { Context } from "../middlewares/context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import { uuidv7 } from "uuidv7";
import moment from "moment";
import { QueryTypes } from "sequelize";
import sequelizeInstance from "../configs/sequelize-instance.js";
import {
    RawatInapModel,
    PerpindahanModel,
} from "@opensimrs/model-sdk/pelayanan";
import { RoomMonitoringModel, PatientModel } from "@opensimrs/model-sdk/admisi";
import { LokasiModel } from "@opensimrs/model-sdk/datamaster";
import NotfoundException from "../exceptions/notfound-exception.js";
import BadRequestException from "../exceptions/bad-request-exception.js";
import DuplicateException from "../exceptions/duplicate-exception.js";

const q = (sql, replacements, type = QueryTypes.SELECT, transaction) => sequelizeInstance.query(sql, { replacements, type, transaction });

// Episode perawatan intensif dipakai bersama ICU, CCU, dan HDU (kolom icu_perawatans.unit). Flowsheet, balance cairan,
// serah terima masuk/keluar, dan laporan dasar berlaku untuk semua unit; data khusus unit (EKG, EWS, dst.) disimpan di
// tabel unit masing-masing. Satu admisi/bed tetap hanya boleh punya satu episode intensif aktif lintas unit.
export const UNIT_INTENSIF = { icu: "ICU", ccu: "CCU", hdu: "HDU" };
export const labelUnit = (unit) => UNIT_INTENSIF[unit] ?? "ICU";

export default class IcuRepository {
    // ── Dasbor & perawatan ────────────────────────────────────────────────────
    static async GetDashboard(filtres = {}, unit = "icu") {
        const cakupan = unit === "icu" ? filterUnitIcu() : { sql: "TRUE", replacements: {} };
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        const perawatan = await q(
            `SELECT uuid, rawat_inap_uuid, room_monitoring_uuid, ruangan_uuid, layanan_kode, template_versi_uuid, diagnosis_ringkas, waktu_masuk
             FROM icu_perawatans WHERE faskes_uuid = :faskesUuid AND unit = :unitIntensif AND status = 'aktif' AND deleted_at IS NULL AND ${cakupan.sql}
             AND (:layanan IS NULL OR COALESCE(layanan_kode,'belum_diklasifikasikan')=:layanan) AND (:unit IS NULL OR ruangan_uuid=:unit)
             ORDER BY waktu_masuk ASC`,
            { faskesUuid, unitIntensif: unit, ...cakupan.replacements, layanan: filtres.layanan_kode ?? null, unit: filtres.ruangan_uuid ?? null },
        );
        if (!perawatan.length) return [];

        const rawatInapUuids = perawatan.map((p) => p.rawat_inap_uuid);
        const rawatInaps = await RawatInapModel.findAll({
            where: { uuid: rawatInapUuids, faskesUuid, deletedAt: null },
            attributes: ["uuid", "noRm", "name", "monitoringRoomUuid"],
        });
        const rawatInapByUuid = new Map(rawatInaps.map((r) => [r.uuid, r]));

        const roomUuids = perawatan.map((p) => p.room_monitoring_uuid);
        const bed = await RoomMonitoringModel.findAll({
            where: { uuid: roomUuids, faskesUuid, deletedAt: null },
            attributes: ["uuid", "noBed", "room_uuid"],
            include: [{ model: LokasiModel, as: "room", attributes: ["uuid", "name"] }],
        });
        const bedByUuid = new Map(bed.map((b) => [b.uuid, b]));

        const observasiTerakhir = await q(
            `SELECT DISTINCT ON (perawatan_uuid) perawatan_uuid, waktu_pengukuran, ventilator_terpasang, ventilator_mode,
                    tekanan_sistolik, tekanan_diastolik, nadi, suhu, spo2, laju_napas, gcs_total
             FROM icu_observasis WHERE faskes_uuid = :faskesUuid AND perawatan_uuid IN (:perawatanUuids) AND deleted_at IS NULL
             ORDER BY perawatan_uuid, waktu_pengukuran DESC`,
            { faskesUuid, perawatanUuids: perawatan.map((p) => p.uuid) },
        );
        const observasiByPerawatan = new Map(observasiTerakhir.map((o) => [o.perawatan_uuid, o]));

        const nilaiKritis = await q(
            `SELECT parameter, satuan, batas_bawah, batas_atas, ruangan_uuid FROM icu_nilai_kritis
             WHERE faskes_uuid = :faskesUuid AND status = true AND deleted_at IS NULL`,
            { faskesUuid },
        );

        const sekarang = moment().unix();
        return perawatan.map((p) => {
            const ri = rawatInapByUuid.get(p.rawat_inap_uuid);
            const b = bedByUuid.get(p.room_monitoring_uuid);
            const obs = observasiByPerawatan.get(p.uuid) ?? null;
            const peringatan = obs ? IcuRepository.hitungPeringatan(obs, nilaiKritis) : [];
            return {
                perawatan_uuid: p.uuid,
                layanan_kode: p.layanan_kode,
                layanan_nama: unit !== "icu" ? labelUnit(unit) : p.layanan_kode ? ({ umum: "ICU Umum", burn: "Burn ICU", neuro: "Neuro ICU" })[p.layanan_kode] : "ICU \u2014 belum diklasifikasikan",
                rawat_inap_uuid: p.rawat_inap_uuid,
                no_rm: ri?.noRm ?? null,
                nama_pasien: ri?.name ?? null,
                bed: b ? { uuid: b.uuid, no_bed: b.noBed, ruangan: b.room?.name ?? null } : null,
                diagnosis_ringkas: p.diagnosis_ringkas,
                hari_rawat: Math.max(1, Math.floor((sekarang - Number(p.waktu_masuk)) / 86400) + 1),
                waktu_masuk: Number(p.waktu_masuk),
                ventilator: { terpasang: obs?.ventilator_terpasang ?? false, mode: obs?.ventilator_mode ?? null },
                observasi_terakhir: obs,
                peringatan,
            };
        });
    }

    // Bandingkan observasi terbaru dengan konfigurasi icu_nilai_kritis faskes (dukungan keputusan, bukan diagnosis).
    static hitungPeringatan(observasi, nilaiKritis) {
        const nilai = {
            tekanan_sistolik: observasi.tekanan_sistolik,
            tekanan_diastolik: observasi.tekanan_diastolik,
            nadi: observasi.nadi,
            suhu: observasi.suhu,
            spo2: observasi.spo2,
        };
        const peringatan = [];
        for (const k of nilaiKritis) {
            const v = nilai[k.parameter];
            if (v === null || v === undefined) continue;
            if (k.batas_bawah !== null && Number(v) < Number(k.batas_bawah)) {
                peringatan.push(`${k.parameter} ${v} di bawah batas kritis ${k.batas_bawah}${k.satuan ?? ""}`);
            } else if (k.batas_atas !== null && Number(v) > Number(k.batas_atas)) {
                peringatan.push(`${k.parameter} ${v} di atas batas kritis ${k.batas_atas}${k.satuan ?? ""}`);
            }
        }
        return peringatan;
    }

    static async GetPerawatan(perawatanUuid, unit = "icu") {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        const perawatan = await IcuRepository.GetPerawatanByUuid(perawatanUuid, faskesUuid, unit);
        if (!perawatan) throw new NotfoundException(`Perawatan ${labelUnit(unit)} tidak ditemukan!`);

        const serahTerima = await q(
            `SELECT * FROM icu_serah_terimas WHERE perawatan_uuid = :perawatanUuid AND faskes_uuid = :faskesUuid AND deleted_at IS NULL
             ORDER BY created_at DESC`,
            { perawatanUuid, faskesUuid },
        );
        const rawatInap = await RawatInapModel.findOne({
            where: { uuid: perawatan.rawat_inap_uuid, faskesUuid, deletedAt: null },
            attributes: ["uuid", "noRm", "name", "patientUuid", "rekamMedisUuid"],
            include: [{ model: PatientModel, as: "patient", attributes: ["uuid", "name", "gender", "noIdentity"] }],
        });

        await IcuRepository.saringSebelumnya(perawatan);
        const template = await Template.ambil(perawatan.template_versi_uuid);
        await auditIcu(null, "baca", "icu_perawatans", perawatan.uuid);
        return { perawatan, rawat_inap: rawatInap, serah_terima: serahTerima, template,
            layanan: { kode: perawatan.layanan_kode, nama: unit !== "icu" ? labelUnit(unit) : perawatan.layanan_kode ? ({ umum: "ICU Umum", burn: "Burn ICU", neuro: "Neuro ICU" })[perawatan.layanan_kode] : "ICU \u2014 belum diklasifikasikan" },
            referensi_integrasi: { patient_uuid: rawatInap?.patientUuid ?? null, rawat_inap_uuid: perawatan.rawat_inap_uuid,
                rekam_medis_uuid: rawatInap?.rekamMedisUuid ?? null, perawatan_uuid: perawatan.uuid } };
    }

    static async saringSebelumnya(perawatan, transaction) {
        if (!perawatan.perawatan_sebelumnya_uuid) return;
        const [asal] = await pilihIcu("SELECT ruangan_uuid FROM icu_perawatans WHERE uuid=:uuid AND faskes_uuid=:f AND deleted_at IS NULL", { uuid: perawatan.perawatan_sebelumnya_uuid }, transaction);
        if (!asal || !unitDiizinkan(Context.get(CTX_ICU_UNIT), asal.ruangan_uuid)) perawatan.perawatan_sebelumnya_uuid = null;
    }

    static async GetPerawatanByUuid(perawatanUuid, faskesUuid, unit = "icu", transaction) {
        if (typeof unit !== "string") { transaction = unit; unit = "icu"; }
        const [perawatan] = await q(
            `SELECT * FROM icu_perawatans WHERE uuid = :perawatanUuid AND faskes_uuid = :faskesUuid AND unit = :unit AND deleted_at IS NULL`,
            { perawatanUuid, faskesUuid, unit }, QueryTypes.SELECT, transaction,
        );
        if (perawatan) {
            if (unit === "icu") pastikanUnitIcu(perawatan.ruangan_uuid);
            await IcuRepository.saringSebelumnya(perawatan, transaction);
        }
        return perawatan ?? null;
    }

    // Perpindahan Rawat Inap berstatus approve yang siap ditautkan ke episode intensif (pengganti mengetik UUID):
    // arah "masuk" = pasien masih di bed tujuan & belum punya episode intensif aktif; arah "keluar" = perpindahan
    // dari bed episode ini setelah pasien masuk unit.
    static async GetPerpindahanSiap(arah, perawatanUuid, unit = "icu") {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        const kolom = `p.uuid, p.waktu_pindah, p.keterangan, ri.uuid AS rawat_inap_uuid, ri.no_rm, ri.name AS nama_pasien,
            ba.no_bed AS bed_asal, la.name AS ruangan_asal, bt.no_bed AS bed_tujuan, lt.name AS ruangan_tujuan`;
        const gabung = `FROM perpindahans p
            JOIN rawat_inaps ri ON ri.uuid = p.admission_ri_uuid AND ri.faskes_uuid = p.faskes_uuid AND ri.deleted_at IS NULL
            LEFT JOIN room_monitorings ba ON ba.uuid = p.origin_monitoring_room_uuid AND ba.faskes_uuid = p.faskes_uuid
            LEFT JOIN lokasi la ON la.uuid = ba.room_uuid AND la.faskes_uuid = p.faskes_uuid
            LEFT JOIN room_monitorings bt ON bt.uuid = p.destination_monitoring_room_uuid AND bt.faskes_uuid = p.faskes_uuid
            LEFT JOIN lokasi lt ON lt.uuid = bt.room_uuid AND lt.faskes_uuid = p.faskes_uuid`;
        if (arah === "keluar") {
            const perawatan = await IcuRepository.pastikanPerawatanAda(perawatanUuid, faskesUuid, unit);
            return q(
                `SELECT ${kolom} ${gabung}
                 WHERE p.faskes_uuid = :faskesUuid AND p.deleted_at IS NULL AND p.status_pindah = 'approve'
                   AND p.admission_ri_uuid = :ri AND p.origin_monitoring_room_uuid = :bed
                   AND p.uuid <> :masukUuid
                 ORDER BY p.waktu_pindah DESC NULLS LAST LIMIT 20`,
                {
                    faskesUuid, ri: perawatan.rawat_inap_uuid, bed: perawatan.room_monitoring_uuid,
                    masukUuid: perawatan.perpindahan_masuk_uuid,
                },
            );
        }
        const cakupan = unit === "icu" ? filterUnitIcu("tujuan") : { sql: "TRUE", replacements: {} };
        return q(
            `SELECT ${kolom} ${gabung}
             CROSS JOIN LATERAL (SELECT bt.room_uuid AS ruangan_uuid) tujuan
             WHERE p.faskes_uuid = :faskesUuid AND p.deleted_at IS NULL AND p.status_pindah = 'approve' AND ${cakupan.sql}
               AND ri.monitoring_room_uuid = p.destination_monitoring_room_uuid
               AND NOT EXISTS (SELECT 1 FROM icu_perawatans x WHERE x.faskes_uuid = :faskesUuid AND x.perpindahan_masuk_uuid = p.uuid AND x.deleted_at IS NULL)
               AND NOT EXISTS (SELECT 1 FROM icu_perawatans x WHERE x.faskes_uuid = :faskesUuid AND x.rawat_inap_uuid = ri.uuid AND x.status = 'aktif' AND x.deleted_at IS NULL)
             ORDER BY p.waktu_pindah DESC NULLS LAST LIMIT 50`,
            { faskesUuid, ...cakupan.replacements },
        );
    }

    // ── Masuk unit intensif (tertaut ke ri_perpindahan yang sudah approve) ─────
    static async MulaiPerawatan(perpindahanUuid, data, unit = "icu") {
        const { faskesUuid, username } = Context.get(CTX_AUTHOR);
        return sequelizeInstance.transaction(async (transaction) => {
            if (unit === "icu") await Konfigurasi.kunci(transaction);
            else await q("SELECT pg_advisory_xact_lock(hashtext(:faskesUuid))", { faskesUuid }, QueryTypes.SELECT, transaction);
            if (unit === "icu") await pastikanModulIcu(faskesUuid, null, transaction);
            const perpindahan = await PerpindahanModel.findOne({ where: { uuid: perpindahanUuid, faskesUuid, deletedAt: null }, transaction, lock: transaction.LOCK.UPDATE });
            if (!perpindahan) throw new NotfoundException("Perpindahan tidak ditemukan!");
            if (perpindahan.statusPindah !== "approve") throw new BadRequestException("Perpindahan belum disetujui (approve) di Rawat Inap.");

            const rawatInap = await RawatInapModel.findOne({ where: { uuid: perpindahan.admissionRiUuid, faskesUuid, deletedAt: null }, transaction, lock: transaction.LOCK.UPDATE });
            if (!rawatInap) throw new NotfoundException("Admisi rawat inap tidak ditemukan!");
            if (rawatInap.monitoringRoomUuid !== perpindahan.destinationMonitoringRoomUuid) {
                throw new BadRequestException("Bed rawat inap saat ini tidak sama dengan bed tujuan perpindahan.");
            }

            const [sudahAda] = await q(
                `SELECT uuid FROM icu_perawatans WHERE faskes_uuid=:faskesUuid AND ((rawat_inap_uuid = :ri AND status = 'aktif') OR perpindahan_masuk_uuid=:perpindahanUuid) AND deleted_at IS NULL`,
                { ri: rawatInap.uuid, faskesUuid, perpindahanUuid }, QueryTypes.SELECT, transaction,
            );
            if (sudahAda) throw new DuplicateException("Admisi masih memiliki episode intensif aktif atau perpindahan sudah ditautkan.");

            const [bedDipakai] = await q(
                `SELECT uuid FROM icu_perawatans WHERE faskes_uuid=:faskesUuid AND room_monitoring_uuid = :bed AND status = 'aktif' AND deleted_at IS NULL`,
                { bed: perpindahan.destinationMonitoringRoomUuid, faskesUuid }, QueryTypes.SELECT, transaction,
            );
            if (bedDipakai) throw new DuplicateException("Bed tujuan sudah dipakai episode perawatan intensif lain.");

            const bedTujuan = await RoomMonitoringModel.findOne({
                where: { uuid: perpindahan.destinationMonitoringRoomUuid, faskesUuid, deletedAt: null }, transaction, lock: transaction.LOCK.UPDATE,
                attributes: ["uuid", "room_uuid", "patientUuid"],
            });

            if (!bedTujuan || bedTujuan.patientUuid !== rawatInap.patientUuid) throw new BadRequestException("Bed tujuan tidak ditempati pasien admisi ini");
            if (unit === "icu") pastikanUnitIcu(bedTujuan.room_uuid);
            const sekarang = moment().unix();
            let template = null;
            if (unit === "icu") {
                const layanan = await Konfigurasi.layanan(data.layanan_kode, transaction);
                if (!layanan.aktif) throw galatIcu(403, "Layanan ICU belum diaktifkan");
                const [pemetaan] = await pilihIcu(`SELECT l.kode FROM icu_layanan_beds b JOIN icu_layanans l ON l.uuid=b.layanan_uuid AND l.faskes_uuid=b.faskes_uuid
                    WHERE b.faskes_uuid=:f AND b.room_monitoring_uuid=:bed AND b.deleted_at IS NULL AND l.deleted_at IS NULL
                    AND b.berlaku_mulai<=:sekarang AND (b.berlaku_sampai IS NULL OR b.berlaku_sampai>:sekarang)`, { bed: bedTujuan.uuid, sekarang }, transaction);
                if ((pemetaan?.kode ?? "umum") !== data.layanan_kode) throw galatIcu(409, "Bed tidak sesuai layanan ICU yang dipilih");
                template = await Template.ambil(data.template_versi_uuid, transaction);
                if (data.layanan_kode !== "umum" && !template) throw galatIcu(400, "Versi template wajib untuk layanan khusus");
                if (template && (template.status !== "ditetapkan" || template.layanan_kode !== data.layanan_kode)) throw galatIcu(409, "Versi template tidak berlaku untuk admisi layanan ini");
            }
            const [sebelumnya] = await pilihIcu(`SELECT uuid FROM icu_perawatans WHERE faskes_uuid=:f AND rawat_inap_uuid=:ri
                AND perpindahan_keluar_uuid=:pindah AND status='selesai' AND deleted_at IS NULL ORDER BY waktu_keluar DESC LIMIT 1`,
                { ri: rawatInap.uuid, pindah: perpindahanUuid }, transaction);
            const perawatanUuid = uuidv7();
            await sequelizeInstance.query(
                `INSERT INTO icu_perawatans
                   (uuid, faskes_uuid, unit, rawat_inap_uuid, perpindahan_masuk_uuid, room_monitoring_uuid, ruangan_uuid,
                    layanan_kode,template_versi_uuid,perawatan_sebelumnya_uuid,diagnosis_ringkas, status, waktu_masuk, dibuat_oleh, created_at)
                 VALUES (:uuid, :faskesUuid, :unit, :rawatInapUuid, :perpindahanUuid, :roomUuid, :ruanganUuid, :layanan,:template,:sebelumnya,:diagnosis,
                         'aktif', :sekarang, :username, :sekarang)`,
                {
                    replacements: {
                        uuid: perawatanUuid, faskesUuid, unit, rawatInapUuid: rawatInap.uuid, perpindahanUuid,
                        roomUuid: perpindahan.destinationMonitoringRoomUuid, ruanganUuid: bedTujuan?.room_uuid ?? null,
                        layanan: unit === "icu" ? data.layanan_kode : null, template: template?.uuid ?? null, sebelumnya: sebelumnya?.uuid ?? null, diagnosis: data.diagnosis_ringkas ?? null, username, sekarang,
                    },
                    transaction,
                },
            );
            const st = data.serah_terima ?? {};
            await sequelizeInstance.query(
                `INSERT INTO icu_serah_terimas
                   (uuid, faskes_uuid, perawatan_uuid, perpindahan_uuid, jenis, kriteria, kondisi, tindakan,
                    terapi_berjalan, alergi_relevan, akses_alat, tindak_lanjut, pencatat, waktu_konfirmasi,
                    dikonfirmasi_oleh, created_at)
                 VALUES (:uuid, :faskesUuid, :perawatanUuid, :perpindahanUuid, 'masuk', :kriteria, :kondisi, :tindakan,
                         :terapiBerjalan, :alergiRelevan, :aksesAlat, :tindakLanjut, :username, :sekarang, :username, :sekarang)`,
                {
                    replacements: {
                        uuid: uuidv7(), faskesUuid, perawatanUuid, perpindahanUuid,
                        kriteria: st.kriteria ?? null, kondisi: st.kondisi ?? null, tindakan: st.tindakan ?? null,
                        terapiBerjalan: st.terapi_berjalan ?? null, alergiRelevan: st.alergi_relevan ?? null,
                        aksesAlat: st.akses_alat ?? null, tindakLanjut: st.tindak_lanjut ?? null, username, sekarang,
                    },
                    transaction,
                },
            );
            auditIcu(transaction, "buat", "icu_perawatans", perawatanUuid);
            return IcuRepository.GetPerawatanByUuid(perawatanUuid, faskesUuid, unit, transaction);
        });
    }

    // ── Keluar unit intensif (tertaut ke ri_perpindahan keluar yang sudah approve) ─
    static async KeluarPerawatan(perawatanUuid, data, unit = "icu") {
        const { faskesUuid, username } = Context.get(CTX_AUTHOR);
        return sequelizeInstance.transaction(async (transaction) => {
            if (unit === "icu") await Konfigurasi.kunci(transaction);
            else await q("SELECT pg_advisory_xact_lock(hashtext(:faskesUuid))", { faskesUuid }, QueryTypes.SELECT, transaction);
            const perawatan = await IcuRepository.GetPerawatanByUuid(perawatanUuid, faskesUuid, unit, transaction);
            if (!perawatan) throw new NotfoundException("Perawatan ICU tidak ditemukan!");
            if (perawatan.status !== "aktif") throw galatIcu(409, "Perawatan ICU ini sudah selesai.");

            const perpindahan = await PerpindahanModel.findOne({ where: { uuid: data.perpindahan_keluar_uuid, faskesUuid, deletedAt: null }, transaction, lock: transaction.LOCK.UPDATE });
            if (!perpindahan) throw new NotfoundException("Perpindahan keluar tidak ditemukan!");
            if (perpindahan.statusPindah !== "approve") throw new BadRequestException("Perpindahan keluar belum disetujui (approve) di Rawat Inap.");
            if (perpindahan.admissionRiUuid !== perawatan.rawat_inap_uuid) throw new BadRequestException("Admisi perpindahan keluar tidak sama dengan episode ICU");
            if (perpindahan.originMonitoringRoomUuid !== perawatan.room_monitoring_uuid) {
                throw new BadRequestException("Bed asal perpindahan tidak sama dengan bed perawatan ICU ini.");
            }

            const sekarang = moment().unix();
            const r = data.ringkasan ?? {};
            await sequelizeInstance.query(
                `INSERT INTO icu_serah_terimas
                   (uuid, faskes_uuid, perawatan_uuid, perpindahan_uuid, jenis, kriteria, kondisi, tindakan,
                    terapi_berjalan, alergi_relevan, akses_alat, tindak_lanjut, pencatat, waktu_konfirmasi,
                    dikonfirmasi_oleh, created_at)
                 VALUES (:uuid, :faskesUuid, :perawatanUuid, :perpindahanUuid, 'keluar', :kriteria, :kondisi, :tindakan,
                         :terapiBerjalan, :alergiRelevan, :aksesAlat, :tindakLanjut, :username, :sekarang, :username, :sekarang)`,
                {
                    replacements: {
                        uuid: uuidv7(), faskesUuid, perawatanUuid, perpindahanUuid: data.perpindahan_keluar_uuid,
                        kriteria: r.kriteria ?? null, kondisi: r.kondisi ?? null, tindakan: r.tindakan ?? null,
                        terapiBerjalan: r.terapi_berjalan ?? null, alergiRelevan: r.alergi_relevan ?? null,
                        aksesAlat: r.akses_alat ?? null, tindakLanjut: r.tindak_lanjut ?? null, username, sekarang,
                    },
                    transaction,
                },
            );
            // Pembaruan bersyarat status = 'aktif': dua permintaan keluar bersamaan tidak menutup episode dua kali.
            const [hasil] = await sequelizeInstance.query(
                `UPDATE icu_perawatans SET status = 'selesai', waktu_keluar = :sekarang, perpindahan_keluar_uuid = :perpindahanUuid,
                        kondisi_keluar = :kondisiKeluar, updated_at = :sekarang
                 WHERE uuid = :perawatanUuid AND faskes_uuid=:faskesUuid AND unit=:unit AND deleted_at IS NULL AND status = 'aktif' RETURNING *`,
                {
                    replacements: { sekarang, perpindahanUuid: data.perpindahan_keluar_uuid, kondisiKeluar: data.kondisi_keluar, perawatanUuid, faskesUuid, unit },
                    type: QueryTypes.SELECT, transaction,
                },
            );
            if (!hasil) throw new BadRequestException(`Perawatan ${labelUnit(unit)} ini sudah selesai.`);
            auditIcu(transaction, "ubah", "icu_perawatans", perawatanUuid);
            await IcuRepository.saringSebelumnya(hasil, transaction);
            return hasil;
        });
    }

    // ── Flowsheet observasi ─────────────────────────────────────────────────
    // Dipakai untuk pembacaan (flowsheet/balance/skor tetap bisa ditinjau setelah pasien keluar unit, KT-12).
    static async pastikanPerawatanAda(perawatanUuid, faskesUuid, unit = "icu") {
        const perawatan = await IcuRepository.GetPerawatanByUuid(perawatanUuid, faskesUuid, unit);
        if (!perawatan) throw new NotfoundException(`Perawatan ${labelUnit(unit)} tidak ditemukan!`);
        return perawatan;
    }

    // Dipakai untuk penulisan baru (observasi/intake-output/skor): hanya pada episode yang masih aktif di unit.
    static async pastikanPerawatanAktif(perawatanUuid, faskesUuid, unit = "icu") {
        const perawatan = await IcuRepository.pastikanPerawatanAda(perawatanUuid, faskesUuid, unit);
        if (perawatan.status !== "aktif") {
            throw new BadRequestException(`Perawatan ${labelUnit(unit)} ini sudah selesai; tidak dapat menambah entri baru.`);
        }
        return perawatan;
    }

    static async TambahObservasi(perawatanUuid, data, unit = "icu") {
        const { faskesUuid, username } = Context.get(CTX_AUTHOR);
        return sequelizeInstance.transaction(async (transaction) => {
            if (unit === "icu") await Konfigurasi.kunci(transaction);
            else await q("SELECT pg_advisory_xact_lock(hashtext(:faskesUuid))", { faskesUuid }, QueryTypes.SELECT, transaction);
            const perawatan = await IcuRepository.GetPerawatanByUuid(perawatanUuid, faskesUuid, unit, transaction);
            if (!perawatan || perawatan.status !== "aktif") throw galatIcu(409, "Episode tidak aktif");
            const template = await Template.ambil(perawatan.template_versi_uuid, transaction);
            try { IcuTemplateService.nilai(template?.definisi.observasi ?? [], data.parameter_tambahan); }
            catch (error) { throw galatIcu(400, error.message); }
            if (data.waktu_pengukuran < Number(perawatan.waktu_masuk) || data.waktu_pengukuran > moment().unix()) throw galatIcu(400, "Waktu observasi di luar episode");
            const sekarang = moment().unix();
            const uuid = uuidv7();
        await sequelizeInstance.query(
            `INSERT INTO icu_observasis
               (uuid, faskes_uuid, perawatan_uuid, waktu_pengukuran, tekanan_sistolik, tekanan_diastolik, nadi, suhu,
                laju_napas, spo2, gcs_e, gcs_v, gcs_m, gcs_total, skala_nyeri, ventilator_terpasang, ventilator_mode,
                ventilator_fio2, ventilator_peep, ventilator_tidal_volume, ventilator_laju_napas, obat_drip, catatan,
                template_versi_uuid,parameter_tambahan,pencatat, created_at)
             VALUES (:uuid, :faskesUuid, :perawatanUuid, :waktuPengukuran, :tekananSistolik, :tekananDiastolik, :nadi, :suhu,
                     :lajuNapas, :spo2, :gcsE, :gcsV, :gcsM, :gcsTotal, :skalaNyeri, :ventilatorTerpasang, :ventilatorMode,
                     :ventilatorFio2, :ventilatorPeep, :ventilatorTidalVolume, :ventilatorLajuNapas, :obatDrip, :catatan,
                     :versi,CAST(:tambahan AS jsonb),:username, :sekarang)`,
            {
                transaction, replacements: {
                    uuid, faskesUuid, perawatanUuid, waktuPengukuran: data.waktu_pengukuran,
                    tekananSistolik: data.tekanan_sistolik ?? null, tekananDiastolik: data.tekanan_diastolik ?? null,
                    nadi: data.nadi ?? null, suhu: data.suhu ?? null, lajuNapas: data.laju_napas ?? null, spo2: data.spo2 ?? null,
                    gcsE: data.gcs_e ?? null, gcsV: data.gcs_v ?? null, gcsM: data.gcs_m ?? null,
                    gcsTotal: data.gcs_e && data.gcs_v && data.gcs_m ? data.gcs_e + data.gcs_v + data.gcs_m : null,
                    skalaNyeri: data.skala_nyeri ?? null, ventilatorTerpasang: data.ventilator_terpasang ?? false,
                    ventilatorMode: data.ventilator_mode ?? null, ventilatorFio2: data.ventilator_fio2 ?? null,
                    ventilatorPeep: data.ventilator_peep ?? null, ventilatorTidalVolume: data.ventilator_tidal_volume ?? null,
                    ventilatorLajuNapas: data.ventilator_laju_napas ?? null, obatDrip: JSON.stringify(data.obat_drip ?? []),
                    versi: perawatan.template_versi_uuid, tambahan: JSON.stringify(data.parameter_tambahan), catatan: data.catatan ?? null, username, sekarang,
                },
            },
        );
        const [observasi] = await q(`SELECT * FROM icu_observasis WHERE uuid = :uuid AND faskes_uuid=:faskesUuid AND deleted_at IS NULL`, { uuid, faskesUuid }, QueryTypes.SELECT, transaction);
        const nilaiKritis = await q(
            `SELECT parameter, satuan, batas_bawah, batas_atas FROM icu_nilai_kritis
             WHERE faskes_uuid = :faskesUuid AND status = true AND deleted_at IS NULL`,
            { faskesUuid }, QueryTypes.SELECT, transaction,
        );
        auditIcu(transaction, "buat", "icu_observasis", uuid);
        return { observasi, peringatan: IcuRepository.hitungPeringatan(observasi, nilaiKritis) };
        });
    }

    static async GetObservasi(perawatanUuid, { dari, sampai } = {}, unit = "icu") {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        await IcuRepository.pastikanPerawatanAda(perawatanUuid, faskesUuid, unit);
        const kondisi = ["perawatan_uuid = :perawatanUuid", "faskes_uuid = :faskesUuid", "deleted_at IS NULL"];
        const replacements = { perawatanUuid, faskesUuid };
        if (dari) { kondisi.push("waktu_pengukuran >= :dari"); replacements.dari = dari; }
        if (sampai) { kondisi.push("waktu_pengukuran <= :sampai"); replacements.sampai = sampai; }
        return q(
            `SELECT * FROM icu_observasis WHERE ${kondisi.join(" AND ")} ORDER BY waktu_pengukuran ASC`,
            replacements,
        );
    }

    static async KoreksiObservasi(observasiUuid, data, unit = "icu") {
        const { faskesUuid, username } = Context.get(CTX_AUTHOR);
        return sequelizeInstance.transaction(async (transaction) => {
            if (unit === "icu") await Konfigurasi.kunci(transaction);
            else await q("SELECT pg_advisory_xact_lock(hashtext(:faskesUuid))", { faskesUuid }, QueryTypes.SELECT, transaction);
            const [observasi] = await q(
                `SELECT * FROM icu_observasis WHERE uuid = :observasiUuid AND faskes_uuid = :faskesUuid AND deleted_at IS NULL FOR UPDATE`,
                { observasiUuid, faskesUuid }, QueryTypes.SELECT, transaction,
            );
            if (!observasi) throw new NotfoundException("Observasi tidak ditemukan!");

            const perawatan = await IcuRepository.GetPerawatanByUuid(observasi.perawatan_uuid, faskesUuid, unit, transaction);
            if (!perawatan) throw new NotfoundException("Perawatan ICU tidak ditemukan!");
            if (data.revisi !== observasi.revisi) throw galatIcu(409, "Revisi observasi telah berubah");
            const gabungan = { ...observasi, ...data.nilai_baru };
            const diuji = IcuRequest.OBSERVASI.safeParse({ ...gabungan, waktu_pengukuran: Number(gabungan.waktu_pengukuran),
                ...Object.fromEntries(["tekanan_sistolik","tekanan_diastolik","nadi","suhu","laju_napas","spo2","gcs_e","gcs_v","gcs_m","skala_nyeri","ventilator_fio2","ventilator_peep","ventilator_tidal_volume","ventilator_laju_napas"].map((k) => [k, gabungan[k] == null ? null : Number(gabungan[k])])) });
            if (!diuji.success) throw galatIcu(400, "Nilai koreksi observasi tidak valid");
            const template = await Template.ambil(observasi.template_versi_uuid, transaction);
            try { IcuTemplateService.nilai(template?.definisi.observasi ?? [], gabungan.parameter_tambahan); }
            catch (error) { throw galatIcu(400, error.message); }
            const kolomDiizinkan = [
                "tekanan_sistolik", "tekanan_diastolik", "nadi", "suhu", "laju_napas", "spo2", "gcs_e", "gcs_v", "gcs_m",
                "skala_nyeri", "ventilator_terpasang", "ventilator_mode", "ventilator_fio2", "ventilator_peep",
                "ventilator_tidal_volume", "ventilator_laju_napas", "catatan", "parameter_tambahan", "obat_drip",
            ];
            const kolom = Object.keys(data.nilai_baru).filter((k) => kolomDiizinkan.includes(k));
            if (!kolom.length) throw new BadRequestException("Tidak ada kolom valid untuk dikoreksi.");

            const nilaiSebelum = Object.fromEntries(kolom.map((k) => [k, observasi[k]]));
            const nilaiSesudah = Object.fromEntries(kolom.map((k) => [k, data.nilai_baru[k]]));
            const sekarang = moment().unix();

            const setClause = kolom.map((k) => `${k} = ${["parameter_tambahan", "obat_drip"].includes(k) ? `CAST(:${k} AS jsonb)` : `:${k}`}`).join(", ");
            await sequelizeInstance.query(
                `UPDATE icu_observasis SET ${setClause}, gcs_total=:gcsTotal,revisi=revisi+1,dikoreksi = true, updated_at = :sekarang WHERE uuid = :observasiUuid AND faskes_uuid=:faskesUuid AND deleted_at IS NULL`,
                { replacements: { ...nilaiSesudah, ...Object.fromEntries(kolom.filter((k) => ["parameter_tambahan", "obat_drip"].includes(k)).map((k) => [k, JSON.stringify(nilaiSesudah[k])])), gcsTotal: gabungan.gcs_e && gabungan.gcs_v && gabungan.gcs_m ? Number(gabungan.gcs_e)+Number(gabungan.gcs_v)+Number(gabungan.gcs_m) : null, sekarang, observasiUuid, faskesUuid }, transaction },
            );
            await sequelizeInstance.query(
                `INSERT INTO icu_observasi_koreksis (uuid, faskes_uuid, observasi_uuid, nilai_sebelum, nilai_sesudah, alasan, pelaku, created_at)
                 VALUES (:uuid, :faskesUuid, :observasiUuid, :nilaiSebelum, :nilaiSesudah, :alasan, :pelaku, :sekarang)`,
                {
                    replacements: {
                        uuid: uuidv7(), faskesUuid, observasiUuid, nilaiSebelum: JSON.stringify(nilaiSebelum),
                        nilaiSesudah: JSON.stringify(nilaiSesudah), alasan: data.alasan, pelaku: username, sekarang,
                    },
                    transaction,
                },
            );
            const [hasil] = await sequelizeInstance.query(`SELECT * FROM icu_observasis WHERE uuid = :observasiUuid AND faskes_uuid=:faskesUuid AND deleted_at IS NULL`, {
                replacements: { observasiUuid, faskesUuid }, type: QueryTypes.SELECT, transaction,
            });
            const koreksi = await sequelizeInstance.query(
                `SELECT * FROM icu_observasi_koreksis WHERE observasi_uuid = :observasiUuid AND faskes_uuid=:faskesUuid ORDER BY created_at ASC`,
                { replacements: { observasiUuid, faskesUuid }, type: QueryTypes.SELECT, transaction },
            );
            auditIcu(transaction, "ubah", "icu_observasis", observasiUuid);
            return { observasi: hasil, koreksi };
        });
    }

    // ── Balance cairan ───────────────────────────────────────────────────────
    static async TambahIntakeOutput(perawatanUuid, data, unit = "icu") {
        const { faskesUuid, username } = Context.get(CTX_AUTHOR);
        await IcuRepository.pastikanPerawatanAktif(perawatanUuid, faskesUuid, unit);
        const sekarang = moment().unix();
        const uuid = uuidv7();
        await sequelizeInstance.query(
            `INSERT INTO icu_intake_outputs (uuid, faskes_uuid, perawatan_uuid, waktu_pencatatan, jenis, kategori, jumlah_ml, keterangan, pencatat, created_at)
             VALUES (:uuid, :faskesUuid, :perawatanUuid, :waktuPencatatan, :jenis, :kategori, :jumlahMl, :keterangan, :username, :sekarang)`,
            {
                replacements: {
                    uuid, faskesUuid, perawatanUuid, waktuPencatatan: data.waktu_pencatatan, jenis: data.jenis,
                    kategori: data.kategori, jumlahMl: data.jumlah_ml, keterangan: data.keterangan ?? null, username, sekarang,
                },
            },
        );
        const [entri] = await q(`SELECT * FROM icu_intake_outputs WHERE uuid = :uuid AND faskes_uuid=:faskesUuid AND deleted_at IS NULL`, { uuid, faskesUuid });
        return entri;
    }

    static async GetBalance(perawatanUuid, { dari, sampai }, unit = "icu") {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        await IcuRepository.pastikanPerawatanAda(perawatanUuid, faskesUuid, unit);
        if (!dari || !sampai) throw new BadRequestException("Parameter dari dan sampai wajib diisi.");

        const entri = await q(
            `SELECT * FROM icu_intake_outputs
             WHERE faskes_uuid = :faskesUuid AND perawatan_uuid = :perawatanUuid AND deleted_at IS NULL
               AND waktu_pencatatan BETWEEN :dari AND :sampai
             ORDER BY waktu_pencatatan ASC`,
            { faskesUuid, perawatanUuid, dari, sampai },
        );
        const totalIntake = entri.filter((e) => e.jenis === "intake").reduce((a, e) => a + Number(e.jumlah_ml), 0);
        const totalOutput = entri.filter((e) => e.jenis === "output").reduce((a, e) => a + Number(e.jumlah_ml), 0);

        // Kelengkapan periode: definisi final jam-kosong/shift menunggu ketetapan pemilik klinis (PRD §13 keputusan #3).
        // Sementara ditandai "belum lengkap" bila periode masih berjalan (sampai > sekarang) atau belum ada entri sama sekali.
        const sekarang = moment().unix();
        const lengkap = entri.length > 0 && sampai <= sekarang;
        return {
            dari, sampai, total_intake: totalIntake, total_output: totalOutput, balance: totalIntake - totalOutput,
            lengkap,
            rentang_kurang: lengkap ? null : { keterangan: entri.length ? "Periode belum berakhir" : "Belum ada entri intake/output pada periode ini" },
            entri,
        };
    }

    // ── Skor SOFA ────────────────────────────────────────────────────────────
    static async TambahSkorSofa(perawatanUuid, hasil, unit = "icu") {
        const { faskesUuid, username } = Context.get(CTX_AUTHOR);
        await IcuRepository.pastikanPerawatanAktif(perawatanUuid, faskesUuid, unit);
        const sekarang = moment().unix();
        const uuid = uuidv7();
        await sequelizeInstance.query(
            `INSERT INTO icu_skor_sofas
               (uuid, faskes_uuid, perawatan_uuid, waktu_penilaian, respirasi_skor, koagulasi_skor, hepar_skor,
                kardiovaskular_skor, saraf_pusat_skor, ginjal_skor, parameter, total_skor, lengkap, penilai, catatan, created_at)
             VALUES (:uuid, :faskesUuid, :perawatanUuid, :waktuPenilaian, :respirasi, :koagulasi, :hepar, :kardiovaskular,
                     :sarafPusat, :ginjal, :parameter, :totalSkor, :lengkap, :username, :catatan, :sekarang)`,
            {
                replacements: {
                    uuid, faskesUuid, perawatanUuid, waktuPenilaian: hasil.waktu_penilaian,
                    respirasi: hasil.skor.respirasi, koagulasi: hasil.skor.koagulasi, hepar: hasil.skor.hepar,
                    kardiovaskular: hasil.skor.kardiovaskular, sarafPusat: hasil.skor.saraf_pusat, ginjal: hasil.skor.ginjal,
                    parameter: JSON.stringify(hasil.parameter), totalSkor: hasil.total_skor, lengkap: hasil.lengkap,
                    username, catatan: hasil.catatan ?? null, sekarang,
                },
            },
        );
        const [skor] = await q(`SELECT * FROM icu_skor_sofas WHERE uuid = :uuid AND faskes_uuid=:faskesUuid AND deleted_at IS NULL`, { uuid, faskesUuid });
        return skor;
    }

    static async GetSkorSofa(perawatanUuid, unit = "icu") {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        await IcuRepository.pastikanPerawatanAda(perawatanUuid, faskesUuid, unit);
        return q(
            `SELECT * FROM icu_skor_sofas WHERE faskes_uuid = :faskesUuid AND perawatan_uuid = :perawatanUuid AND deleted_at IS NULL
             ORDER BY waktu_penilaian DESC`,
            { faskesUuid, perawatanUuid },
        );
    }

    // ── Laporan ──────────────────────────────────────────────────────────────
    static async GetLaporan({ dari, sampai, ruangan_uuid: ruanganUuid, layanan_kode: layananKode }, unitIntensif = "icu") {
        if (unitIntensif !== "icu") return IcuRepository.GetLaporanIntensif({ dari, sampai, ruangan_uuid: ruanganUuid }, unitIntensif);
        const unit = filterUnitIcu();
        const r = { dari, sampai, unit: ruanganUuid ?? null, kode: layananKode ?? null, ...unit.replacements };
        const episode = await pilihIcu(`SELECT * FROM icu_perawatans WHERE faskes_uuid=:f AND unit='icu' AND deleted_at IS NULL AND ${unit.sql}
            AND (:unit IS NULL OR ruangan_uuid=:unit) AND (:kode IS NULL OR COALESCE(layanan_kode,'belum_diklasifikasikan')=:kode)`, r);
        const observasi = episode.length ? await pilihIcu(`SELECT o.perawatan_uuid,p.rawat_inap_uuid,o.waktu_pengukuran,o.ventilator_terpasang FROM icu_observasis o
            JOIN icu_perawatans p ON p.uuid=o.perawatan_uuid AND p.faskes_uuid=o.faskes_uuid
            WHERE o.faskes_uuid=:f AND o.deleted_at IS NULL AND p.deleted_at IS NULL AND p.uuid IN (:ids)
            AND o.waktu_pengukuran>=:dari AND o.waktu_pengukuran< :sampai`, { ...r, ids: episode.map((e) => e.uuid) }) : [];
        const cakupanBed = filterUnitIcu("b");
        const kapasitas = await pilihIcu(`SELECT b.*,l.kode AS layanan_kode FROM icu_layanan_beds b JOIN icu_layanans l ON l.uuid=b.layanan_uuid AND l.faskes_uuid=b.faskes_uuid
            WHERE b.faskes_uuid=:f AND b.deleted_at IS NULL AND l.deleted_at IS NULL AND ${cakupanBed.sql}
            AND (:unit IS NULL OR b.ruangan_uuid=:unit) AND (:kode IS NULL OR l.kode=:kode)
            AND b.berlaku_mulai< :sampai AND (b.berlaku_sampai IS NULL OR b.berlaku_sampai>:dari)`, { ...r, ...cakupanBed.replacements });
        // Faskes yang belum memetakan bed ICU (Konfigurasi Layanan): kapasitas diperkirakan dari bed yang pernah dipakai
        // episode, sama dengan definisi laporan ICU sebelum STD-0048, agar BOR tidak hilang bagi ICU umum yang berjalan.
        const [adaPemetaan] = kapasitas.length ? [true] : await pilihIcu("SELECT 1 FROM icu_layanan_beds WHERE faskes_uuid=:f AND deleted_at IS NULL LIMIT 1");
        const perkiraan = !adaPemetaan;
        const dasar = perkiraan
            ? [...new Map(episode.map((e) => [e.room_monitoring_uuid, { room_monitoring_uuid: e.room_monitoring_uuid, layanan_kode: "perkiraan", berlaku_mulai: dari, berlaku_sampai: sampai }])).values()]
            : kapasitas;
        const hasil = hitungLaporanIcu(perkiraan ? episode.map((e) => ({ ...e, layanan_kode: "perkiraan" })) : episode, observasi, dasar, dari, sampai, moment().unix(), { ruangan_uuid: ruanganUuid ?? null, layanan_kode: layananKode ?? null });
        if (perkiraan && hasil.dasar_kapasitas) {
            hasil.dasar_kapasitas.perkiraan = true;
            hasil.dasar_kapasitas.alasan = "Bed ICU belum dipetakan di Konfigurasi Layanan; kapasitas diperkirakan dari bed yang pernah dipakai episode ICU.";
        }
        return hasil;
    }

    static async GetLaporanIntensif({ dari, sampai, ruangan_uuid: ruanganUuid }, unit = "icu") {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        if (!dari || !sampai) throw new BadRequestException("Parameter dari dan sampai wajib diisi.");
        const sekarang = moment().unix();

        const filterRuangan = "AND unit = :unit" + (ruanganUuid
            ? " AND room_monitoring_uuid IN (SELECT DISTINCT room_monitoring_uuid FROM icu_perawatans WHERE faskes_uuid = :faskesUuid AND ruangan_uuid = :ruanganUuid)"
            : "");
        const replacements = { faskesUuid, dari, sampai, ruanganUuid, unit };

        const [jumlahBedRow] = await q(
            `SELECT COUNT(DISTINCT room_monitoring_uuid) AS jumlah FROM icu_perawatans WHERE faskes_uuid = :faskesUuid AND deleted_at IS NULL ${filterRuangan}`,
            replacements,
        );
        const jumlahBed = Number(jumlahBedRow?.jumlah ?? 0);

        const [overlapRow] = await q(
            `SELECT COALESCE(SUM(GREATEST(0, LEAST(COALESCE(waktu_keluar, :sekarang), :sampai) - GREATEST(waktu_masuk, :dari))), 0) AS detik
             FROM icu_perawatans WHERE faskes_uuid = :faskesUuid AND deleted_at IS NULL
               AND waktu_masuk <= :sampai AND COALESCE(waktu_keluar, :sekarang) >= :dari ${filterRuangan}`,
            { ...replacements, sekarang },
        );
        const bedHariTerisi = Number(overlapRow?.detik ?? 0) / 86400;
        const periodeHari = Math.max(1, (sampai - dari) / 86400);
        const bor = jumlahBed > 0 ? (bedHariTerisi / (jumlahBed * periodeHari)) * 100 : null;

        const episodeSelesai = await q(
            `SELECT waktu_masuk, waktu_keluar, kondisi_keluar FROM icu_perawatans
             WHERE faskes_uuid = :faskesUuid AND status = 'selesai' AND deleted_at IS NULL
               AND waktu_keluar BETWEEN :dari AND :sampai ${filterRuangan}`,
            replacements,
        );
        const alos = episodeSelesai.length
            ? episodeSelesai.reduce((a, e) => a + (Number(e.waktu_keluar) - Number(e.waktu_masuk)), 0) / episodeSelesai.length / 86400
            : null;
        const meninggal = episodeSelesai.filter((e) => e.kondisi_keluar === "meninggal").length;
        const angkaKematian = episodeSelesai.length ? (meninggal / episodeSelesai.length) * 100 : null;

        const [hariVentilatorRow] = await q(
            `SELECT COUNT(*) AS jumlah FROM (
               SELECT DISTINCT o.perawatan_uuid, DATE(to_timestamp(o.waktu_pengukuran)) AS tanggal
               FROM icu_observasis o
               JOIN icu_perawatans p ON p.uuid = o.perawatan_uuid AND p.faskes_uuid = o.faskes_uuid AND p.unit = :unit
               WHERE o.faskes_uuid = :faskesUuid AND o.ventilator_terpasang = true AND o.deleted_at IS NULL
                 AND o.waktu_pengukuran BETWEEN :dari AND :sampai
             ) t`,
            { faskesUuid, dari, sampai, unit },
        );

        return {
            unit,
            periode: { dari, sampai },
            bor: bor === null ? null : Math.round(bor * 100) / 100,
            alos: alos === null ? null : Math.round(alos * 100) / 100,
            angka_kematian: angkaKematian === null ? null : Math.round(angkaKematian * 100) / 100,
            hari_ventilator: Number(hariVentilatorRow?.jumlah ?? 0),
            jumlah_bed_icu: jumlahBed,
            jumlah_episode_selesai: episodeSelesai.length,
            definisi:
                `BOR = bed-hari terisi / (jumlah bed ${labelUnit(unit)} × hari periode); ALOS = rata-rata lama rawat episode yang ` +
                "selesai pada periode; angka kematian = persentase episode selesai dengan kondisi_keluar='meninggal'; " +
                `hari ventilator = jumlah hari-pasien dengan ventilator terpasang. Bed ${labelUnit(unit)} = bed yang pernah dipakai ` +
                "episode icu_perawatans unit ini (belum ada datamaster kategori bed intensif terpisah). Definisi operasional " +
                "ini menunggu ketetapan final pemilik klinis/manajemen (PRD STD-0008 §13 #6).",
        };
    }
}
