import { test } from "node:test";
import assert from "node:assert/strict";
import { buatBodyBulk, tafsirBulk, daftarPesanGalat, pesanGalatLis } from "../src/lis/lis-peta.js";

// Kontrak gateway bridging MCU adamLIS (POST …/registrasi_bulk_mcu/create?kode_rs=&kode_lab=)
const item = [
  { no_registrasi: "LPK001", no_rm: "00-00-01", kode_tindakan: ["LIS-DR"] },
  { no_registrasi: "LPK002", no_rm: "00-00-012", kode_tindakan: ["LIS-DR", "LIS-HBSAG"] },
  { no_registrasi: "LPK003", no_rm: "00-00-02", kode_tindakan: ["LIS-DR"] },
];

test("body bulk: periksa_now boolean, nama & perusahaan tidak kosong", () => {
  const b = buatBodyBulk({ periksaNow: false, nama: "", perusahaan: "PT A", data: [{}] });
  assert.equal(b.periksa_now, false);
  assert.equal(b.nama, "-");
  assert.equal(b.perusahaan, "PT A");
  assert.equal(buatBodyBulk({ data: [] }).periksa_now, true);
});

test("201: nolab dicocokkan per no_registrasi; item tanpa rincian → tidak pasti", () => {
  const t = tafsirBulk({ ok: true, pasti: true, status: 201, json: { success: true, code: 201, message: "Data MCU Berhasil Ditambahkan",
    payload: [{ nolab: "J03/251203/0002", no_registrasi: "LPK002" }, { nolab: "J03/251203/0001", no_registrasi: "LPK001" }] } }, item);
  assert.equal(t.jenis, "sukses");
  assert.deepEqual(t.hasil.map((h) => [h.status, h.no_lab]), [["terkirim", "J03/251203/0001"], ["terkirim", "J03/251203/0002"], ["tidak_pasti", null]]);
});

test("201 tanpa payload per item → semua terkirim tanpa No. Lab", () => {
  const t = tafsirBulk({ ok: true, pasti: true, status: 201, json: { success: true, message: "OK" } }, item);
  assert.ok(t.hasil.every((h) => h.status === "terkirim" && h.no_lab === null));
});

test("409 no_rm duplikat (messsage 3 s): hanya item ber-no_rm tsb yang gagal, tanpa salah cocok awalan", () => {
  const t = tafsirBulk({ ok: false, pasti: true, status: 409, json: { messsage: "Conflic", code: 409, success: false, errors: [{ message: "Nomer RM duplikat ditemukan: 00-00-01" }] } }, item);
  assert.equal(t.jenis, "sebagian");
  assert.equal(t.hasil[0].status, "gagal");
  assert.equal(t.hasil[1], null); // 00-00-012 tidak boleh ikut tercocok
  assert.equal(t.hasil[2], null);
  const t2 = tafsirBulk({ ok: false, pasti: true, status: 409, json: { errors: [{ message: "Duplikat nomer RM 00-00-02" }] } }, item);
  assert.deepEqual(t2.hasil.map((h) => h?.status ?? null), [null, null, "gagal"]);
});

test("400 validasi data.N.* → item ke-N; kode tindakan → item yang memuatnya", () => {
  const t = tafsirBulk({ ok: false, pasti: true, status: 400, json: { message: "Bad request", success: false,
    errors: [{ field: "data.2.pasien.nik", message: "data.2.pasien.nik tidak boleh kosong" }] } }, item);
  assert.deepEqual(t.hasil.map((h) => h?.status ?? null), [null, null, "gagal"]);
  const t2 = tafsirBulk({ ok: false, pasti: true, status: 400, json: { success: false, errors: [{ message: "Data Tindakan HBsAg(LIS-HBSAG) Belum Dimappingkan" }] } }, item);
  assert.deepEqual(t2.hasil.map((h) => h?.status ?? null), [null, "gagal", null]);
});

test("400 umum / 500 / 404 → seluruh item gagal dengan pesan asli", () => {
  const t = tafsirBulk({ ok: false, pasti: true, status: 500, json: { messsage: "Internal Server Error", code: 500, success: false,
    errors: [{ message: "Gagal membuat MCU, silakan coba lagi setelah 5 menit" }] } }, item);
  assert.equal(t.jenis, "gagal");
  assert.ok(t.hasil.every((h) => h.status === "gagal" && /5 menit/.test(h.pesan)));
  const t2 = tafsirBulk({ ok: false, pasti: true, status: 400, json: { errors: [{ field: "data", message: "data terlalu banyak, maksimal data adalah 150" }] } }, item);
  assert.equal(t2.jenis, "gagal");
});

test("respons tidak pasti (waktu habis / 502) → seluruh item tidak pasti", () => {
  const t = tafsirBulk({ ok: false, pasti: false, status: 0, json: { message: "LIS tidak dapat dihubungi: waktu habis" } }, item);
  assert.equal(t.jenis, "tidak_pasti");
  assert.ok(t.hasil.every((h) => h.status === "tidak_pasti"));
});

test("pesan galat toleran: errors[], message, messsage, description", () => {
  assert.deepEqual(daftarPesanGalat({ messsage: "Conflic", errors: [{ message: "Duplikat nomer RM X" }] }), ["Duplikat nomer RM X"]);
  assert.equal(pesanGalatLis({ success: false, message: [{ msg: "A" }, { msg: "B" }] }, 500), "A; B");
  assert.equal(pesanGalatLis({}, 502), "LIS menolak permintaan (HTTP 502)");
});
