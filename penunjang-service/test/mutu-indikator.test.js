import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INM_BAWAAN,
  JENIS_INDIKATOR,
  KODE_OTOMATIS,
  bulanDariEpoch,
  cekProfilIndikator,
  dataDapatDiubah,
  hariDiharapkan,
  hitungCapaian,
  nilaiData,
  parameterOtomatis,
  rekapPeriode,
  rentangBulan,
  ringkasWaktuTunggu,
  statusCapaian,
  tanggalData,
  transisiDataSah,
  triwulanDariBulan,
  uraiBulan,
  uraiPeriode,
  validatorSah,
} from "../src/mutu/indikator-bersama.js";
import { mutuPermission } from "../../auth-service/src/helpers/permission-list.js";
import katalog from "../../database/data/katalog-modul.json" with { type: "json" };

// Epoch detik untuk tanggal/jam WIB (UTC+7).
const wib = (y, m, d, jam = 0, menit = 0) => Date.UTC(y, m - 1, d, jam - 7, menit) / 1000;
const HARI = 86400;

test("hitungCapaian: persen ×100, nilai ×1, pembagi nol aman (null)", () => {
  assert.equal(hitungCapaian(28, 30), 93.33);
  assert.equal(hitungCapaian(30, 30), 100);
  assert.equal(hitungCapaian(0, 30), 0);
  assert.equal(hitungCapaian(5, 0), null);
  assert.equal(hitungCapaian(0, 0), null);
  assert.equal(hitungCapaian("12.5", "50"), 25);
  assert.equal(hitungCapaian(3850, 50, "nilai"), 77);
  assert.equal(hitungCapaian(1, null), null);
  assert.equal(hitungCapaian("abc", 10), null);
});

test("statusCapaian: arah naik/turun, tanpa target, data belum lengkap tidak pernah dinyatakan tercapai", () => {
  assert.equal(statusCapaian(93.33, 100, "naik"), "tidak_tercapai");
  assert.equal(statusCapaian(100, 100, "naik"), "tercapai");
  assert.equal(statusCapaian(4, 5, "turun"), "tercapai");
  assert.equal(statusCapaian(5, 5, "turun"), "tercapai");
  assert.equal(statusCapaian(6, 5, "turun"), "tidak_tercapai");
  assert.equal(statusCapaian(80, null, "naik"), "tanpa_target");
  assert.equal(statusCapaian(null, 80, "naik"), "belum_ada_data");
  assert.equal(statusCapaian(100, 80, "naik", false), "belum_lengkap");
  assert.equal(statusCapaian(10, 80, "naik", false), "belum_lengkap");
});

test("nilaiData: angka ≥ 0, numerator ≤ denominator bila disyaratkan", () => {
  assert.deepEqual(nilaiData(28, 30), { numerator: 28, denominator: 30 });
  assert.deepEqual(nilaiData("2,5", "4"), { numerator: 2.5, denominator: 4 });
  assert.deepEqual(nilaiData(0, 0), { numerator: 0, denominator: 0 });
  assert.throws(() => nilaiData(31, 30), /numerator tidak boleh lebih besar/);
  assert.deepEqual(nilaiData(3850, 50, { numerator_maks_denominator: false }), { numerator: 3850, denominator: 50 });
  assert.throws(() => nilaiData(-1, 30), /numerator harus berupa angka/);
  assert.throws(() => nilaiData(1, undefined), /denominator wajib diisi/);
  assert.throws(() => nilaiData("x", 3), /numerator harus berupa angka/);
});

test("alur validasi: pengumpul → validator, data tervalidasi terkunci, pemisahan tugas", () => {
  assert.ok(transisiDataSah("draf", "diajukan"));
  assert.ok(transisiDataSah("dikembalikan", "diajukan"));
  assert.ok(transisiDataSah("diajukan", "tervalidasi"));
  assert.ok(transisiDataSah("diajukan", "dikembalikan"));
  assert.ok(transisiDataSah("tervalidasi", "draf"));
  assert.ok(!transisiDataSah("draf", "tervalidasi"));
  assert.ok(!transisiDataSah("tervalidasi", "diajukan"));
  assert.ok(!transisiDataSah("dikembalikan", "tervalidasi"));
  assert.ok(dataDapatDiubah("draf") && dataDapatDiubah("dikembalikan"));
  assert.ok(!dataDapatDiubah("diajukan") && !dataDapatDiubah("tervalidasi"));
  const d = { diisi_oleh: "pic.melati", diajukan_oleh: "pic.melati" };
  assert.ok(!validatorSah(d, "pic.melati"));
  assert.ok(validatorSah(d, "komite.mutu"));
  assert.ok(!validatorSah({ diisi_oleh: "a", diajukan_oleh: "b" }, "b"));
  assert.ok(!validatorSah(d, ""));
});

test("tanggal & periode dihitung per hari/bulan Asia/Jakarta", () => {
  // 31 Okt 2026 23.30 WIB = 31 Okt 16.30 UTC → tetap Oktober; 1 Nov 00.30 WIB = 31 Okt 17.30 UTC → November.
  assert.equal(bulanDariEpoch(wib(2026, 10, 31, 23, 30)), "2026-10");
  assert.equal(bulanDariEpoch(wib(2026, 11, 1, 0, 30)), "2026-11");
  assert.equal(tanggalData(wib(2026, 10, 19, 15), "harian"), wib(2026, 10, 19));
  assert.equal(tanggalData(wib(2026, 10, 19, 15), "bulanan"), wib(2026, 10, 1));
  assert.equal(tanggalData(wib(2026, 11, 1, 0, 30), "bulanan"), wib(2026, 11, 1));
  const b = uraiBulan("2026-02");
  assert.equal(b.awal, wib(2026, 2, 1));
  assert.equal(b.akhir, wib(2026, 3, 1));
  assert.equal(uraiBulan("2026-12").akhir, wib(2027, 1, 1));
  assert.throws(() => uraiBulan("2026-13"), /YYYY-MM/);
  const q = uraiPeriode("2026-q4");
  assert.deepEqual(q.bulan, ["2026-10", "2026-11", "2026-12"]);
  assert.equal(q.kode, "2026-Q4");
  assert.equal(q.awal, wib(2026, 10, 1));
  assert.equal(q.akhir, wib(2027, 1, 1));
  assert.throws(() => uraiPeriode("2026-Q5"), /YYYY-MM atau YYYY-Qn/);
  assert.equal(triwulanDariBulan("2026-05"), "2026-Q2");
  assert.deepEqual(rentangBulan("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.throws(() => rentangBulan("2027-01", "2026-12"), /dari > sampai/);
  assert.throws(() => rentangBulan("2024-01", "2027-01"), /maksimal 36/);
});

test("kelengkapan: harian dipotong sampai hari ini, bulanan 1 data per bulan yang sudah dimulai", () => {
  const sekarang = wib(2026, 10, 19, 10);
  assert.equal(hariDiharapkan(uraiPeriode("2026-10"), "harian", sekarang), 19);
  assert.equal(hariDiharapkan(uraiPeriode("2026-09"), "harian", sekarang), 30);
  assert.equal(hariDiharapkan(uraiPeriode("2026-11"), "harian", sekarang), 0);
  assert.equal(hariDiharapkan(uraiPeriode("2026-10"), "bulanan", sekarang), 1);
  assert.equal(hariDiharapkan(uraiPeriode("2026-Q4"), "bulanan", sekarang), 1);
  assert.equal(hariDiharapkan(uraiPeriode("2026-Q3"), "bulanan", sekarang), 3);
});

test("rekapPeriode: Σnum/Σden dari data tervalidasi, status mengikuti kelengkapan", () => {
  const ind = { frekuensi: "bulanan", satuan: "persen", target_nilai: "100", arah: "naik" };
  const sept = uraiPeriode("2026-09");
  const sekarang = wib(2026, 10, 19);
  const r = rekapPeriode([{ numerator: "28", denominator: "30", tanggal: String(wib(2026, 9, 1)) }, { numerator: "10", denominator: "10", tanggal: String(wib(2026, 9, 1)) }], ind, sept, sekarang);
  assert.equal(r.numerator, 38);
  assert.equal(r.denominator, 40);
  assert.equal(r.capaian, 95);
  assert.equal(r.lengkap, true);
  assert.equal(r.status, "tidak_tercapai");
  const kosong = rekapPeriode([], ind, sept, sekarang);
  assert.equal(kosong.capaian, null);
  assert.equal(kosong.status, "belum_ada_data");
  const nol = rekapPeriode([{ numerator: 0, denominator: 0, tanggal: wib(2026, 9, 1) }], ind, sept, sekarang);
  assert.equal(nol.capaian, null);
  // Harian: 2 dari 30 hari terisi → belum lengkap meski capaian 100%.
  const harian = rekapPeriode(
    [{ numerator: 5, denominator: 5, tanggal: wib(2026, 9, 1) }, { numerator: 4, denominator: 4, tanggal: wib(2026, 9, 2) }],
    { ...ind, frekuensi: "harian" },
    sept,
    sekarang,
  );
  assert.equal(harian.capaian, 100);
  assert.equal(harian.terisi, 2);
  assert.equal(harian.diharapkan, 30);
  assert.equal(harian.status, "belum_lengkap");
});

test("hitung otomatis waktu tunggu rawat jalan: ambang menit, cap waktu tidak lengkap dilaporkan", () => {
  const t = wib(2026, 10, 19, 8);
  const r = ringkasWaktuTunggu(
    [
      { tanggal_checkin: t, tanggal_periksa: t + 30 * 60 },
      { tanggal_checkin: t, tanggal_periksa: t + 60 * 60 },
      { tanggal_checkin: t, tanggal_periksa: t + 61 * 60 },
      { tanggal_checkin: t, tanggal_periksa: null },
      { tanggal_checkin: t, tanggal_periksa: t - 60 },
    ],
    60,
  );
  assert.deepEqual(r, { numerator: 2, denominator: 3, tidak_lengkap: 2 });
  assert.deepEqual(parameterOtomatis("waktu_tunggu_rj", {}), { ambang_menit: 60 });
  assert.deepEqual(parameterOtomatis("waktu_tunggu_rj", { ambang_menit: "90", lain: 1 }), { ambang_menit: 90 });
  assert.throws(() => parameterOtomatis("waktu_tunggu_rj", { ambang_menit: 0 }), /Ambang waktu tunggu/);
  assert.throws(() => parameterOtomatis("tidak_ada", {}), /kode_otomatis/);
});

test("cekProfilIndikator: target regulasi wajib acuan, otomatis wajib kode terdaftar", () => {
  assert.doesNotThrow(() => cekProfilIndikator({ satuan: "persen", target_nilai: 80, target_sumber: "faskes", sumber_data: "manual" }));
  assert.throws(() => cekProfilIndikator({ target_sumber: "faskes", target_nilai: null }), /target_nilai wajib/);
  assert.throws(() => cekProfilIndikator({ target_sumber: "regulasi", target_nilai: 80 }), /regulasi_acuan wajib/);
  assert.throws(() => cekProfilIndikator({ sumber_data: "otomatis", kode_otomatis: "karangan" }), /kode_otomatis wajib/);
  assert.throws(() => cekProfilIndikator({ satuan: "persen", target_nilai: 120 }), /maksimal 100/);
  assert.doesNotThrow(() => cekProfilIndikator({ satuan: "nilai", target_nilai: 76.61, target_sumber: "regulasi", regulasi_acuan: "PMK" }));
});

test("set INM bawaan: kode unik, profil lengkap & lolos validasi, sumber otomatis hanya yang terdaftar", () => {
  const kode = INM_BAWAAN.map((i) => i.kode_bawaan);
  assert.equal(new Set(kode).size, kode.length);
  assert.ok(INM_BAWAAN.length >= 12);
  for (const i of INM_BAWAAN) {
    assert.equal(i.jenis, "inm");
    assert.ok(JENIS_INDIKATOR[i.jenis]);
    for (const k of ["judul", "definisi_operasional", "definisi_numerator", "definisi_denominator", "regulasi_acuan"]) assert.ok(i[k], `${i.kode_bawaan}.${k}`);
    assert.doesNotThrow(() => cekProfilIndikator(i), i.kode_bawaan);
    if (i.sumber_data === "otomatis") assert.ok(KODE_OTOMATIS[i.kode_otomatis], i.kode_bawaan);
  }
  assert.equal(INM_BAWAAN.find((i) => i.judul === "Penundaan Operasi Elektif").arah, "turun");
});

test("izin & katalog: submodul Indikator Mutu terpisah, fitur mutu_indikator di modul mutu", () => {
  const sub = mutuPermission.subModules.find((s) => s.name === "Indikator Mutu");
  assert.ok(sub);
  for (const aksi of ["READ", "CREATE", "UPDATE", "DELETE", "INPUT DATA", "VALIDASI", "TINDAK LANJUT", "EKSPOR"]) assert.ok(sub.allows.includes(aksi), aksi);
  for (const lama of ["Dokumen Akreditasi", "Kredensial Staf"]) assert.ok(mutuPermission.subModules.some((s) => s.name === lama), lama);
  const fitur = katalog.fitur.find((f) => f.kode === "mutu_indikator");
  assert.equal(fitur?.modul, "mutu");
  assert.deepEqual(fitur.rute, ["/mutu/indikator"]);
  assert.equal(katalog.modul.filter((m) => m.kode === "mutu").length, 1);
});

test("router Indikator Mutu dapat dimuat tanpa koneksi basis data", async () => {
  for (const berkas of ["indikator.js", "indikator-data.js", "indikator-capaian.js"]) assert.ok((await import(`../src/mutu/${berkas}`)).default, berkas);
});
