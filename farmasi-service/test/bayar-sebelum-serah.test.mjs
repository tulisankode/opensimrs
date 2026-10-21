// Uji aturan "dibayar dulu baru diserahkan" (kecuali rawat inap/penjamin) dan koreksi tagihan retur bernilai HPP.
// Jalankan: TZ=UTC node --test test/bayar-sebelum-serah.test.mjs (akses database diganti tiruan).
import { test } from "node:test";
import assert from "node:assert/strict";
import TagihanFarmasiService, { nilaiStatusBayar, STATUS_BAYAR } from "../src/services/tagihan-farmasi-service.js";
import TagihanRepository from "../src/repositories/tagihan-repository.js";
import axiosInstance from "../src/configurations/axios-instance.js";

const RJ_TUNAI = { type: "RJ", payment_method: 1 };
const belum = { lunas: false, tertutup: false, total: 55000, dibayar: 0 };

test("rawat jalan/IGD tunai: menunggu pembayaran sampai lunas atau ditutup kasir", () => {
  const s = nilaiStatusBayar({ order: { jenis_pelayanan: "rj" }, kunjungan: RJ_TUNAI, tagihan: belum });
  assert.equal(s.kode, "menunggu_pembayaran");
  assert.equal(s.boleh_diserahkan, false);
  assert.equal(s.sisa, 55000);
  assert.equal(
    nilaiStatusBayar({ order: {}, kunjungan: { type: "IGD", payment_method: 1 }, tagihan: { ...belum, dibayar: 20000 } }).sisa,
    35000
  );
  assert.equal(nilaiStatusBayar({ order: {}, kunjungan: RJ_TUNAI, tagihan: { ...belum, lunas: true } }), STATUS_BAYAR.LUNAS);
  assert.equal(nilaiStatusBayar({ order: {}, kunjungan: RJ_TUNAI, tagihan: { ...belum, tertutup: true } }), STATUS_BAYAR.PIUTANG);
});

test("pengecualian: rawat inap, penjamin, BHP penunjang, tanpa tagihan", () => {
  assert.equal(nilaiStatusBayar({ order: {}, kunjungan: { type: "RI", payment_method: 1 }, tagihan: belum }), STATUS_BAYAR.RAWAT_INAP);
  // kunjungan tidak ditemukan: jenis pelayanan order
  assert.equal(nilaiStatusBayar({ order: { jenis_pelayanan: "ri" }, kunjungan: null, tagihan: belum }), STATUS_BAYAR.RAWAT_INAP);
  assert.equal(nilaiStatusBayar({ order: {}, kunjungan: { type: "RJ", payment_method: 2 }, tagihan: belum }), STATUS_BAYAR.PENJAMIN);
  // metode bayar kunjungan diutamakan dari isian order
  assert.equal(
    nilaiStatusBayar({ order: { payment_method: 2 }, kunjungan: RJ_TUNAI, tagihan: belum }).kode,
    "menunggu_pembayaran"
  );
  assert.equal(nilaiStatusBayar({ order: {}, kunjungan: RJ_TUNAI, tagihan: belum, olehPenunjang: true }), STATUS_BAYAR.PENUNJANG);
  assert.equal(nilaiStatusBayar({ order: {}, kunjungan: RJ_TUNAI, tagihan: undefined }), STATUS_BAYAR.TANPA_TAGIHAN);
});

const tiru = (obj, nama, fn) => {
  const asli = obj[nama];
  obj[nama] = fn;
  return () => (obj[nama] = asli);
};

test("penyerahan ditolak dengan pesan jelas bila tagihan belum dibayar", async () => {
  const pulihkan = [
    tiru(TagihanRepository, "cariKunjunganBanyak", async () => new Map([["REG1", { ...RJ_TUNAI, no_reg: "REG1" }]])),
    tiru(TagihanRepository, "statusBayarRef", async (refs) => new Map(refs.map((r) => [r, belum]))),
    tiru(TagihanRepository, "dariPemakaianPenunjang", async () => false),
  ];
  try {
    const resep = { uuid: "r1", no_reg: "REG1", jenis_pelayanan: "rj", payment_method: 1 };
    await assert.rejects(
      TagihanFarmasiService.pastikanSudahDibayar(resep, "resep", "f1"),
      /Obat belum dapat diserahkan: tagihan pasien belum dibayar di kasir \(sisa Rp 55\.000\)/
    );
    await assert.rejects(
      TagihanFarmasiService.pastikanSudahDibayar({ ...resep, uuid: "a1" }, "alkes", "f1"),
      /Alkes belum dapat diserahkan/
    );
    // order Kamar Operasi tidak menunggu kasir
    const ok = await TagihanFarmasiService.pastikanSudahDibayar({ ...resep, jenis_pelayanan: "ok" }, "alkes", "f1");
    assert.equal(ok.kode, "oleh_penunjang");
  } finally {
    pulihkan.forEach((p) => p());
  }
});

test("status pembayaran memakai ref resep:/alkes: sesuai jenis order", async () => {
  let diminta;
  const pulihkan = [
    tiru(TagihanRepository, "cariKunjunganBanyak", async () => new Map()),
    tiru(TagihanRepository, "statusBayarRef", async (refs) => {
      diminta = refs;
      return new Map([[refs[0], { ...belum, lunas: true }]]);
    }),
    tiru(TagihanRepository, "dariPemakaianPenunjang", async () => false),
  ];
  try {
    const hasil = await TagihanFarmasiService.statusPembayaran([{ uuid: "u1", no_reg: "X", payment_method: 1 }], "resep", "f1");
    assert.deepEqual(diminta, ["resep:u1"]);
    assert.equal(hasil.get("u1").kode, "lunas");
    await TagihanFarmasiService.statusPembayaran([{ uuid: "u2", no_reg: "X", payment_method: 1 }], "alkes", "f1");
    assert.deepEqual(diminta, ["alkes:u2"]);
  } finally {
    pulihkan.forEach((p) => p());
  }
});

test("koreksi tagihan retur bernilai HPP (bukan harga jual)", async () => {
  let payload;
  const pulihkan = [
    tiru(TagihanRepository, "cariKunjungan", async () => ({ ...RJ_TUNAI, uuid: "k1", no_reg: "REG1", patient_uuid: "p1" })),
    tiru(TagihanRepository, "tagihanAktifKunjungan", async () => ({ uuid: "b1" })),
    tiru(TagihanRepository, "namaPasien", async () => "Pasien Uji"),
    tiru(TagihanRepository, "namaPraktisi", async () => null),
    tiru(axiosInstance, "post", async (_url, body) => {
      payload = body;
      return { data: {} };
    }),
  ];
  try {
    const hasil = await TagihanFarmasiService.koreksiRetur({
      faskesUuid: "f1",
      noReg: "REG1",
      returUuid: "rt1",
      kategori: "2",
      items: [{ item_name: "Loratadin", qty: 2, harga_satuan: 300 }],
      token: "x",
    });
    assert.equal(hasil.status, "terkirim");
    const item = payload.services[0].items[0];
    assert.equal(item.price, -300);
    assert.equal(item.qty, 2);
    assert.equal(item.additional_info.ref, "retur:rt1");
  } finally {
    pulihkan.forEach((p) => p());
  }
});
