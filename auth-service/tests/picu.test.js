import { mapPermission, picuPermission, icuPermission } from "../src/helpers/permission-list.js";

describe("Katalog izin PICU", () => {
  it("mendaftarkan modul tersendiri tanpa mengubah izin ICU", () => {
    expect(mapPermission(["PICU"])).toEqual([picuPermission]);
    expect(mapPermission(["ICU"])).toEqual([icuPermission]);
    expect(picuPermission.subModules.some((s) => s.name === "Skor SOFA")).toBe(false);
  });
  it("memisahkan pencatatan, finalisasi, koreksi, dan penetapan konfigurasi", () => {
    expect(picuPermission.subModules.find((s) => s.name === "Observasi").allows).toEqual(["READ", "CREATE", "FINALISASI", "KOREKSI"]);
    expect(picuPermission.subModules.find((s) => s.name === "Konfigurasi").allows).toContain("VALIDASI");
  });
});
