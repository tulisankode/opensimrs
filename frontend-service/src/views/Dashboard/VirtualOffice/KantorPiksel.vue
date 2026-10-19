<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { warnaTema } from '@/utils/tema'
import { type Pilihan, type Snapshot, paletMerek, warnaBeban } from './petaIsometrik'
import { type Gerakan, type Pejalan, PINTU, posisiPejalan, selesaiPada, susunPejalan } from './gerakan'
import { buatPerulangan, useAngkaHalus, useGerakKurang } from './animasi'
import { type Adegan, type RuangKantor, gambarStatis, ruangDi, susunAdegan, zonaDi } from './kantor/denah'
import { P, bayangan, gambarKarakter, gelembung, jamDinding, paletPasien, paletPeran, pasienBaring, type Pose } from './kantor/sprite'

// Tampilan "Kantor": denah faskes piksel 2D tampak atas (Canvas 2D, imageSmoothingEnabled = false). Semua sprite &
// perabot digambar prosedural (kantor/sprite.ts). Petugas = label peran bidang kerja per ruang (bukan nama/kehadiran
// pegawai) dengan status dari beban; pasien generik tanpa identitas sejumlah angka nyata menunggu/dilayani (dibatasi
// slot, sisanya "+n"); pasien berjalan hanya untuk selisih nyata antar-snapshot. Zoom bulat 1×/2×/3× agar piksel tajam.
const props = defineProps<{ snapshot: Snapshot; pilihan: Pilihan; gerakan?: Gerakan | null }>()
const emit = defineEmits<{ (e: 'pilih', p: Pilihan): void }>()

const kurang = useGerakKurang()
const kanvas = ref<HTMLCanvasElement | null>(null)
const wadah = ref<HTMLElement | null>(null)
const brand = ref(paletMerek('#14b8a6'))
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 }) // piksel CSS, relatif terhadap posisi tengah
const ukuran = ref({ w: 0, h: 0, dpr: 1 })
const ZOOM = [1, 2, 3]
const MAKS_SPRITE = 320

const adegan = computed<Adegan>(() => susunAdegan(props.snapshot))
const angka = useAngkaHalus(() => Object.fromEntries(adegan.value.ruang.flatMap((r) => [[`${r.kunci}|m`, r.menunggu], [`${r.kunci}|d`, r.dilayani]])), kurang)

// ---- lapisan statis & bingkai dasar ----
let statis: HTMLCanvasElement | null = null
let bingkai: HTMLCanvasElement | null = null
const bangunStatis = () => {
  const a = adegan.value
  statis = statis ?? document.createElement('canvas')
  bingkai = bingkai ?? document.createElement('canvas')
  statis.width = bingkai.width = a.lebar
  statis.height = bingkai.height = a.tinggi
  const c = statis.getContext('2d')!
  c.imageSmoothingEnabled = false
  gambarStatis(c, a, brand.value.utama)
}

// ---- pasien berjalan & kilatan ----
const pejalan = shallowRef<Pejalan[]>([])
let awalGerak = 0
let akhirGerak = 0
const kilat = new Map<string, number>()
watch(() => props.gerakan?.versi, () => {
  const g = props.gerakan
  pejalan.value = g && !kurang.value ? susunPejalan(props.snapshot, g.daftar, g.versi) : []
  awalGerak = performance.now()
  akhirGerak = selesaiPada(pejalan.value)
  minta()
})
watch(() => props.snapshot, (baru, lama) => {
  bangunStatis()
  // Kilatan hanya dengan gerak normal (gerak berkurang menggambar sesuai permintaan, kilatan tidak akan memudar).
  if (lama && lama.tanggal === baru.tanggal && !kurang.value) {
    const sebelum = new Map(susunAdegan(lama).ruang.map((r) => [r.kunci, `${r.menunggu}|${r.dilayani}|${r.selesai}`]))
    const t = performance.now()
    for (const r of adegan.value.ruang) if (sebelum.has(r.kunci) && sebelum.get(r.kunci) !== `${r.menunggu}|${r.dilayani}|${r.selesai}`) kilat.set(r.kunci, t)
  }
  minta()
})

// ---- kamera ----
const skala = () => Math.max(1, Math.round(zoom.value * ukuran.value.dpr))
const asal = () => {
  const k = skala()
  const { w, h, dpr } = ukuran.value
  return { k, ox: Math.round((w * dpr - adegan.value.lebar * k) / 2 + pan.value.x * dpr), oy: Math.round((h * dpr - adegan.value.tinggi * k) / 2 + pan.value.y * dpr) }
}
const zoomPas = () => {
  const { w, h } = ukuran.value
  const pas = Math.floor(Math.min(w / adegan.value.lebar, h / adegan.value.tinggi))
  return Math.min(3, Math.max(1, pas))
}
const ubahZoom = (arah: number, titik?: { x: number; y: number }) => {
  const i = ZOOM.indexOf(zoom.value)
  const baru = ZOOM[Math.min(ZOOM.length - 1, Math.max(0, i + arah))]
  if (baru === zoom.value) return
  // Pertahankan titik di bawah kursor (piksel CSS relatif tengah wadah).
  const q = titik ?? { x: 0, y: 0 }
  const f = baru / zoom.value
  pan.value = { x: q.x - (q.x - pan.value.x) * f, y: q.y - (q.y - pan.value.y) * f }
  zoom.value = baru
  minta()
}
const pusatkan = () => { zoom.value = zoomPas(); pan.value = { x: 0, y: 0 }; minta() }
const fokus = (kodeUnit: string, kodeRuang?: string) => {
  const a = adegan.value
  const r = a.ruang.find((x) => x.kunci === (kodeRuang ? `${kodeUnit}:${kodeRuang}` : kodeUnit))
  const z = a.zona.find((x) => x.kodeUnit === kodeUnit)
  const t = r ?? z
  if (!t) return
  zoom.value = Math.max(2, zoom.value)
  pan.value = { x: -(t.x + t.w / 2 - a.lebar / 2) * zoom.value, y: -(t.y + t.h / 2 - a.tinggi / 2) * zoom.value }
  minta()
}
defineExpose({ perbesar: () => ubahZoom(1), perkecil: () => ubahZoom(-1), pusatkan, fokus })

// ---- menggambar ----
const dipilih = (r: RuangKantor) => {
  const p = props.pilihan
  return p?.jenis === 'unit' && r.pilihan?.jenis === 'unit' && p.kodeUnit === r.pilihan.kodeUnit && (!p.kodeRuang || p.kodeRuang === r.pilihan.kodeRuang)
}
const goyang = (t: number, periode: number, fase: number) => (kurang.value ? 0 : Math.floor(t / periode + fase) % 2)

const gambarBingkai = (t: number) => {
  if (!bingkai || !statis) return
  const c = bingkai.getContext('2d')!
  c.imageSmoothingEnabled = false
  c.drawImage(statis, 0, 0)
  const a = adegan.value
  const waktu = new Date()
  for (const j of a.jam) jamDinding(c, j.x, j.y, waktu)
  let sprite = 0
  const lebih: Array<{ r: RuangKantor; n: number }> = []
  for (const r of a.ruang) {
    if (r.terkunci || r.galat) continue
    // Ruang Padat berdenyut halus; ruang yang angkanya berubah berkilat singkat.
    if (r.beban === 'merah') {
      c.fillStyle = `rgba(220,38,38,${kurang.value ? 0.08 : 0.05 + 0.07 * (0.5 + 0.5 * Math.sin(t / 300))})`
      c.fillRect(r.x + 3, r.y + 8, r.w - 6, r.h - 12)
    }
    const k = kilat.get(r.kunci)
    if (k !== undefined) {
      const u = (t - k) / 1200
      if (u >= 1) kilat.delete(r.kunci)
      else { c.fillStyle = brand.value.utama; c.globalAlpha = 0.35 * (1 - u); c.fillRect(r.x + 3, r.y + 8, r.w - 6, r.h - 12); c.globalAlpha = 1 }
    }
    // Pasien menunggu duduk di kursi tunggu.
    const nKursi = Math.min(r.menunggu, r.kursi.length)
    for (let i = 0; i < nKursi && sprite < MAKS_SPRITE; i++, sprite++) {
      const s = r.kursi[i]
      gambarKarakter(c, paletPasien(i + r.x * 3 + r.y), 'duduk', s.x, s.y - 2 - goyang(t, 900, i * 0.37))
    }
    // Pasien dilayani: berbaring di bed (rawat inap/IGD/radiologi) atau berdiri di depan meja.
    const nLayan = Math.min(r.dilayani, r.layan.length)
    for (let i = 0; i < nLayan && sprite < MAKS_SPRITE; i++, sprite++) {
      const s = r.layan[i]
      const pal = paletPasien(100 + i + r.x)
      if (s.baring) pasienBaring(c, s.x, s.y, pal)
      else { bayangan(c, s.x, s.y); gambarKarakter(c, pal, 'berdiri', s.x, s.y - goyang(t, 650, i * 0.5)) }
    }
    const sisa = Math.max(0, r.menunggu - nKursi) + Math.max(0, r.dilayani - nLayan)
    if (sisa) lebih.push({ r, n: sisa })
    for (const [i, p] of r.petugas.entries()) {
      if (sprite++ >= MAKS_SPRITE) break
      const periode = p.status === 'sibuk' ? 260 : p.status === 'melayani' ? 520 : 1100
      bayangan(c, p.x, p.y)
      gambarKarakter(c, paletPeran(p.peran, brand.value.utama), 'berdiri', p.x, p.y - goyang(t, periode, i * 0.5))
      gelembung(c, p.status, p.x, p.y - 20, kurang.value ? 0 : t + i * 170)
    }
  }
  // Pasien berjalan di koridor (perpindahan nyata), digambar paling atas.
  const tg = t - awalGerak
  const urut = pejalan.value
    .map((p, i) => ({ p, i, q: posisiPejalan(p, tg) }))
    .filter((x) => x.q)
    .sort((a, b) => a.q!.y - b.q!.y)
  for (const { p, i, q } of urut) {
    const x = q!.x * P
    const y = q!.y * P + 6
    const pose: Pose = (['jalan1', 'berdiri', 'jalan2', 'berdiri'] as Pose[])[Math.floor(q!.langkah * 8) % 4]
    c.globalAlpha = q!.opasitas
    bayangan(c, x, y)
    gambarKarakter(c, paletPasien(i * 13 + p.id.length), pose, x, y, q!.opasitas)
    c.globalAlpha = 1
  }
  return lebih
}

const render = (t: number) => {
  const el = kanvas.value
  if (!el || !bingkai) return
  const lebih = gambarBingkai(t) ?? []
  const c = el.getContext('2d')!
  const { k, ox, oy } = asal()
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.fillStyle = '#f1f5f9'
  c.fillRect(0, 0, el.width, el.height)
  c.imageSmoothingEnabled = false
  c.drawImage(bingkai, ox, oy, bingkai.width * k, bingkai.height * k)

  // Label teks digambar pada resolusi layar agar tajam.
  const dpr = ukuran.value.dpr
  const a = adegan.value
  const huruf = (n: number, tebal = true) => `${tebal ? '700 ' : ''}${Math.round(n * dpr)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  const pil = (teks: string, x: number, y: number, latar: string, warna: string, n = 10, tebal = true, tengah = false) => {
    c.font = huruf(n, tebal)
    const w = c.measureText(teks).width + 8 * dpr
    const h = (n + 6) * dpr
    const x0 = tengah ? x - w / 2 : x
    c.fillStyle = latar
    c.fillRect(Math.round(x0), Math.round(y - h), Math.round(w), Math.round(h))
    c.fillStyle = warna
    c.fillText(teks, Math.round(x0 + 4 * dpr), Math.round(y - 4 * dpr))
  }
  c.textBaseline = 'alphabetic'
  // Nama zona di tepi bawah zona; nama & angka ruang di atas dinding utara (celah koridor) agar tidak menutupi petugas.
  for (const z of a.zona) pil(z.nama, ox + (z.x + 24) * k, oy + (z.y + z.h) * k - 4 * dpr, brand.value.tua, '#ffffff', 11)
  for (const r of a.ruang) {
    const x = ox + r.x * k
    const y = oy + r.y * k
    const sel = dipilih(r)
    if (sel) {
      c.strokeStyle = brand.value.tua
      c.lineWidth = 3 * dpr
      c.strokeRect(x - 2 * dpr, y - 2 * dpr, r.w * k + 4 * dpr, r.h * k + 4 * dpr)
    }
    const nama = r.nama.length > 22 ? r.nama.slice(0, 21) + '…' : r.nama
    pil(nama, x, y - 16 * dpr, sel ? brand.value.tua : 'rgba(255,255,255,0.92)', sel ? '#ffffff' : '#1e293b', 10)
    const sub = r.terkunci ? 'Terkunci' : r.galat ? 'Sumber gagal dimuat' : `${angka.value[`${r.kunci}|m`] ?? r.menunggu} antre · ${angka.value[`${r.kunci}|d`] ?? r.dilayani} dilayani`
    pil(sub, x, y - 1 * dpr, 'rgba(255,255,255,0.85)', r.terkunci || r.galat ? '#64748b' : warnaBeban(r.beban as any).garis, 9, false)
    if (k >= 2) for (const p of r.petugas) pil(p.peran, ox + p.x * k, oy + (p.y + 1) * k + 13 * dpr, 'rgba(15,23,42,0.78)', '#ffffff', 9, false, true)
  }
  for (const { r, n } of lebih) pil(`+${n}`, ox + (r.x + r.w - 30) * k, oy + (r.y + r.h - 12) * k, '#1e293b', '#ffffff', 10, true, true)
}

// Perulangan: 30 fps saat ada pasien berjalan/kilatan, 8 fps untuk gerak santai; gerak berkurang = gambar sesuai permintaan.
let terakhir = 0
const loop = buatPerulangan((t) => {
  const aktif = t - awalGerak <= akhirGerak + 100 || kilat.size > 0
  const jeda = aktif ? 33 : 125
  if (t - terakhir >= jeda) { terakhir = t; render(t) }
  if (!aktif && pejalan.value.length) pejalan.value = []
  return !kurang.value || aktif
})
const minta = () => {
  if (kurang.value) requestAnimationFrame((t) => render(t))
  else loop.mulai()
}
watch([() => props.pilihan, zoom, pan, brand, kurang], minta, { deep: true })
watch(angka, minta)

// ---- ukuran ----
let pengamat: ResizeObserver | null = null
const ukurUlang = () => {
  const el = kanvas.value
  const w = wadah.value
  if (!el || !w) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const r = w.getBoundingClientRect()
  ukuran.value = { w: r.width, h: r.height, dpr }
  el.width = Math.max(1, Math.round(r.width * dpr))
  el.height = Math.max(1, Math.round(r.height * dpr))
  render(performance.now())
}
const saatTerlihat = () => { if (!document.hidden) minta() }
let menit: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  brand.value = paletMerek(warnaTema('300'))
  bangunStatis()
  pengamat = new ResizeObserver(ukurUlang)
  if (wadah.value) pengamat.observe(wadah.value)
  ukurUlang()
  zoom.value = zoomPas()
  document.addEventListener('visibilitychange', saatTerlihat)
  // Jam dinding tetap berdetak walau gerak berkurang.
  menit = setInterval(() => kurang.value && minta(), 30000)
  minta()
})
onUnmounted(() => {
  loop.henti()
  pengamat?.disconnect()
  clearInterval(menit)
  document.removeEventListener('visibilitychange', saatTerlihat)
  statis = bingkai = null
})
watch(brand, bangunStatis)

// ---- interaksi ----
const keDasar = (e: { clientX: number; clientY: number }) => {
  const el = kanvas.value!
  const b = el.getBoundingClientRect()
  const { k, ox, oy } = asal()
  const dpr = ukuran.value.dpr
  return { bx: ((e.clientX - b.left) * dpr - ox) / k, by: ((e.clientY - b.top) * dpr - oy) / k, cx: e.clientX - b.left - b.width / 2, cy: e.clientY - b.top - b.height / 2 }
}
const penunjuk = new Map<number, { x: number; y: number }>()
let jarakTempuh = 0
let jarakAwal = 0
const tekan = (e: PointerEvent) => {
  penunjuk.set(e.pointerId, { x: e.clientX, y: e.clientY })
  jarakTempuh = 0
  if (penunjuk.size === 2) { const [a, b] = [...penunjuk.values()]; jarakAwal = Math.hypot(a.x - b.x, a.y - b.y) }
}
const gerak = (e: PointerEvent) => {
  const lama = penunjuk.get(e.pointerId)
  if (!lama) { arahkan(e); return }
  if (penunjuk.size === 1) {
    const dx = e.clientX - lama.x
    const dy = e.clientY - lama.y
    jarakTempuh += Math.abs(dx) + Math.abs(dy)
    if (jarakTempuh > 4 && !kanvas.value?.hasPointerCapture(e.pointerId)) kanvas.value?.setPointerCapture(e.pointerId)
    pan.value = { x: pan.value.x + dx, y: pan.value.y + dy }
  }
  penunjuk.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (penunjuk.size === 2) {
    const [a, b] = [...penunjuk.values()]
    const jarak = Math.hypot(a.x - b.x, a.y - b.y)
    // Cubit bertingkat: zoom berpindah satu tingkat bulat setiap perubahan jarak ±35%.
    if (jarakAwal && (jarak / jarakAwal > 1.35 || jarak / jarakAwal < 0.74)) { ubahZoom(jarak > jarakAwal ? 1 : -1); jarakAwal = jarak }
    jarakTempuh = 99
  }
}
const lepas = (e: PointerEvent) => { penunjuk.delete(e.pointerId); if (penunjuk.size < 2) jarakAwal = 0 }
let akumulasiRoda = 0
const roda = (e: WheelEvent) => {
  akumulasiRoda += e.deltaY
  if (Math.abs(akumulasiRoda) < 60) return
  const q = keDasar(e)
  ubahZoom(akumulasiRoda < 0 ? 1 : -1, { x: q.cx, y: q.cy })
  akumulasiRoda = 0
}
// Pasien berjalan yang diklik → jalur asalnya (bila asal tercatat).
const pejalanDi = (bx: number, by: number) => {
  const tg = performance.now() - awalGerak
  for (const p of pejalan.value) {
    const q = posisiPejalan(p, tg)
    if (q && Math.abs(q.x * P - bx) < 8 && by > q.y * P - 14 && by < q.y * P + 8) return p
  }
  return null
}
const klik = (e: MouseEvent) => {
  if (jarakTempuh > 4) return
  const { bx, by } = keDasar(e)
  const p = pejalanDi(bx, by)
  if (p && p.asal !== PINTU) return emit('pilih', { jenis: 'jalur', asal: p.asal, tujuan: p.tujuan })
  const r = ruangDi(adegan.value, bx, by)
  if (r) return emit('pilih', r.pilihan)
  const z = zonaDi(adegan.value, bx, by)
  if (z) emit('pilih', { jenis: 'unit', kodeUnit: z.kodeUnit })
}
const kursor = ref('grab')
const arahkan = (e: PointerEvent) => {
  const { bx, by } = keDasar(e)
  kursor.value = ruangDi(adegan.value, bx, by) || zonaDi(adegan.value, bx, by) ? 'pointer' : 'grab'
}
const tombol = (e: KeyboardEvent) => {
  const langkah = 48
  const aksi: Record<string, () => void> = {
    ArrowLeft: () => (pan.value = { ...pan.value, x: pan.value.x + langkah }), ArrowRight: () => (pan.value = { ...pan.value, x: pan.value.x - langkah }),
    ArrowUp: () => (pan.value = { ...pan.value, y: pan.value.y + langkah }), ArrowDown: () => (pan.value = { ...pan.value, y: pan.value.y - langkah }),
    '+': () => ubahZoom(1), '=': () => ubahZoom(1), '-': () => ubahZoom(-1), '0': pusatkan,
  }
  if (aksi[e.key]) { e.preventDefault(); aksi[e.key]() }
}
const ringkasAria = computed(() => adegan.value.ruang
  .map((r) => (r.terkunci ? `${r.nama}: terkunci` : r.galat ? `${r.nama}: sumber gagal dimuat` : `${r.nama}: ${r.menunggu} menunggu, ${r.dilayani} dilayani`))
  .join('; '))
</script>

<template>
  <div ref="wadah" class="overflow-hidden select-none kantor">
    <canvas ref="kanvas" class="absolute inset-0 w-full h-full" :style="{ cursor: kursor }" tabindex="0" role="img"
      :aria-label="`Kantor virtual piksel tampak atas. ${ringkasAria}. Seret untuk menggeser, roda mouse atau plus/minus untuk zoom 1×, 2×, 3×.`"
      @pointerdown="tekan" @pointermove="gerak" @pointerup="lepas" @pointercancel="lepas" @pointerleave="lepas"
      @wheel.prevent="roda" @click="klik" @keydown="tombol"></canvas>
    <span class="absolute px-2 py-0.5 text-[11px] font-medium rounded right-3 top-3 bg-white/90 text-grey-500 pointer-events-none">Zoom {{ zoom }}×</span>
  </div>
</template>

<style scoped>
/* posisi (absolute inset-0) dari induk; anak kanvas diposisikan absolut terhadap wadah ini */
.kantor { touch-action: none; background: #f1f5f9; }
canvas { image-rendering: pixelated; }
canvas:focus-visible { outline: 3px solid rgb(var(--opensimrs-300)); outline-offset: -3px; }
</style>
