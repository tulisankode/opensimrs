import { sdmPermission, mapPermission, mutuPermission } from "../src/helpers/permission-list.js";

describe("Izin Pelatihan SDM", () => {
  it("menyediakan seluruh aksi tanpa menambahkan hak Mutu", () => {
    const pelatihan = sdmPermission.subModules.find((s) => s.name === "Pelatihan");
    expect(pelatihan.allows).toEqual(["READ", "KELOLA KATALOG", "KELOLA KEGIATAN", "KELOLA PESERTA", "CATAT HASIL", "VERIFIKASI HASIL", "KELOLA SERTIFIKAT", "KELOLA KEBIJAKAN", "BACA REKAP", "EKSPOR"]);
    expect(mapPermission(["hr / sdm"])).toEqual([sdmPermission]);
    expect(mutuPermission.subModules.find((s) => s.name === "Pelatihan")).toBeUndefined();
  });
});
