import { tiruan, bersihkan } from "./icu-tiruan.mjs";
import test from "node:test";
import assert from "node:assert/strict";
const { Context } = await import("../src/middlewares/context.js");
const { CTX_AUTHOR } = await import("../src/constants/context-constant.js");
const { default: unit, unitDiizinkan, CTX_ICU_UNIT } = await import("../src/middlewares/icu-unit-middleware.js");
const { default: permission } = await import("../src/middlewares/icu-permission-middleware.js");
const { pastikanModulIcu } = await import("../src/helpers/icu-modul-helper.js");
const { default: Konfigurasi } = await import("../src/repositories/icu-konfigurasi-repository.js");
const res = () => ({ code: 200, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } });
test("Layanan khusus tidak aktif tanpa konfigurasi, termasuk fasilitas tanpa segmen", async () => {
    bersihkan(); Context.set(CTX_AUTHOR, { faskesUuid: "fiktif" });
    assert.equal((await Konfigurasi.layanan("burn")).aktif, false);
    assert.equal((await Konfigurasi.layanan("neuro")).aktif, false);
    assert.equal((await Konfigurasi.layanan("umum")).aktif, true);
});
test("Izin tindakan tetap terpisah; tidak menerima izin dari body", async () => {
    bersihkan(); Context.set(CTX_AUTHOR, { user_uuid: "pengguna-fiktif", faskesUuid: "fiktif" });
    tiruan.handler = () => [{ permissions: JSON.stringify([{ module: "ICU", subModules: [{ name: "Flowsheet Observasi", allows: ["READ"] }] }]) }];
    let lolos = false; const response = res();
    await permission("Flowsheet Observasi", "CREATE")({ body: { permissions: ["CREATE"] } }, response, () => { lolos = true; });
    assert.equal(response.code, 403); assert.equal(lolos, false);
    await permission("Flowsheet Observasi", "READ")({}, res(), () => { lolos = true; });
    assert.equal(lolos, true);
});
test("Unit diturunkan dari pengguna terautentikasi; unit body tidak memberi akses", async () => {
    bersihkan(); Context.set(CTX_AUTHOR, { user_uuid: "pengguna-fiktif", faskesUuid: "fiktif" });
    tiruan.handler = () => [{ ruangan_uuid: "unit-a", milik: true }, { ruangan_uuid: "unit-b", milik: false }];
    await unit({ body: { ruangan_uuid: "unit-b", role_uuid: "role-b", faskes_uuid: "lain" } }, res(), () => {});
    const cakupan = Context.get(CTX_ICU_UNIT);
    assert.equal(unitDiizinkan(cakupan, "unit-a"), true); assert.equal(unitDiizinkan(cakupan, "unit-b"), false);
    // Unit tanpa pemetaan akses tetap terbuka (kompatibel dengan ICU sebelum pembatasan unit).
    assert.equal(unitDiizinkan(cakupan, "unit-c"), true);
    assert.equal(tiruan.kueri[0].opsi.replacements.f, "fiktif");
});
test("Faskes tanpa pemetaan akses unit tidak membatasi unit ICU", async () => {
    bersihkan(); Context.set(CTX_AUTHOR, { user_uuid: "pengguna-fiktif", faskesUuid: "fiktif" });
    tiruan.handler = () => [];
    let lolos = false; const response = res();
    await unit({}, response, () => { lolos = true; });
    assert.equal(lolos, true); assert.equal(unitDiizinkan(Context.get(CTX_ICU_UNIT), "unit-apa-saja"), true);
});
test("Superadmin tetap wajib memiliki fasilitas dari token", async () => {
    bersihkan(); Context.set(CTX_AUTHOR, { superadmin: true }); const response = res();
    await unit({}, response, () => assert.fail("Tidak boleh lolos")); assert.equal(response.code, 401);
});
test("Modul dan override fitur nonaktif ditolak server", async () => {
    bersihkan(); Context.set(CTX_AUTHOR, { faskesUuid: "fiktif" });
    tiruan.handler = () => [{ tersedia: true, inti: false, override: false, segmen_kode: null }];
    await assert.rejects(pastikanModulIcu("fiktif"), { code: 403 });
    tiruan.handler = (sql) => sql.includes("FROM ref_modul") ? [{ tersedia: true, segmen_kode: null }] : [{ tersedia: true, wajib: false, override: false }];
    await assert.rejects(pastikanModulIcu("fiktif", "icu_template_klinis"), { code: 403 });
});
