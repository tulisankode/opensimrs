import { rawatInapPermission } from "../src/helpers/permission-list.js";

describe("Izin HDU", () => {
  test("cakupan HDU terpisah dari izin rawat inap lama", () => {
    const sub = rawatInapPermission.subModules;
    expect(sub.find((r) => r.name === "HDU Serah Terima").allows).toContain("KONFIRMASI");
    expect(sub.find((r) => r.name === "HDU Instruksi Observasi").allows).toEqual(["KELOLA"]);
    expect(sub.find((r) => r.name === "Perpindahan Bangsal").allows).toContain("SETUJU DAN TERIMA");
    expect(new Set(sub.map((r) => r.name)).size).toBe(sub.length);
  });
});
