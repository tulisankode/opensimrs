import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const urlData = (s) => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const sumber = readFileSync(new URL("../src/utils/permissions.ts", import.meta.url), "utf8");
const hasil = ts.transpileModule(sumber, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const modul = await import(urlData(hasil.outputText.replace('"@/stores/modulFaskes"', JSON.stringify(urlData("export const ruteDiizinkanModul = () => ({ boleh: true });")))));
const data = new Map();
globalThis.localStorage = { getItem: (k) => data.get(k) ?? null };
const sesiFiktif = (role, subModules = []) => {
  data.clear();
  data.set("access_token", `fiktif.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.fiktif`);
  data.set("permission", JSON.stringify(subModules.length ? [{ module: "HR / SDM", subModules }] : []));
};
const boleh = (path) => modul.canAccessPermission(modul.resolveRoutePermission(path));
test("slip pribadi tidak membuka halaman administratif; alternatif izin periode berlaku", () => {
  sesiFiktif("pegawai", [{ name: "Slip Penggajian", allows: ["READ"] }]);
  assert.equal(boleh("/sdm/penggajian/slip"), true);
  for (const path of ["periode", "periode/fiktif", "komponen", "konfigurasi", "rekap"]) assert.equal(boleh(`/sdm/penggajian/${path}`), false, path);
  sesiFiktif("verifikator", [{ name: "Verifikasi Penggajian", allows: ["READ"] }]);
  assert.equal(boleh("/sdm/penggajian/periode/fiktif"), true);
  assert.equal(boleh("/sdm/penggajian/slip"), false);
});
test("daftar kosong hanya membebaskan super admin pada izin penggajian", () => {
  sesiFiktif("pegawai"); assert.equal(boleh("/sdm/penggajian/slip"), false);
  sesiFiktif("super admin"); assert.equal(boleh("/sdm/penggajian/slip"), true); assert.equal(boleh("/sdm/penggajian/periode"), true);
  sesiFiktif("super admin", [{ name: "Slip Penggajian", allows: ["READ"] }]); assert.equal(boleh("/sdm/penggajian/komponen"), false);
});
