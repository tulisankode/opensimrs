// Rencana Kontrol & SPRI (STD-0021): aturan murni — validasi, sidik & keputusan idempotensi, tanggal Asia/Jakarta,
// syarat surat untuk SEP, filter daftar, rekonsiliasi, izin, serta simulasi VClaim untuk rekonsiliasi.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SECRET_KEY = process.env.SECRET_KEY || "kunci-uji";
process.env.BPJS_MODE = "mock";
const s = await import("../src/vclaim-surat.js");
const { cocokIzin } = await import("../src/izin.js");
const { vclaim } = await import("../src/klien-vclaim.js");
const { buatRencanaKontrol, buatSpri, JALUR_SURAT } = await import("../src/vclaim-peta.js");

const HARI_INI = "2026-10-18";
const dasar = {
  idempotencyKey: "kunci-1",
  noKartu: "0001234567891",
  patientUuid: "pasien-1",
  sumber: "rawat_jalan",
  sumberUuid: "kunjungan-1",
  dpjp: "31486",
  poliTujuan: "INT",
  tglRencana: "2026-10-25",
};
const galat = (status, pola) => (e) => e.status === status && (!pola || pola.test(e.message));

test("tanggal lokal Asia/Jakarta: 17.30 UTC = besok WIB", () => {
  assert.equal(s.tanggalLokal(Date.UTC(2026, 9, 17, 17, 30)), "2026-10-18");
  assert.equal(s.tanggalLokal(Date.UTC(2026, 9, 17, 16, 59)), "2026-10-17");
  assert.equal(s.tanggalValid("2026-02-29"), false);
  assert.equal(s.tanggalValid("2028-02-29"), true);
  assert.equal(s.tanggalValid("2026-13-01"), false);
  assert.equal(s.tanggalValid("18-10-2026"), false);
});

test("status pemantauan: surat bertanggal hari ini BUKAN jatuh tempo; kemarin jatuh tempo", () => {
  const b = { status_operasi: "terkonfirmasi", status_pakai: "belum_dipakai" };
  assert.equal(s.statusPemantauan({ ...b, tgl_rencana_teks: HARI_INI }, HARI_INI), "aktif");
  assert.equal(s.statusPemantauan({ ...b, tgl_rencana_teks: "2026-10-17" }, HARI_INI), "jatuh_tempo");
  assert.equal(s.statusPemantauan({ ...b, tgl_rencana_teks: "2026-10-19" }, HARI_INI), "aktif");
  assert.equal(s.statusPemantauan({ ...b, status_pakai: "dipakai", tgl_rencana_teks: "2026-10-01" }, HARI_INI), "digunakan");
  assert.equal(s.statusPemantauan({ ...b, status_operasi: "tidak_pasti" }, HARI_INI), "tidak_pasti");
  assert.equal(s.statusPemantauan({ ...b, deleted_at: 1 }, HARI_INI), "dihapus");
  // objek Date dari driver pg (tengah malam waktu lokal proses) tetap dibaca sebagai tanggal yang sama
  assert.equal(s.teksTanggal(new Date(2026, 9, 18)), HARI_INI);
});

test("validasi buat Rencana Kontrol: normalisasi & aturan wajib", () => {
  const k = s.validasiBuatSurat("rencana_kontrol", { ...dasar, noKartu: " 0001 2345 67891 ", noSepAsal: "0301R0011026V000001" }, HARI_INI);
  assert.equal(k.noKartu, "0001234567891");
  assert.equal(k.noSepAsal, "0301R0011026V000001");
  assert.equal(k.tglRencana, "2026-10-25");
  // tanggal hari ini boleh
  assert.equal(s.validasiBuatSurat("rencana_kontrol", { ...dasar, tglRencana: HARI_INI }, HARI_INI).tglRencana, HARI_INI);

  const tolak = (ubah, pola) => assert.throws(() => s.validasiBuatSurat("rencana_kontrol", { ...dasar, ...ubah }, HARI_INI), galat(400, pola));
  tolak({ noKartu: "123" }, /13 digit/);
  tolak({ noKartu: "000123456789A" }, /13 digit/);
  tolak({ sumber: "" }, /Sumber/);
  tolak({ sumber: "poli" }, /rawat_jalan, rawat_inap, igd/);
  tolak({ dpjp: "" }, /DPJP/);
  tolak({ poliTujuan: "" }, /Poli tujuan/);
  tolak({ patientUuid: "" }, /Pasien/);
  tolak({ idempotencyKey: "" }, /idempotensi/);
  tolak({ idempotencyKey: "x".repeat(101) }, /terlalu panjang/);
  tolak({ tglRencana: "2026-10-17" }, /sebelum hari ini/);
  tolak({ tglRencana: "2026-02-30" }, /YYYY-MM-DD/);
  tolak({ dpjp: "31486; DROP" }, /tidak valid/);
  assert.throws(() => s.validasiBuatSurat("rencana_kontrol", null, HARI_INI), galat(400));
});

test("validasi SPRI: DPJP & sumber wajib, noSepAsal diabaikan", () => {
  const k = s.validasiBuatSurat("spri", { ...dasar, sumber: "igd", noSepAsal: "X1" }, HARI_INI);
  assert.equal(k.noSepAsal, null);
  assert.throws(() => s.validasiBuatSurat("spri", { ...dasar, dpjp: undefined }, HARI_INI), galat(400, /DPJP/));
  assert.throws(() => s.validasiBuatSurat("spri", { ...dasar, sumber: undefined }, HARI_INI), galat(400, /Sumber/));
});

test("validasi ubah: minimal satu perubahan, tanggal tidak boleh lampau", () => {
  assert.deepEqual(s.validasiUbahSurat("spri", { tglRencana: "2026-10-20" }, HARI_INI), { dpjp: null, poliTujuan: null, tglRencana: "2026-10-20" });
  assert.throws(() => s.validasiUbahSurat("spri", {}, HARI_INI), galat(400, /Tidak ada perubahan/));
  assert.throws(() => s.validasiUbahSurat("spri", { tglRencana: "2026-10-01" }, HARI_INI), galat(400));
});

test("sidik isi permintaan: stabil, berbeda bila isi berubah, tidak bergantung kunci idempotensi", () => {
  const a = s.validasiBuatSurat("rencana_kontrol", dasar, HARI_INI);
  const b = s.validasiBuatSurat("rencana_kontrol", { ...dasar, idempotencyKey: "kunci-lain" }, HARI_INI);
  const c = s.validasiBuatSurat("rencana_kontrol", { ...dasar, tglRencana: "2026-10-26" }, HARI_INI);
  assert.equal(s.sidikPermintaan("rencana_kontrol", a), s.sidikPermintaan("rencana_kontrol", b));
  assert.notEqual(s.sidikPermintaan("rencana_kontrol", a), s.sidikPermintaan("rencana_kontrol", c));
  assert.notEqual(s.sidikPermintaan("rencana_kontrol", a), s.sidikPermintaan("spri", a));
  assert.match(s.sidikPermintaan("spri", a), /^[0-9a-f]{64}$/);
});

test("keputusan idempotensi untuk baris yang sudah ada", () => {
  const sidik = "a".repeat(64);
  assert.deepEqual(s.keputusanIdempotensi({ status_operasi: "terkonfirmasi", no_surat: "RK1", sidik }, sidik), { kembalikan: true });
  assert.equal(s.keputusanIdempotensi({ status_operasi: "terkonfirmasi", no_surat: "RK1", sidik }, "b".repeat(64)).tolak, 409);
  assert.match(s.keputusanIdempotensi({ status_operasi: "diajukan", sidik }, sidik).pesan, /sedang diproses/);
  assert.equal(s.keputusanIdempotensi({ status_operasi: "diajukan", sidik }, sidik).tolak, 409);
  assert.match(s.keputusanIdempotensi({ status_operasi: "tidak_pasti", sidik }, sidik).pesan, /Cek status/);
  // gagal pasti: boleh diulang, termasuk dengan isi yang sudah dikoreksi (kolom diperbarui sebelum dikirim)
  assert.deepEqual(s.keputusanIdempotensi({ status_operasi: "gagal", sidik }, "b".repeat(64)), { klaimUlang: true });
  // baris lama tanpa sidik (sebelum migrasi 20261018030000) tidak ditolak karena sidik
  assert.deepEqual(s.keputusanIdempotensi({ status_operasi: "terkonfirmasi", no_surat: "RK1", sidik: null }, sidik), { kembalikan: true });
});

test("ubah/hapus hanya untuk surat terkonfirmasi yang belum dipakai (409)", () => {
  assert.throws(() => s.periksaBolehUbah({ status_operasi: "terkonfirmasi", no_surat: "RK1", status_pakai: "dipakai", sep_no_sep: "SEP1" }), galat(409, /SEP SEP1/));
  assert.throws(() => s.periksaBolehUbah({ status_operasi: "tidak_pasti", no_surat: "RK1", status_pakai: "belum_dipakai" }), galat(409, /terkonfirmasi/));
  assert.throws(() => s.periksaBolehUbah({ status_operasi: "gagal", no_surat: null, status_pakai: "belum_dipakai" }, "dihapus"), galat(409, /dihapus/));
  assert.doesNotThrow(() => s.periksaBolehUbah({ status_operasi: "terkonfirmasi", no_surat: "RK1", status_pakai: "belum_dipakai" }));
});

test("cara nomor surat pada SEP: suratUuid wajib bila fitur aktif, nomor bebas hanya bila fitur mati", () => {
  assert.equal(s.caraNoSuratSep({ suratUuid: "u", noSurat: "RK1", fiturSurat: true }), "surat");
  assert.equal(s.caraNoSuratSep({ noSurat: "SPRI1", fiturSurat: false }), "manual");
  assert.equal(s.caraNoSuratSep({ noSurat: "  ", fiturSurat: true }), "tanpa");
  assert.equal(s.caraNoSuratSep({}), "tanpa");
  assert.throws(() => s.caraNoSuratSep({ noSurat: "SPRI1", fiturSurat: true }), galat(400, /suratUuid/));
  assert.throws(() => s.caraNoSuratSep({ noSurat: "SPRI1", fiturSurat: null }), galat(400, /tidak dapat diperiksa/));
});

test("pemilihan surat untuk SEP: pasien, kartu, jenis, status, simulasi", () => {
  const surat = {
    jenis: "spri", no_surat: "SPRI1", status_operasi: "terkonfirmasi", status_pakai: "belum_dipakai",
    patient_uuid: "pasien-1", no_kartu: "0001234567891", simulasi: true,
  };
  const syarat = { patientUuid: "pasien-1", noKartu: "0001234567891", jenisPelayanan: "1", modeNyata: false };
  assert.equal(s.periksaSuratUntukSep(surat, syarat), surat);
  const tolak = (ubahSurat, ubahSyarat, status, pola) =>
    assert.throws(() => s.periksaSuratUntukSep(ubahSurat === null ? null : { ...surat, ...ubahSurat }, { ...syarat, ...ubahSyarat }), galat(status, pola));
  tolak(null, {}, 404);
  tolak({ deleted_at: 1 }, {}, 404);
  tolak({ status_operasi: "tidak_pasti" }, {}, 409, /belum terkonfirmasi/);
  tolak({ status_pakai: "dipakai" }, {}, 409, /sudah digunakan/);
  tolak({}, { jenisPelayanan: "2" }, 422, /Jenis surat/);
  tolak({ patient_uuid: null }, {}, 422, /pasien OpenSIMRS yang sama/);
  tolak({}, { patientUuid: "" }, 422, /pasien OpenSIMRS yang sama/);
  tolak({}, { patientUuid: "pasien-2" }, 422, /tidak sesuai dengan pasien/);
  tolak({}, { noKartu: "0001234567892" }, 422, /kartu/);
  tolak({}, { modeNyata: true }, 422, /simulasi/);
  assert.doesNotThrow(() => s.periksaSuratUntukSep({ ...surat, jenis: "rencana_kontrol" }, { ...syarat, jenisPelayanan: "2" }));
});

test("filter daftar: status sesuai PRD, tanggal & uuid tidak valid → 400", () => {
  const f = s.validasiFilterDaftar({ page: "2", limit: "500", status: "jatuh_tempo", dari: "2026-10-01", sampai: "2026-10-31" });
  assert.equal(f.page, 2);
  assert.equal(f.limit, 100);
  assert.equal(f.status, "jatuh_tempo");
  assert.equal(s.validasiFilterDaftar({ status: "semua" }).status, "");
  assert.throws(() => s.validasiFilterDaftar({ status: "kedaluwarsa" }), galat(400, /Status/));
  assert.throws(() => s.validasiFilterDaftar({ dari: "kemarin" }), galat(400, /dari/));
  assert.throws(() => s.validasiFilterDaftar({ sampai: "2026-10-32" }), galat(400, /sampai/));
  assert.throws(() => s.validasiFilterDaftar({ dari: "2026-10-31", sampai: "2026-10-01" }), galat(400));
  assert.throws(() => s.validasiFilterDaftar({ q: { $ne: 1 } }), galat(400));
  assert.throws(() => s.pastikanUuid("bukan-uuid"), galat(400, /UUID/));
  assert.equal(s.pastikanUuid("0192F3A4-0000-7000-8000-000000000001"), "0192f3a4-0000-7000-8000-000000000001");
});

test("rekonsiliasi: satu kandidat cocok dipilih otomatis; beberapa kandidat menunggu pilihan operator", () => {
  const baris = { jenis: "rencana_kontrol", no_kartu: "0001234567891", tgl_rencana_teks: "2026-10-25", dpjp: "31486" };
  const daftar = [
    { noSuratKontrol: "RK-A", jnsKontrol: "2", noKartu: "0001234567891", tglRencanaKontrol: "2026-10-25", kodeDokter: "31486" },
    { noSuratKontrol: "RK-B", jnsKontrol: "2", noKartu: "0001234567891", tglRencanaKontrol: "2026-10-26", kodeDokter: "31486" },
    { noSuratKontrol: "SPRI-C", jnsKontrol: "1", noKartu: "0001234567891", tglRencanaKontrol: "2026-10-25", kodeDokter: "31486" },
    { noSuratKontrol: "RK-D", jnsKontrol: "2", noKartu: "0001234567891", tglRencanaKontrol: "2026-10-25", kodeDokter: "99999" },
  ];
  assert.equal(s.pilihKandidatRekonsiliasi(daftar, baris).terpilih.noSuratKontrol, "RK-A");
  assert.equal(s.pilihKandidatRekonsiliasi(daftar, baris, new Set(["RK-A"])).terpilih, null);
  const dua = [...daftar, { ...daftar[0], noSuratKontrol: "RK-E" }];
  const hasil = s.pilihKandidatRekonsiliasi(dua, baris);
  assert.equal(hasil.terpilih, null);
  assert.equal(hasil.kandidat.length, 2);
  assert.equal(s.pilihKandidatRekonsiliasi(dua, baris, new Set(), "RK-E").terpilih.noSuratKontrol, "RK-E");
  assert.throws(() => s.pilihKandidatRekonsiliasi(dua, baris, new Set(), "RK-B"), galat(400));
});

test("izin Admisi › Rencana Kontrol & SPRI dari users.permissions", () => {
  const izin = [{ module: "Admisi", subModules: [{ name: "Rencana Kontrol & SPRI", allows: ["READ", { name: "CREATE SPRI" }] }] }];
  assert.equal(cocokIzin(izin, "Admisi", "Rencana Kontrol & SPRI", "READ"), true);
  assert.equal(cocokIzin(izin, "admisi", "rencana kontrol & spri", "create spri"), true);
  assert.equal(cocokIzin(izin, "Admisi", "Rencana Kontrol & SPRI", "CREATE RENCANA KONTROL"), false);
  assert.equal(cocokIzin(izin, "Admisi", "Rencana Kontrol & SPRI", ["UPDATE SPRI", "CREATE SPRI"]), true);
  assert.equal(cocokIzin(izin, "Admisi", "SEP", "READ"), false);
  assert.equal(cocokIzin(null, "Admisi", "SEP", "READ"), false);
});

test("simulasi VClaim: surat tercatat dapat dicari ulang (rekonsiliasi) dan koneksi putus = 502", async () => {
  const kred = { consId: "12345", secretKey: "rahasia", userKey: "uk" };
  const body = buatRencanaKontrol({ noKartu: "0001234567891", kodeDokter: "31486", poliKontrol: "INT", tglRencanaKontrol: "2026-11-03" });
  const { response } = await vclaim(kred, "POST", JALUR_SURAT.RENCANA_KONTROL_BUAT, body);
  const cari = await vclaim(kred, "GET", JALUR_SURAT.cariNomor(response.noSuratKontrol));
  assert.equal(cari.response.tglRencanaKontrol, "2026-11-03");

  // nomor kartu berakhiran 9: surat tercatat di "BPJS" tetapi respons hilang
  const putus = buatSpri({ noKartu: "0001234567899", kodeDokter: "31486", poliKontrol: "INT", tglRencana: "2026-11-04" });
  await assert.rejects(vclaim(kred, "POST", JALUR_SURAT.SPRI_BUAT, putus), (e) => e.status === 502);
  const daftar = await vclaim(kred, "GET", JALUR_SURAT.daftarPeserta("11", "2026", "0001234567899"));
  assert.equal(daftar.response.list.length, 1);
  assert.equal(daftar.response.list[0].jnsKontrol, "1");

  await vclaim(kred, "DELETE", JALUR_SURAT.HAPUS, { request: { t_rencontrol: { noSuratKontrol: response.noSuratKontrol } } });
  await assert.rejects(vclaim(kred, "GET", JALUR_SURAT.cariNomor(response.noSuratKontrol)), (e) => e.status === 422);
});
