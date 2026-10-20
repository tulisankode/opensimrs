import { Context } from "../middlewares/context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import { uuidv7 } from "uuidv7";
import moment from "moment";
import { QueryTypes } from "sequelize";
import sequelizeInstance from "../configs/sequelize-instance.js";
import IcuRepository from "./icu-repository.js";
import NotfoundException from "../exceptions/notfound-exception.js";
import BadRequestException from "../exceptions/bad-request-exception.js";
import { hitungQtc, IRAMA_BERBAHAYA, PENANDA_TROPONIN, trenPenanda, ringkasWaktuReperfusi } from "../services/ccu-skor.js";

// Data khusus CCU (tabel ccu_*) di atas episode perawatan intensif bersama (icu_perawatans unit = 'ccu'). Semua kueri
// dibatasi faskes_uuid dari token; entri klinis tidak dihapus fisik — pembatalan menyimpan alasan, pelaku, dan waktu.
const q = (sql, replacements, type = QueryTypes.SELECT) => sequelizeInstance.query(sql, { replacements, type });
const UNIT = "ccu";
const TABEL_BATAL = { ekg: "ccu_ekgs", penanda: "ccu_penanda_jantungs", intervensi: "ccu_intervensis" };
const author = () => Context.get(CTX_AUTHOR);

export default class CcuRepository {
    static async episodeAda(perawatanUuid) {
        return IcuRepository.pastikanPerawatanAda(perawatanUuid, author().faskesUuid, UNIT);
    }

    static async episodeAktif(perawatanUuid) {
        return IcuRepository.pastikanPerawatanAktif(perawatanUuid, author().faskesUuid, UNIT);
    }

    static pastikanWaktu(waktu, perawatan, nama) {
        const sekarang = moment().unix();
        if (waktu > sekarang + 300) throw new BadRequestException(`${nama} tidak boleh di masa depan.`);
        // Toleransi 72 jam sebelum masuk CCU: EKG/sampel/tindakan di IGD atau Cath Lab sebelum pindah tetap boleh dicatat.
        if (waktu < Number(perawatan.waktu_masuk) - 72 * 3600) throw new BadRequestException(`${nama} terlalu jauh sebelum pasien masuk CCU.`);
    }

    // ── Data klinis kardiak (sindrom, waktu onset/tiba, Killip saat masuk) ──
    static async GetKlinis(perawatanUuid) {
        const { faskesUuid } = author();
        await CcuRepository.episodeAda(perawatanUuid);
        const [klinis] = await q(
            `SELECT * FROM ccu_klinis WHERE perawatan_uuid = :perawatanUuid AND faskes_uuid = :faskesUuid AND deleted_at IS NULL`,
            { perawatanUuid, faskesUuid },
        );
        return klinis ?? null;
    }

    static async SimpanKlinis(perawatanUuid, data) {
        const { faskesUuid, username } = author();
        await CcuRepository.episodeAda(perawatanUuid);
        const sekarang = moment().unix();
        const [hasil] = await q(
            `INSERT INTO ccu_klinis
               (uuid, faskes_uuid, perawatan_uuid, sindrom, lokasi_infark, waktu_onset, waktu_kontak_medis_pertama, waktu_tiba_rs,
                kelas_killip, fraksi_ejeksi, faktor_risiko, catatan, diubah_oleh, created_at)
             VALUES (:uuid, :faskesUuid, :perawatanUuid, :sindrom, :lokasiInfark, :waktuOnset, :waktuFmc, :waktuTiba,
                     :killip, :ef, CAST(:faktor AS jsonb), :catatan, :username, :sekarang)
             ON CONFLICT (perawatan_uuid) DO UPDATE SET sindrom = EXCLUDED.sindrom, lokasi_infark = EXCLUDED.lokasi_infark,
               waktu_onset = EXCLUDED.waktu_onset, waktu_kontak_medis_pertama = EXCLUDED.waktu_kontak_medis_pertama,
               waktu_tiba_rs = EXCLUDED.waktu_tiba_rs, kelas_killip = EXCLUDED.kelas_killip, fraksi_ejeksi = EXCLUDED.fraksi_ejeksi,
               faktor_risiko = EXCLUDED.faktor_risiko, catatan = EXCLUDED.catatan, diubah_oleh = EXCLUDED.diubah_oleh,
               updated_at = :sekarang
             WHERE ccu_klinis.faskes_uuid = :faskesUuid
             RETURNING *`,
            {
                uuid: uuidv7(), faskesUuid, perawatanUuid, sindrom: data.sindrom, lokasiInfark: data.lokasi_infark ?? null,
                waktuOnset: data.waktu_onset ?? null, waktuFmc: data.waktu_kontak_medis_pertama ?? null, waktuTiba: data.waktu_tiba_rs ?? null,
                killip: data.kelas_killip ?? null, ef: data.fraksi_ejeksi ?? null, faktor: JSON.stringify(data.faktor_risiko ?? []),
                catatan: data.catatan ?? null, username, sekarang,
            },
        );
        return hasil;
    }

    // ── EKG & irama ──────────────────────────────────────────────────────────
    static async TambahEkg(perawatanUuid, data) {
        const { faskesUuid, username } = author();
        const perawatan = await CcuRepository.episodeAktif(perawatanUuid);
        CcuRepository.pastikanWaktu(data.waktu_rekam, perawatan, "Waktu rekam EKG");
        const [hasil] = await q(
            `INSERT INTO ccu_ekgs
               (uuid, faskes_uuid, perawatan_uuid, waktu_rekam, irama, laju_jantung, interval_pr, durasi_qrs, interval_qt,
                interval_qtc, aksis, perubahan_st, lead_st, gelombang_q, blok_cabang, interpretasi, sumber, status_tinjauan,
                pencatat, created_at)
             VALUES (:uuid, :faskesUuid, :perawatanUuid, :waktuRekam, :irama, :laju, :pr, :qrs, :qt, :qtc, :aksis, :st, :leadSt,
                     :q, :blok, :interpretasi, 'manual', 'terverifikasi', :username, :sekarang)
             RETURNING *`,
            {
                uuid: uuidv7(), faskesUuid, perawatanUuid, waktuRekam: data.waktu_rekam, irama: data.irama,
                laju: data.laju_jantung ?? null, pr: data.interval_pr ?? null, qrs: data.durasi_qrs ?? null, qt: data.interval_qt ?? null,
                qtc: hitungQtc(data.interval_qt, data.laju_jantung), aksis: data.aksis ?? null, st: data.perubahan_st,
                leadSt: data.lead_st ?? null, q: data.gelombang_q ?? false, blok: data.blok_cabang ?? null,
                interpretasi: data.interpretasi ?? null, username, sekarang: moment().unix(),
            },
        );
        return { ekg: hasil, berbahaya: IRAMA_BERBAHAYA.includes(hasil.irama) };
    }

    static async GetEkg(perawatanUuid) {
        const { faskesUuid } = author();
        await CcuRepository.episodeAda(perawatanUuid);
        return q(
            `SELECT * FROM ccu_ekgs WHERE perawatan_uuid = :perawatanUuid AND faskes_uuid = :faskesUuid AND deleted_at IS NULL
             ORDER BY waktu_rekam DESC`,
            { perawatanUuid, faskesUuid },
        );
    }

    // ── Penanda jantung (troponin, CK-MB, NT-proBNP, elektrolit) ─────────────
    static async TambahPenanda(perawatanUuid, data) {
        const { faskesUuid, username } = author();
        const perawatan = await CcuRepository.episodeAktif(perawatanUuid);
        CcuRepository.pastikanWaktu(data.waktu_sampel, perawatan, "Waktu sampel");
        const [hasil] = await q(
            `INSERT INTO ccu_penanda_jantungs
               (uuid, faskes_uuid, perawatan_uuid, waktu_sampel, jenis, nilai, satuan, batas_atas, sumber, referensi_lab,
                catatan, pencatat, created_at)
             VALUES (:uuid, :faskesUuid, :perawatanUuid, :waktuSampel, :jenis, :nilai, :satuan, :batasAtas, :sumber, :referensiLab,
                     :catatan, :username, :sekarang)
             RETURNING *`,
            {
                uuid: uuidv7(), faskesUuid, perawatanUuid, waktuSampel: data.waktu_sampel, jenis: data.jenis, nilai: data.nilai,
                satuan: data.satuan, batasAtas: data.batas_atas ?? null, sumber: data.sumber, referensiLab: data.referensi_lab ?? null,
                catatan: data.catatan ?? null, username, sekarang: moment().unix(),
            },
        );
        return hasil;
    }

    static async GetPenanda(perawatanUuid) {
        const { faskesUuid } = author();
        await CcuRepository.episodeAda(perawatanUuid);
        const semua = await q(
            `SELECT * FROM ccu_penanda_jantungs WHERE perawatan_uuid = :perawatanUuid AND faskes_uuid = :faskesUuid AND deleted_at IS NULL
             ORDER BY waktu_sampel ASC, created_at ASC`,
            { perawatanUuid, faskesUuid },
        );
        // Tren dihitung dari entri yang tidak dibatalkan; entri batal tetap ditampilkan dengan penandanya.
        const aktif = trenPenanda(semua.filter((d) => !d.dibatalkan_pada));
        const trenByUuid = new Map(aktif.map((d) => [d.uuid, d]));
        return semua.map((d) => trenByUuid.get(d.uuid) ?? { ...d, di_atas_batas: null, delta: null, delta_persen: null }).reverse();
    }

    // ── Skor risiko (Killip, TIMI) ───────────────────────────────────────────
    static async TambahSkor(perawatanUuid, data, hasil) {
        const { faskesUuid, username } = author();
        const perawatan = await CcuRepository.episodeAktif(perawatanUuid);
        CcuRepository.pastikanWaktu(data.waktu_penilaian, perawatan, "Waktu penilaian");
        const [baris] = await q(
            `INSERT INTO ccu_skor_risikos
               (uuid, faskes_uuid, perawatan_uuid, waktu_penilaian, jenis, parameter, total_skor, kategori, lengkap, penilai, catatan, created_at)
             VALUES (:uuid, :faskesUuid, :perawatanUuid, :waktu, :jenis, CAST(:parameter AS jsonb), :total, :kategori, :lengkap,
                     :username, :catatan, :sekarang)
             RETURNING *`,
            {
                uuid: uuidv7(), faskesUuid, perawatanUuid, waktu: data.waktu_penilaian, jenis: data.jenis,
                parameter: JSON.stringify(data.parameter), total: hasil.total_skor, kategori: hasil.kategori, lengkap: hasil.lengkap,
                username, catatan: data.catatan ?? null, sekarang: moment().unix(),
            },
        );
        return baris;
    }

    static async GetSkor(perawatanUuid) {
        const { faskesUuid } = author();
        await CcuRepository.episodeAda(perawatanUuid);
        return q(
            `SELECT * FROM ccu_skor_risikos WHERE perawatan_uuid = :perawatanUuid AND faskes_uuid = :faskesUuid AND deleted_at IS NULL
             ORDER BY waktu_penilaian DESC`,
            { perawatanUuid, faskesUuid },
        );
    }

    // ── Intervensi & terapi kardiak (PCI, trombolisis, pacu jantung, IABP, kardioversi) ──
    static async TambahIntervensi(perawatanUuid, data) {
        const { faskesUuid, username } = author();
        const perawatan = await CcuRepository.episodeAktif(perawatanUuid);
        CcuRepository.pastikanWaktu(data.waktu_mulai, perawatan, "Waktu mulai tindakan");
        const [hasil] = await q(
            `INSERT INTO ccu_intervensis
               (uuid, faskes_uuid, perawatan_uuid, jenis, waktu_mulai, waktu_selesai, operator, hasil, komplikasi, catatan, pencatat, created_at)
             VALUES (:uuid, :faskesUuid, :perawatanUuid, :jenis, :mulai, :selesai, :operator, :hasil, :komplikasi, :catatan, :username, :sekarang)
             RETURNING *`,
            {
                uuid: uuidv7(), faskesUuid, perawatanUuid, jenis: data.jenis, mulai: data.waktu_mulai, selesai: data.waktu_selesai ?? null,
                operator: data.operator ?? null, hasil: data.hasil ?? null, komplikasi: data.komplikasi ?? null,
                catatan: data.catatan ?? null, username, sekarang: moment().unix(),
            },
        );
        return hasil;
    }

    static async GetIntervensi(perawatanUuid) {
        const { faskesUuid } = author();
        await CcuRepository.episodeAda(perawatanUuid);
        return q(
            `SELECT * FROM ccu_intervensis WHERE perawatan_uuid = :perawatanUuid AND faskes_uuid = :faskesUuid AND deleted_at IS NULL
             ORDER BY waktu_mulai DESC`,
            { perawatanUuid, faskesUuid },
        );
    }

    // Pembatalan berjejak untuk EKG, penanda jantung, dan intervensi (tanpa hapus fisik).
    static async Batalkan(jenis, uuid, alasan) {
        const { faskesUuid, username } = author();
        const tabel = TABEL_BATAL[jenis];
        const [entri] = await q(
            `SELECT e.uuid, e.dibatalkan_pada FROM ${tabel} e
             JOIN icu_perawatans p ON p.uuid = e.perawatan_uuid AND p.faskes_uuid = e.faskes_uuid AND p.unit = :unit
             WHERE e.uuid = :uuid AND e.faskes_uuid = :faskesUuid AND e.deleted_at IS NULL`,
            { uuid, faskesUuid, unit: UNIT },
        );
        if (!entri) throw new NotfoundException("Entri CCU tidak ditemukan!");
        if (entri.dibatalkan_pada) throw new BadRequestException("Entri ini sudah dibatalkan.");
        const sekarang = moment().unix();
        const [hasil] = await q(
            `UPDATE ${tabel} SET dibatalkan_pada = :sekarang, dibatalkan_oleh = :username, alasan_batal = :alasan, updated_at = :sekarang
             WHERE uuid = :uuid AND faskes_uuid = :faskesUuid AND dibatalkan_pada IS NULL RETURNING *`,
            { uuid, faskesUuid, username, alasan, sekarang },
        );
        if (!hasil) throw new BadRequestException("Entri ini sudah dibatalkan.");
        return hasil;
    }

    // ── Dasbor kardiak: ringkasan per episode CCU aktif ─────────────────────
    static async GetDashboardKardiak() {
        const { faskesUuid } = author();
        const p = { faskesUuid, unit: UNIT };
        const dari = `FROM icu_perawatans ep WHERE ep.faskes_uuid = :faskesUuid AND ep.unit = :unit AND ep.status = 'aktif' AND ep.deleted_at IS NULL`;
        const [klinis, ekg, penanda, skor, intervensi] = await Promise.all([
            q(`SELECT k.perawatan_uuid, k.sindrom, k.kelas_killip, k.waktu_onset, k.waktu_tiba_rs FROM ccu_klinis k
               WHERE k.faskes_uuid = :faskesUuid AND k.deleted_at IS NULL AND k.perawatan_uuid IN (SELECT ep.uuid ${dari})`, p),
            q(`SELECT DISTINCT ON (e.perawatan_uuid) e.perawatan_uuid, e.waktu_rekam, e.irama, e.laju_jantung, e.perubahan_st, e.interval_qtc
               FROM ccu_ekgs e WHERE e.faskes_uuid = :faskesUuid AND e.deleted_at IS NULL AND e.dibatalkan_pada IS NULL
                 AND e.perawatan_uuid IN (SELECT ep.uuid ${dari})
               ORDER BY e.perawatan_uuid, e.waktu_rekam DESC`, p),
            q(`SELECT d.* FROM ccu_penanda_jantungs d WHERE d.faskes_uuid = :faskesUuid AND d.deleted_at IS NULL AND d.dibatalkan_pada IS NULL
                 AND d.jenis IN (:troponin) AND d.perawatan_uuid IN (SELECT ep.uuid ${dari})
               ORDER BY d.waktu_sampel ASC`, { ...p, troponin: PENANDA_TROPONIN }),
            q(`SELECT DISTINCT ON (s.perawatan_uuid, s.jenis) s.perawatan_uuid, s.jenis, s.total_skor, s.kategori, s.waktu_penilaian
               FROM ccu_skor_risikos s WHERE s.faskes_uuid = :faskesUuid AND s.deleted_at IS NULL
                 AND s.perawatan_uuid IN (SELECT ep.uuid ${dari})
               ORDER BY s.perawatan_uuid, s.jenis, s.waktu_penilaian DESC`, p),
            q(`SELECT DISTINCT ON (i.perawatan_uuid) i.perawatan_uuid, i.jenis, i.waktu_mulai FROM ccu_intervensis i
               WHERE i.faskes_uuid = :faskesUuid AND i.deleted_at IS NULL AND i.dibatalkan_pada IS NULL
                 AND i.perawatan_uuid IN (SELECT ep.uuid ${dari})
               ORDER BY i.perawatan_uuid, i.waktu_mulai DESC`, p),
        ]);
        const tren = trenPenanda(penanda);
        const troponinTerakhir = new Map();
        for (const t of tren) troponinTerakhir.set(t.perawatan_uuid, t);
        const hasil = {};
        const isi = (uuid) => (hasil[uuid] ??= { klinis: null, ekg_terakhir: null, troponin_terakhir: null, skor: [], intervensi_terakhir: null, peringatan: [] });
        for (const k of klinis) isi(k.perawatan_uuid).klinis = k;
        for (const e of ekg) {
            const h = isi(e.perawatan_uuid);
            h.ekg_terakhir = e;
            if (IRAMA_BERBAHAYA.includes(e.irama)) h.peringatan.push(`Irama berbahaya pada EKG terakhir: ${e.irama.toUpperCase()}`);
            if (e.perubahan_st === "elevasi") h.peringatan.push("Elevasi ST pada EKG terakhir");
            if (e.interval_qtc && Number(e.interval_qtc) >= 500) h.peringatan.push(`QTc memanjang (${e.interval_qtc} ms)`);
        }
        for (const [uuid, t] of troponinTerakhir) {
            const h = isi(uuid);
            h.troponin_terakhir = t;
            if (t.di_atas_batas && t.delta_persen !== null && t.delta_persen >= 20) h.peringatan.push(`Troponin naik ${t.delta_persen}% dari sampel sebelumnya`);
        }
        for (const s of skor) isi(s.perawatan_uuid).skor.push(s);
        for (const i of intervensi) isi(i.perawatan_uuid).intervensi_terakhir = i;
        return hasil;
    }

    // ── Laporan kardiak: sindrom, waktu reperfusi (door-to-balloon/needle), Killip, mortalitas ──
    static async GetLaporanKardiak({ dari, sampai }) {
        const { faskesUuid } = author();
        const p = { faskesUuid, unit: UNIT, dari, sampai };
        const episode = await q(
            `SELECT ep.uuid, ep.status, ep.kondisi_keluar, k.sindrom, k.kelas_killip, k.waktu_tiba_rs
             FROM icu_perawatans ep LEFT JOIN ccu_klinis k ON k.perawatan_uuid = ep.uuid AND k.faskes_uuid = ep.faskes_uuid AND k.deleted_at IS NULL
             WHERE ep.faskes_uuid = :faskesUuid AND ep.unit = :unit AND ep.deleted_at IS NULL AND ep.waktu_masuk BETWEEN :dari AND :sampai`,
            p,
        );
        const perSindrom = {};
        for (const e of episode) {
            const s = e.sindrom ?? "belum_diisi";
            perSindrom[s] ??= { jumlah: 0, selesai: 0, meninggal: 0 };
            perSindrom[s].jumlah++;
            if (e.status === "selesai") perSindrom[s].selesai++;
            if (e.kondisi_keluar === "meninggal") perSindrom[s].meninggal++;
        }
        const killip = { 1: 0, 2: 0, 3: 0, 4: 0, belum_diisi: 0 };
        for (const e of episode) killip[e.kelas_killip ?? "belum_diisi"]++;

        const reperfusi = await q(
            `SELECT DISTINCT ON (i.perawatan_uuid, i.jenis) i.perawatan_uuid, i.jenis, i.waktu_mulai, k.waktu_tiba_rs
             FROM ccu_intervensis i
             JOIN icu_perawatans ep ON ep.uuid = i.perawatan_uuid AND ep.faskes_uuid = i.faskes_uuid AND ep.unit = :unit
             JOIN ccu_klinis k ON k.perawatan_uuid = i.perawatan_uuid AND k.faskes_uuid = i.faskes_uuid AND k.deleted_at IS NULL
             WHERE i.faskes_uuid = :faskesUuid AND i.deleted_at IS NULL AND i.dibatalkan_pada IS NULL
               AND i.jenis IN ('pci_primer', 'trombolisis') AND k.sindrom = 'stemi'
               AND ep.waktu_masuk BETWEEN :dari AND :sampai
             ORDER BY i.perawatan_uuid, i.jenis, i.waktu_mulai ASC`,
            p,
        );
        const intervensi = await q(
            `SELECT i.jenis, COUNT(*)::int AS jumlah FROM ccu_intervensis i
             JOIN icu_perawatans ep ON ep.uuid = i.perawatan_uuid AND ep.faskes_uuid = i.faskes_uuid AND ep.unit = :unit
             WHERE i.faskes_uuid = :faskesUuid AND i.deleted_at IS NULL AND i.dibatalkan_pada IS NULL
               AND i.waktu_mulai BETWEEN :dari AND :sampai
             GROUP BY i.jenis ORDER BY jumlah DESC`,
            p,
        );
        const stemi = perSindrom.stemi?.jumlah ?? 0;
        const stemiReperfusi = new Set(reperfusi.map((r) => r.perawatan_uuid)).size;
        return {
            periode: { dari, sampai },
            jumlah_episode: episode.length,
            // Larik (bukan objek berkunci kode) agar kode sindrom tidak ikut dikonversi camelCase oleh klien.
            per_sindrom: Object.entries(perSindrom).map(([sindrom, v]) => ({ sindrom, ...v })),
            killip,
            door_to_balloon: ringkasWaktuReperfusi(reperfusi.filter((r) => r.jenis === "pci_primer"), 90),
            door_to_needle: ringkasWaktuReperfusi(reperfusi.filter((r) => r.jenis === "trombolisis"), 30),
            stemi_reperfusi: { stemi, mendapat_reperfusi: stemiReperfusi, persen: stemi ? Math.round((stemiReperfusi / stemi) * 1000) / 10 : null },
            intervensi,
            definisi:
                "Episode = episode CCU yang masuk pada periode. Door-to-balloon = waktu tiba RS → mulai PCI primer pertama (target ≤ 90 menit); " +
                "door-to-needle = waktu tiba RS → mulai trombolisis pertama (target ≤ 30 menit), hanya episode bersindrom STEMI dengan waktu tiba " +
                "terisi. Mortalitas memakai kondisi keluar episode CCU. Definisi & target menunggu ketetapan KSM Jantung/komite mutu faskes.",
        };
    }
}
