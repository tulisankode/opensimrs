import { mapPermission, nicuPermission, icuPermission } from "../src/helpers/permission-list.js";

describe("Katalog izin NICU", () => {
  test("modul dan aksi NICU terpisah dari ICU tanpa pemberian izin ke peran", () => {
    expect(mapPermission(["NICU"])).toEqual([nicuPermission]);
    expect(mapPermission(["ICU"])).toEqual([icuPermission]);
    expect(nicuPermission.subModules.find((s) => s.name === "Dokumentasi").allows).toEqual(["READ", "CREATE", "KOREKSI", "RIWAYAT"]);
    expect(nicuPermission.subModules.find((s) => s.name === "Konfigurasi").allows).toContain("TERBITKAN");
    expect(nicuPermission.subModules.find((s) => s.name === "Laporan").allows).toContain("EKSPOR");
    expect(nicuPermission.subModules.some((s) => s.name === "Skor SOFA")).toBe(false);
  });
});
