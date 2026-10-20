import test from "node:test";
import assert from "node:assert/strict";
import {
    hitungQtc, hitungTimiNste, hitungTimiStemi, hitungSkorRisiko, trenPenanda, ringkasWaktuReperfusi, TIMI_NSTE_BUTIR,
} from "../src/services/ccu-skor.js";
import CcuRequest from "../src/validations/ccu-request.js";

// Data uji fiktif; perhitungan murni tanpa database.

test("QTc Bazett dihitung dari QT dan laju jantung", () => {
    assert.equal(hitungQtc(400, 60), 400);
    assert.equal(hitungQtc(360, 100), 465);
    assert.equal(hitungQtc(null, 80), null);
    assert.equal(hitungQtc(400, 0), null);
});

test("TIMI UA/NSTEMI: 7 butir bernilai 1 dengan kategori risiko", () => {
    const nol = Object.fromEntries(TIMI_NSTE_BUTIR.map((k) => [k, false]));
    assert.deepEqual(hitungTimiNste(nol), { total_skor: 0, kategori: "rendah", lengkap: true });
    assert.equal(hitungTimiNste({ ...nol, usia_lanjut: true, deviasi_st: true, penanda_positif: true }).kategori, "sedang");
    const semua = Object.fromEntries(TIMI_NSTE_BUTIR.map((k) => [k, true]));
    assert.deepEqual(hitungTimiNste(semua), { total_skor: 7, kategori: "tinggi", lengkap: true });
});

test("TIMI STEMI: bobot usia, tekanan sistolik, laju jantung, Killip, berat badan, dan waktu terapi", () => {
    const dasar = { umur: 50, dm_ht_angina: false, sistolik: 130, laju_jantung: 80, killip: 1, berat_badan: 70, ste_anterior_lbbb: false, waktu_terapi_jam: 2 };
    assert.equal(hitungTimiStemi(dasar).total_skor, 0);
    assert.equal(hitungTimiStemi({ ...dasar, umur: 70 }).total_skor, 2);
    assert.equal(hitungTimiStemi({ ...dasar, umur: 80 }).total_skor, 3);
    const maks = { umur: 80, dm_ht_angina: true, sistolik: 90, laju_jantung: 110, killip: 3, berat_badan: 60, ste_anterior_lbbb: true, waktu_terapi_jam: 5 };
    assert.deepEqual(hitungTimiStemi(maks), { total_skor: 14, kategori: "tinggi", lengkap: true });
});

test("Killip dipetakan ke kelas I–IV", () => {
    assert.equal(hitungSkorRisiko("killip", { kelas: 4 }).total_skor, 4);
    assert.match(hitungSkorRisiko("killip", { kelas: 4 }).kategori, /syok kardiogenik/);
    assert.throws(() => hitungSkorRisiko("grace", {}));
});

test("tren penanda: delta per jenis dan tanda di atas batas rujukan", () => {
    const hasil = trenPenanda([
        { uuid: "a", jenis: "hs_troponin_i", nilai: "20", batas_atas: "26" },
        { uuid: "b", jenis: "ck_mb", nilai: "30", batas_atas: null },
        { uuid: "c", jenis: "hs_troponin_i", nilai: "120", batas_atas: "26" },
    ]);
    assert.equal(hasil[0].di_atas_batas, false);
    assert.equal(hasil[0].delta, null);
    assert.equal(hasil[1].di_atas_batas, null);
    assert.equal(hasil[2].di_atas_batas, true);
    assert.equal(hasil[2].delta, 100);
    assert.equal(hasil[2].delta_persen, 500);
});

test("door-to-balloon: median & persen sesuai target, data tak valid diabaikan", () => {
    const r = ringkasWaktuReperfusi([
        { waktu_tiba_rs: 1000, waktu_mulai: 1000 + 60 * 60 },
        { waktu_tiba_rs: 1000, waktu_mulai: 1000 + 120 * 60 },
        { waktu_tiba_rs: 1000, waktu_mulai: 1000 + 80 * 60 },
        { waktu_tiba_rs: null, waktu_mulai: 5000 },
        { waktu_tiba_rs: 9000, waktu_mulai: 5000 },
    ], 90);
    assert.deepEqual(r, { jumlah: 3, median_menit: 80, persen_sesuai_target: 66.7, target_menit: 90 });
    assert.equal(ringkasWaktuReperfusi([], 30).median_menit, null);
});

test("validasi masukan CCU menolak nilai di luar daftar dan urutan waktu salah", () => {
    assert.equal(CcuRequest.EKG.safeParse({ waktu_rekam: 100, irama: "sinus" }).success, true);
    assert.equal(CcuRequest.EKG.safeParse({ waktu_rekam: 100, irama: "bukan_irama" }).success, false);
    assert.equal(CcuRequest.PENANDA.safeParse({ waktu_sampel: 100, jenis: "hs_troponin_i", nilai: -1, satuan: "ng/L" }).success, false);
    assert.equal(CcuRequest.INTERVENSI.safeParse({ jenis: "pci_primer", waktu_mulai: 200, waktu_selesai: 100 }).success, false);
    assert.equal(CcuRequest.SKOR.safeParse({ jenis: "killip", waktu_penilaian: 100, parameter: { kelas: 5 } }).success, false);
    assert.equal(CcuRequest.SKOR.safeParse({ jenis: "timi_nste", waktu_penilaian: 100, parameter: { usia_lanjut: true } }).success, false);
    assert.equal(CcuRequest.KLINIS.safeParse({ sindrom: "stemi", faktor_risiko: ["merokok"] }).success, true);
    assert.equal(CcuRequest.BATAL.safeParse({ alasan: "x" }).success, false);
});
