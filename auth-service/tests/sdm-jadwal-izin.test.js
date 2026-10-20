import { sdmPermission } from "../src/helpers/permission-list.js";
import { SUBMODUL_JADWAL, tambahanSinkronSdm, gabungIzinJadwal } from "../src/helpers/sdm-jadwal-izin.js";
import PermissionController from "../src/controllers/permission-controller.js";
import sequelize from "@opensimrs/model-sdk/instance";

jest.mock("@opensimrs/model-sdk/instance", () => ({ __esModule: true, default: { transaction: jest.fn(), query: jest.fn() } }), { virtual: true });
jest.mock("sequelize", () => ({ QueryTypes: { SELECT: "select", UPDATE: "update" } }));
jest.mock("@opensimrs/authorization-sdk/peran", () => ({ isSuperadmin: () => true }), { virtual: true });
jest.mock("@opensimrs/authorization-sdk/generateKeyRedis", () => ({ __esModule: true, default: () => "fiktif" }), { virtual: true });
jest.mock("../src/configurations/redis-client-config.js", () => ({ __esModule: true, default: {} }));

// Admin biasa menerima semua submodul SDM kecuali Jadwal Dinas yang baru (mis. Kepegawaian, Kredensial, Pelatihan);
// dihitung dari definisi agar tidak patah saat submodul SDM lain ditambahkan.
const namaJadwal = new Set(SUBMODUL_JADWAL.map((s) => s.name));
const namaTanpaJadwal = sdmPermission.subModules.map((s) => s.name).filter((n) => !namaJadwal.has(n));
// Sinkron oleh controller juga menyaring submodul gaji (STD-0041) untuk peran selain super admin.
const namaAdminSinkron = namaTanpaJadwal.filter((n) => !n.endsWith(" Penggajian"));

describe("Izin Jadwal Dinas STD-0038", () => {
  test("katalog mempertahankan izin SDM lama dan membedakan akses sendiri dengan jadwal unit", () => {
    // Izin SDM lama tetap ada (urutan bisa bergeser saat submodul lain ditambahkan, mis. Kehadiran & Cuti).
    expect(sdmPermission.subModules[0].name).toBe("Kepegawaian");
    expect(sdmPermission.subModules.map((s) => s.name)).toContain("Kredensial");
    expect(sdmPermission.subModules.find((s) => s.name === "Jadwal Saya").allows).toEqual(["READ"]);
    expect(SUBMODUL_JADWAL).toHaveLength(5);
  });
  test("sinkron admin biasa menyaring hanya tambahan baru; super admin menerima definisi lengkap", () => {
    const modulLain = { module: "Contoh", subModules: [] };
    const admin = tambahanSinkronSdm([sdmPermission, modulLain], false);
    expect(admin[0].subModules.map((s) => s.name)).toEqual(namaTanpaJadwal);
    expect(admin[1]).toBe(modulLain);
    expect(tambahanSinkronSdm([sdmPermission], true)[0]).toBe(sdmPermission);
  });
  test("penggabungan idempoten mempertahankan aksi manual dan modul lain", () => {
    const lama = [{ module: "Lain", subModules: [] }, { module: "HR / SDM", subModules: [{ name: "Jadwal Dinas", allows: ["READ", "AKSI MANUAL"] }] }];
    const hasil = gabungIzinJadwal(lama);
    expect(gabungIzinJadwal(hasil)).toEqual(hasil);
    expect(hasil[0]).toEqual(lama[0]);
    expect(hasil[1].subModules.find((s) => s.name === "Jadwal Dinas").allows).toContain("AKSI MANUAL");
    expect(lama[1].subModules).toHaveLength(1);
  });
  test("controller sinkron memperbarui peran dan pengguna super admin, mempertahankan izin manual serta daftar kosong", async () => {
    const manual = [{ module: "HR / SDM", subModules: [{ name: "Jadwal Saya", allows: ["READ"] }] }];
    const peran = [
      { uuid: "admin", name: "Admin fiktif", permissions: "[]" },
      { uuid: "manual", name: "Kepala fiktif", permissions: JSON.stringify(manual) },
      { uuid: "super", name: "super admin", permissions: JSON.stringify([{ module: "Lama", subModules: [] }]) },
      { uuid: "kosong", name: "super admin", permissions: "[]" },
    ];
    const pengguna = new Map(peran.map((p) => [p.uuid, [{ uuid: `akun-${p.uuid}`, permissions: p.permissions }]]));
    sequelize.transaction.mockImplementation((fn) => fn({}));
    sequelize.query.mockImplementation(async (sql, opsi) => {
      const p = opsi.replacements;
      if (sql.includes("SELECT uuid, name, permissions FROM role")) return peran;
      if (sql.startsWith("SELECT uuid, permissions FROM users")) return pengguna.get(p.r);
      if (sql.startsWith("SELECT permissions FROM users")) return [{ permissions: "[]" }];
      if (sql.startsWith("UPDATE role")) peran.find((r) => r.uuid === p.u).permissions = p.p;
      else if (sql.startsWith("UPDATE users")) [...pengguna.values()].flat().find((u) => u.uuid === p.u).permissions = p.p;
      else throw new Error("Kueri tiruan tidak dikenali");
      return [];
    });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }, next = jest.fn();
    await PermissionController.sinkronModul({ author: { role: "super admin", username: "super-fiktif", faskesUuid: "faskes-fiktif" }, body: { modul: ["HR / SDM"] } }, res, next);
    expect(next).not.toHaveBeenCalled();
    for (const data of [peran, [...pengguna.values()].flat()]) {
      const isi = (akhir) => JSON.parse(data.find((x) => x.uuid.endsWith(akhir)).permissions);
      expect(isi("admin")[0].subModules.map((s) => s.name)).toEqual(namaAdminSinkron);
      expect(isi("manual")).toEqual(manual);
      expect(isi("super").find((m) => m.module === "HR / SDM").subModules).toEqual(sdmPermission.subModules);
      expect(isi("super")[0]).toEqual({ module: "Lama", subModules: [] });
      expect(isi("kosong")).toEqual([]);
    }
  });
});
