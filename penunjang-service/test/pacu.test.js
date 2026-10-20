import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { definisiValid, nilaiValid, urutanWaktu, konfigurasiBiaya, versiValid } from "../src/kamar-operasi/pacu-validasi.js";

const definisi = {
  nama: "Protokol uji fiktif", interval_pemantauan_detik: 300,
  parameter: [{ kode: "nyeri", nama: "Nyeri", tipe: "angka", satuan: "skala faskes", wajib: true }],
  kriteria_pindah: [{ kode: "hasil", nama: "Hasil peninjauan", tipe: "teks", wajib: true }],
  format_serah_terima: [{ kode: "situasi", nama: "Situasi", tipe: "teks", wajib: true }], biaya: { aktif: false },
};
test("protokol memerlukan definisi faskes dan menolak kode ganda", () => {
  assert.equal(definisiValid(definisi), definisi);
  assert.throws(() => definisiValid({ ...definisi, interval_pemantauan_detik: 0 }));
  assert.throws(() => definisiValid({ ...definisi, parameter: [...definisi.parameter, ...definisi.parameter] }));
  assert.throws(() => definisiValid({ ...definisi, kriteria_pindah: [] }));
});
test("parameter wajib, tipe, dan parameter asing diperiksa tanpa ambang klinis universal", () => {
  nilaiValid(definisi.parameter, { nyeri: 0 });
  assert.throws(() => nilaiValid(definisi.parameter, {}));
  assert.throws(() => nilaiValid(definisi.parameter, { nyeri: "0" }));
  assert.throws(() => nilaiValid(definisi.parameter, { nyeri: Infinity }));
  assert.throws(() => nilaiValid(definisi.parameter, { nyeri: 1, asing: 1 }));
});
test("urutan waktu dan rentang catatan diperiksa saat koreksi", () => {
  const e = { waktu_tiba: 100, waktu_mulai_pemantauan: 110, waktu_siap_pindah: 120, waktu_keluar: 130 };
  urutanWaktu(e, [{ jenis: "pemantauan", waktu_kejadian: 115 }]);
  assert.throws(() => urutanWaktu({ ...e, waktu_keluar: 119 }));
  assert.throws(() => urutanWaktu(e, [{ jenis: "pemantauan", waktu_kejadian: 105 }]));
  assert.throws(() => urutanWaktu(e, [{ jenis: "intervensi", waktu_kejadian: 131 }]));
  assert.throws(() => versiValid({ versi: 2 }, 1), { status: 409 });
});
test("biaya nonaktif dan paket tidak memerlukan tarif; biaya terpisah memerlukan pemetaan lengkap", () => {
  assert.deepEqual(konfigurasiBiaya(undefined), { aktif: false });
  assert.deepEqual(konfigurasiBiaya({ aktif: true, termasuk_paket: true }), { aktif: true, termasuk_paket: true });
  assert.throws(() => konfigurasiBiaya({ aktif: true, termasuk_paket: false }));
});

// Router dimuat dengan pengganti dependensi: tidak memuat konfigurasi, .env, atau membuka database.
const require = createRequire(import.meta.url);
const dataUrl = (s) => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
let keadaan;
const episode = () => ({ uuid: "episode-fiktif", faskes_uuid: "faskes-a", versi: 1,
  status: "dalam_pemantauan", waktu_tiba: 100, waktu_mulai_pemantauan: 110,
  waktu_siap_pindah: null, waktu_keluar: null, protokol_snapshot: structuredClone(definisi) });
const db = {
  query: async (sql, p) => {
    if (sql.includes("FROM pacu_catatan")) return keadaan.pacu_catatan.filter((c) => c.episode_uuid === p[0] && c.faskes_uuid === p[1]);
    throw new Error(`Kueri uji belum dikenali: ${sql}`);
  },
  satu: async (sql, p) => {
    if (sql.includes('FROM rawat_inaps')) return keadaan.kunjungan ?? null;
    if (sql.includes('SELECT uuid FROM patients')) return p[1] === 'faskes-a' ? { uuid: p[0] } : null;
    if (sql.includes('SELECT uuid FROM pacu_episode')) return keadaan.pacu_episode.find(e => e.faskes_uuid === p[0] && e.jadwal_operasi_uuid === p[1] && !e.deleted_at) ?? null;
    if (sql.includes('FROM ok_laporan_operasi')) return keadaan.laporan ?? null;
    if (sql.includes('FROM ok_laporan_anestesi')) return keadaan.anestesi ?? null;
    if (sql.includes("AS aktif")) return { aktif: keadaan.aktif };
    if (sql.includes("FROM lokasi")) return p[1] === "faskes-a" && p[0] === "unit-fiktif" ? { uuid: p[0] } : null;
    if (sql.includes("FROM practitioner")) return p[1] === "faskes-a" && p[0] === "petugas-fiktif" ? { uuid: p[0] } : null;
    const tabel = sql.match(/SELECT \* FROM ((?:pacu|ok)_\w+)/)?.[1];
    if (tabel) return keadaan[tabel]?.find((r) => r.uuid === p[0] && r.faskes_uuid === p[1] && !r.deleted_at) ?? null;
    throw new Error(`Kueri uji belum dikenali: ${sql}`);
  },
  sisipkan: async (tabel, data) => {
    if (keadaan.gagalAudit && tabel === "pacu_riwayat") throw new Error("Audit gagal pada uji fiktif");
    const baru = { uuid: `fiktif-${++keadaan.nomor}`, versi: 1, ...(tabel === "pacu_episode" ? { status: "menunggu_masuk" } : {}), ...structuredClone(data) };
    (keadaan[tabel] ??= []).push(baru);
    return structuredClone(baru);
  },
  ubah: async (tabel, uuid, f, perubahan) => {
    const i = keadaan[tabel].findIndex((r) => r.uuid === uuid && r.faskes_uuid === f);
    keadaan[tabel][i] = { ...keadaan[tabel][i], ...structuredClone(perubahan) };
    return structuredClone(keadaan[tabel][i]);
  },
  transaksi: async (fn) => {
    const sebelum = structuredClone(keadaan);
    try { return await fn({}); } catch (e) { keadaan = sebelum; throw e; }
  },
};
globalThis.__pacuUji = db;
const urlDb = dataUrl(`export const {query,satu,sisipkan,ubah,transaksi}=globalThis.__pacuUji;`);
const urlIzin = dataUrl(`export const izinOk=(s,a)=>(req,res,next)=>req.ditolak===s+':'+a ? res.status(403).json({message:'Akses ditolak'}):next(); export const punyaIzin=async()=>false;`);
const urlBiaya = dataUrl(`export const kirimBiayaPacu=async()=>({status_kirim:'nonaktif'});`);
let sumber = readFileSync(new URL("../src/kamar-operasi/pacu.js", import.meta.url), "utf8");
for (const [asal, tujuan] of [["express", pathToFileURL(require.resolve("express")).href], ["../db.js", urlDb],
  ["../umum/izin.js", urlIzin], ["./pacu-billing.js", urlBiaya],
  ["../umum/respons.js", new URL("../src/umum/respons.js", import.meta.url).href],
  ["./bersama.js", new URL("../src/kamar-operasi/bersama.js", import.meta.url).href],
  ["./pacu-validasi.js", new URL("../src/kamar-operasi/pacu-validasi.js", import.meta.url).href]]) sumber = sumber.replaceAll(`"${asal}"`, JSON.stringify(tujuan));
const { default: rute } = await import(dataUrl(sumber));
delete globalThis.__pacuUji;
const mulai = () => { keadaan = { pacu_episode: [episode()], pacu_catatan: [], pacu_riwayat: [], pacu_biaya: [], nomor: 0, aktif: true }; };
const panggil = async (path, body, tambahan = {}) => {
  const lapisan = rute.stack.find((l) => l.route?.path === path && l.route.methods.post);
  assert.ok(lapisan, path);
  const req = { params: { uuid: "episode-fiktif" }, author: { faskesUuid: "faskes-a", username: "petugas-fiktif" }, body,
    path: path.replace(":uuid", "episode-fiktif"), ...tambahan };
  let kode = 200;
  return new Promise((resolve, reject) => {
    const res = { status: (n) => { kode = n; return res; }, json: (b) => resolve({ kode, ...b }) };
    const daftar = [rute.stack[0].handle, ...lapisan.route.stack.map((s) => s.handle)];
    const lanjut = (e) => {
      if (e) return reject(e);
      const fn = daftar.shift();
      if (fn) Promise.resolve(fn(req, res, lanjut)).catch(reject);
    };
    lanjut();
  });
};
test("endpoint pemantauan menolak modul nonaktif dan izin aksi yang tidak tersedia", async () => {
  mulai(); keadaan.aktif = false;
  assert.equal((await panggil("/:uuid/pemantauan", {})).kode, 403);
  keadaan.aktif = true;
  assert.equal((await panggil("/:uuid/pemantauan", {}, { ditolak: "Pemantauan PACU:CREATE" })).kode, 403);
  assert.equal(keadaan.pacu_catatan.length, 0);
});
test("endpoint menolak faskes lain, soft delete, dan versi usang", async () => {
  mulai();
  assert.equal((await panggil("/:uuid/pemantauan", { versi: 0 })).kode, 409);
  assert.equal((await panggil("/:uuid/pemantauan", { versi: 1 }, { author: { faskesUuid: "faskes-b" } })).kode, 404);
  keadaan.pacu_episode[0].deleted_at = 200;
  assert.equal((await panggil("/:uuid/pemantauan", { versi: 1 })).kode, 404);
});
test("pemantauan menyimpan petugas, riwayat atomik, dan menaikkan versi episode", async () => {
  mulai();
  const r = await panggil("/:uuid/pemantauan", { versi: 1, waktu_ukur: 115, nilai_parameter: { nyeri: 1 }, faskes_uuid: "faskes-b", created_by: "asing" });
  assert.equal(r.kode, 200);
  assert.equal(r.payload.faskes_uuid, "faskes-a");
  assert.equal(r.payload.created_by, "petugas-fiktif");
  assert.equal(keadaan.pacu_episode[0].versi, 2);
  assert.equal(keadaan.pacu_riwayat.length, 2);
});
test("kegagalan audit membatalkan catatan dan perubahan episode", async (t) => {
  t.mock.method(console, "error", () => {});
  mulai(); keadaan.gagalAudit = true;
  const r = await panggil("/:uuid/pemantauan", { versi: 1, waktu_ukur: 115, nilai_parameter: { nyeri: 1 } });
  assert.equal(r.kode, 500);
  assert.equal(keadaan.pacu_catatan.length, 0);
  assert.equal(keadaan.pacu_episode[0].versi, 1);
});
test("keputusan belum siap mempertahankan pemantauan; belum ada pemantauan tidak dapat siap", async () => {
  mulai();
  const b = { versi: 1, waktu_asesmen: 120, keputusan: "siap", hasil_asesmen: "Asesmen fiktif", hasil_kriteria: { hasil: "Tinjauan fiktif" }, alasan: "Alasan fiktif", unit_tujuan_uuid: "unit-fiktif" };
  assert.equal((await panggil("/:uuid/asesmen", b)).kode, 422);
  b.keputusan = "belum_siap";
  assert.equal((await panggil("/:uuid/asesmen", b)).kode, 200);
  assert.equal(keadaan.pacu_episode[0].status, "dalam_pemantauan");
});
test("penyelesaian memerlukan penerimaan dan menolak waktu keluar sebelum catatan terakhir", async () => {
  mulai();
  Object.assign(keadaan.pacu_episode[0], { status: "siap_dipindahkan", waktu_siap_pindah: 120, unit_tujuan_uuid: "unit-fiktif" });
  assert.equal((await panggil("/:uuid/selesaikan", { versi: 1, waktu_keluar: 130 })).kode, 422);
  keadaan.pacu_catatan.push({ uuid: "serah-fiktif", episode_uuid: "episode-fiktif", faskes_uuid: "faskes-a", jenis: "serah_terima_keluar", waktu_kejadian: 125, data: { penerima: "penerima-fiktif", waktu_terima: 135, unit_tujuan_uuid: "unit-fiktif" } });
  assert.equal((await panggil("/:uuid/selesaikan", { versi: 1, waktu_keluar: 130 })).kode, 422);
  assert.equal((await panggil("/:uuid/selesaikan", { versi: 1, waktu_keluar: 140 })).kode, 200);
  assert.equal(keadaan.pacu_episode[0].status, "selesai");
  assert.equal(keadaan.pacu_biaya.length, 0);
});
test("koreksi menyimpan nilai sebelum/sesudah dan alasan; perubahan status dari body ditolak", async () => {
  mulai();
  assert.equal((await panggil("/:uuid/koreksi", { versi: 1, jenis_entitas: "episode", alasan: "Koreksi fiktif", perubahan: { status: "selesai" } })).kode, 422);
  assert.equal((await panggil("/:uuid/koreksi", { versi: 1, jenis_entitas: "episode", alasan: "Koreksi fiktif", perubahan: { waktu_mulai_pemantauan: 105 } })).kode, 200);
  const h = keadaan.pacu_riwayat[0];
  assert.equal(h.nilai_sebelum.waktu_mulai_pemantauan, 110);
  assert.equal(h.nilai_sesudah.waktu_mulai_pemantauan, 105);
  assert.equal(h.alasan, "Koreksi fiktif");
});

test("pembuatan memakai kunjungan asal, menolak duplikasi, dan tidak mensyaratkan jadwal selesai", async () => {
  mulai(); keadaan.pacu_episode = [];
  keadaan.ok_jadwal = [{ uuid: 'jadwal-fiktif', faskes_uuid: 'faskes-a', order_uuid: 'order-fiktif', status: 'terjadwal' }];
  keadaan.ok_order = [{ uuid: 'order-fiktif', faskes_uuid: 'faskes-a', patient_uuid: 'pasien-fiktif', rekam_medis_uuid: 'rekam-fiktif', no_reg: 'REG-FIKTIF', sumber: 'ranap' }];
  keadaan.pacu_protokol = [{ uuid: 'protokol-fiktif', faskes_uuid: 'faskes-a', aktif: true, definisi }];
  keadaan.kunjungan = { uuid: 'kunjungan-fiktif', patient_uuid: 'pasien-fiktif', rekam_medis_uuid: 'rekam-fiktif', type: 'RI' };
  keadaan.laporan = { uuid: 'laporan-fiktif', tindakan_dilakukan: 'Tindakan fiktif' };
  keadaan.anestesi = { uuid: 'anestesi-fiktif' };
  const body = { jadwal_operasi_uuid: 'jadwal-fiktif', protokol_uuid: 'protokol-fiktif', kunjungan_uuid: 'asing' };
  const r = await panggil('/', body);
  assert.equal(r.kode, 200);
  assert.equal(r.payload.kunjungan_uuid, 'kunjungan-fiktif');
  assert.equal(r.payload.status, 'menunggu_masuk');
  assert.equal((await panggil('/', body)).kode, 409);
  assert.equal(keadaan.pacu_episode.length, 1);
  keadaan.pacu_episode = []; keadaan.laporan.tindakan_dilakukan = '';
  assert.equal((await panggil('/', body)).kode, 422);
  keadaan.laporan.tindakan_dilakukan = 'Tindakan fiktif'; keadaan.kunjungan = null;
  assert.equal((await panggil('/', body)).kode, 404);
});
test("seluruh rute aksi memasang izin PACU yang terpisah", async () => {
  mulai();
  for (const lapisan of rute.stack.filter(l => l.route)) {
    assert.ok(lapisan.route.stack.length >= 2, lapisan.route.path);
    const fn = lapisan.route.stack[0].handle;
    const sumber = fn.toString();
    assert.ok(sumber.includes('ditolak'), lapisan.route.path);
  }
});

test("alur lengkap kedatangan sampai selesai menyimpan biaya tertunda dan tidak membuka ulang episode", async () => {
  mulai();
  Object.assign(keadaan.pacu_episode[0], { status: "menunggu_masuk", waktu_tiba: null, waktu_mulai_pemantauan: null });
  keadaan.pacu_episode[0].protokol_snapshot.biaya = { aktif: true, termasuk_paket: false, layanan_uuid: "layanan-fiktif", nama: "Pemulihan fiktif", tarif: 100 };
  assert.equal((await panggil("/:uuid/kedatangan", { versi: 1, waktu_tiba: 100, serah_terima_masuk: { penyerah_uuid: "petugas-fiktif", isi: { situasi: "Serah terima fiktif" } } })).kode, 200);
  assert.equal((await panggil("/:uuid/mulai-pemantauan", { versi: 2, waktu_mulai_pemantauan: 110 })).kode, 200);
  assert.equal((await panggil("/:uuid/pemantauan", { versi: 3, waktu_ukur: 115, nilai_parameter: { nyeri: 1 } })).kode, 200);
  assert.equal((await panggil("/:uuid/asesmen", { versi: 4, waktu_asesmen: 120, hasil_asesmen: "Asesmen fiktif", hasil_kriteria: { hasil: "Tinjauan fiktif" }, keputusan: "siap", alasan: "Alasan fiktif", unit_tujuan_uuid: "unit-fiktif" })).kode, 200);
  const serah = await panggil("/:uuid/serah-terima", { versi: 5, waktu_serah: 125, unit_tujuan_uuid: "unit-fiktif", isi: { situasi: "Pemulihan fiktif" } });
  assert.equal(serah.kode, 200);
  assert.equal((await panggil("/:uuid/serah-terima/:serah_uuid/terima", { versi: 6, waktu_terima: 126 }, { params: { uuid: "episode-fiktif", serah_uuid: serah.payload.uuid } })).kode, 200);
  const selesai = await panggil("/:uuid/selesaikan", { versi: 7, waktu_keluar: 130 });
  assert.equal(selesai.kode, 200);
  assert.equal(selesai.payload.status, "selesai");
  assert.equal(keadaan.pacu_biaya.length, 1);
  assert.equal(keadaan.pacu_biaya[0].kunci_idempoten, "pacu:episode-fiktif:layanan-fiktif");
  assert.ok(keadaan.pacu_riwayat.some((h) => h.aksi === "buat_biaya"));
  assert.equal((await panggil("/:uuid/selesaikan", { versi: 8, waktu_keluar: 140 })).kode, 409);
});
