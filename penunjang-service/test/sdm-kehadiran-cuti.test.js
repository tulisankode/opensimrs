import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { deflateRawSync } from "node:zlib";
import { tanggalWib, tanggal, waktuImpor, rincianHari, validasiUrutan, validasiKebijakan, kunciKejadian, statusKeputusan, hitungSaldo, alokasiSaldo, selCsv, statusJadwal } from "../src/hr/kehadiran-cuti/aturan.js";
import { bacaCsv, bacaXlsx, bacaBerkasImpor } from "../src/hr/kehadiran-cuti/impor.js";
import { sdmPermission } from "../../auth-service/src/helpers/permission-list.js";

test("pergantian hari WIB, waktu impor, tanggal kabisat dan rentang lintas tahun", () => {
  assert.equal(tanggalWib(Date.parse("2026-10-20T17:00:00Z") / 1000), "2026-10-21");
  assert.equal(waktuImpor("2026-10-20 08:30:00", "wib"), Date.parse("2026-10-20T01:30:00Z") / 1000);
  assert.throws(() => waktuImpor("2026-02-30 08:30:00", "wib"));
  assert.throws(() => waktuImpor("2026-10-20 24:00:00", "wib"));
  assert.throws(() => waktuImpor("20/10/2026", "wib"));
  assert.equal(tanggal("2028-02-29"), "2028-02-29");
  assert.throws(() => tanggal("2026-02-29"));
  assert.deepEqual(rincianHari("2026-12-31", "2027-01-02"), { 2026: ["2026-12-31"], 2027: ["2027-01-01", "2027-01-02"] });
  assert.throws(() => rincianHari("2026-12-31", "2026-12-30"));
});
test("urutan web menolak masuk ganda, pulang tanpa masuk, waktu lama, serta sesi terlalu panjang", () => {
  validasiUrutan(null, "masuk", 100000, 24);
  validasiUrutan({ jenis: "masuk", waktu: 100000 }, "pulang", 110000, 24);
  assert.throws(() => validasiUrutan(null, "pulang", 100000, 24), { status: 409 });
  assert.throws(() => validasiUrutan({ jenis: "masuk", waktu: 100000 }, "masuk", 100001, 24), { status: 409 });
  assert.throws(() => validasiUrutan({ jenis: "masuk", waktu: 100000 }, "pulang", 99999, 24));
  assert.throws(() => validasiUrutan({ jenis: "masuk", waktu: 100000 }, "pulang", 200000, 24));
});
test("deduplikasi stabil lintas berkas dan tetap terisolasi faskes/mesin", () => {
  const args = ["faskes-fiktif", "mesin-fiktif", "pegawai-fiktif", 100000, "masuk"];
  assert.equal(kunciKejadian(...args), kunciKejadian(...args));
  assert.notEqual(kunciKejadian(...args), kunciKejadian("faskes-lain", ...args.slice(1)));
  assert.equal(kunciKejadian(...args, "id-kejadian"), kunciKejadian(...args.slice(0, 3), 200000, "pulang", "id-kejadian"));
});
test("CSV mendukung koma, kutip ganda, baris di dalam sel, serta menolak kutip rusak dan sel berlebih", () => {
  assert.deepEqual(bacaCsv('pegawai,waktu,jenis\r\n"pegawai,fiktif","baris\nbaru","ma""suk"'), [["pegawai", "waktu", "jenis"], ["pegawai,fiktif", "baris\nbaru", 'ma"suk']]);
  assert.throws(() => bacaCsv('a,b\n"belum ditutup'));
  assert.throws(() => bacaCsv('a,b\n"tutup"teks,x'));
  assert.throws(() => bacaCsv(`a\n${"x".repeat(2001)}`));
  const b = { nama: "fiktif.csv", base64: Buffer.from("pegawai,waktu,jenis\nfiktif,1,masuk").toString("base64"), pemetaan: { pegawai: "pegawai", waktu: "waktu", jenis: "jenis" } };
  assert.equal(bacaBerkasImpor(b).baris[0].nomor_baris, 2);
  assert.throws(() => bacaBerkasImpor({ ...b, pemetaan: { ...b.pemetaan, jenis: "tidak_ada" } }));
  assert.throws(() => bacaBerkasImpor({ ...b, nama: "fiktif.xls" }));
});
const zipFiktif = (entri) => {
  const lokal = [], pusat = [];
  let offset = 0;
  for (const [nama, nilai] of Object.entries(entri)) {
    const namaBuf = Buffer.from(nama), data = Buffer.from(nilai), padat = deflateRawSync(data);
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50); l.writeUInt16LE(8, 8); l.writeUInt32LE(padat.length, 18); l.writeUInt32LE(data.length, 22); l.writeUInt16LE(namaBuf.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(8, 10); c.writeUInt32LE(padat.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(namaBuf.length, 28); c.writeUInt32LE(offset, 42);
    lokal.push(l, namaBuf, padat); pusat.push(c, namaBuf); offset += l.length + namaBuf.length + padat.length;
  }
  const akhir = Buffer.alloc(22); akhir.writeUInt32LE(0x06054b50); akhir.writeUInt16LE(Object.keys(entri).length, 10); akhir.writeUInt32LE(Buffer.concat(pusat).length, 12); akhir.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokal, ...pusat, akhir]);
};
const entriXlsx = (isi) => ({ "xl/workbook.xml": '<workbook><sheets><sheet name="Fiktif" r:id="rId1"/></sheets></workbook>',
  "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
  "xl/sharedStrings.xml": '<sst><si><t>Pegawai &amp; unit</t></si></sst>', "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${isi}</sheetData></worksheet>` });
test("XLSX membaca kamus teks dan sel renggang; menolak formula, arsip rusak, dan ekspansi berlebih", () => {
  const r = bacaXlsx(zipFiktif(entriXlsx('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>Masuk</t></is></c></row>')));
  assert.deepEqual(r, [["Pegawai & unit", "", "Masuk"]]);
  assert.throws(() => bacaXlsx(zipFiktif(entriXlsx('<row><c r="A1"><f>1+1</f><v>2</v></c></row>'))));
  assert.throws(() => bacaXlsx(Buffer.from("bukan ZIP")));
  assert.throws(() => bacaXlsx(zipFiktif({ ...entriXlsx(""), "besar.xml": "x".repeat(9 * 1024 * 1024) })));
});
test("kebijakan wajib lengkap tanpa hak 12 hari universal", () => {
  assert.throws(() => validasiKebijakan({ tahun: 2026 }));
  const b = { tahun: 2026, hak_tahunan: 0, dasar_hari: "kalender", batas_carry_over: 0, bulan_kedaluwarsa: 12, batal_sebelum_sah: false, batal_setelah_sah: false, batal_saat_berjalan: false, maks_sesi_jam: 24 };
  assert.equal(validasiKebijakan(b).hak_tahunan, 0);
  assert.throws(() => validasiKebijakan({ ...b, batal_setelah_sah: "true" }));
});
test("persetujuan berurutan, penolakan beralasan, atasan salah dan keputusan sendiri ditolak", () => {
  const p = { pemohon: "pegawai-fiktif", status: "menunggu_atasan" };
  assert.equal(statusKeputusan(p, "setujui", "atasan-fiktif", true, false), "menunggu_sdm");
  assert.throws(() => statusKeputusan(p, "sahkan", "sdm-fiktif", false, true));
  assert.throws(() => statusKeputusan(p, "setujui", "pegawai-fiktif", true, true), { status: 403 });
  assert.throws(() => statusKeputusan(p, "setujui", "atasan-lain", false, false));
  assert.throws(() => statusKeputusan(p, "tolak", "atasan-fiktif", true, false));
  assert.equal(statusKeputusan(p, "tolak", "atasan-fiktif", true, false, "Periode perlu diperbaiki"), "ditolak");
  assert.equal(statusKeputusan({ ...p, status: "menunggu_sdm" }, "sahkan", "sdm-fiktif", false, true), "sah");
});
test("hak 12 menjadi 9 setelah pemakaian 3, reservasi terpisah, carry-over kedaluwarsa dan pengembalian tidak memperpanjang hak", () => {
  const m = [{ sumber: "hak", jumlah_hari: 12 }, { sumber: "hak", jumlah_hari: -3 }, { sumber: "carry_over", jumlah_hari: 4, kedaluwarsa: 200 }, { sumber: "carry_over", jumlah_hari: -2, kedaluwarsa: 200 }];
  assert.deepEqual(alokasiSaldo(hitungSaldo(m, 0, 100), 3), { carry_over: 2, hak: 1 });
  assert.equal(hitungSaldo(m, 2, 201).sisa, 9);
  assert.equal(hitungSaldo(m, 2, 201).tersedia, 7);
  assert.throws(() => alokasiSaldo(hitungSaldo(m, 2, 201), 8), { status: 422 });
  assert.equal(hitungSaldo([...m, { sumber: "carry_over", jumlah_hari: 2, kedaluwarsa: 200 }], 0, 201).sisa, 9);
});
test("ekspor menetralkan formula dan jadwal tidak tersedia tidak diberi nilai nol", () => {
  for (const v of ["=1+1", " @SUM(1)", "-1", "+1"]) assert.ok(selCsv(v).startsWith('"\''));
  assert.equal(selCsv('Perawat "Fiktif"'), '"Perawat ""Fiktif"""');
  assert.equal(statusJadwal().terlambat, null);
  assert.ok(sdmPermission.subModules.find((s) => s.name === "Kehadiran, Cuti & Izin").allows.includes("EKSPOR REKAP"));
});

// Uji handler nyata dengan dependensi dalam memori; tidak memuat konfigurasi atau membuka database.
const require = createRequire(import.meta.url);
test("migrasi membentuk tabel secara idempoten dan menolak skema lama yang berbeda tanpa database", async () => {
  const migrasi = require("../../database/migrations/20261021070000-kehadiran_cuti.cjs");
  const skema = new Map(), indeks = new Set();
  let presisi = 8;
  const antarmuka = {
    describeTable: async (nama) => skema.get(nama),
    sequelize: {
      transaction: async (fn) => fn({}),
      query: async (sql) => {
        if (sql.includes("information_schema.columns")) return [[{ numeric_precision: presisi, numeric_scale: 2 }]];
        const tabel = /CREATE TABLE IF NOT EXISTS (\w+)/.exec(sql)?.[1];
        if (tabel && !skema.has(tabel)) {
          const bentuk = {};
          for (const m of sql.matchAll(/\b(\w+)\s+(varchar\(\d+\)|integer|bigint|boolean|jsonb|bytea|text|numeric\(\d+,\d+\))([^,\n]*)/gi)) {
            bentuk[m[1]] = { type: m[2].startsWith("numeric") ? "NUMERIC" : m[2].toUpperCase(), allowNull: !/NOT NULL|PRIMARY KEY/.test(m[3]) };
          }
          skema.set(tabel, bentuk);
        }
        const index = /CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (\w+)/.exec(sql)?.[1];
        if (index) indeks.add(index);
        return [[]];
      },
    },
  };
  await migrasi.up(antarmuka);
  const jumlah = skema.size, jumlahIndeks = indeks.size;
  await migrasi.up(antarmuka);
  assert.equal(skema.size, jumlah); assert.equal(indeks.size, jumlahIndeks);
  assert.ok(indeks.has("hr_kehadiran_deduplikasi")); assert.ok(indeks.has("hr_saldo_reservasi_unik"));
  presisi = 10;
  await assert.rejects(() => migrasi.up(antarmuka), /Presisi/);
  presisi = 8;
  delete skema.get("hr_jenis_cuti").faskes_uuid;
  await assert.rejects(() => migrasi.up(antarmuka), /faskes_uuid/);
});
const urlData = (s) => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
let keadaan;
const db = {
  query: async () => [], satu: async () => null, sekarang: () => Date.parse("2026-10-20T00:00:00+07:00") / 1000,
  transaksi: async (fn) => {
    const sebelum = structuredClone(keadaan);
    try { return await fn({}); } catch (e) { keadaan = sebelum; throw e; }
  },
};
const repo = {
  aktifSql: "h.deleted_at IS NULL",
  ambil: async (tabel, uuid, f) => {
    const r = keadaan[tabel]?.find((r) => r.uuid === uuid && r.faskes_uuid === f && !r.deleted_at);
    if (!r) throw Object.assign(new Error("Data tidak ditemukan"), { status: 404 });
    return structuredClone(r);
  },
  buat: async (tabel, req, b) => { const r = { uuid: `fiktif-${Date.now()}`, ...b }; (keadaan[tabel] ??= []).push(r); return r; },
  perbarui: async (tabel, req, p, b) => { const r = keadaan[tabel].find((r) => r.uuid === p.uuid); Object.assign(r, b); return structuredClone(r); },
  audit: async () => { if (keadaan.gagalAudit) throw Object.assign(new Error("Audit uji gagal"), { status: 503 }); keadaan.audit++; },
  pegawai: async () => ({ uuid: "pegawai-fiktif", tanggal_mulai: 1 }), milikSaya: async () => ({ uuid: "atasan-fiktif" }),
  kunciPegawai: async () => ({ uuid: "pegawai-fiktif" }), dalamCakupan: async (req) => { if (req.luarCakupan) throw Object.assign(new Error("Di luar cakupan"), { status: 403 }); },
  bolehDetail: async () => ({}), cekVersi: (p, v) => { if (p.versi !== v) throw Object.assign(new Error("Versi berubah"), { status: 409 }); },
};
const saldoMock = { pastikanSaldo: async () => ({}), bacaSaldo: async () => ({}), reservasiSaldo: async () => {},
  sahkanSaldo: async () => { keadaan.pemakaian += 3; }, lepasReservasi: async () => { keadaan.reservasi = 0; },
  kembalikanSaldo: async () => { keadaan.pemakaian -= 3; }, kebijakan: async () => ({}), tahunKini: () => 2026, mutasi: async () => ({}) };
globalThis.__sdmKehadiranUji = { db, repo, saldoMock };
const izinUrl = urlData(`export const wajibIzin = (m,s,a) => (req,res,next) => req.izin.includes(a) ? next() : res.status(403).json({message:'Izin ditolak'}); export const punyaIzin = async (req,m,s,a) => req.izin.includes(a);`);
let sumber = readFileSync(new URL("../src/hr/kehadiran-cuti/cuti.js", import.meta.url), "utf8");
const ganti = new Map([
  ["express", pathToFileURL(require.resolve("express")).href],
  ["node:crypto", "node:crypto"], ["../../db.js", urlData('export const {query,satu,sekarang,transaksi}=globalThis.__sdmKehadiranUji.db;')],
  ["../../umum/respons.js", new URL("../src/umum/respons.js", import.meta.url).href], ["../../umum/izin.js", izinUrl],
  ["../../mutu/dasar.js", urlData('export const sisipkanBerkas=async()=>({});')],
  ["./repository.js", urlData('export const {ambil,buat,perbarui,audit,pegawai,milikSaya,kunciPegawai,dalamCakupan,bolehDetail,cekVersi,aktifSql}=globalThis.__sdmKehadiranUji.repo;')],
  ["./aturan.js", new URL("../src/hr/kehadiran-cuti/aturan.js", import.meta.url).href],
  ["./saldo.js", urlData('export const {pastikanSaldo,bacaSaldo,reservasiSaldo,sahkanSaldo,lepasReservasi,kembalikanSaldo,kebijakan,tahunKini,mutasi}=globalThis.__sdmKehadiranUji.saldoMock;')],
]);
for (const [asal, tujuan] of ganti) sumber = sumber.replaceAll(`"${asal}"`, JSON.stringify(tujuan));
const { default: router } = await import(urlData(sumber));
delete globalThis.__sdmKehadiranUji;
const mulai = (status = "menunggu_atasan") => {
  keadaan = { hr_pengajuan_cuti: [{ uuid: "cuti-fiktif", faskes_uuid: "faskes-fiktif", kepegawaian_uuid: "pegawai-fiktif", pemohon: "pemohon-fiktif", atasan_uuid: "atasan-fiktif", status, versi: 1,
    memotong_saldo: true, tanggal_mulai: "2026-10-22", tanggal_selesai: "2026-10-24", potret: { 2026: { data: { batal_saat_berjalan: true } } } }], pemakaian: 0, reservasi: 3, audit: 0 };
};
const panggil = async (path, body, tambahan = {}) => {
  const lapisan = router.stack.find((l) => l.route?.path === path && l.route.methods.post);
  const req = { author: { username: "pemeriksa-fiktif", faskesUuid: "faskes-fiktif" }, params: { uuid: "cuti-fiktif" }, body, izin: ["READ", "TINJAU ATASAN", "SAHKAN SDM"], ...tambahan };
  return new Promise((resolve, reject) => {
    let status = 200;
    const res = { status: (s) => { status = s; return res; }, json: (b) => resolve({ status, ...b }) };
    const handlers = lapisan.route.stack.map((s) => s.handle);
    const next = (e) => { if (e) return reject(e); const fn = handlers.shift(); if (fn) Promise.resolve(fn(req, res, next)).catch(reject); };
    next();
  });
};
test("handler persetujuan menjaga tahap dan versi; saldo hanya berubah saat sah", async () => {
  mulai();
  const p = "/pengajuan/:uuid/keputusan";
  assert.equal((await panggil(p, { versi: 1, aksi: "setujui" })).payload.status, "menunggu_sdm");
  assert.equal(keadaan.pemakaian, 0);
  assert.equal((await panggil(p, { versi: 1, aksi: "sahkan" })).status, 409);
  assert.equal((await panggil(p, { versi: 2, aksi: "sahkan" })).payload.status, "sah");
  assert.equal(keadaan.pemakaian, 3); assert.equal(keadaan.reservasi, 0);
  assert.equal((await panggil(p, { versi: 2, aksi: "sahkan" })).status, 409);
  assert.equal(keadaan.pemakaian, 3);
});
test("handler menolak izin kosong, faskes lain, hapus lunak, keputusan sendiri, dan unit di luar cakupan", async () => {
  const p = "/pengajuan/:uuid/keputusan";
  mulai("menunggu_sdm");
  assert.equal((await panggil(p, { versi: 1, aksi: "sahkan" }, { izin: [] })).status, 403);
  assert.equal((await panggil(p, { versi: 1, aksi: "sahkan" }, { author: { username: "pemeriksa-fiktif", faskesUuid: "lain" } })).status, 404);
  assert.equal((await panggil(p, { versi: 1, aksi: "sahkan" }, { author: { username: "pemohon-fiktif", faskesUuid: "faskes-fiktif" } })).status, 403);
  assert.equal((await panggil(p, { versi: 1, aksi: "sahkan" }, { luarCakupan: true })).status, 403);
  keadaan.hr_pengajuan_cuti[0].deleted_at = 1;
  assert.equal((await panggil(p, { versi: 1, aksi: "sahkan" })).status, 404);
  assert.equal(keadaan.pemakaian, 0);
});
test("kegagalan audit membatalkan status, keputusan, mutasi dan pelepasan reservasi", async (t) => {
  t.mock.method(console, "error", () => {});
  mulai("menunggu_sdm"); keadaan.gagalAudit = true;
  const r = await panggil("/pengajuan/:uuid/keputusan", { versi: 1, aksi: "sahkan" });
  assert.equal(r.status, 503); assert.equal(keadaan.hr_pengajuan_cuti[0].status, "menunggu_sdm");
  assert.equal(keadaan.pemakaian, 0); assert.equal(keadaan.reservasi, 3); assert.equal(keadaan.hr_pengajuan_cuti_keputusan, undefined);
});
test("penolakan tidak memotong saldo dan jenis tanpa potongan tetap dapat disahkan", async () => {
  mulai();
  assert.equal((await panggil("/pengajuan/:uuid/keputusan", { versi: 1, aksi: "tolak", catatan: "Tanggal perlu dikoreksi" })).payload.status, "ditolak");
  assert.equal(keadaan.pemakaian, 0); assert.equal(keadaan.reservasi, 0);
  mulai("menunggu_sdm"); keadaan.hr_pengajuan_cuti[0].memotong_saldo = false;
  assert.equal((await panggil("/pengajuan/:uuid/keputusan", { versi: 1, aksi: "sahkan" })).payload.status, "sah");
  assert.equal(keadaan.pemakaian, 0);
});
test("pembatalan sah mengembalikan saldo sekali, pengulangan keputusan ditolak", async () => {
  mulai("sah"); keadaan.pemakaian = 3; keadaan.hr_pengajuan_cuti[0].pembatalan = true;
  const p = "/pengajuan/:uuid/keputusan-pembatalan";
  assert.equal((await panggil(p, { versi: 1, aksi: "setujui" })).payload.status, "batal");
  assert.equal(keadaan.pemakaian, 0);
  assert.equal((await panggil(p, { versi: 2, aksi: "setujui" })).status, 409);
  assert.equal(keadaan.pemakaian, 0);
});
