import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SECRET_KEY = process.env.SECRET_KEY || "kunci-uji";
process.env.BPJS_MODE = "mock";
const {
  buatSep, hapusSep, keTanggalVclaim, JENIS_PELAYANAN,
  buatRencanaKontrol, ubahRencanaKontrol, hapusRencanaKontrol, buatSpri, ubahSpri,
} = await import("../src/vclaim-peta.js");
const { vclaim } = await import("../src/klien-vclaim.js");

const kred = { consId: "12345", secretKey: "rahasia", userKey: "uk", kdPpk: "0301R001" };

test("tanggal VClaim yyyy-mm-dd dalam WIB", () => {
  // 2026-10-12 18:00 UTC = 2026-10-13 01:00 WIB
  assert.equal(keTanggalVclaim(Date.UTC(2026, 9, 12, 18, 0, 0)), "2026-10-13");
  assert.equal(keTanggalVclaim(Date.UTC(2026, 9, 12, 18, 0, 0) / 1000), "2026-10-13");
  assert.equal(keTanggalVclaim("2026-01-05"), "2026-01-05");
  assert.equal(keTanggalVclaim(null), null);
});

test("SEP rawat jalan: poli tujuan & DPJP layan terisi, SKDP kosong", () => {
  const { request } = buatSep({
    ppkPelayanan: "0301R001", noKartu: "0001234567891", tglSep: "2026-10-13", klsRawatHak: 3, noMR: "RM001",
    rujukan: { asal: "1", tgl: "2026-10-10", no: "0114U163Y000001", ppk: "0114A026" },
    diagAwal: "I10", poliTujuan: "INT", dpjp: "31486", user: "petugas",
  });
  const t = request.t_sep;
  assert.equal(t.jnsPelayanan, JENIS_PELAYANAN.RAWAT_JALAN);
  assert.equal(t.klsRawat.klsRawatHak, "3");
  assert.deepEqual(t.rujukan, { asalRujukan: "1", tglRujukan: "2026-10-10", noRujukan: "0114U163Y000001", ppkRujukan: "0114A026" });
  assert.deepEqual(t.poli, { tujuan: "INT", eksekutif: "0" });
  assert.equal(t.dpjpLayan, "31486");
  assert.deepEqual(t.skdp, { noSurat: "", kodeDPJP: "" });
  assert.equal(t.jaminan.lakaLantas, "0");
  assert.equal(t.user, "petugas");
});

test("SEP rawat inap: poli kosong, DPJP masuk SKDP", () => {
  const t = buatSep({ ppkPelayanan: "X", noKartu: "1", tglSep: "2026-10-13", jnsPelayanan: "1", klsRawatHak: "1", diagAwal: "A09", poliTujuan: "INT", dpjp: "9" }).request.t_sep;
  assert.equal(t.poli.tujuan, "");
  assert.equal(t.skdp.kodeDPJP, "9");
  assert.equal(t.dpjpLayan, "");
});

test("hapus SEP dan nama pengguna dipotong 30 karakter", () => {
  const t = hapusSep({ noSep: "0301R0011026V000001", user: "x".repeat(40) }).request.t_sep;
  assert.equal(t.noSep, "0301R0011026V000001");
  assert.equal(t.user.length, 30);
});

test("simulasi: peserta terdekripsi, nomor berakhiran 0 = tidak ditemukan (422)", async () => {
  const { response } = await vclaim(kred, "GET", "/Peserta/nokartu/0001234567891/tglSEP/2026-10-13");
  assert.equal(response.peserta.noKartu, "0001234567891");
  assert.equal(response.peserta.hakKelas.kode, "3");
  await assert.rejects(vclaim(kred, "GET", "/Peserta/nokartu/0001234567890/tglSEP/2026-10-13"), (e) => e.status === 422);
});

test("simulasi: buat SEP mengembalikan nomor SEP", async () => {
  const body = buatSep({ ppkPelayanan: "0301R001", noKartu: "0001234567891", tglSep: "2026-10-13", klsRawatHak: "3", diagAwal: "I10", poliTujuan: "INT", dpjp: "31486" });
  const { response } = await vclaim(kred, "POST", "/SEP/2.0/insert", body);
  assert.match(response.sep.noSep, /^0301R0012610V\d{6}$/);
});

test("kredensial tidak lengkap ditolak sebelum menghubungi BPJS", async () => {
  await assert.rejects(vclaim({ consId: "1" }, "GET", "/referensi/propinsi"), (e) => e.status === 422);
});

// --- Rencana Kontrol & SPRI (STD-0021) -------------------------------------------------------------

test("payload Rencana Kontrol: buat, ubah, hapus", () => {
  const b = buatRencanaKontrol({ noKartu: "0001234567891", kodeDokter: "31486", poliKontrol: "INT", tglRencanaKontrol: "2026-11-01", user: "petugas" });
  assert.deepEqual(b.request.t_rencontrol, {
    noSEP: "", noKartu: "0001234567891", kodeDokter: "31486", poliKontrol: "INT", tglRencanaKontrol: "2026-11-01", user: "petugas",
  });
  const denganSep = buatRencanaKontrol({ noKartu: "0001234567891", noSep: "0301R0011026V000001", kodeDokter: "31486", poliKontrol: "INT", tglRencanaKontrol: "2026-11-01" });
  assert.equal(denganSep.request.t_rencontrol.noSEP, "0301R0011026V000001");

  const u = ubahRencanaKontrol({ noSuratKontrol: "RK123", noKartu: "0001234567891", kodeDokter: "31487", poliKontrol: "ANA", tglRencanaKontrol: "2026-11-05", user: "petugas" });
  assert.equal(u.request.t_rencontrol.noSuratKontrol, "RK123");
  assert.equal(u.request.t_rencontrol.poliKontrol, "ANA");

  const h = hapusRencanaKontrol({ noSuratKontrol: "RK123", user: "x".repeat(40) });
  assert.equal(h.request.t_rencontrol.noSuratKontrol, "RK123");
  assert.equal(h.request.t_rencontrol.user.length, 30);
});

test("payload SPRI: buat & ubah", () => {
  const b = buatSpri({ noKartu: "0001234567891", kodeDokter: "31486", poliKontrol: "INT", tglRencana: "2026-11-01", user: "petugas" });
  assert.deepEqual(b.request.t_sprirawat, { noKartu: "0001234567891", kodeDokter: "31486", poliKontrol: "INT", tglRencana: "2026-11-01", user: "petugas" });

  const u = ubahSpri({ noSuratSPRI: "SPRI123", noKartu: "0001234567891", tglRencana: "2026-11-02", user: "petugas" });
  assert.equal(u.request.t_sprirawat.noSuratSPRI, "SPRI123");
  assert.equal(u.request.t_sprirawat.tglRencana, "2026-11-02");
});

test("simulasi: buat Rencana Kontrol mengembalikan noSuratKontrol, data tidak lengkap ditolak (201)", async () => {
  const body = buatRencanaKontrol({ noKartu: "0001234567891", kodeDokter: "31486", poliKontrol: "INT", tglRencanaKontrol: "2026-11-01", user: "petugas" });
  const { response } = await vclaim(kred, "POST", "/RencanaKontrol/insert", body);
  assert.match(response.noSuratKontrol, /^RK\d+$/);

  await assert.rejects(
    vclaim(kred, "POST", "/RencanaKontrol/insert", { request: { t_rencontrol: { noKartu: "1" } } }),
    (e) => e.status === 422
  );
});

test("simulasi: ubah & hapus Rencana Kontrol", async () => {
  const u = await vclaim(kred, "PUT", "/RencanaKontrol/update", { request: { t_rencontrol: { noSuratKontrol: "RK123" } } });
  assert.equal(u.response.noSuratKontrol, "RK123");
  const h = await vclaim(kred, "DELETE", "/RencanaKontrol/delete", { request: { t_rencontrol: { noSuratKontrol: "RK123" } } });
  assert.equal(h.response, "RK123");
});

test("simulasi: buat & ubah SPRI mengembalikan noSuratSPRI", async () => {
  const body = buatSpri({ noKartu: "0001234567891", tglRencana: "2026-11-01", user: "petugas" });
  const { response } = await vclaim(kred, "POST", "/SPRI/insert", body);
  assert.match(response.noSuratSPRI, /^SPRI\d+$/);

  const u = await vclaim(kred, "PUT", "/SPRI/update", { request: { t_sprirawat: { noSuratSPRI: response.noSuratSPRI } } });
  assert.equal(u.response.noSuratSPRI, response.noSuratSPRI);
});
