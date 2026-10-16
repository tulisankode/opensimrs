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

const q = (sql, replacements, type = QueryTypes.SELECT) => sequelizeInstance.query(sql, { replacements, type });

export default class IcuRepository {
    // ── Dasbor & perawatan ────────────────────────────────────────────────────
    static async GetDashboard() {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        const perawatan = await q(
            `SELECT uuid, rawat_inap_uuid, room_monitoring_uuid, diagnosis_ringkas, waktu_masuk
             FROM icu_perawatans WHERE faskes_uuid = :faskesUuid AND status = 'aktif' AND deleted_at IS NULL
             ORDER BY waktu_masuk ASC`,
            { faskesUuid },
        );
        if (!perawatan.length) return [];

        const rawatInapUuids = perawatan.map((p) => p.rawat_inap_uuid);
        const rawatInaps = await RawatInapModel.findAll({
            where: { uuid: rawatInapUuids, faskesUuid },
            attributes: ["uuid", "noRm", "name", "monitoringRoomUuid"],
        });
        const rawatInapByUuid = new Map(rawatInaps.map((r) => [r.uuid, r]));

        const roomUuids = perawatan.map((p) => p.room_monitoring_uuid);
        const bed = await RoomMonitoringModel.findAll({
            where: { uuid: roomUuids, faskesUuid },
            attributes: ["uuid", "noBed", "room_uuid"],
            include: [{ model: LokasiModel, as: "room", attributes: ["uuid", "name"] }],
        });
        const bedByUuid = new Map(bed.map((b) => [b.uuid, b]));

        const observasiTerakhir = await q(
            `SELECT DISTINCT ON (perawatan_uuid) perawatan_uuid, waktu_pengukuran, ventilator_terpasang, ventilator_mode,
                    tekanan_sistolik, tekanan_diastolik, nadi, suhu, spo2
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

    static async GetPerawatan(perawatanUuid) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        const [perawatan] = await q(
            `SELECT * FROM icu_perawatans WHERE uuid = :perawatanUuid AND faskes_uuid = :faskesUuid AND deleted_at IS NULL`,
            { perawatanUuid, faskesUuid },
        );
        if (!perawatan) throw new NotfoundException("Perawatan ICU tidak ditemukan!");

        const serahTerima = await q(
            `SELECT * FROM icu_serah_terimas WHERE perawatan_uuid = :perawatanUuid AND faskes_uuid = :faskesUuid AND deleted_at IS NULL
             ORDER BY created_at DESC`,
            { perawatanUuid, faskesUuid },
        );
        const rawatInap = await RawatInapModel.findOne({
            where: { uuid: perawatan.rawat_inap_uuid, faskesUuid },
            attributes: ["uuid", "noRm", "name", "patientUuid"],
            include: [{ model: PatientModel, as: "patient", attributes: ["uuid", "name", "gender", "noIdentity"] }],
        });

        return { perawatan, rawat_inap: rawatInap, serah_terima: serahTerima };
    }

    static async GetPerawatanByUuid(perawatanUuid, faskesUuid) {
        const [perawatan] = await q(
            `SELECT * FROM icu_perawatans WHERE uuid = :perawatanUuid AND faskes_uuid = :faskesUuid AND deleted_at IS NULL`,
            { perawatanUuid, faskesUuid },
        );
        return perawatan ?? null;
    }

    // ── Masuk ICU (tertaut ke ri_perpindahan yang sudah approve) ───────────────
    static async MulaiPerawatan(perpindahanUuid, data) {
        const { faskesUuid, username } = Context.get(CTX_AUTHOR);
        const perpindahan = await PerpindahanModel.findOne({ where: { uuid: perpindahanUuid, faskesUuid } });
        if (!perpindahan) throw new NotfoundException("Perpindahan tidak ditemukan!");
        if (perpindahan.statusPindah !== "approve") throw new BadRequestException("Perpindahan belum disetujui (approve) di Rawat Inap.");

        const rawatInap = await RawatInapModel.findOne({ where: { uuid: perpindahan.admissionRiUuid, faskesUuid } });
        if (!rawatInap) throw new NotfoundException("Admisi rawat inap tidak ditemukan!");
        if (rawatInap.monitoringRoomUuid !== perpindahan.destinationMonitoringRoomUuid) {
            throw new BadRequestException("Bed rawat inap saat ini tidak sama dengan bed tujuan perpindahan.");
        }

        const [sudahAda] = await q(
            `SELECT uuid FROM icu_perawatans WHERE rawat_inap_uuid = :ri AND status = 'aktif' AND deleted_at IS NULL`,
            { ri: rawatInap.uuid },
        );
        if (sudahAda) throw new DuplicateException("Admisi ini sudah memiliki episode perawatan ICU yang aktif.");

        const [bedDipakai] = await q(
            `SELECT uuid FROM icu_perawatans WHERE room_monitoring_uuid = :bed AND status = 'aktif' AND deleted_at IS NULL`,
            { bed: perpindahan.destinationMonitoringRoomUuid },
        );
        if (bedDipakai) throw new DuplicateException("Bed tujuan sudah dipakai episode perawatan ICU lain.");

        const bedTujuan = await RoomMonitoringModel.findOne({
            where: { uuid: perpindahan.destinationMonitoringRoomUuid, faskesUuid },
            attributes: ["uuid", "room_uuid"],
        });

        const sekarang = moment().unix();
        const perawatanUuid = uuidv7();
        return sequelizeInstance.transaction(async (transaction) => {
            await sequelizeInstance.query(
                `INSERT INTO icu_perawatans
                   (uuid, faskes_uuid, rawat_inap_uuid, perpindahan_masuk_uuid, room_monitoring_uuid, ruangan_uuid,
                    diagnosis_ringkas, status, waktu_masuk, dibuat_oleh, created_at)
                 VALUES (:uuid, :faskesUuid, :rawatInapUuid, :perpindahanUuid, :roomUuid, :ruanganUuid, :diagnosis,
                         'aktif', :sekarang, :username, :sekarang)`,
                {
                    replacements: {
                        uuid: perawatanUuid, faskesUuid, rawatInapUuid: rawatInap.uuid, perpindahanUuid,
                        roomUuid: perpindahan.destinationMonitoringRoomUuid, ruanganUuid: bedTujuan?.room_uuid ?? null,
                        diagnosis: data.diagnosis_ringkas ?? null, username, sekarang,
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
            return IcuRepository.GetPerawatanByUuid(perawatanUuid, faskesUuid);
        });
    }

    // ── Keluar ICU (tertaut ke ri_perpindahan keluar yang sudah approve) ───────
    static async KeluarPerawatan(perawatanUuid, data) {
        const { faskesUuid, username } = Context.get(CTX_AUTHOR);
        const perawatan = await IcuRepository.GetPerawatanByUuid(perawatanUuid, faskesUuid);
        if (!perawatan) throw new NotfoundException("Perawatan ICU tidak ditemukan!");
        if (perawatan.status !== "aktif") throw new BadRequestException("Perawatan ICU ini sudah selesai.");

        const perpindahan = await PerpindahanModel.findOne({ where: { uuid: data.perpindahan_keluar_uuid, faskesUuid } });
        if (!perpindahan) throw new NotfoundException("Perpindahan keluar tidak ditemukan!");
        if (perpindahan.statusPindah !== "approve") throw new BadRequestException("Perpindahan keluar belum disetujui (approve) di Rawat Inap.");
        if (perpindahan.originMonitoringRoomUuid !== perawatan.room_monitoring_uuid) {
            throw new BadRequestException("Bed asal perpindahan tidak sama dengan bed perawatan ICU ini.");
        }

        const sekarang = moment().unix();
        return sequelizeInstance.transaction(async (transaction) => {
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
            await sequelizeInstance.query(
                `UPDATE icu_perawatans SET status = 'selesai', waktu_keluar = :sekarang, perpindahan_keluar_uuid = :perpindahanUuid,
                        kondisi_keluar = :kondisiKeluar, updated_at = :sekarang
                 WHERE uuid = :perawatanUuid`,
                { replacements: { sekarang, perpindahanUuid: data.perpindahan_keluar_uuid, kondisiKeluar: data.kondisi_keluar, perawatanUuid }, transaction },
            );
            return IcuRepository.GetPerawatanByUuid(perawatanUuid, faskesUuid);
        });
    }

    // ── Flowsheet observasi ─────────────────────────────────────────────────
    // Dipakai untuk pembacaan (flowsheet/balance/skor tetap bisa ditinjau setelah pasien keluar ICU, KT-12).
    static async pastikanPerawatanAda(perawatanUuid, faskesUuid) {
        const perawatan = await IcuRepository.GetPerawatanByUuid(perawatanUuid, faskesUuid);
        if (!perawatan) throw new NotfoundException("Perawatan ICU tidak ditemukan!");
        return perawatan;
    }

    // Dipakai untuk penulisan baru (observasi/intake-output/skor): hanya pada episode yang masih aktif di ICU.
    static async pastikanPerawatanAktif(perawatanUuid, faskesUuid) {
        const perawatan = await IcuRepository.pastikanPerawatanAda(perawatanUuid, faskesUuid);
        if (perawatan.status !== "aktif") throw new BadRequestException("Perawatan ICU ini sudah selesai; tidak dapat menambah entri baru.");
        return perawatan;
    }

    static async TambahObservasi(perawatanUuid, data) {
        const { faskesUuid, username } = Context.get(CTX_AUTHOR);
        await IcuRepository.pastikanPerawatanAktif(perawatanUuid, faskesUuid);
        const sekarang = moment().unix();
        const uuid = uuidv7();
        await sequelizeInstance.query(
            `INSERT INTO icu_observasis
               (uuid, faskes_uuid, perawatan_uuid, waktu_pengukuran, tekanan_sistolik, tekanan_diastolik, nadi, suhu,
                laju_napas, spo2, gcs_e, gcs_v, gcs_m, gcs_total, skala_nyeri, ventilator_terpasang, ventilator_mode,
                ventilator_fio2, ventilator_peep, ventilator_tidal_volume, ventilator_laju_napas, obat_drip, catatan,
                pencatat, created_at)
             VALUES (:uuid, :faskesUuid, :perawatanUuid, :waktuPengukuran, :tekananSistolik, :tekananDiastolik, :nadi, :suhu,
                     :lajuNapas, :spo2, :gcsE, :gcsV, :gcsM, :gcsTotal, :skalaNyeri, :ventilatorTerpasang, :ventilatorMode,
                     :ventilatorFio2, :ventilatorPeep, :ventilatorTidalVolume, :ventilatorLajuNapas, :obatDrip, :catatan,
                     :username, :sekarang)`,
            {
                replacements: {
                    uuid, faskesUuid, perawatanUuid, waktuPengukuran: data.waktu_pengukuran,
                    tekananSistolik: data.tekanan_sistolik ?? null, tekananDiastolik: data.tekanan_diastolik ?? null,
                    nadi: data.nadi ?? null, suhu: data.suhu ?? null, lajuNapas: data.laju_napas ?? null, spo2: data.spo2 ?? null,
                    gcsE: data.gcs_e ?? null, gcsV: data.gcs_v ?? null, gcsM: data.gcs_m ?? null,
                    gcsTotal: data.gcs_e && data.gcs_v && data.gcs_m ? data.gcs_e + data.gcs_v + data.gcs_m : null,
                    skalaNyeri: data.skala_nyeri ?? null, ventilatorTerpasang: data.ventilator_terpasang ?? false,
                    ventilatorMode: data.ventilator_mode ?? null, ventilatorFio2: data.ventilator_fio2 ?? null,
                    ventilatorPeep: data.ventilator_peep ?? null, ventilatorTidalVolume: data.ventilator_tidal_volume ?? null,
                    ventilatorLajuNapas: data.ventilator_laju_napas ?? null, obatDrip: JSON.stringify(data.obat_drip ?? []),
                    catatan: data.catatan ?? null, username, sekarang,
                },
            },
        );
        const [observasi] = await q(`SELECT * FROM icu_observasis WHERE uuid = :uuid`, { uuid });
        const nilaiKritis = await q(
            `SELECT parameter, satuan, batas_bawah, batas_atas FROM icu_nilai_kritis
             WHERE faskes_uuid = :faskesUuid AND status = true AND deleted_at IS NULL`,
            { faskesUuid },
        );
        return { observasi, peringatan: IcuRepository.hitungPeringatan(observasi, nilaiKritis) };
    }

    static async GetObservasi(perawatanUuid, { dari, sampai } = {}) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        await IcuRepository.pastikanPerawatanAda(perawatanUuid, faskesUuid);
        const kondisi = ["perawatan_uuid = :perawatanUuid", "faskes_uuid = :faskesUuid", "deleted_at IS NULL"];
        const replacements = { perawatanUuid, faskesUuid };
        if (dari) { kondisi.push("waktu_pengukuran >= :dari"); replacements.dari = dari; }
        if (sampai) { kondisi.push("waktu_pengukuran <= :sampai"); replacements.sampai = sampai; }
        return q(
            `SELECT * FROM icu_observasis WHERE ${kondisi.join(" AND ")} ORDER BY waktu_pengukuran ASC`,
            replacements,
        );
    }

    static async KoreksiObservasi(observasiUuid, data) {
        const { faskesUuid, username } = Context.get(CTX_AUTHOR);
        const [observasi] = await q(
            `SELECT * FROM icu_observasis WHERE uuid = :observasiUuid AND faskes_uuid = :faskesUuid AND deleted_at IS NULL`,
            { observasiUuid, faskesUuid },
        );
        if (!observasi) throw new NotfoundException("Observasi tidak ditemukan!");

        const kolomDiizinkan = [
            "tekanan_sistolik", "tekanan_diastolik", "nadi", "suhu", "laju_napas", "spo2", "gcs_e", "gcs_v", "gcs_m",
            "skala_nyeri", "ventilator_terpasang", "ventilator_mode", "ventilator_fio2", "ventilator_peep",
            "ventilator_tidal_volume", "ventilator_laju_napas", "catatan",
        ];
        const kolom = Object.keys(data.nilai_baru).filter((k) => kolomDiizinkan.includes(k));
        if (!kolom.length) throw new BadRequestException("Tidak ada kolom valid untuk dikoreksi.");

        const nilaiSebelum = Object.fromEntries(kolom.map((k) => [k, observasi[k]]));
        const nilaiSesudah = Object.fromEntries(kolom.map((k) => [k, data.nilai_baru[k]]));
        const sekarang = moment().unix();

        return sequelizeInstance.transaction(async (transaction) => {
            const setClause = kolom.map((k) => `${k} = :${k}`).join(", ");
            await sequelizeInstance.query(
                `UPDATE icu_observasis SET ${setClause}, dikoreksi = true, updated_at = :sekarang WHERE uuid = :observasiUuid`,
                { replacements: { ...nilaiSesudah, sekarang, observasiUuid }, transaction },
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
            const [hasil] = await sequelizeInstance.query(`SELECT * FROM icu_observasis WHERE uuid = :observasiUuid`, {
                replacements: { observasiUuid }, type: QueryTypes.SELECT, transaction,
            });
            const koreksi = await sequelizeInstance.query(
                `SELECT * FROM icu_observasi_koreksis WHERE observasi_uuid = :observasiUuid ORDER BY created_at ASC`,
                { replacements: { observasiUuid }, type: QueryTypes.SELECT, transaction },
            );
            return { observasi: hasil, koreksi };
        });
    }

    // ── Balance cairan ───────────────────────────────────────────────────────
    static async TambahIntakeOutput(perawatanUuid, data) {
        const { faskesUuid, username } = Context.get(CTX_AUTHOR);
        await IcuRepository.pastikanPerawatanAktif(perawatanUuid, faskesUuid);
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
        const [entri] = await q(`SELECT * FROM icu_intake_outputs WHERE uuid = :uuid`, { uuid });
        return entri;
    }

    static async GetBalance(perawatanUuid, { dari, sampai }) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        await IcuRepository.pastikanPerawatanAda(perawatanUuid, faskesUuid);
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
    static async TambahSkorSofa(perawatanUuid, hasil) {
        const { faskesUuid, username } = Context.get(CTX_AUTHOR);
        await IcuRepository.pastikanPerawatanAktif(perawatanUuid, faskesUuid);
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
        const [skor] = await q(`SELECT * FROM icu_skor_sofas WHERE uuid = :uuid`, { uuid });
        return skor;
    }

    static async GetSkorSofa(perawatanUuid) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        await IcuRepository.pastikanPerawatanAda(perawatanUuid, faskesUuid);
        return q(
            `SELECT * FROM icu_skor_sofas WHERE faskes_uuid = :faskesUuid AND perawatan_uuid = :perawatanUuid AND deleted_at IS NULL
             ORDER BY waktu_penilaian DESC`,
            { faskesUuid, perawatanUuid },
        );
    }

    // ── Laporan ──────────────────────────────────────────────────────────────
    static async GetLaporan({ dari, sampai, ruangan_uuid: ruanganUuid }) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
        if (!dari || !sampai) throw new BadRequestException("Parameter dari dan sampai wajib diisi.");
        const sekarang = moment().unix();

        const filterRuangan = ruanganUuid ? "AND room_monitoring_uuid IN (SELECT DISTINCT room_monitoring_uuid FROM icu_perawatans WHERE faskes_uuid = :faskesUuid AND ruangan_uuid = :ruanganUuid)" : "";
        const replacements = { faskesUuid, dari, sampai, ruanganUuid };

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
               SELECT DISTINCT perawatan_uuid, DATE(to_timestamp(waktu_pengukuran)) AS tanggal
               FROM icu_observasis
               WHERE faskes_uuid = :faskesUuid AND ventilator_terpasang = true AND deleted_at IS NULL
                 AND waktu_pengukuran BETWEEN :dari AND :sampai
             ) t`,
            { faskesUuid, dari, sampai },
        );

        return {
            periode: { dari, sampai },
            bor: bor === null ? null : Math.round(bor * 100) / 100,
            alos: alos === null ? null : Math.round(alos * 100) / 100,
            angka_kematian: angkaKematian === null ? null : Math.round(angkaKematian * 100) / 100,
            hari_ventilator: Number(hariVentilatorRow?.jumlah ?? 0),
            jumlah_bed_icu: jumlahBed,
            jumlah_episode_selesai: episodeSelesai.length,
            definisi:
                "BOR = bed-hari terisi / (jumlah bed ICU × hari periode); ALOS = rata-rata lama rawat episode yang " +
                "selesai pada periode; angka kematian = persentase episode selesai dengan kondisi_keluar='meninggal'; " +
                "hari ventilator = jumlah hari-pasien dengan ventilator terpasang. Bed ICU = bed yang pernah dipakai " +
                "episode icu_perawatans (belum ada datamaster kategori bed intensif terpisah). Definisi operasional " +
                "ini menunggu ketetapan final pemilik klinis/manajemen (PRD STD-0008 §13 #6).",
        };
    }
}
