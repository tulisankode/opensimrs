import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const urlData = (s) => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const sumber = readFileSync(new URL("../src/utils/permissions.ts", import.meta.url), "utf8");
const hasil = ts.transpileModule(sumber, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
// Penyimpanan khusus modul uji agar tidak mengubah sesi pengujian izin lain.
const penyimpanan = urlData("export const data = new Map(); export const localStorage = { getItem: (k) => data.get(k) ?? null };");
const { data } = await import(penyimpanan);
const modul = await import(urlData(`import { localStorage } from ${JSON.stringify(penyimpanan)};\n` + hasil.outputText.replace('"@/stores/modulFaskes"', JSON.stringify(urlData("export const ruteDiizinkanModul = () => ({ boleh: true });")))));
const sesiFiktif = (role, modules = []) => {
  data.clear();
  data.set("access_token", `fiktif.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.fiktif`);
  data.set("permission", JSON.stringify(modules));
};
const boleh = (path) => modul.canAccessPermission(modul.resolveRoutePermission(path));

test("/dashboard memerlukan izin dasar modul Dashboard (STD-0049 — sebelumnya tidak ada di registry)", () => {
  sesiFiktif("staf", []);
  assert.equal(boleh("/dashboard"), false);
  sesiFiktif("staf", [{ module: "Dashboard", subModules: [] }]);
  assert.equal(boleh("/dashboard"), true);
  // Izin pada submodul lain Dashboard juga cukup, karena /dashboard hanya mensyaratkan modulnya ada.
  sesiFiktif("staf", [{ module: "Dashboard", subModules: [{ name: "Eksekutif", allows: ["READ"] }] }]);
  assert.equal(boleh("/dashboard"), true);
});

test("izin dasar Dashboard tidak otomatis membuka Virtual Office atau Eksekutif (submodul tetap wajib)", () => {
  sesiFiktif("staf", [{ module: "Dashboard", subModules: [] }]);
  assert.equal(boleh("/dashboard/virtual-office"), false);
  assert.equal(boleh("/dashboard/eksekutif"), false);
  sesiFiktif("staf", [{ module: "Dashboard", subModules: [{ name: "Virtual Office", allows: ["READ"] }] }]);
  assert.equal(boleh("/dashboard/virtual-office"), true);
  assert.equal(boleh("/dashboard/eksekutif"), false);
});

test("/dashboard tetap tertutup tanpa daftar izin walau peran super admin (tidak ada pengecualian khusus modul ini)", () => {
  sesiFiktif("super admin", []);
  assert.equal(boleh("/dashboard"), false);
});

test("hasModulePermission: true hanya bila modul ada pada daftar izin, tanpa syarat submodul/aksi", () => {
  sesiFiktif("staf", []);
  assert.equal(modul.hasModulePermission("Dashboard"), false);
  sesiFiktif("staf", [{ module: "Dashboard", subModules: [] }]);
  assert.equal(modul.hasModulePermission("Dashboard"), true);
});
