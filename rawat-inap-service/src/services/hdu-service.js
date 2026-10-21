import { gagal, uuidSchema, konfigurasiSchema, ubahKonfigurasiSchema, instruksiSchema, serahTerimaSchema, konfirmasiSchema, selesaiSchema, paginasiSchema, serahTerimaQuerySchema } from "./hdu-aturan.js";

export default class HduService {
    constructor(repository) { this.repository = repository; }

    async jalankan(operasi, req, boleh, icuAktif) {
        const r = this.repository;
        if (!["daftar", "serahTerima"].includes(operasi) && Object.keys(req.query ?? {}).length) gagal("Endpoint ini tidak menerima parameter kueri.", 422);
        const uuid = req.params.uuid ? uuidSchema.parse(req.params.uuid) : null;
        if (operasi === "konfigurasi") return r.konfigurasi();
        if (operasi === "tempatTidur") return r.tempatTidur();
        if (operasi === "daftar") return r.daftar(paginasiSchema.parse(req.query));
        if (operasi === "detail") {
            const hasil = await r.detail(uuid);
            if (!boleh("Rawat Inap", "HDU Serah Terima", "READ")) delete hasil.serah_terima;
            return hasil;
        }
        if (operasi === "riwayat") {
            await r.detail(uuid);
            return r.query(`SELECT * FROM hdu_instruksi_observasi WHERE episode_uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL ORDER BY berlaku_mulai DESC, versi DESC LIMIT 100`, { uuid });
        }
        if (operasi === "kebijakan") {
            await r.satu((sql, nilai) => r.query(sql, nilai), "hdu_konfigurasi", uuid);
            return r.query(`SELECT * FROM hdu_instruksi_observasi WHERE konfigurasi_uuid = :uuid AND episode_uuid IS NULL AND faskes_uuid = :f AND deleted_at IS NULL ORDER BY berlaku_mulai DESC, versi DESC LIMIT 100`, { uuid });
        }
        if (operasi === "serahTerima") return r.serahTerima(serahTerimaQuerySchema.parse(req.query ?? {}));
        const kunci = uuidSchema.parse(req.get("Idempotency-Key"));
        const schemas = { buatKonfigurasi: konfigurasiSchema, ubahKonfigurasi: ubahKonfigurasiSchema,
            kebijakanTulis: instruksiSchema, instruksiTulis: instruksiSchema, siapkan: serahTerimaSchema, konfirmasi: konfirmasiSchema, selesai: selesaiSchema };
        const data = schemas[operasi].parse(req.body);
        if (["siapkan", "konfirmasi"].includes(operasi) && !boleh("Rawat Inap", "Perpindahan Bangsal", "SETUJU DAN TERIMA")) gagal("Izin penerimaan perpindahan Rawat Inap diperlukan.", 403);
        const bolehIcu = boleh("ICU", "Serah Terima", "KELOLA") && icuAktif;
        return r.tulis(`${operasi}/${uuid ?? ""}`, data, kunci, (q) => {
            if (operasi === "buatKonfigurasi" || operasi === "ubahKonfigurasi") return r.simpanKonfigurasi(q, data, uuid);
            if (operasi === "kebijakanTulis" || operasi === "instruksiTulis") return r.instruksi(q, uuid, data, operasi === "kebijakanTulis" ? "unit" : "episode");
            if (operasi === "siapkan") return r.siapkanSerahTerima(q, data);
            if (operasi === "selesai") return r.selesai(q, uuid, data);
            return r.konfirmasi(q, uuid, data, bolehIcu);
        });
    }
}
