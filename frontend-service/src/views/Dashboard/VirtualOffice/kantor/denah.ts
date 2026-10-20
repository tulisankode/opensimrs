import type { Pilihan, Posisi, Snapshot } from '../petaIsometrik'
import { warnaBeban } from '../petaIsometrik'
import { titikAntre } from '../gerakan'
import {
  P, LANTAI, bangku, bed, dindingRuang, gembok, kasirMesin, kotak, kursi, loket, meja, mesinRadiologi, mikroskop, monitor,
  papan, rakObat, tabung, tanaman, troli, ubin, type StatusPetugas,
} from './sprite'

// Susunan adegan Kantor dari snapshot: ruang (posisi = tata-letak server, satuan petak × P), perabot per jenis ruang,
// titik petugas, kursi tunggu, dan tempat pasien dilayani. Jumlah pasien = angka nyata, dibatasi slot (+n).

export type Slot = { x: number; y: number; baring?: boolean }
export type Petugas = { peran: string; x: number; y: number; status: StatusPetugas }
export type RuangKantor = {
  kunci: string
  pilihan: Pilihan
  nama: string
  jenis: string
  x: number; y: number; w: number; h: number
  terkunci: boolean
  galat: boolean
  beban: string | null
  menunggu: number
  dilayani: number
  selesai: number
  petugas: Petugas[]
  kursi: Slot[]
  layan: Slot[]
}
export type Zona = { kodeUnit: string; nama: string; x: number; y: number; w: number; h: number }
export type Adegan = { lebar: number; tinggi: number; ruang: RuangKantor[]; zona: Zona[]; jam: Array<{ x: number; y: number }> }

const keRect = (p: Posisi) => ({ x: p.x * P, y: p.y * P, w: p.w * P, h: p.d * P })

export const statusPetugas = (beban: string | null, menunggu: number, dilayani: number): StatusPetugas =>
  !menunggu && !dilayani ? 'santai' : beban === 'merah' || beban === 'kuning' ? 'sibuk' : dilayani ? 'melayani' : 'sibuk'

// Tata isi ruang per jenis. (x, y) = pojok kiri atas ruang; koordinat kaki karakter.
const isiRuang = (jenis: string, x: number, y: number, w: number, h: number, peran: string[]) => {
  const tengah = x + w / 2
  const petugas: Array<{ peran: string; x: number; y: number }> = []
  const layan: Slot[] = []
  const pintu0 = x + w - 28
  const kursi: Slot[] = []
  // Kursi tunggu = baris antre (sama dengan titik akhir pasien berjalan), tidak menghalangi pintu.
  for (let i = 0; i < 6; i++) {
    const [ax] = titikAntre({ x: x / P, y: y / P, w: w / P, d: h / P }, i)
    const kx = ax * P
    if (kx + 8 > pintu0) break
    kursi.push({ x: kx, y: y + h - 10 })
  }
  const taruh = (dx: number[]) => peran.slice(0, dx.length).forEach((p, i) => petugas.push({ peran: p, x: x + dx[i], y: y + 30 }))
  switch (jenis) {
    case 'bangsal':
      // Deretan bed; pasien dirawat berbaring, perawat berdiri di antara bed.
      for (let i = 0; i < Math.floor((w - 8) / 28); i++) layan.push({ x: x + 6 + i * 28, y: y + 10, baring: true })
      peran.slice(0, 1).forEach((p) => petugas.push({ peran: p, x: x + w - 14, y: y + h - 28 }))
      break
    case 'igd':
      layan.push({ x: x + w - 50, y: y + 10, baring: true }, { x: x + w - 26, y: y + 10, baring: true })
      if (peran[0]) petugas.push({ peran: peran[0], x: x + w - 56, y: y + 56 })
      if (peran[1]) petugas.push({ peran: peran[1], x: x + 16, y: y + 30 })
      layan.push({ x: x + 22, y: y + 58 })
      break
    case 'radiologi':
      taruh([16])
      layan.push({ x: x + w - 42, y: y + 12, baring: true }, { x: x + 34, y: y + 58 })
      break
    case 'loket_daftar':
    case 'farmasi':
      taruh(w >= 112 ? [tengah - x - 24, tengah - x + 20] : [tengah - x])
      for (const dx of [-24, 0, 24]) layan.push({ x: tengah + dx, y: y + 58 })
      break
    case 'poli':
      taruh([Math.min(36, w / 2 - 6) - 8])
      layan.push({ x: x + Math.min(36, w / 2 - 6) - 6, y: y + 58 }, { x: x + Math.min(36, w / 2 - 6) + 14, y: y + 58 })
      break
    default:
      taruh([w / 2])
      for (const dx of [-20, 0, 20]) layan.push({ x: tengah + dx, y: y + 58 })
  }
  return { petugas, layan, kursi }
}

export const susunAdegan = (s: Snapshot): Adegan => {
  const ruang: RuangKantor[] = []
  const zona: Zona[] = []
  for (const u of s.unit) {
    const jenis = u.jenisRuang ?? 'lain'
    const terkunci = !!u.terkunci
    const galat = !!u.galat
    const masuk = (kunci: string, pilihan: Pilihan, nama: string, p: Posisi, data: { menunggu?: number; dilayani?: number; selesai?: number; beban: any }, peran: string[]) => {
      const r = keRect(p)
      const isi = isiRuang(jenis, r.x, r.y, r.w, r.h, peran)
      const m = data.menunggu ?? 0
      const d = data.dilayani ?? 0
      ruang.push({
        kunci, pilihan, nama, jenis, ...r, terkunci, galat, beban: data.beban, menunggu: m, dilayani: d, selesai: data.selesai ?? 0,
        petugas: terkunci || galat ? [] : isi.petugas.map((t) => ({ ...t, status: statusPetugas(data.beban, m, d) })),
        kursi: isi.kursi, layan: isi.layan,
      })
    }
    if (u.ruang?.length && !terkunci) {
      zona.push({ kodeUnit: u.kodeUnit, nama: u.nama, ...keRect(u.posisi) })
      for (const r of u.ruang) {
        const peran = (u.petugasRuang ?? []).map((t) => t.replace('{ruang}', r.nama))
        masuk(`${u.kodeUnit}:${r.kodeRuang}`, { jenis: 'unit', kodeUnit: u.kodeUnit, kodeRuang: r.kodeRuang }, r.nama, r.posisi, r, peran)
      }
    } else {
      const peran = u.petugas?.length ? u.petugas : (u.petugasRuang ?? []).map((t) => t.replace('{ruang}', u.nama))
      masuk(u.kodeUnit, { jenis: 'unit', kodeUnit: u.kodeUnit }, u.nama, u.posisi, u, peran)
    }
  }
  // Jam dinding nyata di unit pendaftaran & tiap zona.
  const jam = [
    ...ruang.filter((r) => r.jenis === 'loket_daftar').map((r) => ({ x: r.x + 10, y: r.y - 1 })),
    ...zona.map((z) => ({ x: z.x + z.w - 16, y: z.y + 4 })),
  ]
  return { lebar: s.denah.lebar * P, tinggi: s.denah.dalam * P, ruang, zona, jam }
}

const perabot = (c: CanvasRenderingContext2D, r: RuangKantor, utama: string) => {
  const { x, y, w, h } = r
  const tengah = x + w / 2
  switch (r.jenis) {
    case 'loket_daftar':
      papan(c, x + w - 34, y + 9, utama)
      loket(c, x + 8, y + 32, w - 16)
      break
    case 'poli': {
      const mx = x + Math.min(36, w / 2 - 6)
      meja(c, mx - 14, y + 30, 28)
      monitor(c, mx + 2, y + 24, '#7dd3fc')
      bed(c, x + w - 26, y + 12, '#bae6fd')
      break
    }
    case 'igd':
      bed(c, x + w - 50, y + 10, '#fecaca')
      bed(c, x + w - 26, y + 10, '#fecaca')
      troli(c, x + w - 64, y + 30)
      meja(c, x + 8, y + 30, 30)
      monitor(c, x + 26, y + 24, '#fca5a5')
      break
    case 'bangsal':
      for (let i = 0; i < Math.floor((w - 8) / 28); i++) bed(c, x + 6 + i * 28, y + 10, '#bbf7d0')
      break
    case 'lab':
      meja(c, x + 8, y + 30, w - 16)
      mikroskop(c, x + 14, y + 23)
      tabung(c, x + w - 30, y + 25)
      monitor(c, tengah + 10, y + 24, '#c4b5fd')
      break
    case 'radiologi':
      mesinRadiologi(c, x + w - 46, y + 10)
      meja(c, x + 6, y + 30, 28)
      monitor(c, x + 26, y + 24, '#93c5fd')
      break
    case 'farmasi':
      rakObat(c, x + 6, y + 9, w - 12)
      loket(c, x + 8, y + 34, w - 16)
      break
    case 'kasir':
      loket(c, x + 8, y + 32, w - 16)
      kasirMesin(c, tengah - 5, y + 34)
      break
    default:
      meja(c, tengah - 14, y + 30, 28)
  }
  for (const k of r.kursi) kursi(c, k.x, k.y)
  if (w >= 128 && r.jenis !== 'radiologi' && r.jenis !== 'igd') tanaman(c, x + w - 18, y + 46)
}

// Lapisan statis (lantai, dinding, perabot, gembok) — digambar ulang hanya saat snapshot/tema berubah.
export const gambarStatis = (c: CanvasRenderingContext2D, a: Adegan, utama: string) => {
  ubin(c, 0, 0, a.lebar, a.tinggi, LANTAI.koridor)
  // dinding luar gedung
  kotak(c, 0, 0, a.lebar, 4, '#334155')
  kotak(c, 0, 0, 4, a.tinggi, '#334155')
  kotak(c, a.lebar - 4, 0, 4, a.tinggi, '#334155')
  const pintu = a.lebar / 2
  kotak(c, 0, a.tinggi - 4, pintu - 20, 4, '#334155')
  kotak(c, pintu + 20, a.tinggi - 4, a.lebar - pintu - 20, 4, '#334155')
  kotak(c, pintu - 20, a.tinggi - 3, 40, 3, '#cbd5e1') // keset pintu masuk
  // dekorasi koridor: tanaman di sudut & bangku dekat pintu masuk
  tanaman(c, 8, 8)
  tanaman(c, a.lebar - 20, 8)
  tanaman(c, pintu - 40, a.tinggi - 20)
  tanaman(c, pintu + 28, a.tinggi - 20)
  for (const z of a.zona) {
    ubin(c, z.x, z.y, z.w, z.h, LANTAI.tunggu)
    kotak(c, z.x, z.y, z.w, 2, '#a8a29e')
    tanaman(c, z.x + 6, z.y + z.h - 18)
    if (z.w > 200) bangku(c, z.x + z.w / 2 - 20, z.y + z.h - 12, 40)
  }
  for (const r of a.ruang) {
    ubin(c, r.x, r.y, r.w, r.h, LANTAI[r.jenis] ?? LANTAI.lain)
    perabot(c, r, utama)
    dindingRuang(c, r.x, r.y, r.w, r.h, warnaBeban(r.beban as any, r.terkunci, r.galat).garis)
    if (r.terkunci || r.galat) {
      c.fillStyle = r.terkunci ? 'rgba(15,23,42,0.62)' : 'rgba(71,85,105,0.5)'
      c.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 7)
      if (r.terkunci) gembok(c, r.x + r.w / 2, r.y + r.h / 2 + 4)
      else { kotak(c, r.x + r.w / 2 - 2, r.y + r.h / 2 - 10, 4, 12, '#f8fafc'); kotak(c, r.x + r.w / 2 - 2, r.y + r.h / 2 + 5, 4, 4, '#f8fafc') }
    }
  }
}

export const ruangDi = (a: Adegan, bx: number, by: number) => a.ruang.find((r) => bx >= r.x && bx < r.x + r.w && by >= r.y && by < r.y + r.h)
export const zonaDi = (a: Adegan, bx: number, by: number) => a.zona.find((z) => bx >= z.x && bx < z.x + z.w && by >= z.y && by < z.y + z.h)
