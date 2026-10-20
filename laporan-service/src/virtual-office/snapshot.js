import { tataLetak } from "./tata-letak.js"

// Snapshot Virtual Office (STD-0042): peta agregat aktivitas unit hari ini untuk faskes pada token.
// Dependensi disuntikkan agar isolasi faskes, izin, dan mode data dapat diuji tanpa database.
// - faskes HANYA dari req.author (JWT); parameter kueri apa pun ditolak;
// - unit tampil bila modulnya aktif di faskes; angka & ruang unit hanya untuk aksi Dashboard › Virtual Office yang
//   dimiliki pengguna (unit lain tampil terkunci tanpa angka); jalur hanya bila kedua ujungnya terbuka;
// - mode bawaan = data nyata; data simulasi hanya bila flag VIRTUAL_OFFICE_SIMULASI=aktif (berlabel "simulasi").
const URUTAN_BEBAN = { hijau: 0, kuning: 1, merah: 2 }
const terberat = (daftar) => daftar.filter(Boolean).reduce((a, b) => (URUTAN_BEBAN[b] > URUTAN_BEBAN[a] ? b : a), "hijau")
export const hitungBeban = (nilai, ambang) => {
  if (nilai === null || nilai === undefined) return null
  if (nilai >= ambang.merah) return "merah"
  if (nilai >= ambang.kuning) return "kuning"
  return "hijau"
}

// Rentang hari ini (tanggal lokal faskes) dalam epoch detik. offset mis. "+07:00".
export const hariIni = (sekarang, offset = "+07:00") => {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(offset) ?? ["", "+", "07", "00"]
  const geser = (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60)
  const tanggal = new Date((sekarang + geser) * 1000).toISOString().slice(0, 10)
  const awal = Math.floor(Date.parse(`${tanggal}T00:00:00Z`) / 1000) - geser
  return { tanggal, awal, akhir: awal + 86399 }
}

// Angka sintetis deterministik per (faskes, unit, ruang, blok 5 menit) — hanya mode simulasi.
const acak = (teks) => {
  let h = 2166136261
  for (const c of teks) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}
const samarkan = (kode, d, benih) => {
  if (!d || d.galat) return d
  const r = acak(`${benih}|${kode}`)
  const isi = (x) => ({ ...x, menunggu: Math.floor(r() * 14), dilayani: Math.floor(r() * 5), selesai: Math.floor(r() * 40) })
  const ruang = d.ruang?.map((x) => ({ ...isi(x), ...(x.bor !== undefined ? { bor: Math.floor(r() * 100) } : {}) }))
  const hasil = { ...isi(d), ...(ruang ? { ruang } : {}), metrik: [] }
  if (ruang) for (const k of ["menunggu", "dilayani", "selesai"]) hasil[k] = ruang.reduce((a, x) => a + x[k], 0)
  if (d.masuk) hasil.masuk = Object.fromEntries(Object.keys(d.masuk).map((k) => [k, Math.floor(r() * 20)]))
  if (d.bor !== undefined) hasil.bor = Math.floor(r() * 100)
  return hasil
}

const ringkasRuang = (ruang, batas) => {
  if (ruang.length <= batas) return ruang
  const urut = [...ruang].sort((a, b) => b.menunggu + b.dilayani + b.selesai - (a.menunggu + a.dilayani + a.selesai))
  const sisa = urut.slice(batas - 1)
  const jumlah = (k) => sisa.reduce((a, r) => a + r[k], 0)
  return [
    ...urut.slice(0, batas - 1),
    { kode_ruang: "lainnya", nama: `Lainnya (${sisa.length})`, menunggu: jumlah("menunggu"), dilayani: jumlah("dilayani"), selesai: jumlah("selesai"), metrik: [] },
  ]
}

const susunUnit = (u, d, batas) => {
  // jenis_ruang/petugas/satuan = deskripsi tampilan Kantor (perabot, label peran bidang kerja, kata satuan log).
  const dasar = {
    kode_unit: u.kode_unit, nama: u.nama, bidang_kerja: u.bidang_kerja, rute: u.rute ?? null,
    jenis_ruang: u.jenis_ruang ?? null, petugas: u.petugas ?? [], petugas_ruang: u.petugas_ruang ?? [], satuan: u.satuan ?? "transaksi",
  }
  if (!d || d.galat) return { ...dasar, terkunci: false, galat: true, beban: null }
  const metrikBeban = u.metrik_beban ?? "menunggu"
  const ambang = u.ambang ?? { kuning: 5, merah: 15 }
  const bebanRuang = (r) =>
    metrikBeban === "bor" ? (r.bor === null || r.bor === undefined ? (r.menunggu > 0 ? "kuning" : "hijau") : hitungBeban(r.bor, ambang)) : hitungBeban(r.menunggu, ambang)
  const ruang = d.ruang ? ringkasRuang(d.ruang, batas).map((r) => ({ ...r, total: r.menunggu + r.dilayani + r.selesai, beban: bebanRuang(r) })) : null
  const bebanSendiri = metrikBeban === "bor" ? (d.bor === null || d.bor === undefined ? null : hitungBeban(d.bor, ambang)) : hitungBeban(d.menunggu, ambang)
  return {
    ...dasar,
    terkunci: false,
    galat: false,
    menunggu: d.menunggu,
    dilayani: d.dilayani,
    selesai: d.selesai,
    total: d.menunggu + d.dilayani + d.selesai,
    beban: ruang ? terberat([bebanSendiri, ...ruang.map((r) => r.beban)]) : bebanSendiri ?? "hijau",
    metrik_beban: metrikBeban,
    ambang,
    keterangan: d.keterangan ?? null,
    metrik: d.metrik ?? [],
    ...(ruang ? { ruang } : {}),
  }
}

export const buatSnapshot = ({
  konfigurasi,
  bacaModul,
  punyaIzin,
  uuidv7,
  bacaSumber,
  modeSimulasi = () => false,
  jam = () => Date.now(),
  offset = () => process.env.REPORT_TZ_OFFSET || "+07:00",
  simpanMs = 15000,
}) => {
  // Tembolok agregat per faskes + daftar unit (bukan per pengguna); izin tetap diperiksa setiap permintaan.
  const tembolok = new Map()
  const ambil = async (faskes, kode, waktu) => {
    const kunci = `${faskes}|${kode.join(",")}`
    const ada = tembolok.get(kunci)
    if (ada && jam() - ada.pada < simpanMs) return ada.data
    const data = await bacaSumber(faskes, kode, waktu)
    tembolok.set(kunci, { pada: jam(), data })
    if (tembolok.size > 500) tembolok.delete(tembolok.keys().next().value)
    return data
  }

  return async (req, res) => {
    const faskes = req.author?.faskesUuid
    if (!faskes) return res.status(401).json({ message: "Konteks fasilitas kesehatan tidak tersedia." })
    if (Object.keys(req.query ?? {}).length) return res.status(400).json({ message: "Snapshot tidak menerima parameter fasilitas atau transaksi." })
    const aktif = await bacaModul(faskes)
    if (!aktif.fitur || !aktif.modul.includes("dashboard")) return res.status(403).json({ message: "Fitur Virtual Office tidak aktif." })

    const unitAktif = konfigurasi.unit.filter((u) => aktif.modul.includes(u.modul))
    const boleh = await Promise.all(unitAktif.map((u) => punyaIzin(req, "Dashboard", "Virtual Office", u.izin)))
    const terbuka = unitAktif.filter((_, i) => boleh[i])

    const sekarang = Math.floor(jam() / 1000)
    const waktu = { ...hariIni(sekarang, offset()), sekarang }
    const simulasi = modeSimulasi()
    const mentah = terbuka.length ? await ambil(faskes, terbuka.map((u) => u.kode_unit), waktu) : {}
    const benih = `${faskes}|${Math.floor(sekarang / 300)}`
    const data = Object.fromEntries(terbuka.map((u) => [u.kode_unit, simulasi ? samarkan(u.kode_unit, mentah[u.kode_unit], benih) : mentah[u.kode_unit]]))

    const batas = konfigurasi.batas_ruang ?? 12
    const unit = unitAktif.map((u, i) =>
      boleh[i]
        ? susunUnit(u, data[u.kode_unit], batas)
        : { kode_unit: u.kode_unit, nama: u.nama, bidang_kerja: u.bidang_kerja, rute: null, jenis_ruang: u.jenis_ruang ?? null, terkunci: true, izin_dibutuhkan: u.izin, beban: null }
    )
    const letak = tataLetak(unit, konfigurasi.denah)
    const kodeTerbuka = new Set(unit.filter((u) => !u.terkunci && !u.galat).map((u) => u.kode_unit))
    const jalur = konfigurasi.jalur
      .filter((j) => kodeTerbuka.has(j.asal) && kodeTerbuka.has(j.tujuan))
      .map((j) => ({ asal: j.asal, tujuan: j.tujuan, label: j.label, jumlah: data[j.tujuan]?.masuk?.[j.asal] }))
      .filter((j) => Number.isFinite(j.jumlah))

    return res.json({
      message: simulasi ? "Snapshot simulasi Virtual Office berhasil dimuat." : "Snapshot Virtual Office berhasil dimuat.",
      payload: {
        mode_data: simulasi ? "simulasi" : "nyata",
        configuration_version: konfigurasi.versi,
        snapshot_version: uuidv7(),
        generated_at: sekarang,
        tanggal: waktu.tanggal,
        interval_polling: konfigurasi.interval_polling ?? 30,
        status_sinkronisasi: "live",
        denah: letak.denah,
        unit: letak.unit,
        jalur,
      },
    })
  }
}
