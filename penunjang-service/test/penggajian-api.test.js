import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks, createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const dataUrl = (s) => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
let db, izinAkun, aktif, transaksiTerakhir, gagalAudit, gagalJurnal, jurnalDibuat, antrian = Promise.resolve();
const f = "faskes-fiktif", user = "petugas-fiktif", tanggal = Date.UTC(2026, 9, 20) / 1000;
const klien = { query: async () => ({ rows: [] }) };
const cari = (t, uuid, faskes) => db[t]?.find((r) => r.uuid === uuid && r.faskes_uuid === faskes && r.deleted_at == null) ?? null;
const apiDb = {
  sekarang: () => tanggal,
  uuidv7: () => `019a0000-0000-7000-8000-${String(Object.values(db).flat().length + 1).padStart(12, "0")}`,
  query: async (sql, p = []) => {
    if (sql.includes("FROM ref_fitur")) return db.ref_fitur ?? [{ tersedia: false }];
    if (sql.includes("FROM hr_kepegawaian h")) return db.hr_kepegawaian ?? [];
    if (sql.includes("FROM hr_riwayat_jabatan r")) return db.hr_riwayat_jabatan ?? [];
    if (sql.includes("FROM hr_gaji_komponen_pegawai t")) return db.hr_gaji_komponen_pegawai ?? [];
    if (sql.includes("FROM hr_gaji_profil_pegawai WHERE") && !sql.includes("uuid = $2")) return db.hr_gaji_profil_pegawai ?? [];
    if (sql.includes("count(*) AS jumlah")) return [{ jumlah: 0 }];
    if (sql.includes("FROM remunerasi_rincian")) return db.remunerasi_rincian;
    if (sql.includes("FROM hr_gaji_rincian r JOIN")) return db.hr_gaji_rincian ?? [];
    if (sql.includes("FROM hr_gaji_jaspel_sumber")) return (db.hr_gaji_jaspel_sumber ?? []).filter((r) => r.faskes_uuid === p[0] && (r.periode_uuid === p[1] || r.remunerasi_periode_uuid === p[1]) && r.status !== "dilepas");
    if (sql.includes("FROM hr_akun_pegawai")) {
      const a = db.hr_akun_pegawai.find((r) => r.faskes_uuid === p[0] && r.username === p[1] && r.deleted_at == null);
      return a ? [a] : [];
    }
    if (sql.includes("FROM hr_gaji_hasil WHERE")) return db.hr_gaji_hasil.filter((r) => r.faskes_uuid === p[0] && r.penghitungan_uuid === p[1] && r.kepegawaian_uuid === p[2]);
    if (sql.includes("FROM hr_gaji_rincian WHERE")) return db.hr_gaji_rincian.filter((r) => r.faskes_uuid === p[0] && r.hasil_uuid === p[1]);
    if (sql.includes("FROM hr_gaji_jurnal")) return (db.hr_gaji_jurnal ?? []).filter((r) => r.faskes_uuid === p[0] && r.periode_uuid === p[1] && (!sql.includes("status = 'tercatat'") || r.status === "tercatat"));
    const m = /SELECT .* FROM (\w+) WHERE (?:faskes_uuid = \$1 AND uuid = \$2|uuid = \$1 AND faskes_uuid = \$2)/.exec(sql.replace(/\s+/g, " "));
    if (m) {
      const par = sql.includes("WHERE uuid = $1") ? [p[1], p[0]] : p;
      const r = cari(m[1], par[1], par[0]);
      return r ? [structuredClone(r)] : [];
    }
    return [];
  },
  satu: async (...a) => (await apiDb.query(...a))[0] ?? null,
  sisipkan: async (t, b) => {
    if (t === "hr_gaji_riwayat_tindakan" && gagalAudit) throw new Error("Audit uji gagal");
    const r = { uuid: apiDb.uuidv7(), created_at: tanggal, updated_at: tanggal, deleted_at: null, percobaan: 0, ...structuredClone(b) };
    (db[t] ??= []).push(r); return structuredClone(r);
  },
  ubah: async (t, uuid, faskes, b) => {
    const r = cari(t, uuid, faskes); if (!r) return null;
    Object.assign(r, structuredClone(b), { updated_at: tanggal }); return structuredClone(r);
  },
  transaksi: async (fn) => {
    const tunggu = antrian; let lepas; antrian = new Promise((r) => { lepas = r; }); await tunggu;
    const awal = structuredClone(db);
    try { const r = await fn(klien); transaksiTerakhir = "commit"; return r; }
    catch (e) { db = awal; transaksiTerakhir = "rollback"; throw e; }
    finally { lepas(); }
  },
};
globalThis.__ujiPenggajian = {
  db: apiDb,
  fitur: () => aktif,
  punyaIzin: async (req, modul, sub, aksi) => req.author?.role === "super admin" || izinAkun.includes(`${sub}:${aksi}`),
  jurnalkan: async (k, faskes, ev) => { if (gagalJurnal) return { hasil: "tertahan", alasan: "Pemetaan uji belum lengkap" }; jurnalDibuat++; return { hasil: "dijurnal", jurnal_uuid: "jurnal-fiktif" }; },
};
const modul = {
  "/penunjang-service/src/db.js": `export const { query, satu, sisipkan, ubah, transaksi, sekarang, uuidv7 } = globalThis.__ujiPenggajian.db;`,
  "/penunjang-service/src/hr/fitur.js": `export const fiturSdmAktif = async (kode) => kode === 'sdm_kehadiran' ? false : globalThis.__ujiPenggajian.fitur();`,
  "/penunjang-service/src/umum/izin.js": `export const punyaIzin = (...a) => globalThis.__ujiPenggajian.punyaIzin(...a);`,
  "/penunjang-service/src/hr/audit.js": `export const catatAuditPusat = async () => {};`,
  "/penunjang-service/src/akuntansi/proses.js": `export const jurnalkanEvent = (...a) => globalThis.__ujiPenggajian.jurnalkan(...a); export const muatAturan = async () => ({});`,
};
const kait = registerHooks({ resolve(s, c, lanjut) {
  if (s.includes("dotenv") || /(?:^|\/)config\.js$/.test(s)) throw new Error("Konfigurasi runtime tidak boleh dimuat dalam uji penggajian");
  const asal = c.parentURL && (s.startsWith(".") || s.startsWith("file:")) ? new URL(s, c.parentURL).href : s;
  const suffix = Object.keys(modul).find((x) => asal.endsWith(x));
  return suffix ? { url: dataUrl(modul[suffix]), shortCircuit: true } : lanjut(s, c);
} });
const { default: rute } = await import("../src/hr/penggajian/rute.js");
const { pemilikSlip, csvBank } = await import("../src/hr/penggajian/laporan.js");
const { pastikanPembayaranMandiri, ambilHasilPenggajian } = await import("../src/akuntansi/remunerasi/penggajian.js");
const { hitungSumber, muatSumber } = await import("../src/hr/penggajian/sumber.js");
const { isiKonfigurasi } = await import("../src/hr/penggajian/konfigurasi.js");
kait.deregister();

beforeEach(() => {
  izinAkun = []; aktif = true; gagalAudit = false; gagalJurnal = false; jurnalDibuat = 0;
  db = { hr_gaji_periode: [{ uuid: "p", faskes_uuid: f, status: "disetujui", versi: 5, tahun: 2026, bulan: 10, tanggal_bayar: null, bersih: "110.00", hash_hitung: "h", remunerasi_periode_uuid: "r", penghitungan_uuid: "g", terkunci_pada: tanggal, deleted_at: null }], hr_gaji_hasil: [{ uuid: "hasil", faskes_uuid: f, penghitungan_uuid: "g", kepegawaian_uuid: "pegawai-saya", bruto: "120.00", potongan: "10.00", bersih: "110.00" }], hr_gaji_rincian: [{ uuid: "rr", faskes_uuid: f, hasil_uuid: "hasil", kode: "pokok", jenis: "penghasilan", kategori: "gaji_pokok", nilai: "100.00" }, { uuid: "rj", faskes_uuid: f, hasil_uuid: "hasil", kode: "jaspel", jenis: "penghasilan", kategori: "jaspel", nilai: "20.00" }, { uuid: "rp", faskes_uuid: f, hasil_uuid: "hasil", kode: "pph21", jenis: "potongan", kategori: "pph21", nilai: "10.00" }], hr_akun_pegawai: [{ username: user, kepegawaian_uuid: "pegawai-saya", faskes_uuid: f }], hr_gaji_jaspel_sumber: [{ uuid: "reservasi", faskes_uuid: f, periode_uuid: "p", remunerasi_periode_uuid: "r", status: "reservasi", hash_sumber: "uji" }], remunerasi_periode: [{ uuid: "r", faskes_uuid: f, status: "disetujui", jurnal_uuid: "beban", tahun: 2026, bulan: 10, total: "20.00" }], akuntansi_jurnal: [{ uuid: "beban", faskes_uuid: f, status: "final" }], remunerasi_rincian: [{ rincian_uuid: "rj", practitioner_uuid: "pr", kepegawaian_uuid: "pegawai-saya", total: "20.00" }] };
});
const panggil = (path, { method = "GET", body = {}, query = {}, faskes = f, username = user } = {}) => new Promise((resolve, reject) => {
  const req = { method, url: path, originalUrl: path, headers: {}, query, body, author: { username, faskesUuid: faskes, role: "pegawai" } };
  const res = { code: 200, headers: {}, set(n, v) { this.headers[n] = v; return this; }, status(n) { this.code = n; return this; }, json(data) { resolve({ code: this.code, data, headers: this.headers }); } };
  rute.handle(req, res, (e) => e ? reject(e) : resolve({ code: 404 }));
});
test("fitur mati, akun tanpa izin, dan pemalsuan faskes ditolak tanpa nominal", async () => {
  let r = await panggil("/periode"); assert.equal(r.code, 403); assert.equal(r.data.payload, null); assert.equal(r.headers["Cache-Control"], "no-store");
  izinAkun = ["Periode Penggajian:READ"]; aktif = false; assert.equal((await panggil("/periode")).code, 403);
  aktif = true;
  for (const posisi of ["body", "query"]) assert.equal((await panggil("/periode", { [posisi]: { faskes_uuid: "lain" } })).code, 400);
});
test("izin slip tidak membuka data administratif; pemilik diambil dari akun dan faskes", async () => {
  izinAkun = ["Slip Penggajian:READ"];
  for (const path of ["/pegawai", "/periode/p", "/periode/p/hasil", "/rekap", "/konfigurasi"]) assert.equal((await panggil(path)).code, 403, path);
  assert.equal(await pemilikSlip(klien, { author: { faskesUuid: f, username: user } }), "pegawai-saya");
  await assert.rejects(() => pemilikSlip(klien, { author: { faskesUuid: "lain", username: user } }), /Tautan akun/);
  assert.equal((await panggil("/slip/saya/p", { query: { kepegawaian_uuid: "pegawai-lain" } })).code, 400);
});
test("slip menunggu jurnal; hasil pegawai lain tidak ditemukan", async () => {
  izinAkun = ["Slip Penggajian:READ"];
  assert.equal((await panggil("/slip/saya/p")).code, 404);
  db.hr_gaji_periode[0].status = "dibayar";
  db.hr_gaji_jurnal = [{ faskes_uuid: f, periode_uuid: "p", status: "tercatat", jurnal_uuid: "j" }];
  const r = await panggil("/slip/saya/p"); assert.equal(r.code, 200); assert.equal(r.data.payload.kepegawaian_uuid, "pegawai-saya");
  db.hr_akun_pegawai[0].kepegawaian_uuid = "pegawai-lain";
  assert.equal((await panggil("/slip/saya/p")).code, 404);
});
test("periode lintas faskes, versi usang, dan hasil terkunci ditolak", async () => {
  izinAkun = ["Periode Penggajian:READ", "Periode Penggajian:HITUNG"];
  assert.equal((await panggil("/periode/p", { faskes: "lain" })).code, 404);
  assert.equal((await panggil("/periode/p/hitung", { method: "POST", body: { versi: 4 } })).code, 409);
  assert.equal((await panggil("/periode/p/hitung", { method: "POST", body: { versi: 5 } })).code, 409);
});
test("reservasi menolak pembayaran mandiri dan pemetaan penerima yang tidak lengkap", async () => {
  await assert.rejects(() => pastikanPembayaranMandiri(klien, f, "r"), /dicadangkan/);
  db.remunerasi_rincian[0].kepegawaian_uuid = null;
  await assert.rejects(() => ambilHasilPenggajian(klien, f, "r", "p"), /terpetakan/);
});
test("dua permintaan bayar serentak mempertahankan satu pembayaran dan niat jurnal saat pemetaan tertahan", async () => {
  izinAkun = ["Pembayaran Penggajian:BAYAR", "Pembayaran Penggajian:ULANG JURNAL"]; gagalJurnal = true;
  const opsi = { method: "POST", body: { versi: 5, tanggal_bayar: tanggal, metode_bayar: "TRANSFER", referensi_bayar: "bukti-fiktif" } };
  const r = await Promise.all([panggil("/periode/p/bayar", opsi), panggil("/periode/p/bayar", opsi)]);
  assert.deepEqual(r.map((x) => x.code), [200, 200]);
  assert.equal(db.hr_gaji_periode[0].status, "dibayar"); assert.equal(db.hr_gaji_periode[0].versi, 6);
  assert.equal(db.hr_gaji_jurnal.length, 1); assert.equal(db.hr_gaji_jurnal[0].status, "tertahan"); assert.equal(db.hr_gaji_jurnal[0].percobaan, 1);
  assert.equal(db.hr_gaji_riwayat_tindakan.filter((x) => x.aksi === "bayar_periode").length, 1);
  await assert.rejects(() => pastikanPembayaranMandiri(klien, f, "r"), /dibayarkan/);
  const ulang = await panggil("/periode/p/jurnal/ulang", { method: "POST", body: { versi: 6 } });
  assert.equal(ulang.code, 200); assert.equal(db.hr_gaji_jurnal.length, 1); assert.equal(db.hr_gaji_jurnal[0].percobaan, 2);
});
test("audit wajib gagal membatalkan pembayaran tanpa membocorkan galat SQL", async () => {
  izinAkun = ["Pembayaran Penggajian:BAYAR"]; gagalAudit = true;
  const r = await panggil("/periode/p/bayar", { method: "POST", body: { versi: 5, tanggal_bayar: tanggal, metode_bayar: "TRANSFER", referensi_bayar: "bukti-fiktif" } });
  assert.equal(r.code, 500); assert.equal(db.hr_gaji_periode[0].status, "disetujui"); assert.equal(transaksiTerakhir, "rollback");
  assert.doesNotMatch(r.data.message, /Audit uji/);
});
test("jurnal berhasil menyelesaikan Remunerasi; pengulangan tidak membuat jurnal kedua", async () => {
  izinAkun = ["Pembayaran Penggajian:BAYAR", "Pembayaran Penggajian:ULANG JURNAL"];
  db.hr_gaji_jaspel_sumber[0].hash_sumber = (await ambilHasilPenggajian(klien, f, "r", "p")).hash_sumber;
  const r = await panggil("/periode/p/bayar", { method: "POST", body: { versi: 5, tanggal_bayar: tanggal, metode_bayar: "TRANSFER", referensi_bayar: "bukti-fiktif" } });
  assert.equal(r.code, 200); assert.equal(r.data.payload.jurnal.status, "tercatat");
  assert.equal(db.remunerasi_periode[0].status, "dibayar"); assert.equal(db.remunerasi_periode[0].jurnal_bayar_uuid, "jurnal-fiktif");
  assert.equal(db.hr_gaji_jaspel_sumber[0].status, "selesai");
  for (let i = 0; i < 2; i++) assert.equal((await panggil("/periode/p/jurnal/ulang", { method: "POST", body: { versi: 6 } })).data.payload.jurnal_uuid, "jurnal-fiktif");
  assert.equal(jurnalDibuat, 1);
});
test("CSV memakai spesifikasi disahkan, kutip, dan menahan formula spreadsheet", () => {
  const s = { jenis: "csv", pemisah: ";", header: true, desimal: "koma", kolom: ["nomor_rekening", "nama_pemilik", "bersih"] };
  const csv = csvBank(s, [{ nomor_rekening: "00001111", nama_pemilik: "=Contoh", bersih: "12.50" }]);
  assert.match(csv, /"00001111"/); assert.match(csv, /"'=Contoh"/); assert.match(csv, /"12,50"/);
  assert.throws(() => csvBank({ ...s, kolom: ["skrip"] }, []), /Kolom/);
});
const siapkanSumber = () => {
  const c = isiKonfigurasi({ berlaku_mulai: Date.UTC(2026, 9, 1, -7) / 1000, berlaku_sampai: Date.UTC(2026, 10, 1, -7) / 1000,
    dasar_aturan: "Skenario fiktif pengujian, bukan tarif produksi", kebijakan: { tanggal_acuan: "awal_bulan", kehadiran_tidak_digunakan: true, perlakuan_pajak_jaspel: "kena_pajak", penyaluran_jaspel: "utuh", waktu_jurnal: "pembayaran", penerbitan_slip: "pembayaran_dan_jurnal", pemisahan_tugas: "wajib", perubahan_tengah_bulan: "tanggal_acuan" },
    aturan: { metode: "periodik", rekonsiliasi: "tidak_diperlukan", parameter_wajib: [], pembulatan: { metode: "setengah_ke_atas", satuan: "0.01" }, potongan: ["bpjs_kesehatan", "bpjs_ketenagakerjaan", "pph21"].map((kode) => ({ kode, kategori: kode === "pph21" ? "pph21" : "bpjs", rumus: { op: "konstanta", nilai: "0" }, dasar_aturan: "Skenario fiktif" })), iuran_pemberi_kerja: [] },
    kasus_uji: [{ parameter: {}, ekspektasi: { bpjs_kesehatan: "0.00", bpjs_ketenagakerjaan: "0.00", pph21: "0.00" } }] });
  db.hr_gaji_konfigurasi = [{ ...c, uuid: "konfigurasi-fiktif", faskes_uuid: f, status: "disahkan", berlaku_mulai: String(c.berlaku_mulai), berlaku_sampai: String(c.berlaku_sampai) }];
  Object.assign(db.hr_gaji_periode[0], { status: "draf", konfigurasi_uuid: "konfigurasi-fiktif", terkunci_pada: null, hash_hitung: null, penghitungan_uuid: null });
  db.hr_kepegawaian = [{ uuid: "pegawai-saya", tanggal_mulai: tanggal - 86400 * 60 }];
  db.hr_riwayat_jabatan = [{ uuid: "riwayat", kepegawaian_uuid: "pegawai-saya", status_kepegawaian: "tetap", golongan: "fiktif" }];
  db.hr_gaji_komponen_pegawai = [{ uuid: "penetapan", komponen_uuid: "pokok", kepegawaian_uuid: "pegawai-saya", kode: "pokok", jenis: "penghasilan", kategori: "gaji_pokok", perlakuan_pajak: "kena_pajak", nilai: "100.00" }];
  db.hr_gaji_profil_pegawai = [{ uuid: "profil", kepegawaian_uuid: "pegawai-saya", parameter: {}, status: "disahkan" }];
};
test("alur hitung, ajukan, verifikasi, dan persetujuan memakai sumber tetap serta pemisahan tugas", async () => {
  siapkanSumber();
  izinAkun = ["Periode Penggajian:HITUNG", "Periode Penggajian:AJUKAN", "Verifikasi Penggajian:VALIDASI", "Persetujuan Penggajian:SETUJUI"];
  const h = await panggil("/periode/p/hitung", { method: "POST", body: { versi: 5 } });
  assert.equal(h.code, 200); assert.equal(h.data.payload.bruto, "120.00"); assert.equal(h.data.payload.jumlah_pengecualian, 0);
  const sidik = h.data.payload.hash_hitung;
  const ajukan = await panggil("/periode/p/ajukan", { method: "POST", body: { versi: 6, hash_hitung: sidik } });
  assert.equal(ajukan.data.payload.status, "verifikasi");
  const ver = { method: "POST", body: { versi: 7, hash_hitung: sidik } };
  assert.equal((await panggil("/periode/p/verifikasi", ver)).code, 409);
  assert.equal((await panggil("/periode/p/verifikasi", { ...ver, username: "verifikator-fiktif" })).data.payload.status, "menunggu_persetujuan");
  const setujui = { method: "POST", body: { versi: 8, hash_hitung: sidik } };
  assert.equal((await panggil("/periode/p/setujui", { ...setujui, username: "verifikator-fiktif" })).code, 409);
  const s = await panggil("/periode/p/setujui", { ...setujui, username: "penyetuju-fiktif" });
  assert.equal(s.code, 200); assert.equal(s.data.payload.status, "disetujui"); assert.ok(s.data.payload.terkunci_pada);
  assert.equal(db.hr_gaji_penghitungan.length, 1);
});
test("perubahan sumber, konfigurasi kedaluwarsa, dan ketersediaan Kehadiran yang berubah menghalangi finalisasi", async () => {
  siapkanSumber(); izinAkun = ["Periode Penggajian:HITUNG", "Periode Penggajian:AJUKAN"];
  const h = await panggil("/periode/p/hitung", { method: "POST", body: { versi: 5 } });
  db.hr_gaji_komponen_pegawai[0].nilai = "101.00";
  const a = await panggil("/periode/p/ajukan", { method: "POST", body: { versi: 6, hash_hitung: h.data.payload.hash_hitung } });
  assert.equal(a.code, 409); assert.match(a.data.message, /Sumber berubah/);
  db.ref_fitur = [{ tersedia: true }];
  await assert.rejects(() => muatSumber(klien, f, db.hr_gaji_periode[0]), /adaptor resmi/);
  db.ref_fitur = []; await assert.rejects(() => muatSumber(klien, f, db.hr_gaji_periode[0]), /tidak dapat dipastikan/);
  db.hr_gaji_konfigurasi[0].berlaku_sampai = tanggal;
  await assert.rejects(() => muatSumber(klien, f, db.hr_gaji_periode[0]), /sepanjang periode/);
});
test("penghitungan 120 pegawai fiktif mempertahankan desimal dan pengecualian; ukur fungsi murni", () => {
  const s = { acuan: tanggal, konfigurasi: { aturan: { parameter_wajib: [], potongan: [], iuran_pemberi_kerja: [] } }, pegawai: [], riwayat: [], profil: [], komponen: [], skala: [], koreksi: [], jaspel: { penerima: [] }, kehadiran: { status: "tidak_digunakan" } };
  for (let i = 0; i < 120; i++) {
    const id = `pegawai-fiktif-${i}`; s.pegawai.push({ uuid: id, tanggal_mulai: tanggal - 86400 });
    s.riwayat.push({ uuid: `riwayat-${i}`, kepegawaian_uuid: id, status_kepegawaian: "tetap" });
    s.profil.push({ uuid: `profil-${i}`, kepegawaian_uuid: id, parameter: {} });
    s.komponen.push({ uuid: `komponen-${i}`, kepegawaian_uuid: id, komponen_uuid: "pokok", kode: "pokok", jenis: "penghasilan", kategori: "gaji_pokok", nilai: "1000.10", perlakuan_pajak: "kena_pajak" });
  }
  const durasi = [];
  for (let i = 0; i < 20; i++) { const awal = performance.now(); const h = hitungSumber(s); durasi.push(performance.now() - awal); assert.equal(h.ringkasan.bruto, "120012.00"); assert.equal(h.ringkasan.jumlah_pengecualian, 0); }
  const p95 = durasi.sort((a, b) => a - b)[18]; assert.ok(p95 < 60000);
  s.profil.pop(); assert.equal(hitungSumber(s).ringkasan.jumlah_pengecualian, 1);
});
test("migrasi baru dapat dipanggil dua kali tanpa mengakses database", async () => {
  const require = createRequire(import.meta.url), sql = [];
  const m = require("../../database/migrations/20261021060000-std0041_penggajian.cjs");
  const qi = { sequelize: { transaction: async (fn) => fn({}), query: async (s) => { sql.push(s); } } };
  await m.up(qi); const jumlah = sql.length; await m.up(qi); assert.equal(sql.length, jumlah * 2);
  assert.ok(sql.some((s) => s.includes("FOREIGN KEY (faskes_uuid")));
  assert.ok(sql.some((s) => s.includes("Riwayat penggajian hanya dapat ditambah")));
  assert.ok(sql.filter((s) => s.startsWith("CREATE TABLE")).every((s) => s.includes("IF NOT EXISTS")));
  // Uji ini memeriksa keluaran migrasi. Sintaks dan idempotensi SQL nyata tetap diuji manusia.
});
test("migrasi izin menambah super admin secara idempoten dan mempertahankan izin lama serta daftar kosong", async () => {
  const require = createRequire(import.meta.url);
  const m = require("../../database/migrations/20261021060200-std0041_izin_penggajian.cjs");
  const rows = [
    { tabel: "role", uuid: "peran-fiktif", permissions: JSON.stringify([{ module: "HR / SDM", subModules: [{ name: "Kepegawaian", allows: ["READ"] }] }, { module: "Izin Lama", subModules: [] }]) },
    { tabel: "users", uuid: "akun-fiktif", permissions: "[]" },
  ];
  let jumlah = 0;
  const sq = { transaction: async (fn) => fn({}), query: async (s, o) => {
    assert.ok(o.transaction);
    if (s.startsWith("SELECT 'role'")) { assert.match(s, /super admin/); return [[rows[0]]]; }
    if (s.startsWith("SELECT 'users'")) { assert.match(s, /super admin/); return [[rows[1]]]; }
    const r = rows.find((r) => r.uuid === o.replacements.u); r.permissions = o.replacements.p; jumlah++;
    return [];
  } };
  await m.up({ sequelize: sq }); const pertama = jumlah;
  await m.up({ sequelize: sq }); assert.equal(jumlah, pertama);
  const p = JSON.parse(rows[0].permissions);
  assert.ok(p.some((x) => x.module === "Izin Lama")); assert.equal(rows[1].permissions, "[]");
  assert.equal(p[0].subModules.filter((x) => x.name.endsWith(" Penggajian")).length, 11);
});
