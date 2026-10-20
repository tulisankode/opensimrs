import test from "node:test";
import assert from "node:assert/strict";
import Kelengkapan from "../src/services/icu-kelengkapan-service.js";
const p = { waktu_masuk: 100, waktu_keluar: null };
const template = { uuid: "versi-fiktif", aturan_kelengkapan: [{ sumber: "observasi", parameter: ["angka", "ya"], cakupan: "interval", interval_detik: 60 }] };
const catatan = (waktu) => ({ sumber: "observasi", waktu, nilai: [{ kode_parameter: "angka", nilai: 0 }, { kode_parameter: "ya", nilai: false }] });
test("Episode historis dan template tanpa aturan terpisah", () => {
    assert.equal(Kelengkapan.evaluasi(p, null, [], 200).status, "belum_dikonfigurasi");
    assert.equal(Kelengkapan.evaluasi(p, { aturan_kelengkapan: [] }, [], 200).status, "belum_dikonfigurasi");
});
test("Interval dimulai sejak masuk; batas tidak dihitung ganda", () => {
    const hasil = Kelengkapan.evaluasi(p, template, [catatan(160)], 230);
    assert.deepEqual(hasil.kekurangan.map((k) => k.dari), [100, 220]);
    assert.equal(hasil.kekurangan[1].periode_berjalan, true);
    assert.equal(Kelengkapan.evaluasi(p, template, [catatan(100), catatan(160), catatan(220)], 230).status, "lengkap");
});
test("Aturan selesai hanya dievaluasi setelah episode selesai; koreksi dapat melengkapi", () => {
    const t = { uuid: "v", aturan_kelengkapan: [{ sumber: "observasi", parameter: ["angka"], cakupan: "selesai" }] };
    assert.equal(Kelengkapan.evaluasi(p, t, [], 200).status, "lengkap");
    assert.equal(Kelengkapan.evaluasi({ ...p, waktu_keluar: 200 }, t, [], 300).status, "belum_lengkap");
    assert.equal(Kelengkapan.evaluasi({ ...p, waktu_keluar: 200 }, t, [catatan(200)], 300).status, "lengkap");
});
