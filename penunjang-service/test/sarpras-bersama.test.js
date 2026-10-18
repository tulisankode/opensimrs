import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FREKUENSI,
  HASIL_KALIBRASI,
  KATEGORI_ASET,
  PRIORITAS,
  STATUS_ASET,
  STATUS_LAPORAN,
  angkaOpsional,
  awalHariWib,
  cekPilihan,
  epochOpsional,
  pelaksanaanTerlambat,
  periode,
  statusJadwal,
  statusKalibrasi,
  tanggalBerikutnya,
  teks,
  transisiAsetSah,
  transisiLaporanSah,
  validasiBerkas,
  validasiChecklist,
  validasiChecklistHasil,
  wajibPilihan,
  waktuRespons,
} from "../src/sarpras/bersama.js";
import { sarprasPermission } from "../../auth-service/src/helpers/permission-list.js";

// Epoch detik untuk tanggal/jam WIB (UTC+7).
const wib = (y, m, d, jam = 0, menit = 0) => Date.UTC(y, m - 1, d, jam - 7, menit) / 1000;

test("cekPilihan/wajibPilihan: enum kategori, status, prioritas, frekuensi, hasil kalibrasi", () => {
  assert.equal(wajibPilihan("alat_medis", KATEGORI_ASET, "kategori"), "alat_medis");
  assert.throws(() => wajibPilihan("komputer", KATEGORI_ASET, "kategori"), /kategori harus salah satu/);
  assert.throws(() => wajibPilihan(undefined, PRIORITAS, "prioritas"), /prioritas wajib diisi/);
  assert.throws(() => wajibPilihan(["darurat"], PRIORITAS, "prioritas"), /harus salah satu/);
  assert.equal(cekPilihan(undefined, STATUS_ASET, "status"), undefined);
  assert.equal(cekPilihan("", STATUS_ASET, "status"), null);
  assert.equal(cekPilihan("menunggu_suku_cadang", STATUS_LAPORAN, "status"), "menunggu_suku_cadang");
  assert.equal(cekPilihan("tahunan", FREKUENSI, "frekuensi"), "tahunan");
  assert.throws(() => cekPilihan("triwulan", FREKUENSI, "frekuensi"), /frekuensi harus salah satu/);
  assert.equal(cekPilihan("perlu_tindak_lanjut", HASIL_KALIBRASI, "hasil"), "perlu_tindak_lanjut");
  // "toString" bukan anggota enum walau ada di prototipe objek.
  assert.throws(() => cekPilihan("toString", HASIL_KALIBRASI, "hasil"), /harus salah satu/);
});

test("teks, angka, epoch, periode: validasi masukan → galat 400", () => {
  assert.equal(teks("  ALK-001 ", "kode", 10), "ALK-001");
  assert.equal(teks("   ", "kode"), null);
  assert.throws(() => teks("x".repeat(11), "kode", 10), /maksimal 10/);
  assert.throws(() => teks({ a: 1 }, "kode"), /harus berupa teks/);
  assert.equal(angkaOpsional("1500000,5", "nilai"), 1500000.5);
  assert.throws(() => angkaOpsional(-1, "nilai"), /di antara/);
  assert.throws(() => angkaOpsional("abc", "nilai"), /harus berupa angka/);
  assert.equal(epochOpsional("1760000000", "waktu"), 1760000000);
  assert.throws(() => epochOpsional(1760000000000, "waktu"), /di antara/);
  assert.throws(() => epochOpsional(1.5, "waktu"), /epoch detik/);
  assert.deepEqual(periode({}), { mulai: null, selesai: null });
  assert.throws(() => periode({}, true), /wajib diisi/);
  assert.throws(() => periode({ tanggal_mulai: 20, tanggal_selesai: 10 }), /Rentang tanggal tidak valid/);
  try {
    wajibPilihan("x", PRIORITAS, "prioritas");
  } catch (e) {
    assert.equal(e.status, 400);
  }
});

test("transisi work order: baru → diproses ⇄ menunggu suku cadang → selesai/tidak dapat diperbaiki; status final terkunci", () => {
  assert.equal(transisiLaporanSah("baru", "diproses"), true);
  assert.equal(transisiLaporanSah("baru", "selesai"), false);
  assert.equal(transisiLaporanSah("baru", "menunggu_suku_cadang"), false);
  assert.equal(transisiLaporanSah("diproses", "menunggu_suku_cadang"), true);
  assert.equal(transisiLaporanSah("menunggu_suku_cadang", "diproses"), true);
  assert.equal(transisiLaporanSah("diproses", "selesai"), true);
  assert.equal(transisiLaporanSah("menunggu_suku_cadang", "tidak_dapat_diperbaiki"), true);
  assert.equal(transisiLaporanSah("diproses", "diproses"), false);
  assert.equal(transisiLaporanSah("diproses", "baru"), false);
  for (const ke of Object.keys(STATUS_LAPORAN)) {
    assert.equal(transisiLaporanSah("selesai", ke), false);
    assert.equal(transisiLaporanSah("tidak_dapat_diperbaiki", ke), false);
  }
  assert.equal(transisiLaporanSah("tidak_dikenal", "diproses"), false);
});

test("transisi status aset: dihapuskan final; status sama ditolak", () => {
  assert.equal(transisiAsetSah("aktif", "rusak"), true);
  assert.equal(transisiAsetSah("rusak", "dalam_perbaikan"), true);
  assert.equal(transisiAsetSah("aktif", "dihapuskan"), true);
  assert.equal(transisiAsetSah("aktif", "aktif"), false);
  assert.equal(transisiAsetSah("dihapuskan", "aktif"), false);
});

test("waktuRespons: penugasan − laporan (detik), null bila belum ditugaskan", () => {
  assert.equal(waktuRespons(1000, 1900), 900);
  assert.equal(waktuRespons(1000, null), null);
  assert.equal(waktuRespons(1000, undefined), null);
});

test("awalHariWib: tanggal kalender Asia/Jakarta, bukan UTC/zona server", () => {
  assert.equal(awalHariWib(wib(2026, 10, 18, 0, 0)), wib(2026, 10, 18));
  assert.equal(awalHariWib(wib(2026, 10, 18, 6, 59)), wib(2026, 10, 18)); // 23.59 UTC hari sebelumnya
  assert.equal(awalHariWib(wib(2026, 10, 18, 23, 59)), wib(2026, 10, 18));
  assert.equal(awalHariWib(wib(2026, 10, 19, 0, 0)), wib(2026, 10, 19));
});

test("tanggalBerikutnya: harian/mingguan/bulanan/tahunan dari hari pelaksanaan (WIB), akhir bulan & kabisat", () => {
  assert.equal(tanggalBerikutnya(wib(2026, 10, 18, 15), "harian"), wib(2026, 10, 19));
  assert.equal(tanggalBerikutnya(wib(2026, 10, 18, 15), "mingguan"), wib(2026, 10, 25));
  assert.equal(tanggalBerikutnya(wib(2026, 1, 31, 9), "bulanan"), wib(2026, 2, 28));
  assert.equal(tanggalBerikutnya(wib(2028, 1, 31, 9), "bulanan"), wib(2028, 2, 29));
  assert.equal(tanggalBerikutnya(wib(2026, 12, 15), "bulanan"), wib(2027, 1, 15));
  assert.equal(tanggalBerikutnya(wib(2026, 3, 31), "bulanan"), wib(2026, 4, 30));
  assert.equal(tanggalBerikutnya(wib(2028, 2, 29), "tahunan"), wib(2029, 2, 28));
  assert.equal(tanggalBerikutnya(wib(2026, 10, 18), "tahunan"), wib(2027, 10, 18));
  // 01.00 WIB = 18.00 UTC hari sebelumnya: tetap dihitung dari tanggal WIB.
  assert.equal(tanggalBerikutnya(wib(2026, 10, 1, 1), "bulanan"), wib(2026, 11, 1));
  assert.throws(() => tanggalBerikutnya(wib(2026, 10, 1), "triwulan"), /frekuensi tidak valid/);
});

test("statusJadwal & pelaksanaanTerlambat: terlambat setelah hari jatuh tempo lewat (WIB)", () => {
  const jt = wib(2026, 10, 18);
  assert.equal(statusJadwal(jt, wib(2026, 10, 17, 23, 59)), "terjadwal");
  assert.equal(statusJadwal(jt, wib(2026, 10, 18, 0, 1)), "jatuh_tempo");
  assert.equal(statusJadwal(jt, wib(2026, 10, 18, 23, 59)), "jatuh_tempo");
  assert.equal(statusJadwal(jt, wib(2026, 10, 19, 0, 0)), "terlambat");
  assert.equal(pelaksanaanTerlambat(wib(2026, 10, 18, 22), jt), false);
  assert.equal(pelaksanaanTerlambat(wib(2026, 10, 19, 8), jt), true);
  assert.equal(pelaksanaanTerlambat(wib(2026, 10, 10, 8), jt), false);
});

test("statusKalibrasi: berlaku / jatuh tempo dalam ambang (inklusif) / kedaluwarsa setelah hari berlaku lewat", () => {
  const kini = wib(2026, 10, 18, 10);
  assert.equal(statusKalibrasi(wib(2026, 10, 17), 30, kini), "kedaluwarsa");
  assert.equal(statusKalibrasi(wib(2026, 10, 18), 30, kini), "jatuh_tempo");
  assert.equal(statusKalibrasi(wib(2026, 11, 17), 30, kini), "jatuh_tempo");
  assert.equal(statusKalibrasi(wib(2026, 11, 18), 30, kini), "berlaku");
  assert.equal(statusKalibrasi(wib(2026, 11, 18), 31, kini), "jatuh_tempo");
  assert.equal(statusKalibrasi(null, 30, kini), "tanpa_masa_berlaku");
});

test("validasiChecklist & validasiChecklistHasil", () => {
  assert.deepEqual(validasiChecklist([" Cek kabel daya ", { butir: "Uji alarm" }]), ["Cek kabel daya", "Uji alarm"]);
  assert.throws(() => validasiChecklist([]), /minimal 1/);
  assert.throws(() => validasiChecklist("cek"), /daftar butir/);
  assert.throws(() => validasiChecklist(["ok", ""]), /butir 2 wajib diisi/);
  assert.deepEqual(validasiChecklistHasil([{ butir: "Cek kabel", ok: true }]), [{ butir: "Cek kabel", ok: true, catatan: null }]);
  assert.deepEqual(validasiChecklistHasil(undefined), []);
  assert.throws(() => validasiChecklistHasil([{ ok: true }]), /wajib diisi/);
  assert.throws(() => validasiChecklistHasil("x"), /harus berupa daftar/);
});

test("validasiBerkas: tipe dari isi (magic bytes), ukuran maksimum, base64 wajib", () => {
  const pdf = Buffer.from("%PDF-1.4\n%contoh fiktif\n").toString("base64");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]).toString("base64");
  const ok = validasiBerkas({ nama_berkas: "sertifikat.pdf", tipe_mime: "application/pdf", data_base64: pdf }, 5);
  assert.equal(ok.tipe_mime, "application/pdf");
  assert.ok(Buffer.isBuffer(ok.data));
  assert.equal(validasiBerkas({ nama_berkas: "foto.png", tipe_mime: "image/png", data_base64: `data:image/png;base64,${png}` }, 5).ukuran_bita, 10);
  assert.throws(() => validasiBerkas({ nama_berkas: "a.exe", tipe_mime: "application/x-msdownload", data_base64: pdf }, 5), /Tipe berkas/);
  assert.throws(() => validasiBerkas({ nama_berkas: "palsu.pdf", tipe_mime: "application/pdf", data_base64: png }, 5), /tidak sesuai tipe/);
  assert.throws(() => validasiBerkas({ nama_berkas: "x.pdf", tipe_mime: "application/pdf", data_base64: "%%%" }, 5), /base64/);
  assert.throws(() => validasiBerkas({ tipe_mime: "application/pdf", data_base64: pdf }, 5), /nama_berkas wajib/);
  const besar = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(1024 * 1024 + 10)]).toString("base64");
  assert.throws(() => validasiBerkas({ nama_berkas: "besar.pdf", tipe_mime: "application/pdf", data_base64: besar }, 1), /maksimal 1 MB/);
});

test("izin Sarana dan Prasarana memuat submodul & aksi yang dipakai rute", () => {
  assert.equal(sarprasPermission.module, "Sarana dan Prasarana (IPSRS)");
  const aksi = Object.fromEntries(sarprasPermission.subModules.map((s) => [s.name, s.allows]));
  const dipakai = {
    Aset: ["READ", "CREATE", "UPDATE", "PINDAH LOKASI", "UBAH STATUS", "CETAK QR"],
    "Laporan Kerusakan": ["READ", "CREATE", "TUGASKAN", "UPDATE STATUS", "TUTUP"],
    "Suku Cadang": ["READ", "CATAT PEMAKAIAN"],
    Pemeliharaan: ["READ", "CREATE JADWAL", "UPDATE JADWAL", "NONAKTIFKAN JADWAL", "CATAT PELAKSANAAN"],
    Kalibrasi: ["READ", "CREATE", "UPDATE JADWAL", "UNGGAH SERTIFIKAT"],
    Berkas: ["READ"],
    Utilitas: ["READ", "CREATE"],
    "Laporan Sarpras": ["READ", "EKSPOR"],
    Pengaturan: ["READ", "UPDATE"],
  };
  for (const [sub, daftar] of Object.entries(dipakai)) for (const a of daftar) assert.ok(aksi[sub]?.includes(a), `${sub} › ${a}`);
});

test("setiap rute Sarana & Prasarana memasang middleware izin sebelum handler; /sarpras terdaftar di rute.js", async () => {
  const { default: rute } = await import("../src/rute.js");
  assert.ok(rute.stack.find((l) => l.regexp?.test("/sarpras/aset")), "/sarpras belum terdaftar di penunjang-service/src/rute.js");
  const daftar = [];
  for (const nama of ["aset", "laporan-kerusakan", "pemeliharaan", "kalibrasi", "utilitas", "laporan", "rute"]) {
    const { default: r } = await import(`../src/sarpras/${nama}.js`);
    for (const l of r.stack.filter((x) => x.route)) daftar.push([`${nama} ${Object.keys(l.route.methods).join(",")} ${l.route.path}`, l.route.stack.length]);
  }
  assert.ok(daftar.length >= 35, `rute sarpras terlalu sedikit (${daftar.length})`);
  for (const [nama, jumlah] of daftar) assert.ok(jumlah >= 2, `${nama} tanpa middleware izin`);
});
