import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Handler dan izin asli dengan dependensi data tiruan; konfigurasi runtime tidak pernah diimpor.
const urlData = (s) => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const respons = new URL("../src/umum/respons.js", import.meta.url).href;
const bersama = new URL("../src/kamar-operasi/bersama.js", import.meta.url).href;
let log, tersimpan, izin, pilihan, jumlahTransaksi;
const k = {};
const db = {
  query: async (sql, p) => {
    log.push([sql, p]);
    if (sql.includes("FROM inform_consents")) {
      for (const syarat of ["o.rekam_medis_uuid = c.rekam_medis_uuid", "o.faskes_uuid = c.faskes_uuid", "j.faskes_uuid = o.faskes_uuid", "o.deleted_at IS NULL", "j.deleted_at IS NULL", "c.deleted_at IS NULL", "c.faskes_uuid = $2"]) assert.ok(sql.includes(syarat), syarat);
      assert.deepEqual(p.slice(0, 2), ["jadwal-fiktif", "faskes-fiktif"]);
      return pilihan.filter((c) => !c.deleted_at && c.rekam_medis_uuid === "rekam-fiktif" && c.faskes_uuid === p[1] && (!p[2] || c.uuid === p[2]));
    }
    if (sql.includes("FROM item_medis") || sql.includes("FROM lokasi_stok")) {
      assert.equal(p[0], "faskes-fiktif");
      assert.match(sql, /deleted_at IS NULL AND status/);
      return [];
    }
    throw new Error(`Kueri uji tidak dikenal: ${sql}`);
  },
  satu: async (sql, p, klien) => {
    if (sql.includes("FROM users")) return { permissions: izin };
    if (sql.includes("FROM ok_praoperasi")) {
      assert.deepEqual(p, ["jadwal-fiktif", "faskes-fiktif"]);
      return tersimpan;
    }
    if (klien) assert.equal(klien, k);
    return (await db.query(sql, p))[0] ?? null;
  },
  transaksi: async (fn) => { jumlahTransaksi++; return fn(k); },
  sisipkan: async (tabel, data, klien) => { assert.equal(klien, k); tersimpan = { uuid: "pra-fiktif", ...data }; return tersimpan; },
  ubah: async (tabel, uuid, f, data, klien) => { assert.equal(klien, k); assert.equal(f, "faskes-fiktif"); Object.assign(tersimpan, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))); },
};
globalThis.__pilihanOkUji = db;
const basis = urlData("export const {query,satu,sisipkan,ubah,transaksi}=globalThis.__pilihanOkUji;");
const express = urlData(`export default { Router() { return {
  stack: [], get(path,...handlers) { this.stack.push({method:'get',path,handlers}); },
  put(path,...handlers) { this.stack.push({method:'put',path,handlers}); }, use() {}
}; } };`);
const sumberIzin = readFileSync(new URL("../src/umum/izin.js", import.meta.url), "utf8")
  .replace('"../db.js"', JSON.stringify(basis)).replace('"./respons.js"', JSON.stringify(respons));
const izinUrl = urlData(sumberIzin);
const jadwal = urlData(`export async function ambilJadwal(uuid,f) {
  if (uuid !== 'jadwal-fiktif' || f !== 'faskes-fiktif') throw Object.assign(new Error('Jadwal tidak ditemukan'),{status:404});
  return {uuid,status:'terjadwal'};
}`);
async function muat(nama) {
  let sumber = readFileSync(new URL(`../src/kamar-operasi/${nama}.js`, import.meta.url), "utf8");
  for (const [asal, tujuan] of [["express", express], ["../db.js", basis], ["../umum/respons.js", respons], ["../umum/izin.js", izinUrl], ["./jadwal.js", jadwal], ["./bersama.js", bersama]]) {
    // rute utama hanya memasang router lain; tidak perlu memuat layanan lain untuk uji referensi.
    if (nama === "rute" && asal === "./jadwal.js") continue;
    sumber = sumber.replaceAll(JSON.stringify(asal), JSON.stringify(tujuan));
  }
  if (nama === "rute") sumber = sumber.replace(/import (\w+) from "\.\/[^"\n]+";/g, "const $1 = express.Router();");
  return (await import(urlData(sumber))).default;
}
const pra = await muat("praoperasi");
const rute = await muat("rute");
delete globalThis.__pilihanOkUji;
let nomor = 0;
function awal() {
  log = []; tersimpan = null; jumlahTransaksi = 0;
  izin = [{ module: "Kamar Operasi", subModules: [
    { name: "Pra-Operasi", allows: ["READ", "UPDATE"] }, { name: "Pemakaian BHP", allows: ["READ"] },
  ] }];
  pilihan = [{ uuid: "persetujuan-fiktif", rekam_medis_uuid: "rekam-fiktif", faskes_uuid: "faskes-fiktif", persetujuan: true }];
}
async function panggil(router, method, path, body = {}, params = {}) {
  const req = { author: { faskesUuid: "faskes-fiktif", username: `petugas-fiktif-${++nomor}` }, params: { uuid: "jadwal-fiktif", ...params }, query: { faskes_uuid: "faskes-lain" }, body };
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(data) { this.data = data; return this; } };
  const handlers = router.stack.find((r) => r.method === method && r.path === path).handlers;
  let i = 0;
  await handlers[i](req, res, () => handlers[++i](req, res));
  return res;
}

test("daftar persetujuan dibatasi rekam medis order, fasilitas token, dan soft delete", async () => {
  awal();
  pilihan.push({ uuid: "lain", rekam_medis_uuid: "rekam-lain", faskes_uuid: "faskes-fiktif" }, { uuid: "hapus", rekam_medis_uuid: "rekam-fiktif", faskes_uuid: "faskes-fiktif", deleted_at: 1 });
  const res = await panggil(pra, "get", "/jadwal/:uuid/praoperasi/referensi-persetujuan");
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.data.payload.map((c) => c.uuid), ["persetujuan-fiktif"]);
  const lintas = await panggil(pra, "get", "/jadwal/:uuid/praoperasi/referensi-persetujuan", {}, { uuid: "jadwal-lain" });
  assert.equal(lintas.statusCode, 404);
});

test("UUID persetujuan salah konteks atau terhapus ditolak sebelum penulisan", async () => {
  for (const perubahan of [{ rekam_medis_uuid: "rekam-lain" }, { faskes_uuid: "faskes-lain" }, { deleted_at: 1 }]) {
    awal();
    Object.assign(pilihan[0], perubahan);
    const res = await panggil(pra, "put", "/jadwal/:uuid/praoperasi", { consent_tindakan_uuid: "persetujuan-fiktif", faskes_uuid: "faskes-lain" });
    assert.equal(res.statusCode, 400);
    assert.match(res.data.message, /Muat ulang/);
    assert.equal(tersimpan, null);
  }
});

test("simpan memvalidasi ulang pilihan lama pada pembaruan parsial dan menggunakan transaksi", async () => {
  awal();
  const res = await panggil(pra, "put", "/jadwal/:uuid/praoperasi", { consent_tindakan_uuid: "persetujuan-fiktif", consent_anestesi_uuid: null });
  assert.equal(res.statusCode, 200);
  assert.equal(tersimpan.faskes_uuid, "faskes-fiktif");
  assert.equal(jumlahTransaksi, 1);
  assert.ok(log.some(([sql]) => sql.includes("FOR SHARE OF c, o")));
  pilihan = [];
  const usang = await panggil(pra, "put", "/jadwal/:uuid/praoperasi", { asesmen_pra_bedah: "Asesmen fiktif" });
  assert.equal(usang.statusCode, 400);
  assert.equal(tersimpan.asesmen_pra_bedah, null);
});

test("consent tindakan dan anestesi yang sama ditolak saat simpan dan ditandai pada kelengkapan", async () => {
  awal();
  const sama = await panggil(pra, "put", "/jadwal/:uuid/praoperasi", { consent_tindakan_uuid: "persetujuan-fiktif", consent_anestesi_uuid: "persetujuan-fiktif" });
  assert.equal(sama.statusCode, 400);
  assert.match(sama.data.message, /berbeda/);
  assert.equal(tersimpan, null);
  // Pembaruan parsial: consent anestesi diisi sama dengan consent tindakan yang sudah tersimpan.
  await panggil(pra, "put", "/jadwal/:uuid/praoperasi", { consent_tindakan_uuid: "persetujuan-fiktif" });
  const parsial = await panggil(pra, "put", "/jadwal/:uuid/praoperasi", { consent_anestesi_uuid: "persetujuan-fiktif" });
  assert.equal(parsial.statusCode, 400);
  assert.equal(tersimpan.consent_anestesi_uuid, null);
  // Data lama yang terlanjur sama: kelengkapan tidak lengkap.
  tersimpan.consent_anestesi_uuid = "persetujuan-fiktif";
  const detail = await panggil(pra, "get", "/jadwal/:uuid/praoperasi");
  assert.equal(detail.data.payload.kelengkapan.lengkap, false);
  assert.ok(detail.data.payload.kelengkapan.kekurangan.some((x) => /berbeda/.test(x)));
});

test("izin baca dan ubah tetap diperlukan sebelum akses data", async () => {
  awal(); izin = [];
  for (const [router, method, path] of [[pra, "get", "/jadwal/:uuid/praoperasi/referensi-persetujuan"], [pra, "put", "/jadwal/:uuid/praoperasi"], [rute, "get", "/referensi/item-medis"], [rute, "get", "/referensi/lokasi-stok"]]) {
    const res = await panggil(router, method, path);
    assert.equal(res.statusCode, 403);
  }
  assert.equal(log.length, 0);
  assert.equal(jumlahTransaksi, 0);
});

test("referensi item dan depo menggunakan fasilitas token dan membatasi pencarian", async () => {
  awal();
  await panggil(rute, "get", "/referensi/item-medis");
  assert.match(log[0][0], /LIMIT 30/);
  assert.equal(log[0][1][0], "faskes-fiktif");
  await panggil(rute, "get", "/referensi/lokasi-stok");
  assert.match(log[1][0], /jenis_lokasi = 'depo'/);
  assert.deepEqual(log[1][1], ["faskes-fiktif"]);
});
