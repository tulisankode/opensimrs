import { tiruan, bersihkan } from "./icu-tiruan.mjs";
import test from "node:test";
import assert from "node:assert/strict";
const { Context } = await import("../src/middlewares/context.js");
const { CTX_AUTHOR } = await import("../src/constants/context-constant.js");
const { CTX_ICU_UNIT } = await import("../src/middlewares/icu-unit-middleware.js");
const { default: Dokumentasi } = await import("../src/repositories/icu-dokumentasi-repository.js");
const { default: Request } = await import("../src/validations/icu-request.js");
const awal = { uuid: "dokumen-fiktif", perawatan_uuid: "episode-fiktif", kode_dokumen: "dokumen_uji", waktu_pencatatan: 120,
    nilai: [{ kode_parameter: "angka_uji", nilai: 1 }], revisi: 1 };
function siapkan() {
    bersihkan(); Context.set(CTX_AUTHOR, { faskesUuid: "faskes-fiktif", username: "petugas-fiktif", user_uuid: "pengguna-fiktif" });
    Context.set(CTX_ICU_UNIT, { semua: false, units: ["unit-fiktif"], terbatas: ["unit-fiktif"] });
    tiruan.handler = (sql) => {
        if (sql.includes("FROM icu_akses_units a LEFT JOIN users")) return [{ ruangan_uuid: "unit-fiktif", milik: true }];
        if (sql.includes("SELECT * FROM icu_perawatans")) return [{ uuid: "episode-fiktif", ruangan_uuid: "unit-fiktif", template_versi_uuid: "versi-fiktif", status: "aktif", waktu_masuk: 100 }];
        if (sql.includes("SELECT v.*")) return [{ uuid: "versi-fiktif", status: "diarsipkan", definisi: { dokumen: [{ kode_dokumen: "dokumen_uji", elemen: [{ kode_parameter: "angka_uji", jenis: "angka", wajib: true }] }] } }];
        if (sql.includes("SELECT * FROM icu_dokumentasis")) return [awal];
        return [];
    };
}
test("Dokumentasi memakai versi episode, menerima nol dan menolak dokumen atau waktu asing", async () => {
    siapkan();
    await assert.rejects(Dokumentasi.tambah("episode-fiktif", { kode_dokumen: "asing", waktu_pencatatan: 120, nilai: [] }), { code: 400 });
    await assert.rejects(Dokumentasi.tambah("episode-fiktif", { kode_dokumen: "dokumen_uji", waktu_pencatatan: 90, nilai: [] }), { code: 400 });
    tiruan.kueri = [];
    await Dokumentasi.tambah("episode-fiktif", { kode_dokumen: "dokumen_uji", waktu_pencatatan: 120, nilai: [{ kode_parameter: "angka_uji", nilai: 0 }] });
    const insert = tiruan.kueri.find((q) => q.sql.includes("INSERT INTO icu_dokumentasis"));
    assert.equal(insert.opsi.replacements.versi, "versi-fiktif"); assert.equal(insert.opsi.replacements.f, "faskes-fiktif");
    assert.equal(JSON.parse(insert.opsi.replacements.nilai)[0].nilai, 0); assert.equal(tiruan.audit.length, 1);
});
test("Koreksi dokumentasi menolak revisi kedaluwarsa dan mencatat sebelum/sesudah secara atomik", async () => {
    siapkan();
    await assert.rejects(Dokumentasi.koreksi("dokumen-fiktif", { revisi: 2, nilai_baru: [], alasan: "Koreksi fiktif" }), { code: 409 });
    tiruan.kueri = [];
    const nilai = [{ kode_parameter: "angka_uji", nilai: 0 }];
    await Dokumentasi.koreksi("dokumen-fiktif", { revisi: 1, nilai_baru: nilai, alasan: "Koreksi fiktif" });
    const riwayat = tiruan.kueri.find((q) => q.sql.includes("INSERT INTO icu_dokumentasi_koreksis"));
    assert.deepEqual(JSON.parse(riwayat.opsi.replacements.awal), awal.nilai); assert.deepEqual(JSON.parse(riwayat.opsi.replacements.baru), nilai);
    for (const q of tiruan.kueri) assert.equal(q.opsi.transaction, tiruan.sesudah[0]);
});
test("Kegagalan riwayat koreksi menggagalkan transaksi tanpa audit perubahan", async () => {
    siapkan(); const handler = tiruan.handler;
    tiruan.handler = (sql, opsi) => {
        if (sql.includes("INSERT INTO icu_dokumentasi_koreksis")) throw new Error("Penyimpanan riwayat gagal pada tiruan");
        return handler(sql, opsi);
    };
    await assert.rejects(Dokumentasi.koreksi("dokumen-fiktif", { revisi: 1, nilai_baru: [{ kode_parameter: "angka_uji", nilai: 0 }], alasan: "Koreksi fiktif" }));
    assert.equal(tiruan.audit.length, 0); assert.equal(tiruan.sesudah.length, 0);
    assert.equal(tiruan.kueri.some((q) => q.sql.includes("UPDATE icu_dokumentasis")), false);
});
test("Body dokumentasi tidak dapat menetapkan identitas fasilitas/pencatat", () => {
    const body = { kode_dokumen: "dokumen_uji", waktu_pencatatan: 120, nilai: [] };
    assert.equal(Request.DOKUMENTASI.safeParse({ ...body, faskes_uuid: "fasilitas-lain" }).success, false);
    assert.equal(Request.DOKUMENTASI.safeParse({ ...body, pencatat: "pengguna-lain" }).success, false);
});
