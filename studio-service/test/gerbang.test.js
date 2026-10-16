import { test } from "node:test";
import assert from "node:assert/strict";
import { gerbangTahap, statusGerbang } from "../src/gerbang.js";
import { tahapBerikut } from "../src/alur.js";
import { kanonik } from "../src/ekstensi.js";
import { pathDalamTeks, temukanDataPribadi, zonaTersentuh } from "../src/kebijakan.js";
import { globKeRegex, perintahDiizinkan } from "../src/agen/alat.js";

test("gerbang mengikuti tingkat risiko (rancangan §8)", () => {
  assert.deepEqual(gerbangTahap("prd", "sedang"), ["product"]);
  assert.deepEqual(gerbangTahap("prd", "tinggi"), ["product", "klinis"]);
  assert.deepEqual(gerbangTahap("prd", "kritis"), ["product", "klinis", "maintainer"]);
  assert.deepEqual(gerbangTahap("qa", "tinggi"), ["qa", "klinis"]);
  assert.deepEqual(gerbangTahap("usecase", "rendah"), ["pengusul"]);
});

test("status gerbang hanya menghitung persetujuan setelah dokumen terbaru", () => {
  const p = [
    { tahap: "prd", keputusan: "setuju", peran: "product", pengguna: "a", created_at: 100 },
    { tahap: "prd", keputusan: "setuju", peran: "klinis", pengguna: "b", created_at: 300 },
  ];
  const s = statusGerbang("prd", "tinggi", p, 200);
  assert.deepEqual(s.map((g) => [g.kode, g.disetujui]), [["product", false], ["klinis", true]]);
});

test("tahap yang fiturnya mati dilewati; coding tidak pernah dilewati", () => {
  assert.equal(tahapBerikut("prd", { desain: false }), "coding");
  assert.equal(tahapBerikut("desain", { coding: false }), "coding");
  assert.equal(tahapBerikut("coding", { qa: false }), "rilis");
  assert.equal(tahapBerikut("qa", { rilis: false }), "selesai");
  assert.equal(tahapBerikut("rilis", {}), "selesai");
});

test("kanonik stabil untuk tanda tangan paket", () => {
  assert.equal(kanonik({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } }), '{"a":{"c":null,"d":[1,{"x":1,"y":2}]},"b":1}');
});

test("data pribadi & zona dari teks desain", () => {
  assert.deepEqual(temukanDataPribadi("NIK 9999012345678901, HP 080000000000, pasien@contoh.id"), []);
  assert.equal(temukanDataPribadi("hubungi 081234567890").length, 1);
  assert.equal(zonaTersentuh(pathDalamTeks("ubah `payment-service/src/bill.js` dan frontend-service/src/a.vue")), "kuning");
  assert.equal(zonaTersentuh(pathDalamTeks("sunting packages/permission-sdk/src/x.js")), "merah");
  assert.equal(zonaTersentuh(pathDalamTeks("hanya frontend-service/src/views/Laporan/A.vue")), "hijau");
});

test("alat agen: glob & daftar putih perintah", () => {
  assert.ok(globKeRegex("lab-service/**/*.js").test("lab-service/src/lis/x.js"));
  assert.ok(!globKeRegex("lab-service/*.js").test("lab-service/src/x.js"));
  assert.ok(perintahDiizinkan("npm --prefix lab-service test"));
  assert.ok(perintahDiizinkan("node --check lab-service/src/a.js"));
  assert.ok(!perintahDiizinkan("npm install leftpad"));
  assert.ok(!perintahDiizinkan("node --check a.js && rm -rf /"));
  assert.ok(!perintahDiizinkan("git push origin main"));
});

test("risiko kritis: gerbang coding + superadmin; zona merah boleh kecuali .env", async () => {
  const { periksaKebijakan } = await import("../src/kebijakan.js");
  assert.deepEqual(gerbangTahap("coding", "kritis"), ["reviewer", "maintainer"]);
  const changelog = { path: "CHANGELOG.md", status: "M", patch: "+x" };
  const sdk = [{ path: "packages/permission-sdk/src/a.js", status: "M", patch: "+x" }, changelog];
  assert.equal(periksaKebijakan(sdk, { risiko: "tinggi" }).temuan.find((t) => t.cek === "Zona merah").lulus, false);
  assert.equal(periksaKebijakan(sdk, { risiko: "kritis" }).temuan.find((t) => t.cek === "Zona merah").lulus, true);
  const env = [{ path: "lab-service/.env", status: "??", patch: "+A=1" }, changelog];
  assert.equal(periksaKebijakan(env, { risiko: "kritis" }).temuan.find((t) => t.cek === "Zona merah").lulus, false);
});

test("desain: baris penyangkalan & glob tidak dihitung sebagai berkas yang diubah", async () => {
  const { pathDiubahDalamDesain } = await import("../src/kebijakan.js");
  const desain = [
    "| Layanan | Berkas | Perubahan |",
    "|---|---|---|",
    "| lab-service | lab-service/src/lis/rujukan.js | fungsi kirim rujukan |",
    "| frontend | frontend-service/src/views/Lab/Rujukan.vue | halaman baru |",
    "",
    "Pola enkripsi mengikuti lab-service/src/lis/rahasia.js.",
    "**Kosong.** Tidak ada perubahan pada `packages/authorization-sdk/**`, `packages/permission-sdk/**`, `deploy/**`.",
  ].join("\n");
  assert.deepEqual(pathDiubahDalamDesain(desain), ["lab-service/src/lis/rujukan.js", "frontend-service/src/views/Lab/Rujukan.vue"]);
  assert.deepEqual(pathDiubahDalamDesain("Ubah packages/permission-sdk/src/x.js untuk aksi baru."), ["packages/permission-sdk/src/x.js"]);
});

test("desain: path relatif di tabel digabung dengan nama layanan (sel atau judul bagian)", async () => {
  const { pathDiubahDalamDesain, zonaTersentuh } = await import("../src/kebijakan.js");
  const desain = [
    "### 1.2 `lab-service`",
    "| Layanan | Berkas | Perubahan |",
    "| lab-service | `src/services/lab-rujukan-service.js` | Baru |",
    "| | `test/rujukan.test.js` | Baru |",
    "### 1.3 frontend-service",
    "| Berkas | Perubahan |",
    "| `src/views/Lab/Rujukan.vue` | Baru |",
  ].join("\n");
  const p = pathDiubahDalamDesain(desain);
  assert.deepEqual(p, ["lab-service/src/services/lab-rujukan-service.js", "lab-service/test/rujukan.test.js", "frontend-service/src/views/Lab/Rujukan.vue"]);
  assert.equal(zonaTersentuh(p), "kuning");
});
