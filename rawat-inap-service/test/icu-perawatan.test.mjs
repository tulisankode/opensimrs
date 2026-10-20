import { tiruan, bersihkan } from "./icu-tiruan.mjs";
import test from "node:test";
import assert from "node:assert/strict";
const { Context } = await import("../src/middlewares/context.js");
const { CTX_AUTHOR } = await import("../src/constants/context-constant.js");
const { CTX_ICU_UNIT } = await import("../src/middlewares/icu-unit-middleware.js");
const { default: Repository } = await import("../src/repositories/icu-repository.js");
const { default: Template } = await import("../src/repositories/icu-template-repository.js");
const { default: Konfigurasi } = await import("../src/repositories/icu-konfigurasi-repository.js");
const episode = { uuid: "episode-fiktif", ruangan_uuid: "unit-fiktif", rawat_inap_uuid: "admisi-fiktif", room_monitoring_uuid: "bed-asal", status: "aktif" };
function siapkan() {
    bersihkan(); Context.set(CTX_AUTHOR, { faskesUuid: "faskes-fiktif", username: "petugas-fiktif", user_uuid: "pengguna-fiktif" });
    Context.set(CTX_ICU_UNIT, { semua: false, units: ["unit-fiktif"], terbatas: ["unit-fiktif"] });
    tiruan.handler = (sql) => {
        if (sql.includes("FROM icu_akses_units a LEFT JOIN users")) return [{ ruangan_uuid: "unit-fiktif", milik: true }];
        if (sql.includes("FROM ref_modul")) return [{ tersedia: true, segmen_kode: null }];
        if (sql.includes("SELECT * FROM icu_perawatans")) return [episode];
        return [];
    };
}
test("Perpindahan pending dan bed tidak cocok tidak meninggalkan episode atau audit", async () => {
    siapkan(); tiruan.perpindahan.statusPindah = "pending";
    await assert.rejects(Repository.MulaiPerawatan("pindah-fiktif", { layanan_kode: "umum" }));
    assert.equal(tiruan.audit.length, 0); assert.equal(tiruan.kueri.some((q) => q.sql.includes("INSERT INTO icu_perawatans")), false);
    siapkan(); tiruan.admisi.monitoringRoomUuid = "beda";
    await assert.rejects(Repository.MulaiPerawatan("pindah-fiktif", { layanan_kode: "umum" }));
});
test("Admisi keluar harus sama dan episode hanya dapat diselesaikan sekali", async () => {
    siapkan(); tiruan.perpindahan.admissionRiUuid = "admisi-lain";
    await assert.rejects(Repository.KeluarPerawatan(episode.uuid, {}), /Admisi/);
    assert.equal(tiruan.audit.length, 0);
    siapkan(); tiruan.handler = (sql) => sql.includes("SELECT * FROM icu_perawatans") ? [{ ...episode, status: "selesai" }] : [];
    await assert.rejects(Repository.KeluarPerawatan(episode.uuid, {}));
});
test("Mulai umum memakai transaksi yang sama dan audit hanya setelah berhasil", async () => {
    siapkan();
    const hasil = await Repository.MulaiPerawatan("pindah-fiktif", { layanan_kode: "umum", serah_terima: {} });
    assert.equal(hasil.uuid, episode.uuid); assert.equal(tiruan.audit.length, 1);
    const transaksi = tiruan.sesudah[0];
    for (const q of tiruan.kueri) assert.equal(q.opsi.transaction, transaksi);
    assert.equal(tiruan.kueri.find((q) => q.sql.includes("INSERT INTO icu_perawatans")).opsi.replacements.faskesUuid, "faskes-fiktif");
});
test("Perpindahan masuk tidak dapat dipakai ulang dan bed terpakai ditolak", async () => {
    for (const pola of ["((rawat_inap_uuid", "room_monitoring_uuid = :bed"]) {
        siapkan(); const handler = tiruan.handler;
        tiruan.handler = (sql, opsi) => sql.includes(pola) ? [{ uuid: "ganda" }] : handler(sql, opsi);
        await assert.rejects(Repository.MulaiPerawatan("pindah-fiktif", { layanan_kode: "umum" }), { code: 409 });
        assert.equal(tiruan.audit.length, 0);
    }
});
test("Layanan nonaktif dan bed layanan khusus tidak dapat dilewati permintaan lama", async () => {
    siapkan(); await assert.rejects(Repository.MulaiPerawatan("pindah-fiktif", { layanan_kode: "burn" }), { code: 403 });
    siapkan(); const handler = tiruan.handler;
    tiruan.handler = (sql, opsi) => sql.includes("SELECT l.kode FROM icu_layanan_beds") ? [{ kode: "burn" }] : handler(sql, opsi);
    await assert.rejects(Repository.MulaiPerawatan("pindah-fiktif", { layanan_kode: "umum" }), { code: 409 });
});
test("Unit asing ditolak saat detail dibaca dan pencabutan akses diperiksa ulang dalam transaksi", async () => {
    siapkan(); Context.set(CTX_ICU_UNIT, { semua: false, units: ["unit-lain"], terbatas: ["unit-fiktif", "unit-lain"] });
    await assert.rejects(Repository.GetPerawatanByUuid(episode.uuid, "faskes-fiktif"), { code: 403 });
    siapkan(); const handler = tiruan.handler;
    tiruan.handler = (sql, opsi) => sql.includes("FROM icu_akses_units a LEFT JOIN users") ? [{ ruangan_uuid: "unit-fiktif", milik: false }] : handler(sql, opsi);
    await assert.rejects(Repository.MulaiPerawatan("pindah-fiktif", { layanan_kode: "umum" }), { code: 403 });
    assert.equal(tiruan.audit.length, 0);
});
test("Versi ditetapkan tidak dapat ditimpa dan revisi kedaluwarsa ditolak", async () => {
    siapkan(); tiruan.handler = (sql) => sql.includes("SELECT v.*") ? [{ uuid: "v", revisi: 2, status: "ditetapkan" }] : [];
    await assert.rejects(Template.simpan({ revisi: 2 }, "v", "ubah"), { code: 409 });
    await assert.rejects(Template.simpan({ revisi: 1 }, "v", "arsipkan"), { code: 409 });
    assert.equal(tiruan.audit.length, 0);
});
test("Aktivasi layanan memerlukan seluruh prasyarat dan revisi mutakhir", async () => {
    siapkan(); tiruan.handler = (sql) => sql.includes("SELECT * FROM icu_layanans") ? [{ uuid: "l", revisi: 1, aktif: false }] : [];
    await assert.rejects(Konfigurasi.ubahLayanan("burn", { aktif: true, revisi: 0, alasan: "Uji fiktif" }), { code: 409 });
    await assert.rejects(Konfigurasi.ubahLayanan("burn", { aktif: true, revisi: 1, alasan: "Uji fiktif" }), { code: 409 });
});
test("Kegagalan serah terima tidak menjadwalkan audit atau membaca hasil di luar transaksi", async () => {
    siapkan(); const handler = tiruan.handler;
    tiruan.handler = (sql, opsi) => {
        if (sql.includes("INSERT INTO icu_serah_terimas")) throw new Error("Kegagalan tiruan");
        return handler(sql, opsi);
    };
    await assert.rejects(Repository.MulaiPerawatan("pindah-fiktif", { layanan_kode: "umum" }), /Kegagalan tiruan/);
    assert.equal(tiruan.audit.length, 0); assert.equal(tiruan.sesudah.length, 0);
});
test("Koreksi observasi memvalidasi revisi, tipe dan menyimpan riwayat pada transaksi yang sama", async () => {
    siapkan();
    const awal = { uuid: "o", perawatan_uuid: episode.uuid, revisi: 1, waktu_pengukuran: 100, parameter_tambahan: [],
        gcs_e: 4, gcs_v: 5, gcs_m: 6, catatan: null };
    const handler = tiruan.handler;
    tiruan.handler = (sql, opsi) => sql.includes("SELECT * FROM icu_observasis") ? [awal] : handler(sql, opsi);
    await assert.rejects(Repository.KoreksiObservasi("o", { revisi: 2, nilai_baru: { nadi: 70 }, alasan: "Koreksi fiktif" }), { code: 409 });
    await assert.rejects(Repository.KoreksiObservasi("o", { revisi: 1, nilai_baru: { nadi: 400 }, alasan: "Koreksi fiktif" }), { code: 400 });
    tiruan.kueri = [];
    await Repository.KoreksiObservasi("o", { revisi: 1, nilai_baru: { nadi: 70, gcs_e: 3 }, alasan: "Koreksi fiktif" });
    const riwayat = tiruan.kueri.find((q) => q.sql.includes("INSERT INTO icu_observasi_koreksis"));
    assert.deepEqual(JSON.parse(riwayat.opsi.replacements.nilaiSebelum).gcs_e, 4);
    assert.equal(tiruan.kueri.find((q) => q.sql.includes("UPDATE icu_observasis")).opsi.replacements.gcsTotal, 14);
    for (const q of tiruan.kueri) assert.equal(q.opsi.transaction, tiruan.sesudah[0]);
    assert.equal(tiruan.audit.length, 1);
});
test("Versi arsip tetap dapat dibaca pada episode lama", async () => {
    siapkan(); tiruan.handler = () => [{ uuid: "v", status: "diarsipkan", nomor_versi: 1 }];
    assert.equal((await Template.ambil("v")).status, "diarsipkan");
});
