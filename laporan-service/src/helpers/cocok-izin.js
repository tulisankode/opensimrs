// Pencocokan izin murni (tanpa database) agar bisa diuji unit; dipakai helpers/izin.js.
const teks = (x) => String(x ?? "").trim().toLowerCase()
const daftar = (x) => (Array.isArray(x) ? x : [])
const namaAksi = (a) => (typeof a === "string" ? a : a?.name)

export const cocokIzin = (izin, modul, submodul, aksi) => {
  const m = daftar(izin).find((x) => teks(x?.module) === teks(modul))
  if (!m) return false
  if (!submodul) return true // Izin dasar cukup memerlukan keberadaan modul.
  const aksiList = (Array.isArray(aksi) ? aksi : [aksi]).map(teks)
  return daftar(m.subModules ?? m.submodules ?? m.sub_modules)
    .filter((s) => teks(s?.name) === teks(submodul))
    .some((s) => daftar(s.allows).some((a) => aksiList.includes(teks(namaAksi(a)))))
}
