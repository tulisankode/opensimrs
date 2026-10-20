import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { createRequire } from "module";
import { ATURAN_DAFTAR, KonflikTakDikenal, batalGabung, cekSintaksFrontend, gabung3, gabungJson, modulTersediaItem, selesaikanGabung, selesaikanTeks, sinkronkan } from "../src/gabung.js";

// ---------- Katalog: gabung per entri ----------

const KATALOG_DASAR = `{
  "_keterangan": "Katalog uji (fiktif).",
  "modul": [
    {
      "kode": "dashboard",
      "nama": "Dashboard",
      "tersedia": true,
      "menu": ["Dashboard"],
      "rute": [
        "/dashboard"
      ]
    },
    {
      "kode": "gizi",
      "nama": "Gizi",
      "tersedia": false
    }
  ],
  "fitur": [
    {
      "kode": "dashboard_grafik",
      "modul": "dashboard",
      "nama": "Grafik"
    }
  ],
  "preset": {
    "segmen_modul": {
      "klinik": [
        "dashboard"
      ],
      "rs": [
        "dashboard"
      ]
    },
    "fitur_mati": {
      "klinik": []
    }
  }
}
`;
const ubahJson = (teks, fn) => {
  const k = JSON.parse(teks);
  fn(k);
  return `${JSON.stringify(k, null, 2)}\n`;
};
// Item: modul gizi menjadi tersedia + fitur baru + preset klinik; target: modul icu baru + preset rs + deskripsi dashboard.
const KATALOG_ITEM = KATALOG_DASAR
  .replace(`"nama": "Gizi",\n      "tersedia": false`, `"nama": "Gizi",\n      "tersedia": true,\n      "menu": ["Gizi"]`)
  .replace(`"nama": "Grafik"\n    }`, `"nama": "Grafik"\n    },\n    {\n      "kode": "gizi_diet",\n      "modul": "gizi",\n      "nama": "Diet pasien"\n    }`)
  .replace(`"klinik": [\n        "dashboard"\n      ]`, `"klinik": [\n        "dashboard",\n        "gizi"\n      ]`);
const KATALOG_TARGET = KATALOG_DASAR
  .replace(`"tersedia": false\n    }\n  ],`, `"tersedia": false\n    },\n    {\n      "kode": "icu",\n      "nama": "ICU",\n      "tersedia": true,\n      "menu": ["ICU"]\n    }\n  ],`)
  .replace(`"nama": "Dashboard",`, `"nama": "Dashboard",\n      "deskripsi": "Ringkasan kunjungan.",`)
  .replace(`"rs": [\n        "dashboard"\n      ]`, `"rs": [\n        "dashboard",\n        "icu"\n      ]`);

test("gabungJson: perubahan item per entri diterapkan ke versi target (modul, fitur, preset peta-larik)", () => {
  const teks = gabungJson(KATALOG_DASAR, KATALOG_ITEM, KATALOG_TARGET);
  const k = JSON.parse(teks);
  assert.deepEqual(k.modul.map((m) => m.kode), ["dashboard", "gizi", "icu"]);
  assert.equal(k.modul.find((m) => m.kode === "gizi").tersedia, true);
  assert.equal(k.modul.find((m) => m.kode === "dashboard").deskripsi, "Ringkasan kunjungan.");
  assert.deepEqual(k.fitur.map((f) => f.kode), ["dashboard_grafik", "gizi_diet"]);
  assert.deepEqual(k.preset.segmen_modul, { klinik: ["dashboard", "gizi"], rs: ["dashboard", "icu"] });
  // Format asli dipertahankan: larik satu baris tetap satu baris, entri yang tidak diubah identik dengan target.
  assert.match(teks, /"menu": \["Dashboard"\],/);
  assert.match(teks, /"menu": \["ICU"\]/);
  assert.ok(teks.includes(`      "kode": "icu",\n      "nama": "ICU",`));
  assert.ok(teks.endsWith("}\n"));
});

test("gabungJson: kedua sisi mengubah field berbeda pada entri yang sama → digabung per field", () => {
  const item = ubahJson(KATALOG_DASAR, (k) => (k.modul[1].tersedia = true));
  const target = ubahJson(KATALOG_DASAR, (k) => (k.modul[1].instalasi = "Penunjang"));
  const k = JSON.parse(gabungJson(KATALOG_DASAR, item, target));
  assert.deepEqual(k.modul[1], { kode: "gizi", nama: "Gizi", tersedia: true, instalasi: "Penunjang" });
});

test("gabungJson: nilai yang sama diubah berbeda di kedua sisi → KonflikTakDikenal (tidak ditebak)", () => {
  const item = ubahJson(KATALOG_DASAR, (k) => (k.modul[1].nama = "Gizi Klinik"));
  const target = ubahJson(KATALOG_DASAR, (k) => (k.modul[1].nama = "Instalasi Gizi"));
  assert.throws(() => gabungJson(KATALOG_DASAR, item, target), KonflikTakDikenal);
  // Dihapus item tetapi diubah target.
  const hapus = ubahJson(KATALOG_DASAR, (k) => k.fitur.splice(0, 1));
  const ubahFitur = ubahJson(KATALOG_DASAR, (k) => (k.fitur[0].nama = "Grafik harian"));
  assert.throws(() => gabungJson(KATALOG_DASAR, hapus, ubahFitur), KonflikTakDikenal);
});

test("gabung3: penghapusan entri & item larik oleh item diterapkan bila target tidak mengubahnya", () => {
  const b = { modul: [{ kode: "a" }, { kode: "b" }], preset: { s: ["a", "b"] } };
  const o = { modul: [{ kode: "a" }], preset: { s: ["a"] } };
  const t = { modul: [{ kode: "a" }, { kode: "b" }, { kode: "c" }], preset: { s: ["a", "b", "c"] } };
  assert.deepEqual(gabung3(b, o, t), { modul: [{ kode: "a" }, { kode: "c" }], preset: { s: ["a", "c"] } });
});

test("modulTersediaItem: modul Segera → tersedia di item", () => {
  assert.deepEqual(modulTersediaItem(JSON.parse(KATALOG_DASAR), JSON.parse(KATALOG_ITEM)), ["gizi"]);
  assert.deepEqual(modulTersediaItem(null, JSON.parse(KATALOG_ITEM)), []);
});

// ---------- Daftar sisipan ----------

const blokKonflik = (a, b) => `<<<<<<< HEAD\n${a}=======\n${b}>>>>>>> rs-lokal\n`;

test("aturan permission-controller: nama modul item disisipkan sesudah pendahulunya", () => {
  const teks = `const SEMUA_MODUL = [\n${blokKonflik(`  "Dashboard", "Gizi", "Laundry", "MCU",\n`, `  "Dashboard", "Laundry", "MCU", "ICU",\n`)}];\n`;
  assert.equal(selesaikanTeks(teks, ATURAN_DAFTAR["auth-service/src/controllers/permission-controller.js"]), `const SEMUA_MODUL = [\n  "Dashboard", "Gizi", "Laundry", "MCU", "ICU",\n];\n`);
});

test("aturan permission-list & router: blok baru kedua sisi dipisah dengan penutup yang dipotong git", () => {
  const izin = `${blokKonflik(`export const giziPermission = {\n  module: "Gizi",\n  subModules: [\n    { name: "Diet", allows: ["READ"] },\n`, `export const icuPermission = {\n  module: "ICU",\n  subModules: [\n    { name: "Monitor", allows: ["READ"] },\n`)}  ],\n};\n`;
  assert.equal(
    selesaikanTeks(izin, ATURAN_DAFTAR["auth-service/src/helpers/permission-list.js"]),
    `export const giziPermission = {\n  module: "Gizi",\n  subModules: [\n    { name: "Diet", allows: ["READ"] },\n  ],\n};\n\nexport const icuPermission = {\n  module: "ICU",\n  subModules: [\n    { name: "Monitor", allows: ["READ"] },\n  ],\n};\n`,
  );
  const rute = `${blokKonflik(`    // SECTION Gizi\n    ...pakai([\n      { path: "/gizi" },\n`, `    // SECTION ICU\n    ...pakai([\n      { path: "/icu" },\n`)}    ]),\n    // !SECTION\n`;
  const hasil = selesaikanTeks(rute, ATURAN_DAFTAR["frontend-service/src/router/index.ts"]);
  assert.equal((hasil.match(/!SECTION/g) ?? []).length, 2);
  assert.ok(hasil.indexOf("/gizi") < hasil.indexOf("/icu"));
});

test("aturan Header.vue: menu baru kedua sisi, MODUL_PENUNJANG, dan daftar Segera dikurangi modul item", () => {
  const H = ATURAN_DAFTAR["frontend-service/src/components/section/Header.vue"];
  // git memindahkan baris pembuka "  {" & penutup "  }," yang sama di kedua sisi ke luar blok konflik.
  const menu = `  {\n${blokKonflik(`    title: "Gizi",\n    url: "/gizi",\n`, `    title: "ICU",\n    url: "/icu",\n`)}  },\n]);\n`;
  assert.equal(selesaikanTeks(menu, H), `  {\n    title: "Gizi",\n    url: "/gizi",\n  },\n  {\n    title: "ICU",\n    url: "/icu",\n  },\n]);\n`);
  const penunjang = blokKonflik(`const MODUL_PENUNJANG_CADANGAN = ["Laboratorium", "Gizi"];\n`, `const MODUL_PENUNJANG_CADANGAN = ["Laboratorium", "ICU"];\n`);
  assert.equal(selesaikanTeks(penunjang, H), `const MODUL_PENUNJANG_CADANGAN = ["Laboratorium", "ICU", "Gizi"];\n`);
  const segera = `const NAMA_SEGERA: Record<string, string> = {\n${blokKonflik(`  akuntansi: "Akuntansi",\n`, `  akuntansi: "Akuntansi",\n  gizi: "Gizi",\n  laundry: "Laundry",\n`)}};\n`;
  assert.equal(selesaikanTeks(segera, H, { modulTersedia: ["gizi"] }), `const NAMA_SEGERA: Record<string, string> = {\n  akuntansi: "Akuntansi",\n  laundry: "Laundry",\n};\n`);
});

test("aturan penunjang-service & CHANGELOG: sisipan kedua sisi dipertahankan tanpa duplikat, CRLF terjaga", () => {
  const imp = blokKonflik(`import gizi from "./gizi/rute.js";\n`, `import icu from "./icu/rute.js";\n`);
  assert.equal(selesaikanTeks(imp, ATURAN_DAFTAR["penunjang-service/src/rute.js"]), `import gizi from "./gizi/rute.js";\nimport icu from "./icu/rute.js";\n`);
  const pakai = blokKonflik(`rute.use("/gizi", gizi);\n`, `rute.use("/icu", icu);\n`);
  assert.equal(selesaikanTeks(pakai, ATURAN_DAFTAR["penunjang-service/src/rute.js"]), `rute.use("/icu", icu);\nrute.use("/gizi", gizi);\n`);
  const log = blokKonflik("- Gizi (STD-0031).\n- Sama.\n", "- Sama.\n- ICU (STD-0032).\n").replace(/\n/g, "\r\n");
  assert.equal(selesaikanTeks(log, ATURAN_DAFTAR["CHANGELOG.md"]), "- Gizi (STD-0031).\r\n- Sama.\r\n- ICU (STD-0032).\r\n");
});

test("selesaikanTeks: pola blok yang tidak dikenal → null", () => {
  const segera = blokKonflik("const a = 1;\n", "const a = 2;\n");
  assert.equal(selesaikanTeks(segera, ATURAN_DAFTAR["frontend-service/src/components/section/Header.vue"]), null);
});

// ---------- Alur sinkronisasi pada repo git sementara ----------

const DOKUMEN = `import fs from "fs";
const k = JSON.parse(fs.readFileSync("database/data/katalog-modul.json", "utf8"));
fs.writeFileSync("docs/MANAJEMEN-MODUL.md", "# Katalog\\n\\n" + k.modul.map((m) => "- " + m.kode + (m.tersedia ? "" : " (segera)")).join("\\n") + "\\n");
`;
const CEK = `import fs from "fs";
if (fs.readFileSync("CHANGELOG.md", "utf8").includes("TERLARANG")) { console.log("✘ CHANGELOG memuat kata terlarang"); process.exit(1); }
console.log("Cek integritas lulus.");
`;
const PERMISSION = (daftar) => `// uji\nconst SEMUA_MODUL = [\n  ${daftar.map((x) => `"${x}"`).join(", ")},\n];\nexport default SEMUA_MODUL;\n`;
const CHANGELOG = (entri) => `# Catatan Perubahan\n\n## [Belum dirilis]\n\n### Ditambahkan\n- Dasar.\n${entri.map((e) => `- ${e}\n`).join("")}\n---\n`;

const siapkanRepo = (autocrlf = false) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "studio-uji-sinkron-"));
  const g = (...a) => execFileSync("git", ["-c", "safe.directory=*", ...a], { cwd: repo, encoding: "utf8" }).trim();
  const tulis = (rel, isi) => {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), isi);
  };
  const dokumen = () => execFileSync(process.execPath, ["scripts/dokumen-katalog.mjs"], { cwd: repo });
  const commit = (pesan) => {
    g("add", "-A");
    g("commit", "-q", "-m", pesan);
  };
  g("init", "-q", "-b", "rs-lokal");
  g("config", "user.name", "Uji");
  g("config", "user.email", "uji@contoh.id");
  g("config", "core.autocrlf", String(autocrlf));
  tulis("scripts/dokumen-katalog.mjs", DOKUMEN);
  tulis("scripts/cek-integritas.mjs", CEK);
  tulis("database/data/katalog-modul.json", KATALOG_DASAR);
  tulis("auth-service/src/controllers/permission-controller.js", PERMISSION(["Dashboard", "Laundry", "MCU"]));
  tulis("CHANGELOG.md", CHANGELOG([]));
  tulis("README.md", "# Uji\n\nBaris yang sama.\n");
  tulis("docs/MANAJEMEN-MODUL.md", "");
  dokumen();
  commit("dasar");
  return { repo, g, tulis, dokumen, commit };
};

// core.autocrlf=true (bawaan Git for Windows): working tree CRLF, tahap indeks LF.
for (const autocrlf of [false, true]) test(`sinkronkan (autocrlf=${autocrlf}): konflik berpola dikenal diselesaikan otomatis, dokumen katalog dibuat ulang, lalu di-commit`, async () => {
  const { repo, g, tulis, dokumen, commit } = siapkanRepo(autocrlf);
  const baca = (rel) => fs.readFileSync(path.join(repo, rel), "utf8").replace(/\r\n/g, "\n");
  try {
    // Target (branch lokal): modul ICU.
    tulis("database/data/katalog-modul.json", KATALOG_TARGET);
    tulis("auth-service/src/controllers/permission-controller.js", PERMISSION(["Dashboard", "Laundry", "MCU", "ICU"]));
    tulis("CHANGELOG.md", CHANGELOG(["ICU (STD-0032)."]));
    dokumen();
    commit("feat: icu");
    // Branch item dari titik dasar: modul Gizi.
    g("switch", "-q", "-c", "feat/STD-0031-gizi", "HEAD~1");
    tulis("database/data/katalog-modul.json", KATALOG_ITEM);
    tulis("auth-service/src/controllers/permission-controller.js", PERMISSION(["Dashboard", "Gizi", "Laundry", "MCU"]));
    tulis("CHANGELOG.md", CHANGELOG(["Gizi (STD-0031)."]));
    tulis("penunjang-service/src/gizi.js", "export default 1;\n");
    dokumen();
    commit("feat: gizi");
    const sebelum = g("rev-parse", "HEAD");

    const hasil = await sinkronkan({ cwd: repo, target: "rs-lokal", pesanCommit: "chore(studio): sinkronkan feat/STD-0031-gizi dengan rs-lokal" });
    assert.equal(hasil.status, "digabung", JSON.stringify(hasil));
    assert.deepEqual(hasil.tersisa, []);
    const otomatis = hasil.otomatis.map((o) => o.path);
    assert.ok(otomatis.includes("database/data/katalog-modul.json"));
    assert.ok(otomatis.includes("CHANGELOG.md"));
    assert.ok(otomatis.includes("auth-service/src/controllers/permission-controller.js"));

    const k = JSON.parse(baca("database/data/katalog-modul.json"));
    assert.deepEqual(k.modul.map((m) => `${m.kode}:${m.tersedia}`), ["dashboard:true", "gizi:true", "icu:true"]);
    assert.deepEqual(k.preset.segmen_modul, { klinik: ["dashboard", "gizi"], rs: ["dashboard", "icu"] });
    assert.equal(baca("docs/MANAJEMEN-MODUL.md"), "# Katalog\n\n- dashboard\n- gizi\n- icu\n");
    const log = baca("CHANGELOG.md");
    assert.ok(log.includes("- Gizi (STD-0031).") && log.includes("- ICU (STD-0032)."));
    assert.match(baca("auth-service/src/controllers/permission-controller.js"), /"Dashboard", "Gizi", "Laundry", "MCU", "ICU"/);
    // Commit merge dengan dua induk, working tree bersih, berkas item tetap ada.
    assert.equal(g("rev-parse", "HEAD^1"), sebelum);
    assert.equal(g("rev-parse", "HEAD^2"), g("rev-parse", "rs-lokal"));
    assert.equal(g("status", "--porcelain"), "");
    assert.ok(fs.existsSync(path.join(repo, "penunjang-service/src/gizi.js")));
    assert.match(g("log", "-1", "--format=%B"), /Diselesaikan otomatis:/);

    // Sinkron ulang: sudah mutakhir.
    assert.equal((await sinkronkan({ cwd: repo, target: "rs-lokal", pesanCommit: "x" })).status, "mutakhir");
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("sinkronkan: pola tidak dikenal → merge dibatalkan, branch item tetap bersih", async () => {
  const { repo, g, tulis, commit } = siapkanRepo();
  try {
    tulis("README.md", "# Uji\n\nBaris versi target.\n");
    tulis("CHANGELOG.md", CHANGELOG(["ICU."]));
    commit("docs: target");
    g("switch", "-q", "-c", "feat/STD-0033-x", "HEAD~1");
    tulis("README.md", "# Uji\n\nBaris versi item.\n");
    tulis("CHANGELOG.md", CHANGELOG(["X."]));
    commit("docs: item");
    const sebelum = g("rev-parse", "HEAD");
    const hasil = await sinkronkan({ cwd: repo, target: "rs-lokal", pesanCommit: "x" });
    assert.equal(hasil.status, "konflik");
    assert.deepEqual(hasil.tersisa, ["README.md"]);
    assert.equal(g("rev-parse", "HEAD"), sebelum);
    assert.equal(g("status", "--porcelain"), "");
    assert.equal(fs.existsSync(path.join(repo, ".git", "MERGE_HEAD")), false);
    assert.equal(fs.readFileSync(path.join(repo, "README.md"), "utf8"), "# Uji\n\nBaris versi item.\n");
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("sinkronkan: cek integritas gagal setelah penyelesaian otomatis → dibatalkan", async () => {
  const { repo, g, tulis, commit } = siapkanRepo();
  try {
    tulis("CHANGELOG.md", CHANGELOG(["Entri TERLARANG."]));
    commit("docs: target");
    g("switch", "-q", "-c", "feat/STD-0034-y", "HEAD~1");
    tulis("CHANGELOG.md", CHANGELOG(["Y."]));
    commit("docs: item");
    const sebelum = g("rev-parse", "HEAD");
    const hasil = await sinkronkan({ cwd: repo, target: "rs-lokal", pesanCommit: "x" });
    assert.equal(hasil.status, "gagal_integritas");
    assert.match(hasil.integritas, /kata terlarang/);
    assert.equal(g("rev-parse", "HEAD"), sebelum);
    assert.equal(g("status", "--porcelain"), "");
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("sinkronkan: perubahan yang belum di-commit → ditolak tanpa menyentuh branch", async () => {
  const { repo, tulis } = siapkanRepo();
  try {
    tulis("README.md", "# Diubah\n");
    await assert.rejects(sinkronkan({ cwd: repo, target: "rs-lokal", pesanCommit: "x" }), /belum di-commit/);
    assert.equal(fs.readFileSync(path.join(repo, "README.md"), "utf8"), "# Diubah\n");
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// Konflik kode (README) + konflik berpola dikenal (CHANGELOG, permission) pada repo yang sama.
const siapkanKonflikCampuran = () => {
  const r = siapkanRepo();
  const { g, tulis, commit } = r;
  tulis("README.md", "# Uji\n\nBaris versi target.\n");
  tulis("CHANGELOG.md", CHANGELOG(["ICU."]));
  tulis("auth-service/src/controllers/permission-controller.js", PERMISSION(["Dashboard", "Laundry", "MCU", "ICU"]));
  commit("feat: target");
  g("switch", "-q", "-c", "feat/STD-0035-z", "HEAD~1");
  tulis("README.md", "# Uji\n\nBaris versi item.\n");
  tulis("CHANGELOG.md", CHANGELOG(["Z."]));
  tulis("auth-service/src/controllers/permission-controller.js", PERMISSION(["Dashboard", "Gizi", "Laundry", "MCU"]));
  commit("feat: item");
  return r;
};

test("sinkronkan biarkan: pola dikenal diselesaikan, konflik kode dibiarkan berpenanda (merge tetap berjalan)", async () => {
  const { repo, g } = siapkanKonflikCampuran();
  try {
    const hasil = await sinkronkan({ cwd: repo, target: "rs-lokal", pesanCommit: "x", biarkan: true });
    assert.equal(hasil.status, "menunggu", JSON.stringify(hasil));
    assert.deepEqual(hasil.tersisa, ["README.md"]);
    assert.ok(hasil.otomatis.some((o) => o.path === "CHANGELOG.md"));
    assert.equal(fs.existsSync(path.join(repo, ".git", "MERGE_HEAD")), true);
    assert.match(fs.readFileSync(path.join(repo, "README.md"), "utf8"), /^<<<<<<< /m);
    // Yang sudah diselesaikan otomatis tidak lagi berstatus konflik.
    assert.deepEqual(g("diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean), ["README.md"]);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("selesaikanGabung: menolak selama penanda tersisa; setelah bersih → cek integritas lalu commit merge", async () => {
  const { repo, g, tulis } = siapkanKonflikCampuran();
  try {
    const item = g("rev-parse", "HEAD");
    await sinkronkan({ cwd: repo, target: "rs-lokal", pesanCommit: "x", biarkan: true });
    await assert.rejects(selesaikanGabung({ cwd: repo, pesanCommit: "chore: tutup" }), /penanda konflik.*README\.md/);
    // Berkas di-git add tanpa dibersihkan tetap tertangkap.
    g("add", "README.md");
    await assert.rejects(selesaikanGabung({ cwd: repo, pesanCommit: "chore: tutup" }), /README\.md/);
    tulis("README.md", "# Uji\n\nBaris versi item dan target.\n");
    tulis("catatan-lokal.txt", "berkas baru yang belum dilacak\n");
    const h = await selesaikanGabung({ cwd: repo, pesanCommit: "chore: tutup" });
    assert.equal(h.sha, g("rev-parse", "HEAD"));
    assert.equal(g("rev-parse", "HEAD^1"), item);
    assert.equal(g("rev-parse", "HEAD^2"), g("rev-parse", "rs-lokal"));
    assert.equal(fs.existsSync(path.join(repo, ".git", "MERGE_HEAD")), false);
    // Berkas baru yang tidak dilacak tidak ikut ter-commit.
    assert.equal(g("status", "--porcelain"), "?? catatan-lokal.txt");
    assert.match(g("log", "-1", "--format=%B"), /Konflik diselesaikan: .*README\.md/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("selesaikanGabung: cek integritas gagal → merge tidak di-commit dan tetap bisa dibatalkan", async () => {
  const { repo, g, tulis } = siapkanKonflikCampuran();
  try {
    const item = g("rev-parse", "HEAD");
    await sinkronkan({ cwd: repo, target: "rs-lokal", pesanCommit: "x", biarkan: true });
    tulis("README.md", "# Uji\n");
    tulis("CHANGELOG.md", CHANGELOG(["TERLARANG."]));
    await assert.rejects(selesaikanGabung({ cwd: repo, pesanCommit: "chore: tutup" }), /integritas gagal/);
    assert.equal(fs.existsSync(path.join(repo, ".git", "MERGE_HEAD")), true);
    await batalGabung({ cwd: repo });
    assert.equal(g("rev-parse", "HEAD"), item);
    assert.equal(g("status", "--porcelain"), "");
    await assert.rejects(batalGabung({ cwd: repo }), /Tidak ada penggabungan/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// Butuh esbuild & @vue/compiler-sfc dari frontend-service/node_modules. Di CI studio-service hanya modul layanan ini yang
// dipasang, jadi uji dilewati (pemeriksa sintaks pun melewati pemeriksaan bila modul itu tidak ada).
const AKAR_REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../..");
const frontendTerpasang = (akar = AKAR_REPO) => {
  try {
    createRequire(path.join(akar, "frontend-service", "package.json")).resolve("esbuild");
    return true;
  } catch {
    return false;
  }
};
test("cekSintaksFrontend: tanpa node_modules frontend → pemeriksaan dilewati (null), bukan dianggap rusak", async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "studio-uji-tanpa-fe-"));
  try {
    fs.mkdirSync(path.join(repo, "frontend-service", "src"), { recursive: true });
    fs.writeFileSync(path.join(repo, "frontend-service", "package.json"), "{}");
    fs.writeFileSync(path.join(repo, "frontend-service", "src", "rusak.ts"), "const a = [;\n");
    assert.equal(frontendTerpasang(repo), false);
    assert.equal(await cekSintaksFrontend(repo, ["frontend-service/src/rusak.ts"]), null);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
test("cekSintaksFrontend: router .ts dan komponen .vue yang rusak setelah penggabungan tertangkap", { skip: !frontendTerpasang() && "node_modules frontend-service tidak terpasang" }, async () => {
  const repo = AKAR_REPO;
  const dir = path.join(repo, "frontend-service", "src", "__uji_sintaks__");
  const rel = (n) => `frontend-service/src/__uji_sintaks__/${n}`;
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(path.join(dir, "rusak.ts"), 'const rute = [\n  ...halaman(View, [\n    ["/a", "a", A],\n  { path: "/b" },\n  ]),\n];\n});\n');
    fs.writeFileSync(path.join(dir, "Rusak.vue"), '<script setup lang="ts">\nconst a = ref(1\n</script>\n<template><div>{{ a }}</div></template>\n');
    fs.writeFileSync(path.join(dir, "Baik.vue"), '<script setup lang="ts">\nconst a = 1;\n</script>\n<template><div>{{ a }}</div></template>\n');
    const galat = await cekSintaksFrontend(repo, [rel("rusak.ts"), rel("Rusak.vue"), rel("Baik.vue"), "README.md"]);
    assert.match(galat, /rusak\.ts:\d+/);
    assert.match(galat, /Rusak\.vue/);
    assert.doesNotMatch(galat, /Baik\.vue/);
    assert.equal(await cekSintaksFrontend(repo, [rel("Baik.vue"), "README.md"]), null);
    assert.equal(await cekSintaksFrontend(repo, ["README.md"]), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
