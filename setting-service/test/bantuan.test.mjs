// Uji unit penyaring Helpdesk: node --test test/*.test.mjs (ekstensi .mjs agar tidak ikut dijalankan jest).
import { test } from "node:test";
import assert from "node:assert/strict";
import { samarkanDataPribadi } from "../src/bantuan/saring.js";

test("samarkanDataPribadi: NIK, kartu, HP, email, dan nomor RM disamarkan", () => {
  const { teks, disamarkan } = samarkanDataPribadi(
    "Pasien NIK 3201234567890001 kartu 0001234567890 HP 081234567890 email budi@gmail.com no RM 00123 tidak muncul",
  );
  assert.equal(teks, "Pasien NIK [NIK] kartu [NO-KARTU] HP [HP] email [EMAIL] no RM [NO-RM] tidak muncul");
  assert.equal(disamarkan, 5);
});

test("samarkanDataPribadi: data contoh fiktif & pertanyaan biasa tidak diubah", () => {
  const masukan = "Cara daftar pasien NIK 9999000000000001, HP 080000000000, email petugas@contoh.id? Menu Admisi.";
  assert.deepEqual(samarkanDataPribadi(masukan), { teks: masukan, disamarkan: 0 });
  assert.equal(samarkanDataPribadi("Bagaimana membatalkan order lab?").disamarkan, 0);
});

test("rahasia: token Gateway terenkripsi & bisa dibaca kembali; samaran hanya 4 karakter terakhir", async () => {
  process.env.SECRET_KEY ??= "kunci-uji-saja";
  const { enkripsi, dekripsi, samarkan } = await import("../src/bantuan/rahasia.js");
  const sandi = enkripsi("token-gateway-rahasia-1234");
  assert.match(sandi, /^enc:v1:/);
  assert.ok(!sandi.includes("token-gateway"));
  assert.equal(dekripsi(sandi), "token-gateway-rahasia-1234");
  assert.equal(dekripsi("nilai-polos"), "nilai-polos");
  assert.equal(samarkan("token-gateway-rahasia-1234"), "••••••••1234");
  assert.equal(enkripsi(""), null);
});

test("panduan: bagian dipecah per judul ##/###, catatan peninjau dilewati, kata kunci tanpa akhiran -nya", async () => {
  const { pecahBagian, cariBagian, kataKunci } = await import("../src/bantuan/panduan.js");
  const isi = "# Rawat Inap\n\n## Tugas sehari-hari\n\n### Memahami alur penerimaan pasien\nDokter membuat **SPRI**.\n\n### Mengajukan pindah bed\nKlik **Pindah Bed**.\n\n## Catatan untuk peninjau\nRahasia internal.\n";
  const bagian = pecahBagian(isi, "rawat-inap.md");
  assert.deepEqual(bagian.map((s) => s.judul), ["Rawat Inap › Tugas sehari-hari › Memahami alur penerimaan pasien", "Rawat Inap › Tugas sehari-hari › Mengajukan pindah bed"]);
  assert.deepEqual(kataKunci("Bagaimana alurnya untuk pasien rawat inap?"), ["alur", "pasien", "rawat", "inap"]);
  assert.equal(cariBagian("oke bagaimana alur pasien rawat inap?", { bagian })[0].judul.endsWith("Memahami alur penerimaan pasien"), true);
  assert.equal(cariBagian("cara pindah bed", { bagian })[0].judul.endsWith("Mengajukan pindah bed"), true);
  assert.deepEqual(cariBagian("tolong ya", { bagian }), []);
});

test("panduan nyata: pertanyaan umum menemukan bagian yang tepat", async () => {
  const { cariBagian } = await import("../src/bantuan/panduan.js");
  const teratas = (q) => cariBagian(q)[0]?.judul ?? "";
  assert.match(teratas("Bagaimana mengganti kata sandi?"), /Mengganti password/);
  assert.match(teratas("oke bagaimana alur untuk pasien rawat inap?"), /Rawat Inap/);
  assert.match(teratas("cara membatalkan order lab"), /Laboratorium › .*Membatalkan order/);
});
