// STD-0029 — Uji unit helper murni Audit Trail (tanpa I/O, tanpa database). Jalankan: node --test "test/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  samarkanNilaiField,
  samarkanRingkasan,
  jsonKanonik,
  kanonikBaris,
  hitungHashBaris,
} from "../umum/audit-core.js";

test("jsonKanonik: urutan kunci objek tidak memengaruhi hasil (stabil terhadap penyusunan ulang JSONB)", () => {
  const a = { baru: "B", lama: "A" };
  const b = { lama: "A", baru: "B" };
  assert.equal(jsonKanonik(a), jsonKanonik(b));
});

test("jsonKanonik: stabil rekursif pada objek bersarang dan array", () => {
  const a = { x: { b: 2, a: 1 }, list: [{ q: 1, p: 2 }] };
  const b = { list: [{ p: 2, q: 1 }], x: { a: 1, b: 2 } };
  assert.equal(jsonKanonik(a), jsonKanonik(b));
});

test("jsonKanonik: field undefined/function diabaikan konsisten seperti JSON.stringify", () => {
  const nilai = { a: 1, b: undefined, c: () => {} };
  assert.equal(jsonKanonik(nilai), '{"a":1}');
});

test("samarkanNilaiField: field rahasia selalu [DISAMARKAN], tidak peduli nilainya", () => {
  assert.equal(samarkanNilaiField("password", "rahasia123"), "[DISAMARKAN]");
  assert.equal(samarkanNilaiField("accessToken", "abc.def.ghi"), "[DISAMARKAN]");
  assert.equal(samarkanNilaiField("api_key", "sk-xxxx"), "[DISAMARKAN]");
});

test("samarkanNilaiField: NIK disamarkan sebagian (6 digit depan + 2 belakang, sisanya bintang)", () => {
  assert.equal(samarkanNilaiField("nik", "9999010112340007"), "999901********07");
  assert.equal(samarkanNilaiField("no_identity", "9999010112340007"), "999901********07");
  assert.equal(samarkanNilaiField("noIdentity", "9999010112340007"), "999901********07");
});

test("samarkanNilaiField: NIK pendek (<=8 digit) disamarkan seluruhnya", () => {
  assert.equal(samarkanNilaiField("nik", "99990101"), "********");
});

test("samarkanNilaiField: nama kolom yang mengandung 'nik' sebagai kata lain tidak ikut disamarkan", () => {
  assert.equal(samarkanNilaiField("klinik", "Klinik Sehat"), "Klinik Sehat");
  assert.equal(samarkanNilaiField("teknik_tindakan", "insisi"), "insisi");
});

test("samarkanNilaiField: objek bersarang disamarkan rekursif, field rahasia di dalamnya dibuang", () => {
  const hasil = samarkanNilaiField("data", { nama: "Budi", password: "rahasia", nik: "9999010112340007" });
  assert.deepEqual(hasil, { nama: "Budi", nik: "999901********07" });
  assert.equal("password" in hasil, false);
});

test("samarkanNilaiField: array objek disamarkan rekursif per elemen (field rahasia di tiap elemen dibuang)", () => {
  const hasil = samarkanNilaiField("anggota_keluarga", [
    { nama: "Budi", nik: "9999010112340007" },
    { nama: "Ani", password: "rahasia" },
  ]);
  assert.deepEqual(hasil, [{ nama: "Budi", nik: "999901********07" }, { nama: "Ani" }]);
});

test("samarkanNilaiField: berkas biner (Buffer) diringkas sebagai penanda, bukan disalin", () => {
  const buf = Buffer.from("isi berkas pdf palsu");
  assert.equal(samarkanNilaiField("unggah_berkas", buf), `[BERKAS BINER ${buf.length} byte]`);
});

test("samarkanNilaiField: representasi JSON Buffer ({type:'Buffer',data:[]}) juga diringkas", () => {
  const nilai = { type: "Buffer", data: [1, 2, 3, 4, 5] };
  assert.equal(samarkanNilaiField("unggah_berkas", nilai), "[BERKAS BINER 5 byte]");
});

test("samarkanNilaiField: teks sangat panjang dipotong, tidak disalin penuh ke audit", () => {
  const teksPanjang = "a".repeat(3000);
  const hasil = samarkanNilaiField("catatan", teksPanjang);
  assert.ok(hasil.length < teksPanjang.length);
  assert.match(hasil, /^a{200}… \[DIPOTONG, 3000 karakter\]$/);
});

test("samarkanNilaiField: teks pendek/nilai biasa tidak diubah", () => {
  assert.equal(samarkanNilaiField("nama", "Budi Santoso"), "Budi Santoso");
  assert.equal(samarkanNilaiField("umur", 30), 30);
  assert.equal(samarkanNilaiField("aktif", true), true);
});

test("samarkanNilaiField: null/undefined dikembalikan apa adanya", () => {
  assert.equal(samarkanNilaiField("nik", null), null);
  assert.equal(samarkanNilaiField("password", undefined), undefined);
});

test("samarkanRingkasan: field rahasia dihilangkan total dari ringkasan (tidak ikut tersimpan)", () => {
  const hasil = samarkanRingkasan({
    nama: { lama: "Budi", baru: "Budi Santoso" },
    password: { lama: "lama123", baru: "baru456" },
  });
  assert.equal("password" in hasil, false);
  assert.deepEqual(hasil.nama, { lama: "Budi", baru: "Budi Santoso" });
});

test("samarkanRingkasan: NIK pada bentuk {lama, baru} disamarkan pada kedua sisi", () => {
  const hasil = samarkanRingkasan({ nik: { lama: "9999010112340007", baru: "9999010112340099" } });
  assert.deepEqual(hasil.nik, { lama: "999901********07", baru: "999901********99" });
});

test("hitungHashBaris: hasil stabil untuk baris yang identik", () => {
  const baris = {
    uuid: "u1", faskes_uuid: "f1", waktu_epoch: 1000, pengguna_uuid: "p1", identitas_akun: "budi",
    peran: "admin", layanan: "auth", aksi: "login", entitas: null, entitas_uuid: null, patient_uuid: null,
    ringkasan_perubahan: null, alamat_ip: "127.0.0.1", user_agent: "jest", request_id: "r1", hash_sebelumnya: null,
  };
  assert.equal(hitungHashBaris(baris), hitungHashBaris({ ...baris }));
});

test("hitungHashBaris: perubahan isi baris mengubah hash (mendeteksi perubahan)", () => {
  const baris = {
    uuid: "u1", faskes_uuid: "f1", waktu_epoch: 1000, pengguna_uuid: "p1", identitas_akun: "budi",
    peran: "admin", layanan: "auth", aksi: "login", entitas: null, entitas_uuid: null, patient_uuid: null,
    ringkasan_perubahan: null, alamat_ip: "127.0.0.1", user_agent: "jest", request_id: "r1", hash_sebelumnya: null,
  };
  const diubah = { ...baris, identitas_akun: "andi" };
  assert.notEqual(hitungHashBaris(baris), hitungHashBaris(diubah));
});

test("hitungHashBaris: perubahan hash_sebelumnya mengubah hash (mendeteksi baris disisipkan/dihapus di rantai)", () => {
  const baris = {
    uuid: "u2", faskes_uuid: "f1", waktu_epoch: 1001, pengguna_uuid: null, identitas_akun: null,
    peran: null, layanan: "auth", aksi: "logout", entitas: null, entitas_uuid: null, patient_uuid: null,
    ringkasan_perubahan: null, alamat_ip: null, user_agent: null, request_id: null, hash_sebelumnya: "hashA",
  };
  const rantaiLain = { ...baris, hash_sebelumnya: "hashB" };
  assert.notEqual(hitungHashBaris(baris), hitungHashBaris(rantaiLain));
});

test("hitungHashBaris: urutan kunci JSONB ringkasan_perubahan yang berbeda (mis. hasil baca ulang dari Postgres) tidak mengubah hash", () => {
  const dasar = {
    uuid: "u3", faskes_uuid: "f1", waktu_epoch: 1002, pengguna_uuid: "p1", identitas_akun: "budi",
    peran: "admin", layanan: "rawat-jalan", aksi: "ubah", entitas: "Pasien", entitas_uuid: "e1", patient_uuid: "e1",
    alamat_ip: null, user_agent: null, request_id: null, hash_sebelumnya: null,
  };
  const saatTulis = { ...dasar, ringkasan_perubahan: { nama: { lama: "Budi", baru: "Budi S" } } };
  // PostgreSQL JSONB boleh menyusun ulang urutan kunci objek saat dibaca kembali.
  const saatVerifikasi = { ...dasar, ringkasan_perubahan: { nama: { baru: "Budi S", lama: "Budi" } } };
  assert.equal(hitungHashBaris(saatTulis), hitungHashBaris(saatVerifikasi));
});

test("kanonikBaris: kolom yang tidak ada di whitelist hash (mis. peristiwa non-standar) diabaikan, tidak melempar error", () => {
  const baris = { uuid: "u4", kolom_asing: "tidak dipakai" };
  assert.doesNotThrow(() => kanonikBaris(baris));
});
