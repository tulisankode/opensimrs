import { ProyeksiSimulasi } from "./proyeksi.js"

// Dependensi disuntikkan agar isolasi fasilitas dan izin dapat diuji tanpa koneksi database.
export const buatSnapshot = ({ konfigurasi, bacaModul, punyaIzin, uuidv7 }) => async (req, res) => {
  const faskes = req.author?.faskesUuid
  if (!faskes) return res.status(401).json({ message: "Konteks fasilitas kesehatan tidak tersedia." })
  if (Object.keys(req.query).length) return res.status(400).json({ message: "Snapshot tidak menerima parameter fasilitas atau transaksi." })
  const aktif = await bacaModul(faskes)
  if (!aktif.fitur || !aktif.modul.includes("dashboard")) return res.status(403).json({ message: "Fitur Virtual Office tidak aktif." })
  const unit = []
  for (const u of konfigurasi.unit) {
    if (aktif.modul.includes(u.modul) && await punyaIzin(req, "Dashboard", "Virtual Office", u.izin)) unit.push(u)
  }
  const proyeksi = new ProyeksiSimulasi(konfigurasi)
  for (const u of unit) {
    for (const skenario of konfigurasi.skenario) {
      proyeksi.terapkan({ faskes_uuid: faskes, source_service: "simulasi", source_kind: "pekerjaan", source_uuid: uuidv7(),
        event_uuid: uuidv7(), source_revision: 1, kode_unit: u.kode_unit, event_type: skenario.event_type })
    }
  }
  const kode = unit.map((u) => u.kode_unit)
  return res.json({ message: "Snapshot simulasi Virtual Office berhasil dimuat.", payload: {
    mode_data: "simulasi", configuration_version: konfigurasi.versi, snapshot_version: uuidv7(),
    generated_at: Math.floor(Date.now() / 1000), status_sinkronisasi: "simulasi",
    unit: unit.map(({ izin, modul, ...u }) => ({ ...u, ...proyeksi.ringkasan(faskes, u.kode_unit) })),
    jalur: konfigurasi.jalur.filter((j) => kode.includes(j.asal) && kode.includes(j.tujuan)),
  } })
}
