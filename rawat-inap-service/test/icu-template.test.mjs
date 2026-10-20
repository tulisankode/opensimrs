import test from "node:test";
import assert from "node:assert/strict";
import Template from "../src/services/icu-template-service.js";
const elemen = [{ kode_parameter: "angka_uji", label: "Angka fiktif", jenis: "angka", minimum: 0, maksimum: 10, wajib: true },
    { kode_parameter: "boolean_uji", label: "Boolean fiktif", jenis: "boolean", wajib: true }];
test("Nilai nol dan false terisi; kode dinamis tetap menjadi nilai", () => {
    assert.equal(Template.nilai(elemen, [{ kode_parameter: "angka_uji", nilai: 0 }, { kode_parameter: "boolean_uji", nilai: false }]).length, 2);
});
test("Menolak tipe salah, kode asing/ganda, rentang, dan kekurangan wajib", () => {
    for (const data of [[{ kode_parameter: "angka_uji", nilai: "1" }], [{ kode_parameter: "asing", nilai: 1 }],
        [{ kode_parameter: "angka_uji", nilai: 1 }, { kode_parameter: "angka_uji", nilai: 2 }], [{ kode_parameter: "angka_uji", nilai: 11 }], []]) {
        assert.throws(() => Template.nilai(elemen, data));
    }
});
test("Pilihan, panjang teks, dan definisi tanpa kode eksekusi", () => {
    assert.throws(() => Template.nilai([{ kode_parameter: "pilihan", jenis: "pilihan", pilihan: ["a"] }], [{ kode_parameter: "pilihan", nilai: "b" }]));
    assert.throws(() => Template.nilai([{ kode_parameter: "teks", jenis: "teks", panjang_maksimum: 2 }], [{ kode_parameter: "teks", nilai: "abc" }]));
    assert.throws(() => Template.validasi({ observasi: [], dokumen: [], skrip: "kode" }));
    assert.throws(() => Template.validasi({ observasi: elemen, dokumen: [] }, [{ sumber: "observasi", parameter: ["asing"], cakupan: "episode" }]));
});
