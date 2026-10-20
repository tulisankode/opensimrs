import { describe, it, expect } from "@jest/globals";
import { sdmPermission } from "../src/helpers/permission-list.js";
import { tambahanSinkronPenggajian } from "../src/helpers/penggajian-izin.js";

describe("Katalog dan sinkron izin penggajian", () => {
  it("memuat sebelas submodul tanpa mengubah izin kepegawaian", () => {
    expect(sdmPermission.subModules.filter((s) => s.name.endsWith(" Penggajian"))).toHaveLength(11);
    expect(sdmPermission.subModules[0].allows).toContain("TAUTKAN AKUN");
    expect(sdmPermission.subModules.find((s) => s.name === "Slip Penggajian").allows).toEqual(["READ"]);
  });
  it("memberikan katalog penuh hanya kepada super admin; tambahan admin faskes disaring tanpa mutasi", () => {
    const awal = JSON.stringify(sdmPermission);
    expect(tambahanSinkronPenggajian([sdmPermission], "super admin")[0]).toBe(sdmPermission);
    expect(tambahanSinkronPenggajian([sdmPermission], "admin faskes")[0].subModules.map((s) => s.name)).toEqual(sdmPermission.subModules.map((s) => s.name).filter((n) => !n.endsWith(" Penggajian")));
    expect(JSON.stringify(sdmPermission)).toBe(awal);
  });
});
