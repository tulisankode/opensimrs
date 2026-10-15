import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import lz from "lz-string";

process.env.SECRET_KEY = process.env.SECRET_KEY || "kunci-uji";
const { tandaTangan, otorisasi, header, dekripsiRespons, enkripsiRespons } = await import("../src/klien-pcare.js");
const { buatPendaftaran, buatKunjungan, keTanggalPcare, KD_TKP_RJTP } = await import("../src/pcare-peta.js");
const { enkripsi, dekripsi, samarkan } = await import("../src/rahasia.js");

const kred = { consId: "12345", secretKey: "rahasia", userKey: "uk", username: "admin", password: "sandi", kdAplikasi: "095" };

test("X-signature = base64(HMAC-SHA256(consId&timestamp, secretKey))", () => {
  const harap = crypto.createHmac("sha256", "rahasia").update("12345&1700000000").digest("base64");
  assert.equal(tandaTangan("12345", "rahasia", 1700000000), harap);
});

test("X-authorization = Basic base64(username:password:kdAplikasi)", () => {
  const nilai = otorisasi("admin", "sandi", "095");
  assert.equal(nilai, `Basic ${Buffer.from("admin:sandi:095").toString("base64")}`);
  assert.equal(Buffer.from(nilai.slice(6), "base64").toString(), "admin:sandi:095");
});

test("header lengkap untuk permintaan PCare", () => {
  const h = header(kred, 1700000000);
  assert.deepEqual(Object.keys(h).sort(), ["X-authorization", "X-cons-id", "X-signature", "X-timestamp", "user_key"]);
  assert.equal(h["X-timestamp"], "1700000000");
  assert.equal(h.user_key, "uk");
});

test("dekripsi respons: AES-256-CBC (kunci SHA-256(consId+secret+timestamp), IV 16 byte) + LZ-String", () => {
  const objek = { field: "noUrut", message: "A12" };
  // enkripsi manual sesuai spesifikasi BPJS, independen dari enkripsiRespons
  const kunci = crypto.createHash("sha256").update("12345rahasia1700000000").digest();
  const cipher = crypto.createCipheriv("aes-256-cbc", kunci, kunci.subarray(0, 16));
  const teks = cipher.update(lz.compressToEncodedURIComponent(JSON.stringify(objek)), "utf8", "base64") + cipher.final("base64");
  assert.deepEqual(dekripsiRespons(teks, "12345", "rahasia", "1700000000"), objek);
  // dan bolak-balik dengan enkripsiRespons (dipakai mode simulasi)
  assert.deepEqual(dekripsiRespons(enkripsiRespons(objek, "12345", "rahasia", 1700000000), "12345", "rahasia", "1700000000"), objek);
});

test("tanggal PCare dd-mm-yyyy dalam WIB", () => {
  // 2026-10-12 18:30 UTC = 2026-10-13 01:30 WIB
  assert.equal(keTanggalPcare(Date.UTC(2026, 9, 12, 18, 30) / 1000), "13-10-2026");
  assert.equal(keTanggalPcare(null), null);
});

test("pendaftaran: field sesuai katalog PCare", () => {
  const b = buatPendaftaran({
    kdProvider: "0114A026", noKartu: "0001113569638", kdPoli: "001", tanggal: Date.UTC(2026, 9, 13, 2) / 1000,
    keluhan: "demam", tandaVital: { tekanan_darah_sistole: 120, tekanan_darah_diastole: 80, frekuensi_nafas: 20, frekuensi_nadi: 88 },
    antropometri: { berat_badan: 60.5, tinggi_badan: 165, lingkar_perut: 80 },
  });
  assert.deepEqual(b, {
    kdProviderPeserta: "0114A026", tglDaftar: "13-10-2026", noKartu: "0001113569638", kdPoli: "001", keluhan: "demam",
    kunjSakit: true, sistole: 120, diastole: 80, beratBadan: 60.5, tinggiBadan: 165, respRate: 20, lingkarPerut: 80,
    heartRate: 88, rujukBalik: 0, kdTkp: KD_TKP_RJTP,
  });
});

test("kunjungan: diagnosis 1–3, dokter, status pulang & nilai bawaan", () => {
  const b = buatKunjungan({
    noKartu: "0001113569638", tanggalDaftar: Date.UTC(2026, 9, 13, 2) / 1000, tanggalPulang: Date.UTC(2026, 9, 13, 4) / 1000,
    kdPoli: "001", kdDokter: "131491", diagnosis: [{ kode: "J06.9" }, { kode: "K30" }], keluhan: "demam",
    tandaVital: { suhu: 37.8, frekuensi_nadi: 90 },
  });
  assert.equal(b.noKunjungan, null);
  assert.equal(b.kdDiag1, "J06.9");
  assert.equal(b.kdDiag2, "K30");
  assert.equal(b.kdDiag3, null);
  assert.equal(b.kdDokter, "131491");
  assert.equal(b.tglPulang, "13-10-2026");
  assert.equal(b.kdStatusPulang, "3");
  assert.equal(b.suhu, "37.8");
  assert.equal(b.heartRate, 90);
  assert.equal(b.kdTacc, -1);
});

test("rahasia: enkripsi AES-GCM bolak-balik, nilai lama polos tetap terbaca, penyamaran", () => {
  const terenkripsi = enkripsi("rahasia-bpjs");
  assert.match(terenkripsi, /^enc:v1:/);
  assert.notEqual(terenkripsi, enkripsi("rahasia-bpjs")); // IV acak
  assert.equal(dekripsi(terenkripsi), "rahasia-bpjs");
  assert.equal(dekripsi("polos"), "polos");
  assert.equal(enkripsi(""), null);
  assert.equal(samarkan("abcdefgh1234"), "••••••••1234");
});
