// Definisi lengkap tetap tampil di katalog. Sinkron otomatis tidak memberikan gaji kepada admin faskes.
// Daftar izin yang sudah diberikan manual tidak disentuh oleh penyaring tambahan ini.
export const tambahanSinkronPenggajian = (tambahan, namaPeran) => {
  if (String(namaPeran ?? "").trim().toLowerCase() === "super admin") return tambahan;
  return tambahan.map((m) => m.module === "HR / SDM" ? { ...m, subModules: m.subModules.filter((s) => !s.name.endsWith(" Penggajian")) } : m);
};
