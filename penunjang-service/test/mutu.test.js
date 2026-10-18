import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JENIS_DOKUMEN,
  STATUS_DOKUMEN,
  barisImpor,
  batasMasaBerlaku,
  daftarUuid,
  perluTinjau,
  persen,
  petakanGalatPg,
  saringMasaBerlaku,
  sisaHari,
  statusMasaBerlaku,
  susunKesiapan,
  transisiDokumenSah,
  uraiCsv,
  validasiBerkasMutu,
  validasiHierarkiImpor,
  versiBerikutnya,
  wajibPilihan,
  TIPE_BERKAS_DOKUMEN,
  TIPE_BERKAS_KREDENSIAL,
} from "../src/mutu/bersama.js";
import { mutuPermission, mapPermission } from "../../auth-service/src/helpers/permission-list.js";

// Epoch detik untuk tanggal/jam WIB (UTC+7).
const wib = (y, m, d, jam = 0, menit = 0) => Date.UTC(y, m - 1, d, jam - 7, menit) / 1000;
const HARI = 86400;

test("statusMasaBerlaku: batas 90/30 hari & kedaluwarsa dihitung per hari WIB", () => {
  const sekarang = wib(2026, 10, 18, 9);
  const hariIni = wib(2026, 10, 18);
  assert.equal(statusMasaBerlaku(null, sekarang), "aktif");
  assert.equal(statusMasaBerlaku(hariIni + 91 * HARI, sekarang), "aktif");
  assert.equal(statusMasaBerlaku(hariIni + 90 * HARI, sekarang), "peringatan_90");
  assert.equal(statusMasaBerlaku(hariIni + 31 * HARI, sekarang), "peringatan_90");
  assert.equal(statusMasaBerlaku(hariIni + 30 * HARI, sekarang), "peringatan_30");
  // Berlaku sampai akhir hari tanggal_berakhir: hari ini masih berlaku (peringatan 30), kemarin sudah kedaluwarsa.
  assert.equal(statusMasaBerlaku(hariIni, sekarang), "peringatan_30");
  assert.equal(statusMasaBerlaku(hariIni - HARI, sekarang), "kedaluwarsa");
  // 23.30 WIB masih hari yang sama walau UTC sudah berganti tanggal dibanding 06.30 WIB.
  assert.equal(statusMasaBerlaku(hariIni, wib(2026, 10, 18, 23, 30)), "peringatan_30");
  assert.equal(statusMasaBerlaku(hariIni, wib(2026, 10, 19, 0, 1)), "kedaluwarsa");
  assert.equal(sisaHari(hariIni + 5 * HARI + 3600, sekarang), 5);
  assert.equal(sisaHari(hariIni - 2 * HARI, sekarang), -2);
  assert.equal(sisaHari(null, sekarang), null);
});

test("saringMasaBerlaku: SQL & batas sesuai statusMasaBerlaku; nilai lain → 400", () => {
  const sekarang = wib(2026, 10, 18, 9);
  const { hariIni, batas30, batas90 } = batasMasaBerlaku(sekarang);
  assert.equal(hariIni, wib(2026, 10, 18));
  assert.deepEqual(saringMasaBerlaku("kedaluwarsa", "k.t", 3, sekarang), { sql: "k.t < $3", params: [hariIni] });
  assert.deepEqual(saringMasaBerlaku("peringatan_30", "k.t", 2, sekarang), { sql: "k.t BETWEEN $2 AND $3", params: [hariIni, batas30] });
  assert.deepEqual(saringMasaBerlaku("peringatan_90", "k.t", 2, sekarang), { sql: "k.t > $2 AND k.t <= $3", params: [batas30, batas90] });
  assert.deepEqual(saringMasaBerlaku("aktif", "k.t", 4, sekarang), { sql: "(k.t IS NULL OR k.t > $4)", params: [batas90] });
  assert.throws(() => saringMasaBerlaku("lain", "k.t", 1), (e) => e.status === 400);
});

test("perluTinjau hanya untuk dokumen disahkan yang tanggal tinjaunya tiba (tanpa mengubah status)", () => {
  const sekarang = wib(2026, 10, 18, 10);
  const hariIni = wib(2026, 10, 18);
  assert.equal(perluTinjau({ status: "disahkan", tanggal_tinjau_ulang: hariIni }, sekarang), true);
  assert.equal(perluTinjau({ status: "disahkan", tanggal_tinjau_ulang: hariIni - HARI }, sekarang), true);
  assert.equal(perluTinjau({ status: "disahkan", tanggal_tinjau_ulang: hariIni + HARI }, sekarang), false);
  assert.equal(perluTinjau({ status: "disahkan", tanggal_tinjau_ulang: null }, sekarang), false);
  assert.equal(perluTinjau({ status: "draf", tanggal_tinjau_ulang: hariIni }, sekarang), false);
  assert.equal(perluTinjau({ status: "dicabut", tanggal_tinjau_ulang: hariIni }, sekarang), false);
});

test("transisi status dokumen manual: draf→disahkan→kedaluwarsa/dicabut, dicabut final", () => {
  assert.equal(transisiDokumenSah("draf", "disahkan"), true);
  assert.equal(transisiDokumenSah("draf", "dicabut"), true);
  assert.equal(transisiDokumenSah("draf", "kedaluwarsa"), false);
  assert.equal(transisiDokumenSah("disahkan", "kedaluwarsa"), true);
  assert.equal(transisiDokumenSah("disahkan", "draf"), false);
  assert.equal(transisiDokumenSah("kedaluwarsa", "disahkan"), false);
  assert.equal(transisiDokumenSah("dicabut", "disahkan"), false);
  assert.deepEqual(Object.keys(STATUS_DOKUMEN), ["draf", "disahkan", "kedaluwarsa", "dicabut"]);
});

test("versiBerikutnya menaikkan versi numerik; versi non-angka wajib diisi pengguna", () => {
  assert.equal(versiBerikutnya("1"), "2");
  assert.equal(versiBerikutnya("09"), "10");
  assert.equal(versiBerikutnya("1.4"), "1.5");
  assert.equal(versiBerikutnya("Rev A"), null);
});

test("susunKesiapan: persentase kelengkapan per instrumen, bab, standar dihitung dari elemen", () => {
  const dasar = { instrumen_uuid: "i1", instrumen_kode: "INS", instrumen_nama: "Instrumen Contoh" };
  const baris = [
    { ...dasar, bab_uuid: "b1", bab_kode: "B1", bab_nama: "Bab 1", standar_uuid: "s1", standar_kode: "S1", standar_nama: "S 1", elemen_uuid: "e1", ada_bukti: true },
    { ...dasar, bab_uuid: "b1", bab_kode: "B1", bab_nama: "Bab 1", standar_uuid: "s1", standar_kode: "S1", standar_nama: "S 1", elemen_uuid: "e2", ada_bukti: false },
    { ...dasar, bab_uuid: "b1", bab_kode: "B1", bab_nama: "Bab 1", standar_uuid: "s2", standar_kode: "S2", standar_nama: "S 2", elemen_uuid: "e3", ada_bukti: true },
    { ...dasar, bab_uuid: "b2", bab_kode: "B2", bab_nama: "Bab 2", standar_uuid: "s3", standar_kode: "S3", standar_nama: "S 3", elemen_uuid: null, ada_bukti: false },
    { instrumen_uuid: "i2", instrumen_kode: null, instrumen_nama: "Kosong", bab_uuid: null },
  ];
  const [i1, i2] = susunKesiapan(baris);
  assert.equal(i1.total_elemen, 3);
  assert.equal(i1.elemen_terbukti, 2);
  assert.equal(i1.persen, 66.7);
  assert.equal(i1.bab[0].persen, 66.7);
  assert.deepEqual(i1.bab[0].standar.map((s) => [s.kode, s.persen]), [["S1", 50], ["S2", 100]]);
  // Bab/standar tanpa elemen: total 0, persen null (bukan 0% atau NaN).
  assert.equal(i1.bab[1].total_elemen, 0);
  assert.equal(i1.bab[1].persen, null);
  assert.equal(i1.bab[1].standar[0].persen, null);
  assert.equal(i2.total_elemen, 0);
  assert.equal(i2.persen, null);
  assert.equal(persen(1, 3), 33.3);
  assert.equal(persen(0, 0), null);
});

test("impor CSV: pemisah koma/titik koma, kutip, kolom wajib, dan validasi hierarki per baris", () => {
  assert.deepEqual(uraiCsv('a,b\n"x, y","say ""hai"""\r\n\n'), [["a", "b"], ["x, y", 'say "hai"']]);
  assert.deepEqual(uraiCsv("a;b\n1;2"), [["a", "b"], ["1", "2"]]);
  const csv = [
    "bab_kode,bab_nama,standar_kode,standar_nama,elemen_kode,elemen_uraian",
    "B1,Bab Satu,S1,Standar Satu,E1,Uraian contoh",
    "B1,Bab Satu,,,E2,Elemen tanpa standar",
    ",,S2,Standar Dua,E3,Elemen tanpa bab",
  ].join("\n");
  const baris = barisImpor(csv);
  assert.equal(baris.length, 3);
  assert.equal(baris[0].elemen_uraian, "Uraian contoh");
  const ditolak = validasiHierarkiImpor(baris);
  assert.deepEqual(ditolak.map((d) => d.baris), [3, 4]);
  assert.match(ditolak[0].alasan, /standar induk/);
  assert.match(ditolak[1].alasan, /bab induk/);
  assert.throws(() => barisImpor("bab_kode,bab_nama\nB1,Bab"), /Kolom CSV wajib tidak ditemukan: standar_kode/);
  assert.throws(() => barisImpor("bab_kode,bab_nama,standar_kode,standar_nama,elemen_kode,elemen_uraian"), /kosong/);
});

test("validasiBerkasMutu: dokumen PDF saja, kredensial PDF/JPG/PNG, isi & ukuran diperiksa", () => {
  const pdf = { nama_berkas: "spo-contoh.pdf", tipe_mime: "application/pdf", data_base64: Buffer.from("%PDF-1.4 contoh").toString("base64") };
  const png = { nama_berkas: "str.png", tipe_mime: "image/png", data_base64: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]).toString("base64") };
  assert.equal(validasiBerkasMutu(pdf, 1, TIPE_BERKAS_DOKUMEN).ukuran_bita, 15);
  assert.equal(validasiBerkasMutu(png, 1, TIPE_BERKAS_KREDENSIAL).tipe_mime, "image/png");
  assert.throws(() => validasiBerkasMutu(png, 1, TIPE_BERKAS_DOKUMEN), /Tipe berkas harus PDF/);
  assert.throws(() => validasiBerkasMutu({ ...pdf, data_base64: Buffer.from("bukan pdf").toString("base64") }, 1, TIPE_BERKAS_DOKUMEN), /Isi berkas tidak sesuai/);
  assert.throws(() => validasiBerkasMutu({ ...pdf, data_base64: Buffer.alloc(1024 * 1024 + 10, 0x25).toString("base64") }, 1, TIPE_BERKAS_DOKUMEN), /maksimal 1 MB/);
  assert.throws(() => validasiBerkasMutu(undefined, 1, TIPE_BERKAS_DOKUMEN), (e) => e.status === 400);
});

test("petakanGalatPg & validasi masukan menghasilkan 4xx, bukan 500", () => {
  assert.equal(petakanGalatPg({ code: "23505" }).status, 409);
  assert.equal(petakanGalatPg({ code: "23503" }).status, 400);
  assert.equal(petakanGalatPg({ code: "22P02" }).status, 400);
  const lain = new Error("koneksi");
  assert.equal(petakanGalatPg(lain), lain);
  assert.throws(() => wajibPilihan("lain", JENIS_DOKUMEN, "jenis"), (e) => e.status === 400 && /jenis harus salah satu/.test(e.message));
  assert.deepEqual(daftarUuid(["a", "a", " b "], "elemen_uuid"), ["a", "b"]);
  assert.equal(daftarUuid(undefined, "x"), undefined);
  assert.throws(() => daftarUuid("a", "elemen_uuid"), (e) => e.status === 400);
  assert.throws(() => daftarUuid([1], "elemen_uuid"), (e) => e.status === 400);
});

test("izin Mutu & Akreditasi terdaftar dengan submodul fitur dokumen & kredensial", () => {
  const nama = mutuPermission.subModules.map((s) => s.name);
  assert.deepEqual(nama, ["Dasbor Kesiapan", "Instrumen Akreditasi", "Dokumen Akreditasi", "Kredensial Staf", "Akses Surveior"]);
  assert.deepEqual(mapPermission(["mutu & akreditasi"]).map((m) => m.module), ["Mutu & Akreditasi"]);
  const dokumen = mutuPermission.subModules.find((s) => s.name === "Dokumen Akreditasi").allows;
  for (const aksi of ["READ", "CREATE", "UPDATE", "REVISI", "UBAH STATUS", "TINJAU", "PETAKAN ELEMEN", "BAGIKAN SURVEIOR", "DELETE"]) assert.ok(dokumen.includes(aksi), aksi);
});

test("router Mutu dapat dimuat tanpa koneksi basis data", async () => {
  const modul = await import("../src/mutu/rute.js");
  assert.ok(modul.default);
});
