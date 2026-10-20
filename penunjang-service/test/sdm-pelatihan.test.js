import { test } from "node:test";
import assert from "node:assert/strict";
import { buatLayananPelatihan } from "../src/hr/pelatihan/layanan.js";
import { hitungJam, tahunZona, validasiHasil, validasiKatalog, validasiKebijakan, validasiKegiatan, pilihTarget } from "../src/hr/pelatihan/validasi.js";
import { susunRekap, susunWajib, susunPeringatan } from "../src/hr/pelatihan/rekap.js";
import { sdmPermission } from "../../auth-service/src/helpers/permission-list.js";
import { siapkanEkspor } from "../src/hr/pelatihan/ekspor.js";

const waktu = Date.UTC(2026, 9, 20) / 1000;
const kegiatan = { uuid: "kegiatan-fiktif", faskes_uuid: "faskes-a", versi: 1, katalog_uuid: "katalog-fiktif", kebijakan_uuid: "kebijakan-fiktif",
  nama_pelatihan: "Pelatihan fiktif", status: "berlangsung", jam: "8.00", kapasitas: 2, jadwal_mulai: waktu - 86400, jadwal_selesai: waktu - 100, deleted_at: null };
const peserta = { uuid: "peserta-fiktif", faskes_uuid: "faskes-a", versi: 1, kegiatan_uuid: kegiatan.uuid, pegawai_uuid: "pegawai-fiktif",
  kehadiran: "hadir", hasil: "lulus", jam_hadir: "8.00", jam_diakui: 0, status_pendaftaran: "terdaftar", status_verifikasi: "belum_diverifikasi", kredensial_uuid: null, deleted_at: null };
const kebijakan = { uuid: "kebijakan-fiktif", faskes_uuid: "faskes-a", versi: 1, tahun: 2026, zona_waktu: "Asia/Jakarta", dasar_jam: "lulus", aturan_sebagian: "jam_hadir", syarat_sertifikat: false };
const permintaan = (body = {}, params = {}) => ({ author: { faskesUuid: "faskes-a", username: "petugas-fiktif" }, params: { uuid: kegiatan.uuid, peserta_uuid: peserta.uuid, ...params }, body });

const tiruan = ({ gagalSertifikat = false, kapasitas = 2 } = {}) => {
  let state = {
    kegiatan: [{ ...kegiatan, kapasitas }], peserta: [{ ...peserta }], kebijakan: [{ ...kebijakan }], katalog: [], target: [], cakupan: [],
    pegawai: [{ uuid: "pegawai-fiktif", pegawai_uuid: "induk-fiktif", faskes_uuid: "faskes-a", aktif: true },
      { uuid: "pegawai-kedua", pegawai_uuid: "induk-kedua", faskes_uuid: "faskes-a", aktif: true },
      { uuid: "pegawai-luar", pegawai_uuid: "induk-luar", faskes_uuid: "faskes-b", aktif: true }],
    kredensial: [], audit: [], log: [],
  };
  let nomor = 0, antrean = Promise.resolve();
  const query = async (sql, p = []) => {
    const s = sql.replace(/\s+/g, " ").trim(); state.log.push({ sql: s, params: p });
    if (s.includes("pg_advisory_xact_lock") || s.startsWith("SET TRANSACTION")) return [];
    if (s.includes("FROM hr_kepegawaian h")) return state.pegawai.filter((x) => x.uuid === p[0] && x.faskes_uuid === p[1] && x.aktif);
    if (s.includes("FROM pegawai")) return [{ uuid: p[0] }];
    if (s.includes("FROM mutu_kredensial")) return state.kredensial.filter((x) => x.uuid === p[0] && x.faskes_uuid === p[1]);
    const t = s.match(/FROM sdm_pelatihan_(\w+)/)?.[1];
    if (!t) throw new Error(`Kueri tiruan belum ditangani: ${s}`);
    let rows = state[t].filter((x) => !x.deleted_at);
    if (/WHERE uuid = \$1/.test(s)) rows = rows.filter((x) => x.uuid === p[0] && x.faskes_uuid === p[1]);
    if (/WHERE kegiatan_uuid = \$1/.test(s)) rows = rows.filter((x) => x.kegiatan_uuid === p[0] && x.faskes_uuid === p[1]);
    if (s.includes("pegawai_uuid = $3")) rows = rows.filter((x) => x.pegawai_uuid === p[2]);
    if (s.includes("status_pendaftaran = 'terdaftar'")) rows = rows.filter((x) => x.status_pendaftaran === "terdaftar");
    if (s.includes("AND (status_verifikasi = 'terverifikasi'")) rows = rows.filter((x) => x.status_verifikasi === "terverifikasi" || x.kredensial_uuid);
    if (s.includes("AND status_verifikasi <> 'terverifikasi'")) rows = rows.filter((x) => x.status_verifikasi !== "terverifikasi");
    if (s.startsWith("SELECT count(*)")) return [{ n: rows.length }];
    return structuredClone(rows);
  };
  const satu = async (...args) => (await query(...args))[0] ?? null;
  const sisipkan = async (tabel, data) => {
    const row = { uuid: `baru-${++nomor}`, versi: 1, status_pendaftaran: "terdaftar", status_verifikasi: "belum_diverifikasi", deleted_at: null, ...data };
    state[tabel.replace("sdm_pelatihan_", "")].push(row); return structuredClone(row);
  };
  const ubah = async (tabel, id, f, data) => {
    const row = state[tabel.replace("sdm_pelatihan_", "")].find((x) => x.uuid === id && x.faskes_uuid === f && !x.deleted_at);
    assert.ok(row); Object.assign(row, data); return structuredClone(row);
  };
  const transaksi = (fn) => {
    const hasil = antrean.then(async () => {
      const sebelum = structuredClone(state);
      try { return await fn({ query }); } catch (e) { state = sebelum; throw e; }
    });
    antrean = hasil.catch(() => {}); return hasil;
  };
  const layanan = buatLayananPelatihan({ query, satu, sisipkan, ubah, transaksi, sekarang: () => waktu, audit: async (...args) => state.audit.push(args.slice(2)), maksMb: 10,
    catatKredensial: async (k, req, b) => {
      const c = { uuid: "sertifikat-baru", faskes_uuid: req.author.faskesUuid, ...b }; state.kredensial.push(c);
      if (gagalSertifikat) throw new Error("Kegagalan kredensial tiruan");
      return c;
    } });
  return { layanan, state: () => state };
};

test("validasi katalog, cakupan, jadwal dan kebijakan menolak masukan ambigu", () => {
  assert.throws(() => validasiKegiatan({ jadwal_mulai: waktu, jadwal_selesai: waktu }), /harus setelah/);
  const kat = { kode: "FIKTIF", nama: "Pelatihan fiktif", kategori: "internal", wajib: true, jam: "4.50", cakupan: [{ jenis_cakupan: "semua", mulai_berlaku: waktu }] };
  assert.equal(validasiKatalog(kat).jam, 4.5);
  assert.throws(() => validasiKatalog({ ...kat, jam: "0.001" }), /dua desimal/);
  assert.throws(() => validasiKatalog({ ...kat, wajib: "false" }), /benar atau salah/);
  assert.throws(() => validasiKatalog({ ...kat, cakupan: [null] }), (e) => e.status === 400);
  assert.throws(() => validasiKatalog({ ...kat, cakupan: [...kat.cakupan, { jenis_cakupan: "pegawai", referensi_uuid: "pegawai-fiktif", mulai_berlaku: waktu }] }), /bertumpang/);
  assert.throws(() => validasiKebijakan({ tahun: 2026, target: [], hari_peringatan: 0, prioritas_target: "hanya_semua" }), /zona_waktu/);
  assert.throws(() => validasiHasil({ kehadiran: "hadir", hasil: "lulus", jam_hadir: 4 }, kegiatan), /tidak sesuai/);
});

test("jam hadir, lulus, sebagian dan tidak hadir mengikuti kebijakan eksplisit", () => {
  assert.equal(hitungJam(peserta, kegiatan, kebijakan), 8);
  assert.equal(hitungJam({ ...peserta, hasil: "tidak_lulus" }, kegiatan, kebijakan), 0);
  assert.equal(hitungJam({ ...peserta, hasil: "tidak_lulus" }, kegiatan, { ...kebijakan, dasar_jam: "hadir" }), 8);
  assert.equal(hitungJam({ ...peserta, kehadiran: "sebagian", jam_hadir: "4.55" }, kegiatan, kebijakan), 4.55);
  assert.equal(hitungJam({ ...peserta, kehadiran: "sebagian", jam_hadir: "4.55" }, kegiatan, { ...kebijakan, aturan_sebagian: "tidak_dihitung" }), 0);
  assert.equal(hitungJam({ ...peserta, kehadiran: "tidak_hadir", hasil: "tidak_lulus", jam_hadir: 0 }, kegiatan, kebijakan), 0);
  assert.throws(() => hitungJam({ ...peserta, hasil: "belum_dinilai" }, kegiatan, kebijakan), /wajib dicatat/);
});

test("batas tahun menggunakan zona waktu kegiatan, bukan zona server", () => {
  const t = Date.UTC(2026, 11, 31, 16) / 1000;
  assert.equal(tahunZona(t, "Asia/Jakarta"), 2026);
  assert.equal(tahunZona(t, "Asia/Jayapura"), 2027);
});

test("pendaftaran kelompok menolak pegawai lintas faskes secara atomik", async () => {
  const db = tiruan({ kapasitas: 3 });
  await assert.rejects(() => db.layanan.daftarPeserta(permintaan({ versi: 1, pegawai_uuids: ["pegawai-kedua", "pegawai-luar"] })), (e) => e.status === 404);
  assert.equal(db.state().peserta.length, 1); assert.equal(db.state().audit.length, 0);
  await assert.rejects(() => db.layanan.daftarPeserta(permintaan({ versi: 1, pegawai_uuids: ["pegawai-fiktif"] })), (e) => e.status === 409);
});

test("pendaftaran bersamaan tidak melampaui kapasitas; perubahan versi meminta muat ulang", async () => {
  const db = tiruan();
  const req = permintaan({ versi: 1, pegawai_uuids: ["pegawai-kedua"] });
  const hasil = await Promise.allSettled([db.layanan.daftarPeserta(req), db.layanan.daftarPeserta(req)]);
  assert.equal(hasil.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(db.state().peserta.length, 2);
  assert.equal(db.state().kegiatan[0].versi, 2);
  assert.ok(db.state().log.some((x) => x.sql.includes("FOR UPDATE") && x.params[1] === "faskes-a"));
});

test("hasil sementara nol jam, verifikasi menghitung server, koreksi membatalkan jam", async () => {
  const db = tiruan();
  const sementara = await db.layanan.catatHasil(permintaan({ versi: 1, kehadiran: "sebagian", hasil: "lulus", jam_hadir: "4.25", jam_diakui: 999, faskes_uuid: "faskes-b" }));
  assert.equal(sementara.jam_diakui, 0); assert.equal(sementara.faskes_uuid, "faskes-a");
  const v = await db.layanan.verifikasi(permintaan({ versi: 2, diverifikasi_oleh: "orang-lain" }));
  assert.equal(v.jam_diakui, 4.25); assert.equal(v.diverifikasi_oleh, "petugas-fiktif");
  await assert.rejects(() => db.layanan.catatHasil(permintaan({ versi: 3, kehadiran: "hadir", hasil: "lulus", jam_hadir: 8 })), (e) => e.status === 409);
  const koreksi = await db.layanan.koreksi(permintaan({ versi: 3, alasan: "Koreksi hasil fiktif" }));
  assert.equal(koreksi.jam_diakui, 0); assert.equal(koreksi.status_verifikasi, "belum_diverifikasi");
});

test("kegagalan kredensial membatalkan verifikasi, sertifikat dan audit dalam transaksi yang sama", async () => {
  const db = tiruan({ gagalSertifikat: true });
  await assert.rejects(() => db.layanan.verifikasi(permintaan({ versi: 1, sertifikat: { nomor: "FIKTIF-1", penerbit: "Lembaga fiktif", tanggal_mulai: waktu } })), /Kegagalan kredensial/);
  assert.equal(db.state().peserta[0].status_verifikasi, "belum_diverifikasi");
  assert.equal(db.state().peserta[0].versi, 1); assert.equal(db.state().kredensial.length, 0); assert.equal(db.state().audit.length, 0);
});

test("sertifikat disimpan dengan identitas induk yang tertaut dan jenis kredensial bersama", async () => {
  const db = tiruan();
  const r = await db.layanan.verifikasi(permintaan({ versi: 1, sertifikat: { nomor: "FIKTIF-2", penerbit: "Lembaga fiktif", tanggal_mulai: waktu, pegawai_uuid: "induk-luar", jenis: "str" } }));
  assert.equal(r.kredensial_uuid, "sertifikat-baru");
  assert.equal(db.state().kredensial[0].pegawai_uuid, "induk-fiktif");
  assert.equal(db.state().kredensial[0].jenis, "sertifikat");
});

test("peserta atau kegiatan terhapus dan versi lama tidak dapat diubah", async () => {
  const db = tiruan();
  await assert.rejects(() => db.layanan.verifikasi(permintaan({ versi: 99 })), (e) => e.status === 409);
  db.state().peserta[0].deleted_at = waktu;
  await assert.rejects(() => db.layanan.verifikasi(permintaan({ versi: 1 })), (e) => e.status === 404);
  assert.equal(db.state().audit.length, 0);
});

test("kegiatan tidak selesai sebelum seluruh hasil terverifikasi; riwayat tidak berubah oleh katalog", async () => {
  const db = tiruan();
  await assert.rejects(() => db.layanan.statusKegiatan(permintaan({ versi: 1, status: "selesai" })), (e) => e.status === 409);
  await db.layanan.verifikasi(permintaan({ versi: 1 }));
  const g = await db.layanan.statusKegiatan(permintaan({ versi: 1, status: "selesai" }));
  assert.equal(g.status, "selesai"); assert.equal(g.jam, "8.00");
  await assert.rejects(() => db.layanan.hapusKegiatan(permintaan({ versi: 2, alasan: "Fiktif" })), (e) => e.status === 409);
  await db.layanan.bukaKegiatan(permintaan({ versi: 2, alasan: "Koreksi kegiatan fiktif" }));
  assert.equal(db.state().peserta[0].jam_diakui, 0);
});

test("rekap memuat pegawai nol jam dan target kosong tidak dianggap gagal", () => {
  const pegawai = [{ uuid: "a", unit_uuid: "unit-fiktif", tipe: 1 }, { uuid: "b", unit_uuid: "unit-lain", tipe: 2 }];
  const target = [{ jenis_cakupan: "semua", target_jam: 10 }, { jenis_cakupan: "unit", referensi_uuid: "unit-fiktif", target_jam: 12 }, { jenis_cakupan: "pegawai", referensi_uuid: "a", target_jam: 15 }];
  assert.equal(pilihTarget(target, pegawai[0]).target_jam, 15);
  const rekap = susunRekap(pegawai, [{ pegawai_uuid: "a", jam_diakui: "0.10" }, { pegawai_uuid: "a", jam_diakui: "0.20" }], target);
  assert.equal(rekap[0].jam_tercatat, 0.3); assert.equal(rekap[1].jam_tercatat, 0);
  assert.equal(susunRekap(pegawai, [], [])[0].status_pemenuhan, "belum_ditetapkan");
});

test("pemenuhan wajib membaca pencabutan/verifikasi kredensial aktual dan cakupan periode", () => {
  const p = [{ uuid: "a", unit_uuid: "u", tipe: 1 }], kat = [{ uuid: "k", nama: "Pelatihan fiktif" }];
  const c = [{ katalog_uuid: "k", jenis_cakupan: "unit", referensi_uuid: "u", mulai_berlaku: waktu - 100 }];
  const s = [{ pegawai_uuid: "a", katalog_uuid: "k", hasil: "lulus", kehadiran: "hadir", jadwal_selesai: waktu - 10, kredensial_status: "aktif", kredensial_verifikasi: "terverifikasi", tanggal_mulai: waktu - 10, tanggal_berakhir: waktu + 86400 }];
  assert.equal(susunWajib(p, kat, c, s, { syarat_sertifikat: true }, waktu).length, 0);
  assert.equal(susunWajib(p, kat, c, [{ ...s[0], kredensial_status: "dicabut" }], { syarat_sertifikat: true }, waktu)[0].alasan, "sertifikat_belum_sah");
  assert.equal(susunWajib(p, kat, [{ ...c[0], akhir_berlaku: waktu }], [], kebijakan, waktu).length, 0);
  assert.equal(susunWajib(p, kat, c, [], null, waktu).length, 0);
});

test("peringatan membedakan hari kedaluwarsa, hari terakhir, rentang batas dan tanpa tanggal", () => {
  const awalHari = waktu - 7 * 3600;
  const s = [-1, 0, 30, 31].map((hari) => ({ kredensial_uuid: `fiktif-${hari}`, kredensial_status: "aktif", tanggal_berakhir: awalHari + hari * 86400 }));
  const r = susunPeringatan([...s, { kredensial_uuid: "tanpa-akhir", kredensial_status: "aktif", tanggal_berakhir: null }], waktu, 30);
  assert.equal(r.length, 3); assert.equal(r[0].status_masa_berlaku, "kedaluwarsa"); assert.equal(r[1].status_masa_berlaku, "akan_kedaluwarsa");
  assert.equal(r[2].sisa_hari, 30);
});

test("Pelatihan memiliki izin aksi terpisah, termasuk verifikasi, sertifikat dan ekspor", () => {
  const s = sdmPermission.subModules.find((s) => s.name === "Pelatihan");
  for (const aksi of ["READ", "KELOLA KATALOG", "KELOLA KEGIATAN", "KELOLA PESERTA", "CATAT HASIL", "VERIFIKASI HASIL", "KELOLA SERTIFIKAT", "KELOLA KEBIJAKAN", "BACA REKAP", "EKSPOR"]) assert.ok(s.allows.includes(aksi), aksi);
});

test("ekspor memakai faskes token, filter tampilan, batas baris dan kebijakan hasil kosong", async () => {
  const req = permintaan({ format: "xlsx", jenis_laporan: "jam", tahun: 2026, unit_uuid: "unit-fiktif", faskes_uuid: "faskes-b" });
  const jejak = [], transaksi = (fn) => fn({ query: async () => ({ rows: [] }) });
  const deps = { transaksi, audit: async (...args) => jejak.push(args.slice(2)), laporan: async (f, filter, jenis) => {
    assert.equal(f, "faskes-a"); assert.equal(filter.unit_uuid, "unit-fiktif"); assert.equal(jenis, "jam");
    return { data: [], kebijakan: { izinkan_ekspor_kosong: false }, tahun: 2026 };
  } };
  await assert.rejects(() => siapkanEkspor(req, deps), /Ekspor kosong/); assert.equal(jejak.length, 0);
  const hasil = await siapkanEkspor(req, { ...deps, laporan: async () => ({ data: [], kebijakan: { izinkan_ekspor_kosong: true }, tahun: 2026 }) });
  assert.equal(hasil.nama_berkas, "Pelatihan-jam-2026.xlsx"); assert.equal(jejak.length, 1);
  await assert.rejects(() => siapkanEkspor(req, { ...deps, laporan: async () => ({ data: Array(10001).fill({}), tahun: 2026 }) }), /10.000/);
  await assert.rejects(() => siapkanEkspor(permintaan({ format: "csv" }), deps), /Excel atau PDF/);
});

test("setiap endpoint menolak pengguna tanpa izin; ekspor juga memerlukan izin tersendiri", async () => {
  const { pool } = await import("../src/db.js");
  const { default: rute } = await import("../src/hr/pelatihan/rute.js");
  const lama = pool.query;
  let nomor = 0;
  const jalankan = (fn, req) => new Promise((resolve, reject) => {
    const res = { kode: 200, status(kode) { this.kode = kode; return this; }, json(body) { resolve({ kode: this.kode, body }); } };
    fn(req, res, (e) => reject(e ?? new Error("Pengguna tanpa izin lolos")));
  });
  try {
    pool.query = async (sql) => { assert.match(sql, /SELECT permissions FROM users/); return { rows: [{ permissions: [] }] }; };
    for (const layer of rute.stack.filter((s) => s.route)) {
      const req = { author: { username: `tanpa-izin-fiktif-${++nomor}`, faskesUuid: "faskes-a", role: "petugas" }, body: {} };
      const res = await jalankan(layer.route.stack[0].handle, req);
      assert.equal(res.kode, 403, layer.route.path);
    }
    const layer = rute.stack.find((s) => s.route?.path === "/ekspor");
    pool.query = async () => ({ rows: [{ permissions: [{ module: "HR / SDM", subModules: [{ name: "Pelatihan", allows: ["BACA REKAP"] }] }] }] });
    const tanpaEkspor = await jalankan(layer.route.stack[1].handle, { author: { username: "hanya-rekap-fiktif", faskesUuid: "faskes-a" } });
    assert.equal(tanpaEkspor.kode, 403);
    pool.query = async () => ({ rows: [{ permissions: [{ module: "HR / SDM", subModules: [{ name: "Pelatihan", allows: ["VERIFIKASI HASIL"] }] }] }] });
    const verifikasi = rute.stack.find((s) => s.route?.path.endsWith("/verifikasi"));
    const tanpaSertifikat = await jalankan(verifikasi.route.stack[1].handle, { author: { username: "hanya-verifikasi-fiktif", faskesUuid: "faskes-a" }, body: { sertifikat: {} } });
    assert.equal(tanpaSertifikat.kode, 403);
  } finally { pool.query = lama; }
});

test("fitur Pelatihan nonaktif menolak akses berdasarkan faskes token", async () => {
  const { pool } = await import("../src/db.js");
  const { wajibFiturSdm } = await import("../src/hr/fitur.js");
  const lama = pool.query;
  try {
    pool.query = async (sql, p) => { assert.match(sql, /FROM ref_fitur/); assert.equal(p[0], "sdm_pelatihan"); return { rows: [{ tersedia: false }] }; };
    const hasil = await new Promise((resolve, reject) => wajibFiturSdm("sdm_pelatihan")({ author: { faskesUuid: "faskes-a" } }, {
      status: (kode) => ({ json: (body) => resolve({ kode, body }) }),
    }, () => reject(new Error("Fitur nonaktif lolos"))));
    assert.equal(hasil.kode, 403);
  } finally { pool.query = lama; }
});

test("penulis kredensial bersama memakai transaksi pemanggil dan audit tanpa isi berkas", async () => {
  const { catatKredensial } = await import("../src/mutu/penulis-kredensial.js");
  const baris = [], k = { query: async (sql, p) => {
    if (sql.includes("FROM pegawai")) { assert.equal(p[1], "faskes-a"); return { rows: [{ uuid: "induk-fiktif", nama: "Pegawai fiktif" }] }; }
    const kolom = sql.match(/INSERT INTO (\w+) \(([^)]+)\)/);
    assert.ok(kolom, sql);
    const row = Object.fromEntries(kolom[2].split(", ").map((nama, i) => [nama.replaceAll('"', ""), p[i]]));
    baris.push({ tabel: kolom[1], row }); return { rows: [row] };
  } };
  const isi = Buffer.from("%PDF-1.4\nBukti pelatihan fiktif").toString("base64");
  const hasil = await catatKredensial(k, permintaan(), { pegawai_uuid: "induk-fiktif", jenis: "sertifikat", nomor: "FIKTIF-3", tanggal_mulai: waktu,
    berkas: { nama_berkas: "bukti-fiktif.pdf", tipe_mime: "application/pdf", data_base64: isi } }, 10);
  assert.equal(baris[0].tabel, "mutu_kredensial"); assert.equal(baris[1].tabel, "mutu_audit");
  assert.match(hasil.uuid, /^[0-9a-f-]{14}7/);
  assert.equal(hasil.berkas, undefined); assert.ok(Buffer.isBuffer(baris[0].row.berkas));
  const audit = JSON.parse(baris[1].row.data_sesudah);
  assert.equal(audit.berkas, undefined); assert.ok(!JSON.stringify(audit).includes(isi));
});

test("migrasi izin idempoten mempertahankan hak lama dan daftar super admin kosong", async () => {
  const { default: migrasi } = await import("../../database/migrations/20261021040200-std_0040_izin_pelatihan.cjs");
  const lama = { module: "HR / SDM", subModules: [{ name: "Kepegawaian", allows: ["READ"] }] };
  const peran = [
    { tabel: "role", uuid: "peran-fiktif", permissions: JSON.stringify([lama, { module: "Mutu & Akreditasi", subModules: [] }]) },
    { tabel: "role", uuid: "super-tanpa-daftar", permissions: "[]" },
  ];
  const akun = [{ tabel: "users", uuid: "akun-fiktif", permissions: JSON.stringify([{ ...lama }]) }];
  let transaksi = 0;
  const qi = { sequelize: {
    transaction: async (fn) => { transaksi++; return fn({ fiktif: true }); },
    query: async (sql, opsi) => {
      assert.ok(opsi.transaction?.fiktif);
      if (sql.startsWith("SELECT")) { assert.match(sql, /lower\((?:r\.)?name\) = 'super admin'/); return [structuredClone(sql.includes("FROM users") ? akun : peran)]; }
      const row = [...peran, ...akun].find((r) => r.uuid === opsi.replacements.uuid);
      assert.ok(row); row.permissions = opsi.replacements.izin;
      return [[]];
    },
  } };
  await migrasi.up(qi); const pertama = structuredClone([...peran, ...akun]);
  await migrasi.up(qi); assert.deepEqual([...peran, ...akun], pertama); assert.equal(transaksi, 2);
  assert.equal(peran[1].permissions, "[]");
  const izin = JSON.parse(peran[0].permissions);
  assert.deepEqual(izin[0].subModules[0], lama.subModules[0]);
  assert.equal(izin[0].subModules.filter((s) => s.name === "Pelatihan").length, 1);
  assert.equal(izin[1].module, "Mutu & Akreditasi");
});
