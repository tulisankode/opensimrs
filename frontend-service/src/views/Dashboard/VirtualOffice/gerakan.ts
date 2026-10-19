import type { Posisi, Snapshot, Unit } from './petaIsometrik'

// Gerakan Virtual Office: perpindahan nyata dihitung dari SELISIH dua snapshot berurutan (angka kumulatif hari ini),
// lalu diterjemahkan menjadi avatar yang berjalan di koridor denah. Tidak ada aktivitas karangan: tanpa selisih
// positif tidak ada avatar berjalan. Fungsi di sini murni (tanpa DOM) dan dipakai tampilan 2.5D maupun 3D.
// Koordinat = petak denah (x ke timur, y ke selatan), sama dengan tata-letak.js di laporan-service.

export type Titik = [number, number]
// asal 'pintu' = kedatangan yang asalnya tidak tercatat/tidak terlihat (mis. tagihan baru di Kasir).
export type Perpindahan = { asal: string; tujuan: string; kodeRuang?: string; jumlah: number }
export type Gerakan = { versi: number; daftar: Perpindahan[] }
export type Pejalan = { id: string; rute: Titik[]; panjang: number[]; total: number; mulai: number; durasi: number; asal: string; tujuan: string }

export const MAKS_PEJALAN = 60
export const PINTU = 'pintu'
const KECEPATAN = 3.2 // petak per detik
const DURASI_MIN = 3500
const DURASI_MAKS = 11000
const JEDA = 420 // ms antaravatar pada satu jalur
const JEDA_MAKS = 9000

const kunciJalur = (j: { asal: string; tujuan: string }) => `${j.asal}>${j.tujuan}`
const terbuka = (u?: Unit) => !!u && !u.terkunci && !u.galat

// Bagi `n` secara proporsional ke bobot (metode sisa terbesar).
const bagi = (n: number, bobot: number[]) => {
  const jumlah = bobot.reduce((a, b) => a + b, 0)
  if (!jumlah) return bobot.map(() => 0)
  const mentah = bobot.map((b) => (n * b) / jumlah)
  const hasil = mentah.map(Math.floor)
  let sisa = n - hasil.reduce((a, b) => a + b, 0)
  const urut = mentah.map((m, i) => [m - Math.floor(m), i]).sort((a, b) => b[0] - a[0])
  for (let k = 0; sisa > 0; k = (k + 1) % urut.length, sisa--) hasil[urut[k][1]]++
  return hasil
}

// Selisih snapshot → daftar perpindahan (sudah dibatasi MAKS_PEJALAN). Snapshot hari berbeda / pertama = tanpa gerakan.
export const hitungPerpindahan = (lama: Snapshot | null, baru: Snapshot, batas = MAKS_PEJALAN): Perpindahan[] => {
  if (!lama || lama.tanggal !== baru.tanggal) return []
  const unitLama = new Map(lama.unit.map((u) => [u.kodeUnit, u]))
  const unitBaru = new Map(baru.unit.map((u) => [u.kodeUnit, u]))
  const jalurLama = new Map(lama.jalur.map((j) => [kunciJalur(j), j.jumlah]))
  const hasil: Perpindahan[] = []
  const masukJalur = new Map<string, number>()

  for (const j of baru.jalur) {
    const sebelum = jalurLama.get(kunciJalur(j))
    if (sebelum === undefined) continue // jalur baru terlihat (mis. izin berubah) ≠ perpindahan
    const d = j.jumlah - sebelum
    masukJalur.set(j.tujuan, (masukJalur.get(j.tujuan) ?? 0) + Math.max(0, d))
    if (d > 0) hasil.push({ asal: j.asal, tujuan: j.tujuan, jumlah: d })
  }
  // Unit tanpa jalur masuk yang terlihat: kenaikan total = kedatangan lewat pintu/koridor.
  const adaJalurMasuk = new Set(baru.jalur.map((j) => j.tujuan))
  for (const u of baru.unit) {
    const l = unitLama.get(u.kodeUnit)
    if (!terbuka(u) || !terbuka(l) || adaJalurMasuk.has(u.kodeUnit)) continue
    const d = (u.total ?? 0) - (l!.total ?? 0)
    if (d > 0) hasil.push({ asal: PINTU, tujuan: u.kodeUnit, jumlah: d })
  }

  // Unit berzona: arahkan ke ruang yang totalnya naik (proporsional); bila tidak ada, ke ruang terpadat.
  const pecah: Perpindahan[] = []
  for (const p of hasil) {
    const u = unitBaru.get(p.tujuan)
    if (!u?.ruang?.length) { pecah.push(p); continue }
    const ruangLama = new Map((unitLama.get(p.tujuan)?.ruang ?? []).map((r) => [r.kodeRuang, r.total]))
    const naik = u.ruang.map((r) => Math.max(0, r.total - (ruangLama.get(r.kodeRuang) ?? r.total)))
    if (naik.some((n) => n > 0)) {
      bagi(p.jumlah, naik).forEach((n, i) => n > 0 && pecah.push({ ...p, kodeRuang: u.ruang![i].kodeRuang, jumlah: n }))
    } else {
      const padat = [...u.ruang].sort((a, b) => b.menunggu - a.menunggu)[0]
      pecah.push({ ...p, kodeRuang: padat.kodeRuang })
    }
  }

  // Batas total avatar: diskalakan proporsional, setiap perpindahan tetap minimal satu avatar.
  const total = pecah.reduce((a, p) => a + p.jumlah, 0)
  if (total <= batas) return pecah
  const dibagi = bagi(batas, pecah.map((p) => p.jumlah)).map((n) => Math.max(1, n))
  while (dibagi.reduce((a, b) => a + b, 0) > batas) dibagi[dibagi.indexOf(Math.max(...dibagi))]--
  return pecah.map((p, i) => ({ ...p, jumlah: dibagi[i] })).slice(0, batas)
}

// ---- rute di koridor ----
// Baris denah = kelompok unit dengan y awal sama; koridor = tengah celah di bawah baris. Antarbaris lewat lajur tepi
// kiri/kanan (selalu kosong karena `tepi`), sehingga avatar tidak menembus ruang.
const barisDenah = (s: Snapshot) => {
  const ys = [...new Set(s.unit.map((u) => u.posisi.y))].sort((a, b) => a - b)
  return ys.map((y, i) => {
    const bawah = Math.max(...s.unit.filter((u) => u.posisi.y === y).map((u) => u.posisi.y + u.posisi.d))
    return { y, koridor: (bawah + (ys[i + 1] ?? s.denah.dalam)) / 2 }
  })
}

// Titik antre di depan ruang (sama dengan posisiAvatar 2.5D, satuan petak).
export const titikAntre = (p: Posisi, i: number): Titik => {
  const perBaris = Math.max(1, Math.floor(p.w / 0.7))
  return [p.x + 0.45 + (i % perBaris) * 0.7, p.y + p.d - 0.5 - Math.floor(i / perBaris) * 0.55]
}

// Pintu ruang di ujung kanan dinding selatan (tampilan Kantor menggambar celah pintu di sini).
export const pintuX = (p: Posisi) => p.x + p.w - 0.56

type Simpul = { koridor: number; x: number; dalam: Titik[] } // dalam: dari koridor menuju titik di dalam ruang

const simpulUnit = (s: Snapshot, kode: string, kodeRuang: string | undefined, antre: number): Simpul | null => {
  const u = s.unit.find((x) => x.kodeUnit === kode)
  if (!u) return null
  const baris = barisDenah(s).find((b) => b.y === u.posisi.y)
  if (!baris) return null
  const r = kodeRuang ? u.ruang?.find((x) => x.kodeRuang === kodeRuang) : undefined
  if (r) {
    // Masuk zona lewat celah kolom di kiri ruang, menyusuri depan ruang ke pintu, lalu ke ekor antrean ruang.
    const gx = r.posisi.x - 0.5
    const depan = r.posisi.y + r.posisi.d + 0.5
    const px = pintuX(r.posisi)
    return { koridor: baris.koridor, x: gx, dalam: [[gx, depan], [px, depan], [px, r.posisi.y + r.posisi.d - 0.3], titikAntre(r.posisi, antre)] }
  }
  const p = u.posisi
  const px = pintuX(p)
  return { koridor: baris.koridor, x: px, dalam: [[px, p.y + p.d + 0.15], [px, p.y + p.d - 0.3], titikAntre(p, antre)] }
}

export const ruteAntarunit = (s: Snapshot, asal: string, tujuan: string, kodeRuang?: string, nomor = 0): Titik[] | null => {
  const uTujuan = s.unit.find((u) => u.kodeUnit === tujuan)
  const rTujuan = kodeRuang ? uTujuan?.ruang?.find((r) => r.kodeRuang === kodeRuang) : undefined
  const antre = Math.max(0, Math.min((rTujuan ?? uTujuan)?.menunggu ?? 1, 6) - 1)
  const b = simpulUnit(s, tujuan, kodeRuang, antre)
  if (!b) return null
  const baris = barisDenah(s)
  let a: Simpul | null
  if (asal === PINTU) {
    // Pintu masuk di tepi selatan denah, tengah; koridor baris terakhir menyambung ke sana.
    const x = s.denah.lebar / 2
    a = { koridor: baris[baris.length - 1].koridor, x, dalam: [[x, s.denah.dalam - 0.05]] }
  } else {
    // Unit asal berzona: berangkat bergiliran dari ruang yang sedang/selesai melayani.
    const uAsal = s.unit.find((u) => u.kodeUnit === asal)
    const ruang = (uAsal?.ruang ?? []).filter((r) => r.dilayani + r.selesai > 0)
    const rAsal = ruang.length ? ruang[nomor % ruang.length].kodeRuang : undefined
    const simpul = simpulUnit(s, asal, rAsal, 0)
    // Berangkat dari depan meja layanan (tempat avatar "dilayani"), lalu keluar lewat pintu ruang.
    const p = (rAsal ? uAsal?.ruang?.find((r) => r.kodeRuang === rAsal)?.posisi : uAsal?.posisi) as Posisi | undefined
    a = simpul && p ? { ...simpul, dalam: [[p.x + p.w / 2, p.y + Math.min(1.6, p.d * 0.55)], ...simpul.dalam.slice(0, -1).reverse()] } : null
  }
  if (!a) return null
  const keluar = a.dalam
  const tengah: Titik[] = [[a.x, a.koridor]]
  if (a.koridor !== b.koridor) {
    const kiri = 0.5
    const kanan = s.denah.lebar - 0.5
    const lajur = Math.abs(a.x - kiri) + Math.abs(b.x - kiri) <= Math.abs(a.x - kanan) + Math.abs(b.x - kanan) ? kiri : kanan
    tengah.push([lajur, a.koridor], [lajur, b.koridor])
  }
  tengah.push([b.x, b.koridor])
  // Sedikit geser lajur per avatar agar tidak bertumpuk di garis yang sama.
  const geser = ((nomor % 5) - 2) * 0.12
  const rute = [...keluar, ...tengah.map(([x, y]) => [x + geser, y + geser] as Titik), ...b.dalam]
  return rute.filter((t, i) => i === 0 || Math.hypot(t[0] - rute[i - 1][0], t[1] - rute[i - 1][1]) > 0.01)
}

export const susunPejalan = (s: Snapshot, daftar: Perpindahan[], versi: number): Pejalan[] => {
  const hasil: Pejalan[] = []
  daftar.forEach((p, g) => {
    for (let k = 0; k < p.jumlah && hasil.length < MAKS_PEJALAN; k++) {
      const rute = ruteAntarunit(s, p.asal, p.tujuan, p.kodeRuang, k)
      if (!rute || rute.length < 2) continue
      const panjang = [0]
      for (let i = 1; i < rute.length; i++) panjang.push(panjang[i - 1] + Math.hypot(rute[i][0] - rute[i - 1][0], rute[i][1] - rute[i - 1][1]))
      const total = panjang[panjang.length - 1]
      hasil.push({
        id: `${versi}:${g}:${k}`,
        rute, panjang, total,
        mulai: Math.min(JEDA_MAKS, k * JEDA + g * 260),
        durasi: Math.min(DURASI_MAKS, Math.max(DURASI_MIN, (total / KECEPATAN) * 1000)),
        asal: p.asal, tujuan: p.tujuan,
      })
    }
  })
  return hasil
}

// Posisi avatar pada waktu `t` (ms sejak gerakan dimulai). null = belum berangkat / sudah tiba.
export const posisiPejalan = (p: Pejalan, t: number) => {
  const u = (t - p.mulai) / p.durasi
  if (u < 0 || u > 1) return null
  // Percepatan halus di awal & akhir.
  const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2
  const jarak = e * p.total
  let i = 1
  while (i < p.panjang.length - 1 && p.panjang[i] < jarak) i++
  const seg = p.panjang[i] - p.panjang[i - 1] || 1
  const f = Math.min(1, Math.max(0, (jarak - p.panjang[i - 1]) / seg))
  const [x0, y0] = p.rute[i - 1]
  const [x1, y1] = p.rute[i]
  // Muncul di awal, memudar saat menyatu dengan antrean tujuan.
  const opasitas = Math.min(1, u / 0.06, (1 - u) / 0.1)
  return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, arah: Math.atan2(y1 - y0, x1 - x0), langkah: (t - p.mulai) / 1000, opasitas }
}

export const selesaiPada = (daftar: Pejalan[]) => daftar.reduce((a, p) => Math.max(a, p.mulai + p.durasi), 0)

// Kunci jalur yang sedang beraliran pada gerakan terakhir (untuk animasi garis jalur).
export const jalurBeraliran = (g: Gerakan | null) => new Set((g?.daftar ?? []).filter((p) => p.asal !== PINTU).map(kunciJalur))
