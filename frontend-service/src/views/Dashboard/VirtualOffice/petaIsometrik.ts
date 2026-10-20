// Geometri & tipe Virtual Office (STD-0042). Koordinat denah (petak, dari laporan-service) diproyeksikan ke isometrik
// 2:1: x ke kanan-bawah, y ke kiri-bawah, z ke atas. Satu petak = 2·SETENGAH_LEBAR × 2·SETENGAH_TINGGI piksel layar.
export const SETENGAH_LEBAR = 28
export const SETENGAH_TINGGI = 14

export type Beban = 'hijau' | 'kuning' | 'merah' | null
export type Posisi = { x: number; y: number; w: number; d: number }
export type Metrik = { kode: string; label: string; nilai: number | string | null; satuan: string }
export type Ruang = {
  kodeRuang: string
  nama: string
  menunggu: number
  dilayani: number
  selesai: number
  total: number
  beban: Beban
  bor?: number | null
  metrik: Metrik[]
  posisi: Posisi
}
export type Unit = {
  kodeUnit: string
  nama: string
  bidangKerja: string
  rute: string | null
  terkunci: boolean
  galat?: boolean
  izinDibutuhkan?: string
  menunggu?: number
  dilayani?: number
  selesai?: number
  total?: number
  beban: Beban
  metrikBeban?: 'menunggu' | 'bor'
  ambang?: { kuning: number; merah: number }
  keterangan?: string | null
  metrik?: Metrik[]
  ruang?: Ruang[]
  posisi: Posisi
  // Hasil tata letak frontend (tataLetak.ts): y koridor di bawah rak unit & x celah di kiri kolomnya (rute pejalan).
  koridor?: number
  lajur?: number
  // Deskripsi tampilan Kantor dari konfigurasi server: jenis perabot, label peran bidang kerja (bukan nama pegawai),
  // dan kata satuan untuk log aktivitas.
  jenisRuang?: string | null
  petugas?: string[]
  petugasRuang?: string[]
  satuan?: string
}
export type Jalur = { asal: string; tujuan: string; label: string; jumlah: number }
export type Snapshot = {
  modeData: 'nyata' | 'simulasi'
  generatedAt: number
  tanggal: string
  intervalPolling: number
  denah: { lebar: number; dalam: number }
  unit: Unit[]
  jalur: Jalur[]
}
// Pilihan pada peta: unit utuh, satu ruang di dalam unit, atau satu jalur.
export type Pilihan = { jenis: 'unit'; kodeUnit: string; kodeRuang?: string } | { jenis: 'jalur'; asal: string; tujuan: string } | null

export const WARNA_BEBAN: Record<string, { garis: string; isi: string; label: string }> = {
  hijau: { garis: '#16a34a', isi: '#dcfce7', label: 'Lancar' },
  kuning: { garis: '#d97706', isi: '#fef3c7', label: 'Ramai' },
  merah: { garis: '#dc2626', isi: '#fee2e2', label: 'Padat' },
}
export const WARNA_TERKUNCI = { garis: '#94a3b8', isi: '#f1f5f9', label: 'Terkunci' }
export const WARNA_GALAT = { garis: '#64748b', isi: '#e2e8f0', label: 'Sumber gagal dimuat' }

export const warnaBeban = (beban: Beban, terkunci = false, galat = false) =>
  terkunci ? WARNA_TERKUNCI : galat || !beban ? WARNA_GALAT : WARNA_BEBAN[beban]

export const iso = (x: number, y: number, z = 0): [number, number] => [(x - y) * SETENGAH_LEBAR, (x + y) * SETENGAH_TINGGI - z]
export const titik = (daftar: Array<[number, number]>) => daftar.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')

// Muka balok/dinding ruang. `h` = tinggi dinding (piksel).
export const lantai = (p: Posisi, z = 0) => titik([iso(p.x, p.y, z), iso(p.x + p.w, p.y, z), iso(p.x + p.w, p.y + p.d, z), iso(p.x, p.y + p.d, z)])
export const dindingUtara = (p: Posisi, h: number) => titik([iso(p.x, p.y), iso(p.x + p.w, p.y), iso(p.x + p.w, p.y, h), iso(p.x, p.y, h)])
export const dindingBarat = (p: Posisi, h: number) => titik([iso(p.x, p.y), iso(p.x, p.y + p.d), iso(p.x, p.y + p.d, h), iso(p.x, p.y, h)])
export const dindingSelatan = (p: Posisi, h: number) => titik([iso(p.x, p.y + p.d), iso(p.x + p.w, p.y + p.d), iso(p.x + p.w, p.y + p.d, h), iso(p.x, p.y + p.d, h)])
export const dindingTimur = (p: Posisi, h: number) => titik([iso(p.x + p.w, p.y), iso(p.x + p.w, p.y + p.d), iso(p.x + p.w, p.y + p.d, h), iso(p.x + p.w, p.y, h)])
export const tengah = (p: Posisi, z = 0) => iso(p.x + p.w / 2, p.y + p.d / 2, z)

// Titik avatar di lantai ruang: `dilayani` di dekat meja (belakang), `menunggu` berbaris di depan.
export const MAKS_AVATAR_MENUNGGU = 6
export const MAKS_AVATAR_DILAYANI = 3
export const posisiAvatar = (p: Posisi, menunggu: number, dilayani: number) => {
  const hasil: Array<{ x: number; y: number; jenis: 'menunggu' | 'dilayani' }> = []
  const nd = Math.min(dilayani, MAKS_AVATAR_DILAYANI)
  for (let i = 0; i < nd; i++) {
    const [x, y] = iso(p.x + (p.w * (i + 1)) / (nd + 1), p.y + Math.min(1.45, p.d * 0.48))
    hasil.push({ x, y, jenis: 'dilayani' })
  }
  const nm = Math.min(menunggu, MAKS_AVATAR_MENUNGGU)
  const perBaris = Math.max(1, Math.floor(p.w / 0.7))
  for (let i = 0; i < nm; i++) {
    const kol = i % perBaris
    const bar = Math.floor(i / perBaris)
    const [x, y] = iso(p.x + 0.45 + kol * 0.7, p.y + p.d - 0.5 - bar * 0.55)
    hasil.push({ x, y, jenis: 'menunggu' })
  }
  return hasil.sort((a, b) => a.y - b.y)
}

// Turunan warna merek dari warna utama tema faskes (warnaTema): t > 0 dicampur putih, t < 0 dicampur hitam.
export const campur = (hex: string, t: number) => {
  const h = hex.replace('#', '')
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  if (rgb.some((n) => Number.isNaN(n))) return hex
  return '#' + rgb.map((c) => Math.round(t >= 0 ? c + (255 - c) * t : c * (1 + t)).toString(16).padStart(2, '0')).join('')
}
export const paletMerek = (utama: string) => ({ utama, tua: campur(utama, -0.3), muda: campur(utama, 0.92), lembut: campur(utama, 0.8), sedang: campur(utama, 0.62) })
export type PaletMerek = ReturnType<typeof paletMerek>
