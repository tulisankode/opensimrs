// Definisi tunggal peran superadmin (role "super admin" tanpa faskes) untuk semua layanan OpenSIMRS.
// Terima objek author dari JWT ({ role }) atau nama peran langsung.
export const NAMA_SUPERADMIN = "super admin";

export const isSuperadmin = (authorAtauPeran) => {
  const peran = typeof authorAtauPeran === "string" ? authorAtauPeran : authorAtauPeran?.role;
  return String(peran ?? "").trim().toLowerCase() === NAMA_SUPERADMIN;
};
