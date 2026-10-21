import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import * as vue from "vue";
import ts from "typescript";

const require = createRequire(import.meta.url);
const filename = new URL("../src/views/Dashboard/DashboardPage.vue", import.meta.url).pathname;
const { descriptor, errors } = parse(readFileSync(new URL("../src/views/Dashboard/DashboardPage.vue", import.meta.url), "utf8"), { filename });
assert.deepEqual(errors, []);
const script = compileScript(descriptor, { id: "dashboard-uji" });
const template = compileTemplate({ source: descriptor.template.content, filename, id: "dashboard-uji", compilerOptions: { bindingMetadata: script.bindings } });

test("halaman dan view Dashboard dapat dikompilasi", () => {
  assert.deepEqual(template.errors, []);
  const view = parse(readFileSync(new URL("../src/views/Dashboard/DashboardView.vue", import.meta.url), "utf8"));
  assert.deepEqual(view.errors, []);
  const skripView = compileScript(view.descriptor, { id: "dashboard-view-uji" });
  assert.deepEqual(compileTemplate({ source: view.descriptor.template.content, filename: "DashboardView.vue", id: "dashboard-view-uji", compilerOptions: { bindingMetadata: skripView.bindings } }).errors, []);
});

const halaman = (getRekap) => {
  const modul = { exports: {} };
  const sumber = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dependensi = (nama) => {
    if (nama === "vue") return { ...vue, onMounted() {}, watch() {} };
    if (nama === "@/stores/dashboard") return { useDashboardStore: () => ({ getRekap }) };
    if (nama === "@/utils/Helpers") return { formatPrice: String };
    if (nama === "@/utils/tema") return { warnaTema: () => "#000000" };
    if (nama.endsWith(".vue") || nama.endsWith(".svg")) return { default: {} };
    return require(nama);
  };
  new Function("require", "module", "exports", sumber)(dependensi, modul, modul.exports);
  return modul.exports.default.setup({}, { expose() {} });
};
const berhasil = () => ({ payload: [] });

test("periode terbalik tidak mengirim permintaan; hasil nol tetap sah", async () => {
  let panggilan = 0;
  const page = halaman(async () => { panggilan++; return berhasil(); });
  page.startDateFilter.value = new Date(2026, 9, 21);
  page.endDateFilter.value = new Date(2026, 9, 20);
  await page.fetchDashboard();
  assert.equal(panggilan, 0);
  assert.equal(page.periodeTidakValid.value, true);
  page.endDateFilter.value = new Date(2026, 9, 21);
  await page.fetchDashboard();
  assert.equal(panggilan, 7);
  assert.equal(page.adaData.value, true);
  assert.equal(page.totalKunjungan.value, "0");
  assert.deepEqual(page.top5Poli.value, []);
});

test("galat atau penolakan tidak menampilkan hasil periode sebelumnya", async () => {
  let gagal = false;
  const page = halaman(async () => gagal ? undefined : berhasil());
  await page.fetchDashboard();
  assert.equal(page.adaData.value, true);
  gagal = true;
  await page.fetchDashboard();
  assert.equal(page.adaData.value, false);
  assert.equal(page.loading.value, false);
  const galat = halaman(async () => { throw new Error("Permintaan gagal"); });
  await galat.fetchDashboard();
  assert.equal(galat.adaData.value, false);
  assert.equal(galat.loading.value, false);
});

test("respons lama tidak menimpa periode terbaru dan perubahan ke periode tidak valid membatalkan hasil tertunda", async () => {
  const tertunda = [];
  const page = halaman(() => new Promise((resolve) => tertunda.push(resolve)));
  const lama = page.fetchDashboard();
  page.endDateFilter.value = new Date(2026, 10, 1);
  const baru = page.fetchDashboard();
  const hasil = (total) => ({ payload: { totalKunjungan: [{ total }] } });
  tertunda.slice(7).forEach((resolve) => resolve(hasil(2)));
  await baru;
  tertunda.slice(0, 7).forEach((resolve) => resolve(hasil(1)));
  await lama;
  assert.equal(page.totalKunjungan.value, "2");
  const berikut = page.fetchDashboard();
  page.endDateFilter.value = new Date(2020, 0, 1);
  await page.fetchDashboard();
  tertunda.slice(14).forEach((resolve) => resolve(hasil(3)));
  await berikut;
  assert.equal(page.adaData.value, false);
  assert.equal(page.loading.value, false);
});
