import type { Snapshot, Unit } from './petaIsometrik'

// Tata letak rapat Virtual Office, dihitung di frontend dari daftar unit & ruang snapshot (posisi dari server hanya
// dipakai untuk urutan unit tunggal), agar denah mengikuti area tampilan. Fungsi murni & deterministik.
// - Blok = unit tunggal (ukuran dasar UNIT_MIN) atau zona berisi kisi ruang anak (RUANG_MIN, jarak JARAK_RUANG).
// - Blok dikemas per "rak" (shelf packing): zona diurutkan dari yang tertinggi; unit tunggal boleh ditumpuk dalam satu
//   kolom rak. Semua celah = koridor tipis seragam (KORIDOR) dan tepi gedung (TEPI) untuk jalur pejalan.
// - Kandidat (jumlah kolom ruang per zona × tinggi tumpukan × lebar rak) dinilai terhadap sasaran:
//   Denah (isometrik): keliling terkecil (W + D) karena kotak isometrik selalu ±2:1, dengan kepadatan tinggi;
//   Kantor (piksel): zoom bulat terbesar (3×, 2×, 1×) yang memuat denah, lalu rasio terdekat dengan area tampilan;
//   bila tidak muat pada 1× (layar kecil), zoom pecahan "pas" sebesar mungkin.
// - Rak, kolom, dan ruang lalu direntangkan agar denah terisi penuh: bangunan mengikuti tata letak (ruang lebih besar
//   bila ruangnya sedikit atau areanya luas), tanpa celah besar.
// Setiap unit membawa `koridor` (y koridor di bawah raknya) dan `lajur` (x celah di kiri kolomnya) untuk rute pejalan.
export const KORIDOR = 1
export const TEPI = 1
export const PAD_ZONA = 1
export const JARAK_RUANG = 1
const UNIT_MIN = { w: 4, d: 3 }
const RUANG_MIN = { w: 3, d: 3 }
const MAKS_KOLOM = 6
const MAKS_TUMPUK = 4
const MARGIN_PX = 8

type Blok = { kode: string; urut: number; n: number; kolom: number; w: number; d: number }
type Kolom = { blok: Blok[]; w: number; h: number }
type Rak = { kolom: Kolom[]; lebar: number; tinggi: number; batas: number }
type Kandidat = { rak: Rak[]; W: number; D: number; padat: number }

export type Sasaran =
  | { mode: 'denah' }
  | { mode: 'kantor'; lebar: number; tinggi: number; dpr: number; petak: number; zoom?: number[] }
export type HasilTata = { snapshot: Snapshot; zoom: number }

// Piksel layar per piksel denah Kantor pada zoom z: zoom bulat → kelipatan bulat (piksel tajam); zoom "pas" pecahan
// (< 1, hanya bila denah tidak muat pada 1×) → skala tepat, digambar diperhalus.
export const skalaPiksel = (z: number, dpr: number) => (Number.isInteger(z) ? Math.max(1, Math.round(z * dpr)) : z * dpr)

const ukuranZona = (n: number, c: number) => {
  const b = Math.ceil(n / c)
  return { w: c * RUANG_MIN.w + (c - 1) * JARAK_RUANG + 2 * PAD_ZONA, d: b * RUANG_MIN.d + (b - 1) * JARAK_RUANG + 2 * PAD_ZONA }
}

// Bagi `n` (bilangan bulat ≥ 0) proporsional terhadap bobot (metode sisa terbesar, urutan stabil).
const bagi = (n: number, bobot: number[]) => {
  const jumlah = bobot.reduce((a, b) => a + b, 0)
  if (n <= 0 || !jumlah) return bobot.map(() => 0)
  const mentah = bobot.map((b) => (n * b) / jumlah)
  const hasil = mentah.map(Math.floor)
  let sisa = n - hasil.reduce((a, b) => a + b, 0)
  const urut = mentah.map((m, i) => [m - Math.floor(m), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1])
  for (let k = 0; sisa > 0; k = (k + 1) % urut.length, sisa--) hasil[urut[k][1]]++
  return hasil
}

const kemas = (blok: Blok[], lebarMaks: number, tumpuk: number): Rak[] => {
  const rak: Rak[] = []
  for (const b of blok) {
    const r = rak[rak.length - 1]
    const akhir = r?.kolom[r.kolom.length - 1]
    // Unit tunggal ditumpuk di kolom tunggal terakhir selama muat di tinggi rak.
    if (r && !b.n && akhir && !akhir.blok[0].n && akhir.blok.length < tumpuk && akhir.h + KORIDOR + b.d <= r.batas) {
      akhir.blok.push(b)
      akhir.h += KORIDOR + b.d
      continue
    }
    if (r && r.lebar + KORIDOR + b.w <= lebarMaks && b.d <= r.batas) {
      r.kolom.push({ blok: [b], w: b.w, h: b.d })
      r.lebar += KORIDOR + b.w
      continue
    }
    rak.push({ kolom: [{ blok: [b], w: b.w, h: b.d }], lebar: b.w, tinggi: 0, batas: b.n ? b.d : tumpuk * b.d + (tumpuk - 1) * KORIDOR })
  }
  for (const r of rak) r.tinggi = Math.max(...r.kolom.map((k) => k.h))
  return rak
}

const kombinasi = (pilihan: number[][]): number[][] =>
  pilihan.reduce<number[][]>((acc, p) => acc.flatMap((a) => p.map((x) => [...a, x])), [[]])

const susunKandidat = (unit: Unit[]): Kandidat[] => {
  const urutServer = [...unit].map((u, i) => ({ u, i })).sort((a, b) => a.u.posisi.y - b.u.posisi.y || a.u.posisi.x - b.u.posisi.x || a.i - b.i)
  const zona = urutServer.filter(({ u }) => !u.terkunci && u.ruang?.length)
  const tunggal: Blok[] = urutServer
    .filter(({ u }) => u.terkunci || !u.ruang?.length)
    .map(({ u }, urut) => ({ kode: u.kodeUnit, urut, n: 0, kolom: 0, ...UNIT_MIN }))
  // Pilihan kolom per zona (dibatasi agar kombinasi tetap kecil bila zona banyak).
  const opsiKolom = zona.map(({ u }) => {
    const n = u.ruang!.length
    const semua = Array.from({ length: Math.min(n, MAKS_KOLOM) }, (_, i) => i + 1)
    if (zona.length <= 3) return semua
    const c0 = Math.max(1, Math.round(Math.sqrt(n)))
    return semua.filter((c) => Math.abs(c - c0) <= 1)
  })
  const hasil: Kandidat[] = []
  const sudah = new Set<string>()
  for (const kolom of kombinasi(opsiKolom)) {
    const blokZona: Blok[] = zona
      .map(({ u }, i) => ({ kode: u.kodeUnit, urut: i, n: u.ruang!.length, kolom: kolom[i], ...ukuranZona(u.ruang!.length, kolom[i]) }))
      .sort((a, b) => b.d - a.d || a.urut - b.urut)
    const blok = [...blokZona, ...tunggal]
    if (!blok.length) continue
    const luas = blok.reduce((a, b) => a + b.w * b.d, 0)
    const lebarMin = Math.max(...blok.map((b) => b.w))
    const lebarTotal = blok.reduce((a, b) => a + b.w, 0) + (blok.length - 1) * KORIDOR
    for (let tumpuk = 1; tumpuk <= MAKS_TUMPUK; tumpuk++) {
      for (let L = lebarMin; L <= lebarTotal; L++) {
        const rak = kemas(blok, L, tumpuk)
        const W = Math.max(...rak.map((r) => r.lebar))
        const D = rak.reduce((a, r) => a + r.tinggi, 0) + (rak.length - 1) * KORIDOR
        const sidik = `${kolom.join(',')}|${rak.map((r) => r.kolom.map((k) => k.blok.map((b) => b.kode).join('+')).join('/')).join('|')}`
        if (sudah.has(sidik)) continue
        sudah.add(sidik)
        hasil.push({ rak, W, D, padat: luas / (W * D) })
      }
    }
  }
  return hasil
}

// Tembolok kandidat per struktur snapshot (unit, terkunci, jumlah ruang) — tidak bergantung angka.
const tembolok = new Map<string, Kandidat[]>()
const kandidatUntuk = (unit: Unit[]) => {
  const kunci = unit.map((u) => `${u.kodeUnit}:${u.terkunci ? 'k' : ''}:${u.ruang?.length ?? 0}:${u.posisi.x},${u.posisi.y}`).join('|')
  let k = tembolok.get(kunci)
  if (!k) {
    k = susunKandidat(unit)
    tembolok.set(kunci, k)
    if (tembolok.size > 8) tembolok.delete(tembolok.keys().next().value!)
  }
  return k
}

// Rentangkan kandidat ke ukuran dalam W × D (≥ ukuran kandidat) dan hitung posisi akhir (sudah termasuk TEPI).
const tempatkan = (k: Kandidat, W: number, D: number, peta: Map<string, Unit>) => {
  const hasil = new Map<string, Unit>()
  const tambahD = bagi(D - k.D, k.rak.map((r) => r.tinggi))
  const dalam = D + 2 * TEPI
  let y = TEPI
  k.rak.forEach((r, i) => {
    const H = r.tinggi + tambahD[i]
    const terakhir = i === k.rak.length - 1
    const koridor = terakhir ? (y + H + dalam) / 2 : y + H + KORIDOR / 2
    const tambahW = bagi(W - r.lebar, r.kolom.map((c) => c.w))
    let x = TEPI
    r.kolom.forEach((c, j) => {
      const w = c.w + tambahW[j]
      const lajur = x - KORIDOR / 2
      if (c.blok[0].n) {
        const b = c.blok[0]
        const u = peta.get(b.kode)!
        const kol = b.kolom
        const baris = Math.ceil(b.n / kol)
        const rw = Math.floor((w - 2 * PAD_ZONA - (kol - 1) * JARAK_RUANG) / kol)
        const rd = Math.floor((H - 2 * PAD_ZONA - (baris - 1) * JARAK_RUANG) / baris)
        const x0 = x + PAD_ZONA + Math.floor((w - 2 * PAD_ZONA - (kol - 1) * JARAK_RUANG - kol * rw) / 2)
        const y0 = y + PAD_ZONA
        hasil.set(b.kode, {
          ...u,
          posisi: { x, y, w, d: H },
          koridor,
          lajur,
          ruang: u.ruang!.map((ru, n) => ({ ...ru, posisi: { x: x0 + (n % kol) * (rw + JARAK_RUANG), y: y0 + Math.floor(n / kol) * (rd + JARAK_RUANG), w: rw, d: rd } })),
        })
      } else {
        const isi = c.blok.reduce((a, b) => a + b.d, 0) + (c.blok.length - 1) * KORIDOR
        const tambah = bagi(H - isi, c.blok.map((b) => b.d))
        let yy = y
        c.blok.forEach((b, m) => {
          const d = b.d + tambah[m]
          hasil.set(b.kode, { ...peta.get(b.kode)!, posisi: { x, y: yy, w, d }, koridor, lajur })
          yy += d + KORIDOR
        })
      }
      x += w + KORIDOR
    })
    y += H + KORIDOR
  })
  return { hasil, denah: { lebar: W + 2 * TEPI, dalam } }
}

const skorDenah = (k: Kandidat) => Math.sqrt(k.padat) / (k.W + k.D + 4 * TEPI)

export const tataLetak = (s: Snapshot, sasaran: Sasaran): HasilTata => {
  if (!s.unit.length) return { snapshot: s, zoom: 1 }
  const daftar = kandidatUntuk(s.unit)
  if (!daftar.length) return { snapshot: s, zoom: 1 }
  let pilih = daftar[0]
  let W = pilih.W
  let D = pilih.D
  let zoom = 1
  if (sasaran.mode === 'denah') {
    for (const k of daftar) if (skorDenah(k) > skorDenah(pilih)) pilih = k
    W = pilih.W
    D = pilih.D
  } else {
    const lebar = sasaran.lebar > 0 ? sasaran.lebar : 1200
    const tinggi = sasaran.tinggi > 0 ? sasaran.tinggi : 700
    const dpr = sasaran.dpr || 1
    const tingkat = [...(sasaran.zoom ?? [1, 2, 3])].sort((a, b) => b - a)
    // Petak dalam (tanpa tepi) yang muat di area pada zoom z.
    const muat = (z: number) => {
      const petak = sasaran.petak * skalaPiksel(z, dpr)
      return {
        AW: Math.floor(((lebar - 2 * MARGIN_PX) * dpr) / petak) - 2 * TEPI,
        AD: Math.floor(((tinggi - 2 * MARGIN_PX) * dpr) / petak) - 2 * TEPI,
      }
    }
    const skor = (k: Kandidat, AW: number, AD: number) => {
      const rW = AW / k.W
      const rD = AD / k.D
      return k.padat * (Math.min(rW, rD) / Math.max(rW, rD))
    }
    let ketemu = false
    for (const z of tingkat) {
      const { AW, AD } = muat(z)
      const cocok = daftar.filter((k) => k.W <= AW && k.D <= AD)
      if (!cocok.length) continue
      pilih = cocok.reduce((a, b) => (skor(b, AW, AD) > skor(a, AW, AD) ? b : a))
      W = AW
      D = AD
      zoom = z
      ketemu = true
      break
    }
    if (!ketemu) {
      // Tidak muat pada zoom 1× (layar kecil): zoom pecahan "pas" (< 1, diperhalus) sebesar mungkin, dari kandidat yang
      // paling sedikit perlu diperkecil; lalu rentangkan agar rasio sama dengan area.
      const lw = lebar - 2 * MARGIN_PX
      const lt = tinggi - 2 * MARGIN_PX
      const pas = (k: Kandidat) => Math.min(lw / ((k.W + 2 * TEPI) * sasaran.petak), lt / ((k.D + 2 * TEPI) * sasaran.petak))
      pilih = daftar.reduce((a, b) => (pas(b) > pas(a) + 1e-9 || (Math.abs(pas(b) - pas(a)) < 1e-9 && b.padat > a.padat) ? b : a))
      zoom = Math.max(0.25, Math.floor(pas(pilih) * 100) / 100)
      W = Math.max(pilih.W, Math.floor(lw / (zoom * sasaran.petak)) - 2 * TEPI)
      D = Math.max(pilih.D, Math.floor(lt / (zoom * sasaran.petak)) - 2 * TEPI)
    }
  }
  const peta = new Map(s.unit.map((u) => [u.kodeUnit, u]))
  const { hasil, denah } = tempatkan(pilih, W, D, peta)
  return { snapshot: { ...s, denah, unit: s.unit.map((u) => hasil.get(u.kodeUnit) ?? u) }, zoom }
}

