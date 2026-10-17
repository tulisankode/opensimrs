import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tanggalValid,
  hariIni,
  rentang,
  jumlahSlotValid,
  hargaValid,
  siapkanSesi,
  sisaSlot,
  ramah,
} from "../src/training/bersama.js";
import { Galat } from "../src/umum/respons.js";

// Logika murni (tanpa koneksi DB) modul Training: validasi datamaster kelas, rentang laporan,
// dan penghitungan slot. Dipakai kelas.js/booking.js/order.js/laporan.js.

test("tanggalValid: menerima YYYY-MM-DD, menolak format lain", () => {
  assert.equal(tanggalValid("2026-10-20"), "2026-10-20");
  assert.throws(() => tanggalValid("20-10-2026"), Galat);
  assert.throws(() => tanggalValid("2026/10/20"), Galat);
  assert.throws(() => tanggalValid(""), Galat);
  assert.throws(() => tanggalValid("2026-13-99"), Galat);
});

test("hariIni: mengembalikan tanggal berformat YYYY-MM-DD", () => {
  assert.match(hariIni(), /^\d{4}-\d{2}-\d{2}$/);
});

test("rentang: bawaan memakai hari ini bila query kosong", () => {
  const h = hariIni();
  const r = rentang({});
  assert.deepEqual(r, { mulai: h, selesai: h });
});

test("rentang: memakai tanggal_mulai/tanggal_selesai dari query", () => {
  const r = rentang({ tanggal_mulai: "2026-10-01", tanggal_selesai: "2026-10-31" });
  assert.deepEqual(r, { mulai: "2026-10-01", selesai: "2026-10-31" });
});

test("rentang: tanggal_selesai ikut tanggal_mulai bila tidak diisi", () => {
  const r = rentang({ tanggal_mulai: "2026-10-05" });
  assert.deepEqual(r, { mulai: "2026-10-05", selesai: "2026-10-05" });
});

test("rentang: format tanggal tidak valid ditolak", () => {
  assert.throws(() => rentang({ tanggal_mulai: "05-10-2026" }), Galat);
});

test("jumlahSlotValid: bilangan bulat positif diterima", () => {
  assert.equal(jumlahSlotValid(10), 10);
  assert.equal(jumlahSlotValid("5"), 5);
});

test("jumlahSlotValid: nol, negatif, desimal, dan bukan angka ditolak (KF-2)", () => {
  assert.throws(() => jumlahSlotValid(0), Galat);
  assert.throws(() => jumlahSlotValid(-1), Galat);
  assert.throws(() => jumlahSlotValid(1.5), Galat);
  assert.throws(() => jumlahSlotValid("abc"), Galat);
  assert.throws(() => jumlahSlotValid(undefined), Galat);
});

test("hargaValid: angka tidak negatif diterima, kosong dianggap 0", () => {
  assert.equal(hargaValid(75000), 75000);
  assert.equal(hargaValid(0), 0);
  assert.equal(hargaValid(undefined), 0);
});

test("hargaValid: negatif ditolak (KF-2)", () => {
  assert.throws(() => hargaValid(-1000), Galat);
  assert.throws(() => hargaValid("abc"), Galat);
});

test("siapkanSesi: kelas tanpa sesi selalu menghasilkan daftar kosong", () => {
  assert.deepEqual(siapkanSesi(false, [{ nama_sesi: "Sesi 1" }]), []);
  assert.deepEqual(siapkanSesi(false, undefined), []);
});

test("siapkanSesi: kelas bersesi wajib minimal satu sesi (KF-2)", () => {
  assert.throws(() => siapkanSesi(true, []), Galat);
  assert.throws(() => siapkanSesi(true, undefined), Galat);
});

test("siapkanSesi: nama_sesi wajib diisi pada setiap sesi", () => {
  assert.throws(() => siapkanSesi(true, [{ nama_sesi: "  " }]), Galat);
});

test("siapkanSesi: memetakan & menormalkan daftar sesi dengan urutan bawaan", () => {
  const sesi = siapkanSesi(true, [
    { nama_sesi: " Pagi ", jam_mulai: "07:00", jam_selesai: "08:00" },
    { nama_sesi: "Sore" },
  ]);
  assert.deepEqual(sesi, [
    { nama_sesi: "Pagi", jam_mulai: "07:00", jam_selesai: "08:00", urutan: 1 },
    { nama_sesi: "Sore", jam_mulai: null, jam_selesai: null, urutan: 2 },
  ]);
});

test("siapkanSesi: urutan eksplisit dipertahankan", () => {
  const sesi = siapkanSesi(true, [{ nama_sesi: "Sore", urutan: 5 }]);
  assert.equal(sesi[0].urutan, 5);
});

test("sisaSlot: kuota dikurangi terisi, tidak pernah negatif (T2)", () => {
  assert.equal(sisaSlot(10, 0), 10);
  assert.equal(sisaSlot(10, 8), 2);
  assert.equal(sisaSlot(10, 10), 0);
  assert.equal(sisaSlot(10, 11), 0);
});

test("ramah: pelanggaran unique index (23505) menjadi Galat 409 dengan pesan ramah", () => {
  const err = { code: "23505", message: "duplicate key" };
  assert.throws(
    () => ramah(err, "Kode kelas sudah dipakai di faskes ini"),
    (e) => e instanceof Galat && e.status === 409 && e.message === "Kode kelas sudah dipakai di faskes ini",
  );
});

test("ramah: galat lain diteruskan apa adanya", () => {
  const err = new Error("galat lain");
  assert.throws(() => ramah(err, "pesan ramah"), (e) => e === err);
});
