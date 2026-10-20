import { kamarOperasiPermission } from "../src/helpers/permission-list.js";

describe("Izin PACU", () => {
  test("izin klinis, koreksi, protokol, dan biaya memiliki aksi terpisah", () => {
    const sub = kamarOperasiPermission.subModules;
    for (const [nama, aksi] of [["Episode PACU", "SELESAIKAN"], ["Asesmen PACU", "VALIDASI"],
      ["Serah Terima PACU", "TERIMA"], ["Koreksi PACU", "UPDATE"], ["Biaya PACU", "KIRIM"],
      ["Protokol PACU", "VALIDASI"], ["Pemantauan PACU", "CREATE"], ["Intervensi PACU", "CREATE"], ["Riwayat PACU", "READ"]]) {
      expect(sub.find((s) => s.name === nama)?.allows).toContain(aksi);
    }
    expect(new Set(sub.map((s) => s.name)).size).toBe(sub.length);
    expect(sub.find((s) => s.name === "Laporan Anestesi").allows).toEqual(["READ", "CREATE", "UPDATE"]);
    expect(sub.find((s) => s.name === "Jadwal OK").allows).toEqual(["READ", "CREATE", "UPDATE", "BATAL", "VALIDASI"]);
  });
});
