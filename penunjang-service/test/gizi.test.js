import { test } from "node:test";
import assert from "node:assert/strict";
import { INSTRUMEN, hitungSkor, kategoriRisiko, teks } from "../src/gizi/bersama.js";
import { hitungRekapPorsi } from "../src/gizi/distribusi.js";

test("kategoriRisiko: berisiko bila skor >= ambang instrumen, tidak_berisiko bila di bawahnya", () => {
  assert.equal(kategoriRisiko("mst", 2), "berisiko");
  assert.equal(kategoriRisiko("mst", 1), "tidak_berisiko");
  assert.equal(kategoriRisiko("nrs2002", 3), "berisiko");
  assert.equal(kategoriRisiko("nrs2002", 2), "tidak_berisiko");
});

test("teks: undefined tidak diubah, kosong jadi null, dipotong sesuai maks", () => {
  assert.equal(teks(undefined), undefined);
  assert.equal(teks(""), null);
  assert.equal(teks("   "), null);
  assert.equal(teks(" DM 1700 "), "DM 1700");
  assert.equal(teks("abcdef", 3), "abc");
});

test("hitungSkor: MST — jawaban tidak berisiko menghasilkan skor 0 & kategori tidak_berisiko", () => {
  const { jawaban, skor, kategoriRisiko: kategori } = hitungSkor("mst", [
    { kode: "penurunan_bb", nilai: "tidak" },
    { kode: "asupan_turun", nilai: "tidak" },
  ]);
  assert.equal(skor, 0);
  assert.equal(kategori, "tidak_berisiko");
  assert.equal(jawaban.length, INSTRUMEN.mst.pertanyaan.length);
});

test("hitungSkor: MST — penurunan BB 6-10kg + asupan turun mencapai ambang berisiko (skor 2 >= 2)", () => {
  const { skor, kategoriRisiko: kategori } = hitungSkor("mst", [
    { kode: "penurunan_bb", nilai: "ya_6_10" },
    { kode: "asupan_turun", nilai: "tidak" },
  ]);
  assert.equal(skor, 2);
  assert.equal(kategori, "berisiko");
});

test("hitungSkor: NRS-2002 — empat kriteria terpenuhi mencapai ambang berisiko (skor 4 >= 3)", () => {
  const { skor, kategoriRisiko: kategori } = hitungSkor("nrs2002", [
    { kode: "imt_rendah", nilai: "ya" },
    { kode: "penurunan_bb_3bulan", nilai: "ya" },
    { kode: "asupan_turun_seminggu", nilai: "ya" },
    { kode: "sakit_berat", nilai: "ya" },
    { kode: "usia_lanjut", nilai: "tidak" },
  ]);
  assert.equal(skor, 4);
  assert.equal(kategori, "berisiko");
});

test("hitungSkor: instrumen tidak dikenal ditolak (400)", () => {
  assert.throws(() => hitungSkor("tidak_ada", []), /instrumen harus salah satu dari/);
});

test("hitungSkor: jawaban kurang lengkap ditolak (400)", () => {
  assert.throws(() => hitungSkor("mst", [{ kode: "penurunan_bb", nilai: "tidak" }]), /wajib diisi/);
});

test("hitungSkor: nilai jawaban tidak valid ditolak (400)", () => {
  assert.throws(
    () =>
      hitungSkor("mst", [
        { kode: "penurunan_bb", nilai: "tidak_valid" },
        { kode: "asupan_turun", nilai: "tidak" },
      ]),
    /tidak valid/,
  );
});

test("hitungRekapPorsi: menghitung jumlah porsi per jenis diet, mengecualikan pasien tanpa order diet berlaku", () => {
  const data = [
    { order_diet_uuid: "o1", nama_diet: "DM" },
    { order_diet_uuid: "o2", nama_diet: "DM" },
    { order_diet_uuid: "o3", nama_diet: "Rendah Garam" },
    { order_diet_uuid: null, nama_diet: null },
  ];
  const { data: rekap, tanpaOrder } = hitungRekapPorsi(data);
  assert.equal(tanpaOrder, 1);
  assert.deepEqual(
    rekap.sort((a, b) => a.nama_diet.localeCompare(b.nama_diet)),
    [
      { nama_diet: "DM", jumlah_porsi: 2 },
      { nama_diet: "Rendah Garam", jumlah_porsi: 1 },
    ],
  );
});

test("hitungRekapPorsi: populasi kosong menghasilkan rekap kosong tanpa galat", () => {
  const { data: rekap, tanpaOrder } = hitungRekapPorsi([]);
  assert.deepEqual(rekap, []);
  assert.equal(tanpaOrder, 0);
});
