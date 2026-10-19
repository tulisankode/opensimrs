import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JENIS_INSIDEN,
  MATRIKS_BAWAAN,
  TENGGAT_INVESTIGASI_BAWAAN,
  amankanPasien,
  amankanPelapor,
  batasInvestigasi,
  batasLapor,
  gradeDariMatriks,
  inisial,
  jamPelaporan,
  jenisInvestigasiUntuk,
  median,
  perluRca,
  statusTenggat,
  susunTren,
  syaratTutup,
  terlambatLapor,
  tindakLanjutTerlambat,
  validasiMatriks,
  validasiTenggatInvestigasi,
} from "../src/mutu/ikp-bersama.js";
import { mutuPermission } from "../../auth-service/src/helpers/permission-list.js";
import katalog from "../../database/data/katalog-modul.json" with { type: "json" };

// Epoch detik untuk tanggal/jam WIB (UTC+7).
const wib = (y, m, d, jam = 0, menit = 0) => Date.UTC(y, m - 1, d, jam - 7, menit) / 1000;
const HARI = 86400;

test("jenis insiden KTD, KNC, KTC, KPC, sentinel", () => {
  assert.deepEqual(Object.keys(JENIS_INSIDEN), ["ktd", "knc", "ktc", "kpc", "sentinel"]);
});

test("grading matriks bawaan: dampak × probabilitas → grade & skor", () => {
  assert.deepEqual(gradeDariMatriks(1, 1), { skor: 1, grade: "biru" });
  assert.deepEqual(gradeDariMatriks(2, 2), { skor: 4, grade: "biru" });
  assert.deepEqual(gradeDariMatriks(2, 3), { skor: 6, grade: "hijau" });
  assert.deepEqual(gradeDariMatriks(3, 1), { skor: 3, grade: "hijau" });
  assert.deepEqual(gradeDariMatriks(3, 3), { skor: 9, grade: "kuning" });
  assert.deepEqual(gradeDariMatriks(4, 1), { skor: 4, grade: "kuning" });
  assert.deepEqual(gradeDariMatriks(4, 3), { skor: 12, grade: "merah" });
  assert.deepEqual(gradeDariMatriks(5, 1), { skor: 5, grade: "merah" });
  assert.deepEqual(gradeDariMatriks("5", "5"), { skor: 25, grade: "merah" });
  assert.throws(() => gradeDariMatriks(0, 3), /dampak/);
  assert.throws(() => gradeDariMatriks(3, 6), /probabilitas/);
  assert.throws(() => gradeDariMatriks(2.5, 3), /dampak/);
});

test("grading memakai matriks faskes bila diatur", () => {
  const m = MATRIKS_BAWAAN.map((b) => b.map(() => "merah"));
  assert.equal(gradeDariMatriks(1, 1, m).grade, "merah");
});

test("validasi matriks 5×5 & tenggat investigasi", () => {
  assert.deepEqual(validasiMatriks(MATRIKS_BAWAAN), MATRIKS_BAWAAN);
  assert.throws(() => validasiMatriks([["biru"]]), /5 × 5/);
  assert.throws(() => validasiMatriks(MATRIKS_BAWAAN.map((b, i) => (i ? b : ["ungu", ...b.slice(1)]))), /Isi matriks/);
  assert.deepEqual(validasiTenggatInvestigasi({ biru: 7, hijau: "14", kuning: 45, merah: 45, sentinel: 30 }), { biru: 7, hijau: 14, kuning: 45, merah: 45, sentinel: 30 });
  assert.throws(() => validasiTenggatInvestigasi({ biru: 0, hijau: 14, kuning: 45, merah: 45, sentinel: 45 }), /biru/);
});

test("RCA wajib untuk kuning/merah & sentinel; selain itu investigasi sederhana", () => {
  assert.equal(jenisInvestigasiUntuk("knc", "biru"), "sederhana");
  assert.equal(jenisInvestigasiUntuk("ktd", "hijau"), "sederhana");
  assert.equal(jenisInvestigasiUntuk("ktd", "kuning"), "rca");
  assert.equal(jenisInvestigasiUntuk("kpc", "merah"), "rca");
  assert.equal(jenisInvestigasiUntuk("sentinel", "biru"), "rca");
  assert.equal(perluRca("sentinel", null), true);
});

test("batas laporan 2 × 24 jam sejak insiden diketahui", () => {
  const diketahui = wib(2026, 10, 1, 8, 0);
  assert.equal(batasLapor(diketahui), diketahui + 48 * 3600);
  assert.equal(terlambatLapor(diketahui, diketahui + 48 * 3600), false);
  assert.equal(terlambatLapor(diketahui, diketahui + 48 * 3600 + 1), true);
  assert.equal(terlambatLapor(diketahui, diketahui + 25 * 3600, 24), true);
  assert.equal(jamPelaporan(diketahui, diketahui + 5400), 1.5);
});

test("batas investigasi menurut grade & sentinel", () => {
  const n = wib(2026, 10, 1, 10);
  assert.equal(batasInvestigasi(n, "knc", "biru"), n + 7 * HARI);
  assert.equal(batasInvestigasi(n, "knc", "hijau"), n + 14 * HARI);
  assert.equal(batasInvestigasi(n, "ktd", "merah"), n + 45 * HARI);
  assert.equal(batasInvestigasi(n, "sentinel", "biru", { ...TENGGAT_INVESTIGASI_BAWAAN, sentinel: 30 }), n + 30 * HARI);
});

test("status tenggat: tepat waktu, mendekati, terlambat, selesai", () => {
  const n = wib(2026, 10, 10, 12);
  assert.equal(statusTenggat(null, false, n), null);
  assert.equal(statusTenggat(n + 5 * HARI, false, n), "tepat_waktu");
  assert.equal(statusTenggat(n + HARI, false, n), "mendekati");
  assert.equal(statusTenggat(n - 1, false, n), "terlambat");
  assert.equal(statusTenggat(n - 1, true, n), "selesai");
});

test("tindak lanjut terlambat setelah hari tenggat (WIB) lewat dan belum selesai", () => {
  const tenggat = wib(2026, 10, 10, 0);
  assert.equal(tindakLanjutTerlambat({ status: "berjalan", tenggat }, wib(2026, 10, 10, 23, 59)), false);
  assert.equal(tindakLanjutTerlambat({ status: "berjalan", tenggat }, wib(2026, 10, 11, 0, 1)), true);
  assert.equal(tindakLanjutTerlambat({ status: "selesai", tenggat }, wib(2026, 10, 20)), false);
  assert.equal(tindakLanjutTerlambat({ status: "terverifikasi", tenggat }, wib(2026, 10, 20)), false);
});

test("syarat penutupan laporan", () => {
  const hijau = { jenis_insiden: "knc", grade: "hijau" };
  const merah = { jenis_insiden: "ktd", grade: "merah" };
  assert.deepEqual(syaratTutup({ laporan: { jenis_insiden: "knc" } }).slice(0, 2), ["Laporan belum digrading", "Investigasi belum dicatat"]);
  assert.match(syaratTutup({ laporan: hijau, investigasi: { status: "berjalan" }, alasan: "x" }).join(), /belum diselesaikan/);
  assert.deepEqual(syaratTutup({ laporan: hijau, investigasi: { status: "selesai" }, alasan: "Cukup edukasi" }), []);
  assert.match(syaratTutup({ laporan: hijau, investigasi: { status: "selesai" } }).join(), /Alasan penutupan/);
  assert.match(syaratTutup({ laporan: merah, investigasi: { status: "selesai" }, alasan: "x" }).join(), /RCA wajib/);
  assert.match(syaratTutup({ laporan: merah, investigasi: { status: "selesai" }, tindakLanjut: [{ status: "selesai" }] }).join(), /1 tindak lanjut belum terverifikasi/);
  assert.deepEqual(syaratTutup({ laporan: merah, investigasi: { status: "selesai" }, tindakLanjut: [{ status: "terverifikasi" }] }), []);
});

test("identitas pelapor anonim tidak dikembalikan; pemilik dikenali lewat milik_saya", () => {
  const row = { uuid: "1", anonim: true, dibuat_oleh: "perawat.uji", pelapor_nama: null, kronologi: "x" };
  const peninjau = amankanPelapor(row, "kepala.unit");
  assert.equal(peninjau.dibuat_oleh, null);
  assert.equal(peninjau.milik_saya, false);
  const pemilik = amankanPelapor(row, "perawat.uji");
  assert.equal(pemilik.dibuat_oleh, null);
  assert.equal(pemilik.milik_saya, true);
  const terbuka = amankanPelapor({ ...row, anonim: false, pelapor_nama: "Perawat Uji" }, "kepala.unit");
  assert.equal(terbuka.dibuat_oleh, "perawat.uji");
  assert.equal(terbuka.pelapor_nama, "Perawat Uji");
});

test("rujukan pasien hanya untuk pemegang LIHAT PASIEN", () => {
  const row = { patient_uuid: "p1", no_reg: "RJ-1", pasien_no_rm: "RM-9", pasien_nama: "B. S." };
  const tanpa = amankanPasien(row, false);
  assert.equal(tanpa.terkait_pasien, true);
  assert.equal(tanpa.patient_uuid, null);
  assert.equal(tanpa.no_reg, null);
  assert.equal(tanpa.pasien_no_rm, null);
  assert.deepEqual(amankanPasien(row, true), { ...row, terkait_pasien: true });
  assert.equal(inisial("budi  santoso"), "B. S.");
  assert.equal(inisial(""), null);
});

test("median & tren bulanan", () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  const tren = susunTren(
    [
      { bulan: "2026-09", kunci: "knc", jumlah: 2 },
      { bulan: "2026-10", kunci: "ktd", jumlah: 1 },
      { bulan: "2026-10", kunci: "knc", jumlah: "3" },
    ],
    ["2026-09", "2026-10"],
    ["ktd", "knc"],
  );
  assert.deepEqual(tren, [
    { bulan: "2026-09", total: 2, ktd: 0, knc: 2 },
    { bulan: "2026-10", total: 4, ktd: 1, knc: 3 },
  ]);
});

test("izin IKP terpisah dari submodul mutu lain & katalog fitur mutu_ikp", () => {
  const sub = mutuPermission.subModules.find((s) => s.name === "Insiden Keselamatan Pasien");
  assert.ok(sub);
  for (const a of ["LAPOR", "READ", "LIHAT PASIEN", "TERIMA", "GRADING", "INVESTIGASI", "TINDAK LANJUT", "VERIFIKASI", "TUTUP", "DASBOR", "EKSPOR", "PENGATURAN"]) assert.ok(sub.allows.includes(a), a);
  assert.deepEqual(mutuPermission.subModules.find((s) => s.name === "Register Risiko").allows, ["READ", "CREATE", "UPDATE", "DELETE"]);
  const fitur = katalog.fitur.find((f) => f.kode === "mutu_ikp");
  assert.equal(fitur.modul, "mutu");
  assert.deepEqual(fitur.rute, ["/mutu/ikp"]);
  assert.equal(fitur.wajib, false);
});
