export const SUBMODUL_JADWAL = [
  { name: "Pola Shift", allows: ["READ", "CREATE", "UPDATE", "DELETE", "PENGATURAN"] },
  { name: "Jadwal Dinas", allows: ["READ", "CREATE", "UPDATE", "AJUKAN", "REVISI", "TERBITKAN", "EKSPOR", "CETAK"] },
  { name: "Persetujuan Jadwal", allows: ["READ", "SETUJUI", "TOLAK"] },
  { name: "Jadwal Saya", allows: ["READ"] },
  { name: "Tukar Dinas", allows: ["READ", "CREATE", "TANGGAPI", "BATALKAN", "SETUJUI", "TOLAK"] },
];

// Izin yang pernah diberikan manual dipertahankan; tambahan otomatis jadwal hanya untuk super admin.
export const tambahanSinkronSdm = (tambahan, superAdmin) => tambahan.map((m) => m.module === "HR / SDM" && !superAdmin
  ? { ...m, subModules: m.subModules.filter((s) => !SUBMODUL_JADWAL.some((x) => x.name === s.name)) } : m);

export const gabungIzinJadwal = (data) => {
  const hasil = structuredClone(data);
  let modul = hasil.find((m) => m.module === "HR / SDM");
  if (!modul) hasil.push(modul = { module: "HR / SDM", subModules: [] });
  modul.subModules ??= [];
  for (const sub of SUBMODUL_JADWAL) {
    let ada = modul.subModules.find((s) => s.name === sub.name);
    if (!ada) modul.subModules.push(ada = { name: sub.name, allows: [] });
    ada.allows ??= [];
    for (const aksi of sub.allows) if (!ada.allows.some((x) => (typeof x === "string" ? x : x?.name) === aksi)) ada.allows.push(aksi);
  }
  return hasil;
};
