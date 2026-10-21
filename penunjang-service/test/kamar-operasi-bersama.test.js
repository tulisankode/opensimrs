import { test } from "node:test";
import assert from "node:assert/strict";
import {
  consentBerbedaValid,
  consentSama,
  epoch,
  jenisOperasiValid,
  kelasOperasiValid,
  kelasTertinggi,
  peranValid,
  ramah,
  sumberValid,
  tahapValid,
  tanggalValid,
} from "../src/kamar-operasi/bersama.js";
import { Galat } from "../src/umum/respons.js";

// Validasi dasar modul Kamar Operasi (penunjang-service): aturan bisnis #1 (data wajib order), #2 (prioritas cito
// tidak mengubah urutan tanpa jenis_operasi valid), #3 (bentrok jadwal), dan bagian tahap checklist WHO (KF-9).

test("sumberValid: hanya menerima rajal/ranap/igd", () => {
  assert.equal(sumberValid("rajal"), "rajal");
  assert.equal(sumberValid("ranap"), "ranap");
  assert.equal(sumberValid("igd"), "igd");
  assert.throws(() => sumberValid("aps"), Galat);
  assert.throws(() => sumberValid(undefined), Galat);
});

test("jenisOperasiValid: hanya menerima elektif/cito", () => {
  assert.equal(jenisOperasiValid("elektif"), "elektif");
  assert.equal(jenisOperasiValid("cito"), "cito");
  assert.throws(() => jenisOperasiValid("darurat"), Galat);
});

test("kelasOperasiValid: opsional (null/undefined/'' -> null), selain itu harus salah satu kelas baku", () => {
  assert.equal(kelasOperasiValid(undefined), null);
  assert.equal(kelasOperasiValid(null), null);
  assert.equal(kelasOperasiValid(""), null);
  assert.equal(kelasOperasiValid("besar"), "besar");
  assert.throws(() => kelasOperasiValid("sangat besar"), Galat);
});

test("peranValid: hanya menerima peran tim OK yang baku (KF-4)", () => {
  assert.equal(peranValid("operator"), "operator");
  assert.equal(peranValid("perawat_instrumen"), "perawat_instrumen");
  assert.throws(() => peranValid("dokter_anak"), Galat);
});

test("tahapValid: menerima format sign-in/time-out/sign-out maupun sign_in/time_out/sign_out", () => {
  assert.equal(tahapValid("sign-in"), "sign_in");
  assert.equal(tahapValid("time-out"), "time_out");
  assert.equal(tahapValid("sign_out"), "sign_out");
  assert.throws(() => tahapValid("scrub-in"), Galat);
});

test("epoch: menerima epoch detik, ISO string, dan nilai kosong -> null", () => {
  assert.equal(epoch(null), null);
  assert.equal(epoch(undefined), null);
  assert.equal(epoch(""), null);
  assert.equal(epoch(1700000000), 1700000000);
  assert.equal(typeof epoch("2026-10-16T14:00:00+07:00"), "number");
  assert.throws(() => epoch("bukan-tanggal"), Galat);
});

test("tanggalValid: hanya menerima format YYYY-MM-DD", () => {
  assert.equal(tanggalValid("2026-10-16"), "2026-10-16");
  assert.throws(() => tanggalValid("16-10-2026"), Galat);
  assert.throws(() => tanggalValid("2026-13-40"), Galat);
});

test("kelasTertinggi: memilih kelas operasi tertinggi di antara rencana tindakan (dipakai menentukan tarif jasa tim)", () => {
  assert.equal(kelasTertinggi([{ kelas_operasi: "kecil" }, { kelas_operasi: "besar" }, { kelas_operasi: "sedang" }]), "besar");
  assert.equal(kelasTertinggi([{ kelas_operasi: "khusus" }]), "khusus");
  assert.equal(kelasTertinggi([{ kelas_operasi: null }]), null);
  assert.equal(kelasTertinggi([]), null);
});

test("ramah: pelanggaran unique constraint (23505) menjadi Galat 409 dengan pesan ramah; galat lain diteruskan", () => {
  assert.throws(() => ramah({ code: "23505" }, "Kode ruang OK sudah dipakai"), (e) => e instanceof Galat && e.status === 409 && e.message === "Kode ruang OK sudah dipakai");
  const lain = new Error("koneksi database terputus");
  assert.throws(() => ramah(lain, "pesan tidak dipakai"), (e) => e === lain);
});

test("consentSama/consentBerbedaValid: consent tindakan & anestesi harus dokumen berbeda; kosong diabaikan", () => {
  assert.equal(consentSama("c-1", "c-2"), false);
  assert.equal(consentSama("c-1", "c-1"), true);
  assert.equal(consentSama(null, null), false);
  assert.equal(consentSama("c-1", null), false);
  assert.equal(consentSama("", ""), false);
  assert.doesNotThrow(() => consentBerbedaValid("c-1", "c-2"));
  assert.doesNotThrow(() => consentBerbedaValid(undefined, "c-2"));
  assert.throws(() => consentBerbedaValid("c-1", "c-1"), (e) => e instanceof Galat && e.status === 400);
});
