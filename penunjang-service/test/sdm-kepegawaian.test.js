import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JENJANG_PENDIDIKAN,
  STATUS_KEPEGAWAIAN,
  kolomBerubah,
  riwayatAwal,
  ringkasanUbah,
  susunPerubahan,
  validasiKepegawaianBaru,
  validasiPendidikan,
  validasiPerubahanKepegawaian,
} from "../src/hr/bersama.js";
import { JENIS_KREDENSIAL, STATUS_VERIFIKASI, perluVerifikasiUlang } from "../src/mutu/bersama.js";
import { sdmPermission, mutuPermission, mapPermission } from "../../auth-service/src/helpers/permission-list.js";

// Epoch detik untuk tanggal/jam WIB (UTC+7).
const wib = (y, m, d, jam = 0) => Date.UTC(y, m - 1, d, jam - 7) / 1000;
const pegawai = "019a0000-0000-7000-8000-000000000001";
const lama = {
  uuid: "k1",
  pegawai_uuid: pegawai,
  status_kepegawaian: "kontrak",
  unit_uuid: "u1",
  jabatan: "Perawat Pelaksana",
  golongan: null,
  tanggal_mulai: String(wib(2024, 1, 2)), // BIGINT dari pg berupa string
  tanggal_selesai: null,
};
const terbuka = { uuid: "r1", tanggal_mulai: String(wib(2024, 1, 2)), tanggal_selesai: null };
const ubahan = (b) => validasiPerubahanKepegawaian(b);

test("validasiKepegawaianBaru: wajib pegawai, status sah, TMT epoch → awal hari WIB; selain itu 400", () => {
  const v = validasiKepegawaianBaru({ pegawai_uuid: pegawai, status_kepegawaian: "tetap", tanggal_mulai: wib(2025, 3, 1, 12), jabatan: "  Bidan  ", unit_uuid: "" });
  assert.equal(v.tanggal_mulai, wib(2025, 3, 1));
  assert.equal(v.jabatan, "Bidan");
  assert.equal(v.unit_uuid, null);
  const tolak = (b, pola) => assert.throws(() => validasiKepegawaianBaru(b), (e) => e.status === 400 && pola.test(e.message));
  tolak({ status_kepegawaian: "tetap", tanggal_mulai: wib(2025, 1, 1) }, /pegawai_uuid wajib/);
  tolak({ pegawai_uuid: pegawai, status_kepegawaian: "pns", tanggal_mulai: wib(2025, 1, 1) }, /status_kepegawaian harus salah satu/);
  tolak({ pegawai_uuid: pegawai, status_kepegawaian: "tetap" }, /tanggal_mulai wajib/);
  tolak({ pegawai_uuid: pegawai, status_kepegawaian: "tetap", tanggal_mulai: "" }, /tanggal_mulai wajib/);
  tolak({ pegawai_uuid: pegawai, status_kepegawaian: "tetap", tanggal_mulai: "abc" }, /harus berupa angka/);
  tolak({ pegawai_uuid: pegawai, status_kepegawaian: "tetap", tanggal_mulai: wib(2025, 1, 1), jabatan: "x".repeat(151) }, /jabatan maksimal 150/);
  assert.ok(STATUS_KEPEGAWAIAN.tetap && JENJANG_PENDIDIKAN.s1);
});

test("perubahan jabatan bertanggal berlaku: potret lama ditutup, potret baru lengkap (KT-2)", () => {
  const berlaku = wib(2025, 7, 1);
  const r = susunPerubahan(lama, terbuka, ubahan({ jabatan: "Kepala Ruangan", golongan: "III/a", status_kepegawaian: "kontrak", tanggal_berlaku: berlaku, nomor_sk: "SK-001" }));
  assert.deepEqual(r.kolom, ["jabatan", "golongan"]);
  assert.deepEqual(r.ubah, { jabatan: "Kepala Ruangan", golongan: "III/a" });
  assert.equal(r.tutupRiwayat, berlaku);
  assert.deepEqual(r.riwayatBaru, {
    status_kepegawaian: "kontrak",
    unit_uuid: "u1",
    jabatan: "Kepala Ruangan",
    golongan: "III/a",
    tanggal_mulai: berlaku,
    jenis_perubahan: "jabatan, golongan",
    nomor_sk: "SK-001",
    catatan: null,
  });
});

test("perubahan ditolak: tanpa tanggal berlaku, mundur sebelum riwayat terakhir, tanpa perubahan, atau sudah berakhir", () => {
  const tolak = (l, t, b, status, pola) => assert.throws(() => susunPerubahan(l, t, ubahan(b)), (e) => e.status === status && pola.test(e.message));
  tolak(lama, terbuka, { jabatan: "Kepala Ruangan" }, 400, /tanggal_berlaku wajib/);
  tolak(lama, terbuka, { jabatan: "Kepala Ruangan", tanggal_berlaku: wib(2023, 12, 31) }, 400, /tidak boleh sebelum/);
  tolak(lama, { ...terbuka, tanggal_mulai: String(wib(2025, 7, 1)) }, { golongan: "III/b", tanggal_berlaku: wib(2025, 6, 30) }, 400, /tidak boleh sebelum/);
  tolak(lama, terbuka, { jabatan: "Perawat Pelaksana", tanggal_berlaku: wib(2025, 1, 1) }, 400, /Tidak ada perubahan/);
  tolak({ ...lama, tanggal_selesai: String(wib(2025, 1, 1)) }, null, { jabatan: "X", tanggal_berlaku: wib(2025, 2, 1) }, 409, /sudah berakhir/);
  assert.throws(() => ubahan({ tanggal_mulai: wib(2025, 1, 1) }), (e) => e.status === 400);
  assert.throws(() => ubahan({ pegawai_uuid: "lain" }), (e) => e.status === 400);
  assert.throws(() => ubahan({ status_kepegawaian: null }), (e) => e.status === 400);
});

test("akhiri kepegawaian menutup potret terbuka; aktif kembali membuat potret baru", () => {
  const selesai = wib(2026, 1, 31);
  const akhir = susunPerubahan(lama, terbuka, ubahan({ tanggal_selesai: selesai }));
  assert.deepEqual(akhir.ubah, { tanggal_selesai: selesai });
  assert.equal(akhir.tutupRiwayat, selesai);
  assert.equal(akhir.riwayatBaru, null);
  assert.throws(() => susunPerubahan(lama, terbuka, ubahan({ tanggal_selesai: selesai, jabatan: "Lain" })), (e) => e.status === 400);
  assert.throws(() => susunPerubahan(lama, terbuka, ubahan({ tanggal_selesai: wib(2023, 1, 1) })), (e) => e.status === 400);

  const berakhir = { ...lama, tanggal_selesai: String(selesai) };
  const aktif = susunPerubahan(berakhir, null, ubahan({ tanggal_selesai: null, tanggal_berlaku: wib(2026, 3, 1), status_kepegawaian: "tetap" }));
  assert.equal(aktif.ubah.tanggal_selesai, null);
  assert.equal(aktif.ubah.status_kepegawaian, "tetap");
  assert.equal(aktif.tutupRiwayat, null);
  assert.equal(aktif.riwayatBaru.jenis_perubahan, "aktif_kembali, status_kepegawaian");
  assert.throws(() => susunPerubahan(berakhir, null, ubahan({ tanggal_selesai: null })), (e) => e.status === 400);
  assert.throws(() => susunPerubahan(berakhir, null, ubahan({ tanggal_selesai: null, tanggal_berlaku: wib(2026, 1, 1) })), (e) => e.status === 400);
});

test("riwayatAwal, kolomBerubah & ringkasan audit tidak memuat data pribadi", () => {
  const awal = riwayatAwal({ ...validasiKepegawaianBaru({ pegawai_uuid: pegawai, status_kepegawaian: "magang", tanggal_mulai: wib(2025, 1, 1) }) });
  assert.equal(awal.jenis_perubahan, "awal");
  assert.equal(awal.jabatan, null);
  assert.deepEqual(kolomBerubah(lama, { unit_uuid: "u1", jabatan: null }), ["jabatan"]);
  assert.deepEqual(ringkasanUbah(lama, { jabatan: "Kepala" }), { jabatan: { lama: "Perawat Pelaksana", baru: "Kepala" } });
});

test("validasiPendidikan: jenjang & institusi wajib, tahun lulus wajar, parsial untuk ubah", () => {
  assert.deepEqual(validasiPendidikan({ jenjang: "s1", institusi: "Universitas Contoh", tahun_lulus: "2015" }), {
    jenjang: "s1",
    institusi: "Universitas Contoh",
    bidang_studi: null,
    tahun_lulus: 2015,
  });
  assert.throws(() => validasiPendidikan({ jenjang: "s9", institusi: "X" }), (e) => e.status === 400);
  assert.throws(() => validasiPendidikan({ jenjang: "s1" }), (e) => e.status === 400 && /institusi wajib/.test(e.message));
  assert.throws(() => validasiPendidikan({ jenjang: "s1", institusi: "X", tahun_lulus: 1900 }), (e) => e.status === 400);
  assert.throws(() => validasiPendidikan({ jenjang: "s1", institusi: "X", tahun_lulus: "20a5" }), (e) => e.status === 400);
  assert.deepEqual(
    Object.fromEntries(Object.entries(validasiPendidikan({ bidang_studi: "Keperawatan" }, { parsial: true })).filter(([, v]) => v !== undefined)),
    { bidang_studi: "Keperawatan" },
  );
});

test("kredensial satu sumber: jenis gabungan Mutu+SDM, verifikasi ulang bila data inti berubah", () => {
  for (const j of ["str", "sip", "sertifikat", "sertifikat_kompetensi", "rkk", "spk", "lainnya"]) assert.ok(JENIS_KREDENSIAL[j], j);
  assert.deepEqual(Object.keys(STATUS_VERIFIKASI), ["belum_diverifikasi", "terverifikasi", "ditolak"]);
  const k = { jenis: "sip", nomor: "SIP-1", penerbit: null, tanggal_mulai: "1735664400", tanggal_berakhir: null, practitioner_uuid: null };
  assert.equal(perluVerifikasiUlang(k, { nomor: "SIP-1", tanggal_mulai: 1735664400, uraian: "catatan" }), false);
  assert.equal(perluVerifikasiUlang(k, { nomor: "SIP-2" }), true);
  assert.equal(perluVerifikasiUlang(k, { penerbit: "Dinas Kesehatan" }), true);
  assert.equal(perluVerifikasiUlang(k, { practitioner_uuid: undefined }), false);
});

test("izin HR / SDM hanya berisi fitur yang ada; Mutu Kredensial Staf punya VERIFIKASI", () => {
  assert.deepEqual(sdmPermission.subModules.map((s) => s.name), ["Kepegawaian", "Kredensial"]);
  assert.deepEqual(sdmPermission.subModules[0].allows, ["READ", "CREATE", "UPDATE", "DELETE", "TAUTKAN AKUN"]);
  for (const a of ["READ", "CREATE", "UPDATE", "UNGGAH DOKUMEN", "VERIFIKASI", "CABUT", "DELETE"]) assert.ok(sdmPermission.subModules[1].allows.includes(a), a);
  assert.ok(mutuPermission.subModules.find((s) => s.name === "Kredensial Staf").allows.includes("VERIFIKASI"));
  assert.deepEqual(mapPermission(["hr / sdm"]).map((m) => m.module), ["HR / SDM"]);
});

test("router HR / SDM dapat dimuat tanpa koneksi basis data", async () => {
  const modul = await import("../src/hr/rute.js");
  assert.ok(modul.default);
});
