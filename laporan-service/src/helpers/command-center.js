// Definisi & perhitungan murni Command Center (STD-0037, Dashboard › Command Center). Tanpa database agar bisa diuji
// unit; kueri agregat ada di repositories/command-center-repository.js.
//
// Definisi indikator (posisi saat permintaan, faskes dari token):
//   Tempat tidur  : room_monitorings aktif (status = true, tidak terhapus) bertipe "Bed" per ruangan/kelas.
//                   terisi  = ada patient_uuid ATAU status_operasional "Penuh";
//                   kosong  = tanpa patient_uuid DAN status_operasional "Tersedia"/kosong (sama dengan Monitoring Kamar);
//                   lainnya = status operasional lain yang belum dipetakan → tidak dihitung kosong (KT-6).
//                   BOR saat ini = terisi / total bed × 100%. Bed cadangan & box bayi dilaporkan terpisah.
//   IGD           : instalasi_gawat_darurats status_igd 1 = sedang dirawat, 2 = pulang/discharge, 0 = batal (diabaikan).
//                   Lama di IGD = sekarang − tanggal_daftar (dirawat) atau discharge_date − tanggal_daftar (pulang).
//   Menunggu kamar: rawat_inaps status_ri 1 (SPRI terbit, belum mendapat bed); asal IGD = encounter 'IGD'.
//                   Lama tunggu = sekarang − created_at SPRI.
//   Antrean poli  : rawat_jalans hari ini (jadwal_periksa, atau tanggal_daftar bila kosong) per lokasi poli:
//                   status_rj 1 booking, 2–3 menunggu, 4 dilayani, 5 selesai. Waktu tunggu = tanggal_periksa −
//                   tanggal_checkin (atau tanggal_daftar), 0–1440 menit (sama dengan Dashboard Eksekutif).
//   Antrean admisi: tabel antrian pelayanan 'admisi' untuk kunjungan hari ini: status_panggilan 0 menunggu,
//                   1/3 dipanggil/diproses, 2 terlewat, 4 selesai. Lama menunggu = sekarang − created_at antrean.
// Semua hasil hanya agregat (jumlah, rata-rata, maksimum): tidak ada nama, No. RM, NIK, atau uuid pasien.

export const STATUS_DATA = Object.freeze({
  TERSEDIA: "tersedia",
  BELUM_TERSEDIA: "belum_tersedia",
  GAGAL: "gagal",
})

export const INTERVAL_POLLING_DETIK = 30

// Label kelas ruangan (ruangan.kelas_ruangan, sama dengan Datamaster › Ruangan).
const KELAS = { 1: "Kelas 1", 2: "Kelas 2", 3: "Kelas 3", 4: "VIP", 5: "VVIP" }
export const labelKelas = (kode, cadangan = null) => KELAS[Number(kode)] ?? (cadangan ? String(cadangan) : "Tanpa kelas")

// Ambang yang dapat diatur per faskes (izin ATUR AMBANG). Sistem tidak memasang ambang otomatis: `saran` hanya contoh
// pengisian pada formulir. cakupan: faskes (satu nilai), ruangan / poli (dievaluasi per baris).
export const KATALOG_AMBANG = Object.freeze([
  { kode: "bor_total", nama: "BOR seluruh tempat tidur", satuan: "%", cakupan: "faskes", saran: 85 },
  { kode: "bor_ruangan", nama: "BOR per ruangan", satuan: "%", cakupan: "ruangan", saran: 90 },
  { kode: "igd_dirawat", nama: "Pasien sedang dirawat di IGD", satuan: "pasien", cakupan: "faskes", saran: 20 },
  { kode: "igd_lama_jam", nama: "Lama di IGD terlama", satuan: "jam", cakupan: "faskes", saran: 6 },
  { kode: "igd_menunggu_kamar", nama: "Pasien IGD menunggu kamar", satuan: "pasien", cakupan: "faskes", saran: 5 },
  { kode: "igd_menunggu_kamar_jam", nama: "Lama tunggu kamar terlama (asal IGD)", satuan: "jam", cakupan: "faskes", saran: 2 },
  { kode: "poli_menunggu", nama: "Pasien menunggu per poli", satuan: "pasien", cakupan: "poli", saran: 20 },
  { kode: "poli_tunggu_menit", nama: "Tunggu terlama per poli", satuan: "menit", cakupan: "poli", saran: 60 },
  { kode: "admisi_menunggu", nama: "Pasien menunggu admisi", satuan: "pasien", cakupan: "faskes", saran: 15 },
  { kode: "admisi_tunggu_menit", nama: "Tunggu admisi terlama", satuan: "menit", cakupan: "faskes", saran: 30 },
])
export const KODE_AMBANG = KATALOG_AMBANG.map((a) => a.kode)
export const cariAmbang = (kode) => KATALOG_AMBANG.find((a) => a.kode === kode) ?? null

// Sumber data tiap kode ambang: peringatan kode ini hanya dievaluasi/ditutup bila sumbernya berhasil dimuat.
export const SUMBER_AMBANG = Object.freeze({
  bor_total: "tempat_tidur",
  bor_ruangan: "tempat_tidur",
  igd_dirawat: "igd",
  igd_lama_jam: "igd",
  igd_menunggu_kamar: "igd",
  igd_menunggu_kamar_jam: "igd",
  poli_menunggu: "antrean_poli",
  poli_tunggu_menit: "antrean_poli",
  admisi_menunggu: "antrean_admisi",
  admisi_tunggu_menit: "antrean_admisi",
})

export const OPERATOR = Object.freeze([">", ">="])

const angka = (x) => (x === null || x === undefined || x === "" ? null : Number.isFinite(Number(x)) ? Number(x) : null)

export const bulatkan = (x, desimal = 1) => {
  const n = angka(x)
  if (n === null) return null
  const f = 10 ** desimal
  return Math.round(n * f) / f
}

export const persen = (bagian, total) => {
  const a = angka(bagian)
  const b = angka(total)
  if (a === null || b === null || b <= 0) return null
  return bulatkan((a / b) * 100, 1)
}

export const melampaui = (nilai, operator, batas) => {
  const v = angka(nilai)
  const b = angka(batas)
  if (v === null || b === null) return false
  return operator === ">=" ? v >= b : v > b
}

// Tingkat pelanggaran satu nilai terhadap satu ambang: "kritis" lebih dulu, lalu "peringatan"; null = aman.
export const tingkatPelanggaran = (nilai, ambang) => {
  if (!ambang || ambang.aktif === false) return null
  const op = OPERATOR.includes(ambang.operator) ? ambang.operator : ">"
  if (melampaui(nilai, op, ambang.batas_kritis)) return { tingkat: "kritis", batas: angka(ambang.batas_kritis), operator: op }
  if (melampaui(nilai, op, ambang.batas_peringatan)) return { tingkat: "peringatan", batas: angka(ambang.batas_peringatan), operator: op }
  return null
}

// Kunci peringatan stabil per (kode, sasaran): satu peringatan aktif per kunci per faskes.
export const kunciPeringatan = (kode, sasaranUuid = null) => (sasaranUuid ? `${kode}:${sasaranUuid}` : kode)

// sampel: [{ kode, sasaran_uuid?, sasaran_label?, nilai }] → pelanggaran: [{ kunci, kode, ..., tingkat, batas, operator }]
export const evaluasiAmbang = (daftarAmbang, sampel) => {
  const perKode = new Map((daftarAmbang ?? []).map((a) => [a.kode, a]))
  const hasil = []
  for (const s of sampel ?? []) {
    const def = cariAmbang(s.kode)
    const p = tingkatPelanggaran(s.nilai, perKode.get(s.kode))
    if (!def || !p) continue
    hasil.push({
      kunci: kunciPeringatan(s.kode, s.sasaran_uuid),
      kode: s.kode,
      nama: def.nama,
      satuan: def.satuan,
      sasaran_uuid: s.sasaran_uuid ?? null,
      sasaran_label: s.sasaran_label ?? null,
      nilai: bulatkan(s.nilai, 1),
      ...p,
    })
  }
  return hasil
}

const jumlahkan = (baris, kolom) => baris.reduce((a, r) => a + (angka(r[kolom]) ?? 0), 0)

// Baris agregat bed per ruangan (repository) → ringkasan total, per ruangan, per kelas.
export const susunTempatTidur = (baris = []) => {
  const perRuangan = baris
    .filter((r) => (angka(r.total) ?? 0) > 0 || (angka(r.cadangan_total) ?? 0) > 0)
    .map((r) => {
      const total = angka(r.total) ?? 0
      const terisi = angka(r.terisi) ?? 0
      const kosong = angka(r.kosong) ?? 0
      return {
        ruangan_uuid: r.ruangan_uuid ?? null,
        ruangan: r.ruangan ?? "Tanpa ruangan",
        kelas: labelKelas(r.kelas_kode, r.kelas_nama),
        total,
        terisi,
        kosong,
        lainnya: Math.max(total - terisi - kosong, 0),
        bor: persen(terisi, total),
        cadangan_total: angka(r.cadangan_total) ?? 0,
        cadangan_terisi: angka(r.cadangan_terisi) ?? 0,
      }
    })
  const kelasMap = new Map()
  for (const r of perRuangan) {
    const k = kelasMap.get(r.kelas) ?? { kelas: r.kelas, ruangan: 0, total: 0, terisi: 0, kosong: 0, lainnya: 0 }
    k.ruangan += 1
    k.total += r.total
    k.terisi += r.terisi
    k.kosong += r.kosong
    k.lainnya += r.lainnya
    kelasMap.set(r.kelas, k)
  }
  const urutanKelas = Object.values(KELAS)
  const perKelas = [...kelasMap.values()]
    .map((k) => ({ ...k, bor: persen(k.terisi, k.total) }))
    .sort((a, b) => (urutanKelas.indexOf(a.kelas) + 1 || 99) - (urutanKelas.indexOf(b.kelas) + 1 || 99))
  const total = jumlahkan(perRuangan, "total")
  const terisi = jumlahkan(perRuangan, "terisi")
  return {
    ringkasan: {
      ruangan: perRuangan.length,
      total,
      terisi,
      kosong: jumlahkan(perRuangan, "kosong"),
      lainnya: jumlahkan(perRuangan, "lainnya"),
      bor: persen(terisi, total),
      cadangan_total: jumlahkan(perRuangan, "cadangan_total"),
      cadangan_terisi: jumlahkan(perRuangan, "cadangan_terisi"),
    },
    per_ruangan: perRuangan,
    per_kelas: perKelas,
  }
}

// Ringkasan antrean poli dari baris per poli.
export const susunAntreanPoli = (baris = []) => {
  const perPoli = baris.map((r) => ({
    poli_uuid: r.poli_uuid ?? null,
    poli: r.poli ?? "Tanpa poli",
    booking: angka(r.booking) ?? 0,
    menunggu: angka(r.menunggu) ?? 0,
    dilayani: angka(r.dilayani) ?? 0,
    selesai: angka(r.selesai) ?? 0,
    rata_tunggu_menit: bulatkan(r.rata_tunggu_menit, 0),
    sampel_tunggu: angka(r.sampel_tunggu) ?? 0,
    terlama_menunggu_menit: bulatkan(r.terlama_menunggu_menit, 0),
  }))
  const sampel = jumlahkan(perPoli, "sampel_tunggu")
  const totalTunggu = perPoli.reduce((a, p) => a + (p.rata_tunggu_menit ?? 0) * p.sampel_tunggu, 0)
  const terlama = perPoli.map((p) => p.terlama_menunggu_menit).filter((x) => x !== null)
  return {
    ringkasan: {
      poli: perPoli.length,
      booking: jumlahkan(perPoli, "booking"),
      menunggu: jumlahkan(perPoli, "menunggu"),
      dilayani: jumlahkan(perPoli, "dilayani"),
      selesai: jumlahkan(perPoli, "selesai"),
      rata_tunggu_menit: sampel > 0 ? bulatkan(totalTunggu / sampel, 0) : null,
      sampel_tunggu: sampel,
      terlama_menunggu_menit: terlama.length ? Math.max(...terlama) : null,
    },
    per_poli: perPoli,
  }
}

// Sampel nilai untuk evaluasi ambang dari bagian ringkasan yang berhasil dimuat.
export const sampelAmbang = ({ tempatTidur, igd, antreanPoli, antreanAdmisi }) => {
  const s = []
  if (tempatTidur) {
    s.push({ kode: "bor_total", nilai: tempatTidur.ringkasan.bor })
    for (const r of tempatTidur.per_ruangan) s.push({ kode: "bor_ruangan", sasaran_uuid: r.ruangan_uuid, sasaran_label: r.ruangan, nilai: r.bor })
  }
  if (igd) {
    const r = igd.ringkasan
    s.push({ kode: "igd_dirawat", nilai: r.dirawat })
    s.push({ kode: "igd_lama_jam", nilai: r.terlama_dirawat_menit === null ? null : r.terlama_dirawat_menit / 60 })
    s.push({ kode: "igd_menunggu_kamar", nilai: r.menunggu_kamar })
    s.push({ kode: "igd_menunggu_kamar_jam", nilai: r.menunggu_kamar_terlama_menit === null ? null : r.menunggu_kamar_terlama_menit / 60 })
  }
  if (antreanPoli) {
    for (const p of antreanPoli.per_poli) {
      s.push({ kode: "poli_menunggu", sasaran_uuid: p.poli_uuid, sasaran_label: p.poli, nilai: p.menunggu })
      s.push({ kode: "poli_tunggu_menit", sasaran_uuid: p.poli_uuid, sasaran_label: p.poli, nilai: p.terlama_menunggu_menit })
    }
  }
  if (antreanAdmisi) {
    s.push({ kode: "admisi_menunggu", nilai: antreanAdmisi.ringkasan.menunggu })
    s.push({ kode: "admisi_tunggu_menit", nilai: antreanAdmisi.ringkasan.terlama_menunggu_menit })
  }
  return s
}

// Status tindak lanjut peringatan setelah tindakan: eskalasi tidak turun menjadi "ditinjau".
export const statusSetelahTindakan = (statusLama, jenis) => {
  if (jenis === "eskalasi") return "dieskalasi"
  return statusLama === "dieskalasi" ? "dieskalasi" : "ditinjau"
}
