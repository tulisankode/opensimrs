import { ccuPermission, icuPermission, mapPermission } from "../src/helpers/permission-list.js";

describe("Katalog izin CCU", () => {
  it("terdaftar di mapPermission tanpa memberikan izin modul klinis lain", () => {
    expect(mapPermission(["CCU"])).toEqual([ccuPermission]);
  });

  // Submodul & aksi yang dipakai rute intensif bersama (rawat-inap-service/src/routes/intensif-routes.js). Submodul khusus
  // ICU (mis. layanan Burn/Neuro ICU) tidak wajib ada di CCU.
  const IZIN_RUTE_BERSAMA = {
    Dasbor: ["READ"],
    Perawatan: ["READ"],
    "Serah Terima": ["KELOLA"],
    "Flowsheet Observasi": ["READ", "CREATE", "KOREKSI"],
    "Balance Cairan": ["READ", "CREATE"],
  };
  it("submodul dasar sama dengan ICU agar rute intensif bersama memakai nama izin yang sama", () => {
    for (const izin of [icuPermission, ccuPermission]) {
      for (const [nama, aksi] of Object.entries(IZIN_RUTE_BERSAMA)) {
        const sub = izin.subModules.find((s) => s.name === nama);
        expect(sub).toBeDefined();
        for (const a of aksi) expect(sub.allows).toContain(a);
      }
    }
    expect(ccuPermission.subModules.map((s) => s.name)).toContain("Laporan CCU");
  });

  it("data kardiologi punya izin baca/tulis/batal terpisah", () => {
    const allows = (n) => ccuPermission.subModules.find((s) => s.name === n)?.allows;
    expect(allows("EKG & Irama")).toEqual(["READ", "CREATE", "BATAL"]);
    expect(allows("Penanda Jantung")).toEqual(["READ", "CREATE", "BATAL"]);
    expect(allows("Intervensi Kardiak")).toEqual(["READ", "CREATE", "BATAL"]);
    expect(allows("Skor Risiko")).toEqual(["READ", "CREATE"]);
    expect(allows("Data Klinis Kardiak")).toEqual(["READ", "KELOLA"]);
  });
});
