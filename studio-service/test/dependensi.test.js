import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { pasangDependensi } from "../src/alur.js";

const siapkan = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uji-dependensi-"));
  const tulis = (p, isi) => {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), isi);
  };
  tulis("lab-service/package.json", JSON.stringify({ name: "uji-lab", private: true, scripts: { dev: "nodemon ./src/app.js" } }));
  tulis("lab-service/src/app.js", "");
  tulis("studio-service/package.json", JSON.stringify({ name: "uji-studio", private: true, scripts: { dev: "node src/server.js" } }));
  tulis("studio-service/src/server.js", "");
  const lama = new Date(Date.now() - 3600_000);
  fs.utimesSync(path.join(dir, "lab-service/src/app.js"), lama, lama);
  return dir;
};

test("pasangDependensi: tanpa perubahan paket/SDK tidak menjalankan apa pun", async () => {
  const dir = siapkan();
  try {
    assert.deepEqual(await pasangDependensi(dir, ["lab-service/src/routes/routes.js", "frontend-service/src/App.vue"]), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("pasangDependensi: package.json layanan berubah → npm install & layanan nodemon dimuat ulang", async () => {
  const dir = siapkan();
  try {
    const hasil = await pasangDependensi(dir, ["lab-service/package.json", "studio-service/package-lock.json"]);
    const install = hasil.filter((h) => h.langkah.startsWith("npm install"));
    assert.deepEqual(install.map((h) => [h.langkah, h.ok]), [["npm install di lab-service", true], ["npm install di studio-service", true]]);
    const muat = hasil.find((h) => h.langkah === "muat ulang layanan");
    assert.deepEqual(muat.muatUlang, ["lab-service"]);
    // Tanpa nodemon (studio-service) → harus dijalankan ulang manual.
    assert.deepEqual(muat.manual, ["studio-service"]);
    assert.ok(Date.now() - fs.statSync(path.join(dir, "lab-service/src/app.js")).mtimeMs < 60_000);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
