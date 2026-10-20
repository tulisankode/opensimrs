import { icuPermission } from "../src/helpers/permission-list.js";

describe("Izin layanan ICU khusus", () => {
  test("Memisahkan konfigurasi, penetapan, pencatatan, koreksi dan kelengkapan", () => {
    expect(icuPermission.module).toBe("ICU");
    const izin = Object.fromEntries(icuPermission.subModules.map((s) => [s.name, s.allows]));
    expect(izin["Konfigurasi Layanan"]).toEqual(["READ", "KELOLA"]);
    expect(izin["Template Klinis"]).toEqual(["READ", "CREATE", "UPDATE", "TETAPKAN"]);
    expect(izin["Dokumentasi Klinis"]).toEqual(["READ", "CREATE", "KOREKSI"]);
    expect(izin["Kelengkapan Dokumentasi"]).toEqual(["READ"]);
    expect(izin["Flowsheet Observasi"]).toEqual(["READ", "CREATE", "KOREKSI"]);
    expect(new Set(icuPermission.subModules.map((s) => s.name)).size).toBe(icuPermission.subModules.length);
  });
});
