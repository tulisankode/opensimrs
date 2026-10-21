// Uji aturan murni Resep Dokter: transisi status, biaya racik, harga jual, dan item tagihan.
// Jalankan: node --test test/resep-dokter.test.mjs (berkas .mjs tidak diambil jest).
import { test } from "node:test";
import assert from "node:assert/strict";
import PrescriptionHelper from "../src/helpers/prescriptionHelper.js";
import PrescriptionService from "../src/services/prescription-service.js";
import PrescriptionValidation from "../src/validations/prescription-validation.js";

const S = PrescriptionHelper.STATUS;

test("aksi ditolak bila status resep tidak sesuai (termasuk resep batal)", () => {
  assert.doesNotThrow(() => PrescriptionService.cekStatus(S.SUDAH_DITELAAH, [S.SUDAH_DITELAAH]));
  // sebelumnya batas atas saja: status 0 (batal) dan 1 (belum telaah) lolos ke verifikasi/penyerahan
  for (const status of [S.BATAL, S.RESEP_MASUK, S.OBAT_DISIAPKAN, S.DISERAHKAN]) {
    assert.throws(() => PrescriptionService.cekStatus(status, [S.SUDAH_DITELAAH]), /order status tidak memungkinkan/);
  }
  assert.throws(() => PrescriptionService.cekStatus(S.DISERAHKAN, [S.RESEP_MASUK, S.SUDAH_DITELAAH, S.OBAT_DISIAPKAN]), /Sudah Diserahkan/);
});

test("biaya racik metode paket memakai pembulatan ke atas", () => {
  assert.equal(PrescriptionHelper.kaliBiayaRacik("paket", 3, 10, 2), 1);
  assert.equal(PrescriptionHelper.kaliBiayaRacik("paket", 10, 10, 2), 1); // dulu 2
  assert.equal(PrescriptionHelper.kaliBiayaRacik("paket", 11, 10, 2), 2);
  assert.equal(PrescriptionHelper.kaliBiayaRacik("paket", 5, 0, 2), 5); // isi paket kosong tidak menghasilkan Infinity
  assert.equal(PrescriptionHelper.kaliBiayaRacik("item", 30, 10, 3), 3);
  assert.equal(PrescriptionHelper.kaliBiayaRacik(null, 3, 10, 2), null);
});

test("item tagihan: harga jual = HPP + margin; racikan satu paket", () => {
  const items = PrescriptionHelper.itemTagihan(
    [
      { is_compound: false, item_medis: { name: "Loratadin" }, harga_satuan: 300, medication_qty: 2 },
      {
        is_compound: true,
        nama_racikan: "Puyer",
        biaya_racik: 1000,
        biaya_embalase: 500,
        racikan: [
          { harga_satuan: 250, medication_qty: 3 },
          { harga_satuan: 250, medication_qty: 3 },
        ],
      },
    ],
    25
  );
  assert.deepEqual(items, [
    { nama_item: "Loratadin", harga: 375, qty: 2 },
    { nama_item: "Puyer", harga: 313 * 3 * 2 + 1500, qty: 1 },
  ]);
});

test("pilihan jenis stok verifikasi tidak dibuang validasi", () => {
  const hasil = PrescriptionValidation.UPDATE_VERIFIKASI.parse({
    uuid: "r1",
    items: [{ item_uuid: "i1", jenis_stok_uuid: "j1" }],
    racikan_items: [{ racikan_uuid: "k1", jenis_stok_uuid: "j2" }],
  });
  assert.equal(hasil.items[0].jenis_stok_uuid, "j1");
  assert.equal(hasil.racikan_items[0].jenis_stok_uuid, "j2");
});

test("jumlah obat harus positif", () => {
  const dasar = {
    prescription_uuid: "p", item_medis_uuid: "i", medication_dose_qty: 1, medication_dose_satuan_uuid: "s",
    medication_period: "Hari", aturan_pakai_uuid: "a", cara_pakai_uuid: "c", is_chronic: false, route: "O",
  };
  assert.throws(() => PrescriptionValidation.CREATE_PRESCRIPTION_ITEM.parse({ ...dasar, medication_qty: 0 }));
  assert.throws(() => PrescriptionValidation.CREATE_PRESCRIPTION_ITEM_RACIKAN.parse({ item_medis_uuid: "i", medication_qty: -1 }));
});
