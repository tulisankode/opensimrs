// Sprite & perabot piksel tampilan Kantor, DIGAMBAR PROSEDURAL dari kode (tanpa aset gambar luar). Palet terbatas,
// satuan = piksel dasar; kanvas utama menskalakan dengan faktor bulat (imageSmoothingEnabled = false).

export const P = 32 // piksel dasar per petak denah (1 petak = 2×2 ubin 16 px)
export const UBIN = 16

type Ctx = CanvasRenderingContext2D
export const kotak = (c: Ctx, x: number, y: number, w: number, h: number, warna: string) => {
  c.fillStyle = warna
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

// ---- karakter ----
// Pola 12×17: H rambut/kerudung, S kulit, E mata, B baju, A aksen (stetoskop/dasi), P celana, K sepatu.
const KEPALA = [
  '....HHHH....',
  '...HHHHHH...',
  '..HHHHHHHH..',
  '..HSSSSSSH..',
  '..SSESSESS..',
  '..SSSSSSSS..',
  '...SSSSSS...',
  '....SSSS....',
]
const KERUDUNG = [
  '....HHHH....',
  '...HHHHHH...',
  '..HHHHHHHH..',
  '..HSSSSSSH..',
  '..HSESSESH..',
  '..HSSSSSSH..',
  '..HHSSSSHH..',
  '...HHHHHH...',
]
const BADAN = [
  '..BBBBBBBB..',
  '.BBBBAABBBB.',
  '.BBBBAABBBB.',
  '.SBBBBBBBBS.',
  '..BBBBBBBB..',
]
const KAKI: Record<string, string[]> = {
  berdiri: ['..PPPPPPPP..', '..PPP..PPP..', '..PPP..PPP..', '..KKK..KKK..'],
  jalan1: ['..PPPPPPPP..', '.PPP...PPP..', '.PPP...KKK..', '.KKK........'],
  jalan2: ['..PPPPPPPP..', '..PPP...PPP.', '..KKK...PPP.', '........KKK.'],
  duduk: ['.PPPPPPPPPP.', '.PP......PP.', '.KK......KK.'],
}
export type Pose = 'berdiri' | 'jalan1' | 'jalan2' | 'duduk'
export type Palet = { H: string; S: string; E: string; B: string; A: string; P: string; K: string; kerudung?: boolean }
const GARIS = '#1f2937'

export const PALET_PERAN: Record<string, Palet> = {
  dokter: { H: '#3f2a1d', S: '#e0ac69', E: '#1f2937', B: '#f8fafc', A: '#0f766e', P: '#475569', K: '#1f2937' },
  perawat: { H: '#1c1917', S: '#c68642', E: '#1f2937', B: '#14b8a6', A: '#f8fafc', P: '#0f766e', K: '#f8fafc', kerudung: true },
  analis: { H: '#57534e', S: '#f1c27d', E: '#1f2937', B: '#ede9fe', A: '#7c3aed', P: '#4c1d95', K: '#1f2937' },
  radiografer: { H: '#292524', S: '#e0ac69', E: '#1f2937', B: '#1e40af', A: '#93c5fd', P: '#1e293b', K: '#1f2937' },
  apoteker: { H: '#1c1917', S: '#c68642', E: '#1f2937', B: '#f0fdf4', A: '#16a34a', P: '#14532d', K: '#1f2937', kerudung: true },
  petugas: { H: '#292524', S: '#f1c27d', E: '#1f2937', B: '#3b82f6', A: '#1e3a8a', P: '#1f2937', K: '#1f2937' },
}
export const paletPeran = (label: string, utama: string): Palet => {
  const l = label.toLowerCase()
  if (l.startsWith('dokter')) return PALET_PERAN.dokter
  if (l.startsWith('perawat')) return { ...PALET_PERAN.perawat, B: utama }
  if (l.startsWith('analis')) return PALET_PERAN.analis
  if (l.startsWith('radiografer')) return PALET_PERAN.radiografer
  if (l.startsWith('apoteker') || l.startsWith('ttk')) return PALET_PERAN.apoteker
  return PALET_PERAN.petugas
}
// Pasien generik: variasi warna baju/rambut deterministik dari nomor urut, tanpa identitas apa pun.
const BAJU = ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#f97316', '#64748b', '#ec4899', '#0ea5e9']
const RAMBUT = ['#1c1917', '#3f2a1d', '#78716c', '#d6d3d1', '#292524']
const KULIT = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524']
export const paletPasien = (n: number): Palet => {
  const h = Math.abs(Math.imul(n + 7, 2654435761)) >>> 0
  const baju = BAJU[h % BAJU.length]
  return { H: RAMBUT[(h >> 4) % RAMBUT.length], S: KULIT[(h >> 8) % KULIT.length], E: '#1f2937', B: baju, A: baju, P: ['#334155', '#1e293b', '#475569'][(h >> 12) % 3], K: '#1f2937', kerudung: (h >> 16) % 4 === 0 }
}

const tembolok = new Map<string, HTMLCanvasElement>()
export const spriteKarakter = (pal: Palet, pose: Pose) => {
  const kunci = `${Object.values(pal).join(',')}|${pose}`
  const ada = tembolok.get(kunci)
  if (ada) return ada
  const pola = [...(pal.kerudung ? KERUDUNG : KEPALA), ...BADAN, ...KAKI[pose]]
  const w = 12
  const h = pola.length
  const kanvas = document.createElement('canvas')
  kanvas.width = w + 2
  kanvas.height = h + 2
  const c = kanvas.getContext('2d')!
  // Garis tepi gelap 1 px di sekeliling siluet agar terbaca di lantai mana pun.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (pola[y][x] === '.') continue
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) kotak(c, x + 1 + dx, y + 1 + dy, 1, 1, GARIS)
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = pola[y][x]
    if (ch !== '.') kotak(c, x + 1, y + 1, 1, 1, (pal as any)[ch] ?? GARIS)
  }
  if (tembolok.size > 400) tembolok.clear()
  tembolok.set(kunci, kanvas)
  return kanvas
}
// Gambar karakter dengan kaki di (x, y) (tengah bawah).
export const gambarKarakter = (c: Ctx, pal: Palet, pose: Pose, x: number, y: number, alpha = 1) => {
  const s = spriteKarakter(pal, pose)
  c.globalAlpha = alpha
  c.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height))
  c.globalAlpha = 1
}
export const bayangan = (c: Ctx, x: number, y: number, w = 10) => {
  c.fillStyle = 'rgba(15,23,42,0.18)'
  c.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 2)
  c.fillRect(Math.round(x - w / 2 + 2), Math.round(y - 2), w - 4, 4)
}

// ---- gelembung status petugas ----
export type StatusPetugas = 'santai' | 'melayani' | 'sibuk'
export const gelembung = (c: Ctx, status: StatusPetugas, x: number, y: number, t: number) => {
  const bx = Math.round(x - 7)
  const by = Math.round(y - 13)
  const latar = status === 'sibuk' ? '#fee2e2' : '#ffffff'
  const tepi = status === 'sibuk' ? '#dc2626' : '#334155'
  kotak(c, bx, by, 14, 10, tepi)
  kotak(c, bx + 1, by + 1, 12, 8, latar)
  kotak(c, bx + 3, by + 10, 2, 2, tepi)
  if (status === 'santai') {
    // cangkir kopi + uap
    kotak(c, bx + 4, by + 4, 5, 4, '#92400e')
    kotak(c, bx + 9, by + 5, 1, 2, '#92400e')
    if (Math.floor(t / 600) % 2) kotak(c, bx + 5, by + 2, 1, 1, '#94a3b8')
    else kotak(c, bx + 7, by + 2, 1, 1, '#94a3b8')
  } else if (status === 'melayani') {
    const n = Math.floor(t / 400) % 4
    for (let i = 0; i < 3; i++) kotak(c, bx + 3 + i * 3, by + 4, 2, 2, i < n ? '#0f766e' : '#cbd5e1')
  } else {
    kotak(c, bx + 6, by + 2, 2, 4, '#dc2626')
    kotak(c, bx + 6, by + 7, 2, 1, '#dc2626')
  }
}

// ---- lantai & dinding ----
export const LANTAI: Record<string, [string, string]> = {
  koridor: ['#e5e7eb', '#dfe2e6'],
  tunggu: ['#f3ece0', '#ece3d3'],
  loket_daftar: ['#fdf6e3', '#f6ecd2'],
  poli: ['#e0f2fe', '#d3ebfb'],
  igd: ['#fde8e8', '#f9dada'],
  bangsal: ['#e3f6ec', '#d5f0e1'],
  lab: ['#efeafe', '#e5ddfb'],
  radiologi: ['#e2e8f0', '#d7dee8'],
  farmasi: ['#e6f7e9', '#d8f0dc'],
  kasir: ['#fff4e0', '#fbe9c8'],
  lain: ['#f1f5f9', '#e8edf3'],
}
export const ubin = (c: Ctx, x: number, y: number, w: number, h: number, warna: [string, string]) => {
  kotak(c, x, y, w, h, warna[0])
  c.fillStyle = warna[1]
  for (let j = 0; j * UBIN < h; j++) for (let i = 0; i * UBIN < w; i++) {
    if ((i + j) % 2) continue
    c.fillRect(x + i * UBIN, y + j * UBIN, Math.min(UBIN, w - i * UBIN), Math.min(UBIN, h - j * UBIN))
  }
}

// Dinding ruang tampak atas 3/4: dinding utara tebal (muka terlihat), samping & selatan tipis, pintu di kanan selatan.
export const dindingRuang = (c: Ctx, x: number, y: number, w: number, h: number, beban: string) => {
  kotak(c, x, y, w, 8, '#94a3b8')
  kotak(c, x, y, w, 3, '#475569')
  kotak(c, x, y + 7, w, 1, '#64748b')
  kotak(c, x, y, 3, h, '#475569')
  kotak(c, x + w - 3, y, 3, h, '#475569')
  const pintu0 = x + w - 28
  kotak(c, x, y + h - 4, pintu0 - x, 4, '#475569')
  kotak(c, x + w - 8, y + h - 4, 8, 4, '#475569')
  // Strip warna beban di dinding selatan.
  kotak(c, x + 3, y + h - 3, pintu0 - x - 3, 2, beban)
  // Kusen pintu.
  kotak(c, pintu0, y + h - 5, 2, 5, '#78350f')
  kotak(c, x + w - 10, y + h - 5, 2, 5, '#78350f')
}

// ---- perabot ----
export const meja = (c: Ctx, x: number, y: number, w: number) => {
  kotak(c, x, y, w, 8, '#c08457')
  kotak(c, x, y, w, 2, '#d9a273')
  kotak(c, x, y + 8, w, 3, '#8b5a2b')
  kotak(c, x + 1, y + 11, 2, 2, '#5b3a1a')
  kotak(c, x + w - 3, y + 11, 2, 2, '#5b3a1a')
}
export const monitor = (c: Ctx, x: number, y: number, layar: string) => {
  kotak(c, x, y, 10, 7, '#1f2937')
  kotak(c, x + 1, y + 1, 8, 5, layar)
  kotak(c, x + 4, y + 7, 2, 2, '#334155')
}
export const kursi = (c: Ctx, x: number, y: number) => {
  kotak(c, x - 7, y - 10, 14, 4, '#475569')
  kotak(c, x - 7, y - 6, 14, 6, '#64748b')
  kotak(c, x - 6, y, 2, 2, '#334155')
  kotak(c, x + 4, y, 2, 2, '#334155')
}
export const bed = (c: Ctx, x: number, y: number, selimut: string) => {
  kotak(c, x, y, 20, 34, '#94a3b8')
  kotak(c, x + 1, y + 1, 18, 32, '#f8fafc')
  kotak(c, x + 3, y + 2, 14, 6, '#e2e8f0')
  kotak(c, x + 1, y + 14, 18, 19, selimut)
  kotak(c, x + 1, y + 14, 18, 2, '#ffffff')
}
export const pasienBaring = (c: Ctx, x: number, y: number, pal: { S: string; H: string }) => {
  kotak(c, x + 6, y + 3, 8, 7, '#1f2937')
  kotak(c, x + 7, y + 4, 6, 5, pal.S)
  kotak(c, x + 7, y + 4, 6, 2, pal.H)
}
export const troli = (c: Ctx, x: number, y: number) => {
  kotak(c, x, y, 12, 8, '#cbd5e1')
  kotak(c, x + 1, y + 1, 10, 2, '#ef4444')
  kotak(c, x + 2, y + 4, 3, 2, '#0ea5e9')
  kotak(c, x + 1, y + 8, 2, 2, '#334155')
  kotak(c, x + 9, y + 8, 2, 2, '#334155')
}
export const mikroskop = (c: Ctx, x: number, y: number) => {
  kotak(c, x, y + 6, 8, 2, '#334155')
  kotak(c, x + 2, y, 3, 7, '#475569')
  kotak(c, x + 1, y, 4, 2, '#1f2937')
}
export const tabung = (c: Ctx, x: number, y: number) => {
  for (let i = 0; i < 4; i++) {
    kotak(c, x + i * 3, y, 2, 6, '#e2e8f0')
    kotak(c, x + i * 3, y + 3, 2, 3, ['#ef4444', '#8b5cf6', '#f59e0b', '#22c55e'][i])
  }
}
export const mesinRadiologi = (c: Ctx, x: number, y: number) => {
  kotak(c, x, y, 34, 30, '#64748b')
  kotak(c, x + 2, y + 2, 30, 26, '#e2e8f0')
  kotak(c, x + 10, y + 8, 14, 14, '#1f2937')
  kotak(c, x + 12, y + 10, 10, 10, '#334155')
  kotak(c, x + 14, y + 22, 6, 18, '#f8fafc')
  kotak(c, x + 14, y + 22, 6, 1, '#94a3b8')
  kotak(c, x + 4, y + 4, 4, 2, '#22c55e')
}
export const rakObat = (c: Ctx, x: number, y: number, w: number) => {
  kotak(c, x, y, w, 14, '#8b5a2b')
  const warna = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#f8fafc', '#a855f7']
  for (let r = 0; r < 2; r++) {
    kotak(c, x + 1, y + 1 + r * 7, w - 2, 5, '#5b3a1a')
    for (let i = 0; i * 4 + 2 < w - 2; i++) kotak(c, x + 2 + i * 4, y + 2 + r * 7, 3, 4, warna[(i * 7 + r * 3) % warna.length])
  }
}
export const loket = (c: Ctx, x: number, y: number, w: number) => {
  kotak(c, x, y, w, 10, '#e2e8f0')
  kotak(c, x, y, w, 2, '#f8fafc')
  kotak(c, x, y + 10, w, 3, '#94a3b8')
  // kaca loket
  for (let i = 0; i < Math.floor(w / 24); i++) kotak(c, x + 4 + i * 24, y - 8, 16, 8, 'rgba(147,197,253,0.55)')
}
export const kasirMesin = (c: Ctx, x: number, y: number) => {
  kotak(c, x, y, 10, 6, '#334155')
  kotak(c, x + 1, y + 1, 8, 2, '#22c55e')
}
export const papan = (c: Ctx, x: number, y: number, utama: string) => {
  kotak(c, x, y, 26, 8, '#1f2937')
  kotak(c, x + 1, y + 1, 24, 6, utama)
  kotak(c, x + 3, y + 3, 4, 2, '#ffffff')
  kotak(c, x + 9, y + 3, 14, 2, '#e2e8f0')
}
export const tanaman = (c: Ctx, x: number, y: number) => {
  kotak(c, x + 2, y + 8, 8, 6, '#b45309')
  kotak(c, x + 2, y + 8, 8, 1, '#d97706')
  kotak(c, x + 4, y, 4, 9, '#15803d')
  kotak(c, x, y + 2, 5, 4, '#22c55e')
  kotak(c, x + 7, y + 3, 5, 4, '#16a34a')
  kotak(c, x + 3, y - 2, 4, 3, '#4ade80')
}
export const bangku = (c: Ctx, x: number, y: number, w: number) => {
  kotak(c, x, y, w, 5, '#a16207')
  kotak(c, x, y, w, 1, '#ca8a04')
  kotak(c, x + 1, y + 5, 2, 2, '#713f12')
  kotak(c, x + w - 3, y + 5, 2, 2, '#713f12')
}
// Jam dinding: jarum mengikuti waktu nyata.
export const jamDinding = (c: Ctx, x: number, y: number, waktu: Date) => {
  kotak(c, x + 1, y, 8, 10, '#1f2937')
  kotak(c, x, y + 1, 10, 8, '#1f2937')
  kotak(c, x + 1, y + 1, 8, 8, '#f8fafc')
  kotak(c, x + 4, y + 4, 2, 2, '#1f2937')
  const sudut = (n: number, maks: number) => (n / maks) * Math.PI * 2 - Math.PI / 2
  const jarum = (a: number, r: number, w: string) => kotak(c, x + 5 + Math.round(Math.cos(a) * r) - (Math.cos(a) < 0 ? 1 : 0), y + 5 + Math.round(Math.sin(a) * r) - (Math.sin(a) < 0 ? 1 : 0), 1, 1, w)
  jarum(sudut(waktu.getHours() % 12 + waktu.getMinutes() / 60, 12), 2, '#1f2937')
  jarum(sudut(waktu.getMinutes(), 60), 3, '#dc2626')
}
export const gembok = (c: Ctx, x: number, y: number) => {
  kotak(c, x - 4, y - 12, 8, 2, '#cbd5e1')
  kotak(c, x - 5, y - 11, 2, 6, '#cbd5e1')
  kotak(c, x + 3, y - 11, 2, 6, '#cbd5e1')
  kotak(c, x - 7, y - 5, 14, 11, '#e2e8f0')
  kotak(c, x - 6, y - 4, 12, 9, '#94a3b8')
  kotak(c, x - 1, y - 2, 2, 4, '#334155')
}
