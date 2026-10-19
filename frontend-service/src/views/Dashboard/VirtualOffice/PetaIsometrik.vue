<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { warnaTema } from '@/utils/tema'
import {
  type Jalur, type Pilihan, type Posisi, type Snapshot,
  MAKS_AVATAR_DILAYANI, MAKS_AVATAR_MENUNGGU, SETENGAH_LEBAR, SETENGAH_TINGGI,
  dindingBarat, dindingSelatan, dindingTimur, dindingUtara, iso, lantai, paletMerek, posisiAvatar, tengah, titik, warnaBeban,
} from './petaIsometrik'
import { type Gerakan, jalurBeraliran } from './gerakan'
import { useAngkaHalus, useGerakKurang } from './animasi'
import LapisanPejalan from './LapisanPejalan.vue'

// Peta isometrik 2.5D (SVG) Virtual Office: lantai berpetak, zona unit, ruang berdinding rendah, avatar beban kerja,
// jalur lintas unit. Geser = seret / tombol panah; zoom = roda mouse / cubit (pinch) / tombol + −. Hanya membaca snapshot.
// Hidup tanpa data karangan: avatar berjalan hanya untuk selisih nyata antar-snapshot (`gerakan`), antrean bergoyang
// pelan, ruang Padat berdenyut, angka berubah dengan count-up + kilatan. prefers-reduced-motion mematikan semuanya.
const props = defineProps<{ snapshot: Snapshot; pilihan: Pilihan; gerakan?: Gerakan | null }>()
const emit = defineEmits<{ (e: 'pilih', p: Pilihan): void }>()

const TINGGI_UNIT = 30
const TINGGI_RUANG = 24
const TINGGI_DEPAN = 7

const brand = ref(paletMerek('#14b8a6'))
onMounted(() => { brand.value = paletMerek(warnaTema('300')) })

type Ruangan = {
  kunci: string
  kodeUnit: string
  kodeRuang?: string
  nama: string
  sub: string
  posisi: Posisi
  menunggu: number
  dilayani: number
  selesai: number
  tinggi: number
  terkunci: boolean
  galat: boolean
  beban: any
  aria: string
}
type Zona = { kodeUnit: string; nama: string; posisi: Posisi; sub: string; menunggu: number; dilayani: number; selesai: number }

const kurang = useGerakKurang()
const ringkas = (m?: number, d?: number) => `Antre ${m ?? 0} · Dilayani ${d ?? 0}`

const susunan = computed(() => {
  const ruangan: Ruangan[] = []
  const zona: Zona[] = []
  for (const u of props.snapshot.unit) {
    const terkunci = !!u.terkunci
    const galat = !!u.galat
    if (u.ruang?.length && !terkunci) {
      zona.push({ kodeUnit: u.kodeUnit, nama: u.nama, posisi: u.posisi, sub: `${ringkas(u.menunggu, u.dilayani)} · Selesai ${u.selesai ?? 0}`, menunggu: u.menunggu ?? 0, dilayani: u.dilayani ?? 0, selesai: u.selesai ?? 0 })
      for (const r of u.ruang) {
        ruangan.push({
          kunci: `${u.kodeUnit}:${r.kodeRuang}`, kodeUnit: u.kodeUnit, kodeRuang: r.kodeRuang, nama: r.nama,
          sub: r.bor !== undefined && r.bor !== null ? ` · BOR ${r.bor}%` : '',
          posisi: r.posisi, menunggu: r.menunggu, dilayani: r.dilayani, selesai: r.selesai, tinggi: TINGGI_RUANG, terkunci: false, galat: false, beban: r.beban,
          aria: `${u.nama} › ${r.nama}: ${r.menunggu} menunggu, ${r.dilayani} dilayani, ${r.selesai} selesai`,
        })
      }
    } else {
      ruangan.push({
        kunci: u.kodeUnit, kodeUnit: u.kodeUnit, nama: u.nama,
        sub: terkunci ? 'Terkunci' : galat ? 'Sumber gagal dimuat' : '',
        posisi: u.posisi, menunggu: u.menunggu ?? 0, dilayani: u.dilayani ?? 0, selesai: u.selesai ?? 0, tinggi: TINGGI_UNIT, terkunci, galat, beban: u.beban,
        aria: terkunci ? `${u.nama}: terkunci, perlu izin ${u.izinDibutuhkan}` : galat ? `${u.nama}: sumber data gagal dimuat` : `${u.nama}: ${u.menunggu} menunggu, ${u.dilayani} dilayani, ${u.selesai} selesai`,
      })
    }
  }
  // Algoritma pelukis: ruang di belakang (x + y kecil) digambar lebih dulu.
  ruangan.sort((a, b) => a.posisi.x + a.posisi.y + a.posisi.w + a.posisi.d - (b.posisi.x + b.posisi.y + b.posisi.w + b.posisi.d))
  return { ruangan, zona }
})

// ---- angka count-up & kilatan perubahan ----
const angkaSumber = () => {
  const m: Record<string, number> = {}
  for (const r of susunan.value.ruangan) { m[`${r.kunci}|m`] = r.menunggu; m[`${r.kunci}|d`] = r.dilayani }
  for (const z of susunan.value.zona) { m[`z-${z.kodeUnit}|m`] = z.menunggu; m[`z-${z.kodeUnit}|d`] = z.dilayani; m[`z-${z.kodeUnit}|s`] = z.selesai }
  for (const j of props.snapshot.jalur) m[`j-${j.asal}>${j.tujuan}`] = j.jumlah
  return m
}
const angka = useAngkaHalus(angkaSumber, kurang)
const n = (k: string, cadangan: number) => angka.value[k] ?? cadangan
const subRuang = (r: Ruangan) => (r.terkunci || r.galat ? r.sub : `${ringkas(n(`${r.kunci}|m`, r.menunggu), n(`${r.kunci}|d`, r.dilayani))}${r.sub}`)
const subZona = (z: Zona) => `${ringkas(n(`z-${z.kodeUnit}|m`, z.menunggu), n(`z-${z.kodeUnit}|d`, z.dilayani))} · Selesai ${n(`z-${z.kodeUnit}|s`, z.selesai)}`

const kilat = ref<{ versi: number; kunci: Set<string> }>({ versi: 0, kunci: new Set() })
let pewaktuKilat: ReturnType<typeof setTimeout> | undefined
watch(() => props.snapshot, (baru, lama) => {
  if (!lama || lama.tanggal !== baru.tanggal) return
  const sidik = (s: Snapshot) => {
    const m = new Map<string, string>()
    for (const u of s.unit) {
      if (u.terkunci || u.galat) continue
      m.set(u.kodeUnit, `${u.menunggu}|${u.dilayani}|${u.selesai}`)
      for (const r of u.ruang ?? []) m.set(`${u.kodeUnit}:${r.kodeRuang}`, `${r.menunggu}|${r.dilayani}|${r.selesai}`)
    }
    return m
  }
  const a = sidik(lama)
  const b = sidik(baru)
  const kunci = new Set([...b].filter(([k, v]) => a.has(k) && a.get(k) !== v).map(([k]) => k))
  if (!kunci.size) return
  kilat.value = { versi: kilat.value.versi + 1, kunci }
  clearTimeout(pewaktuKilat)
  pewaktuKilat = setTimeout(() => (kilat.value = { versi: kilat.value.versi, kunci: new Set() }), 1600)
})
onUnmounted(() => clearTimeout(pewaktuKilat))

// Garis jalur hanya beranimasi bila ada arus nyata pada pembaruan terakhir.
const beraliran = computed(() => jalurBeraliran(props.gerakan ?? null))

const batas = computed(() => {
  const { lebar, dalam } = props.snapshot.denah
  const kiri = iso(0, dalam)[0] - 40
  const kanan = iso(lebar, 0)[0] + 40
  const atas = iso(0, 0, 110)[1]
  const bawah = iso(lebar, dalam)[1] + 60
  return { kiri, atas, lebar: kanan - kiri, tinggi: bawah - atas }
})
const denahPos = computed<Posisi>(() => ({ x: 0, y: 0, w: props.snapshot.denah.lebar, d: props.snapshot.denah.dalam }))
const garisPetak = computed(() => {
  const { lebar, dalam } = props.snapshot.denah
  let d = ''
  for (let i = 0; i <= lebar; i++) { const a = iso(i, 0); const b = iso(i, dalam); d += `M${a[0]},${a[1]}L${b[0]},${b[1]}` }
  for (let j = 0; j <= dalam; j++) { const a = iso(0, j); const b = iso(lebar, j); d += `M${a[0]},${a[1]}L${b[0]},${b[1]}` }
  return d
})
const tebalLantai = (p: Posisi) => ({
  selatan: titik([iso(p.x, p.y + p.d), iso(p.x + p.w, p.y + p.d), iso(p.x + p.w, p.y + p.d, -12), iso(p.x, p.y + p.d, -12)]),
  timur: titik([iso(p.x + p.w, p.y), iso(p.x + p.w, p.y + p.d), iso(p.x + p.w, p.y + p.d, -12), iso(p.x + p.w, p.y, -12)]),
})

// Matriks teks di bidang lantai: sumbu teks x → sumbu denah x, sumbu teks y → sumbu denah y (skala 1 px teks ≈ 1 px layar).
const tulisLantai = (p: Posisi) => {
  const [x, y] = iso(p.x + 0.3, p.y + p.d - 0.3)
  const k = 1 / Math.hypot(SETENGAH_LEBAR, SETENGAH_TINGGI)
  return `matrix(${SETENGAH_LEBAR * k} ${SETENGAH_TINGGI * k} ${-SETENGAH_LEBAR * k} ${SETENGAH_TINGGI * k} ${x} ${y})`
}

const meja = (p: Posisi) => {
  const m: Posisi = { x: p.x + p.w / 2 - 0.6, y: p.y + 0.55, w: 1.2, d: 0.5 }
  return { atas: lantai(m, 8), selatan: dindingSelatan(m, 8), timur: dindingTimur(m, 8) }
}

const unitDipilih = (kodeUnit: string, kodeRuang?: string) =>
  props.pilihan?.jenis === 'unit' && props.pilihan.kodeUnit === kodeUnit && (kodeRuang === undefined || props.pilihan.kodeRuang === kodeRuang || !props.pilihan.kodeRuang)

const posUnit = computed(() => Object.fromEntries(props.snapshot.unit.map((u) => [u.kodeUnit, u.posisi])))
const maksJalur = computed(() => Math.max(1, ...props.snapshot.jalur.map((j) => j.jumlah)))
const lengkung = (j: Jalur) => {
  const a = posUnit.value[j.asal]
  const b = posUnit.value[j.tujuan]
  if (!a || !b) return null
  const [x1, y1] = tengah(a, TINGGI_UNIT + 6)
  const [x2, y2] = tengah(b, TINGGI_UNIT + 6)
  const naik = 50 + Math.hypot(x2 - x1, y2 - y1) * 0.18
  const cx = (x1 + x2) / 2
  const cy = Math.min(y1, y2) - naik
  return { d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, label: [cx, (Math.min(y1, y2) + cy) / 2 + naik * 0.12] as [number, number] }
}
const jalurGambar = computed(() =>
  props.snapshot.jalur.map((j) => ({ j, g: lengkung(j), tebal: j.jumlah > 0 ? 1.5 + (3.5 * j.jumlah) / maksJalur.value : 1.2 })).filter((x) => x.g)
)
const jalurDipilih = (j: Jalur) => props.pilihan?.jenis === 'jalur' && props.pilihan.asal === j.asal && props.pilihan.tujuan === j.tujuan

// ---- geser & zoom ----
const svg = ref<SVGSVGElement | null>(null)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const ZOOM_MIN = 0.4
const ZOOM_MAKS = 3
const keSvg = (cx: number, cy: number) => {
  const el = svg.value
  const ctm = el?.getScreenCTM()
  if (!el || !ctm) return { x: 0, y: 0 }
  const p = el.createSVGPoint()
  p.x = cx
  p.y = cy
  const h = p.matrixTransform(ctm.inverse())
  return { x: h.x, y: h.y }
}
const zoomDi = (faktor: number, q?: { x: number; y: number }) => {
  const z2 = Math.min(ZOOM_MAKS, Math.max(ZOOM_MIN, zoom.value * faktor))
  const titikZoom = q ?? { x: batas.value.kiri + batas.value.lebar / 2, y: batas.value.atas + batas.value.tinggi / 2 }
  panX.value = titikZoom.x - (titikZoom.x - panX.value) * (z2 / zoom.value)
  panY.value = titikZoom.y - (titikZoom.y - panY.value) * (z2 / zoom.value)
  zoom.value = z2
}
const pusatkan = () => { zoom.value = 1; panX.value = 0; panY.value = 0 }
const geserTombol = (dx: number, dy: number) => { panX.value += dx; panY.value += dy }
defineExpose({ perbesar: () => zoomDi(1.25), perkecil: () => zoomDi(0.8), pusatkan })

const roda = (e: WheelEvent) => zoomDi(Math.exp(-e.deltaY * 0.0015), keSvg(e.clientX, e.clientY))

const penunjuk = new Map<number, { x: number; y: number }>()
let jarakAwal = 0
let jarakTempuh = 0
const tekan = (e: PointerEvent) => {
  penunjuk.set(e.pointerId, { x: e.clientX, y: e.clientY })
  jarakTempuh = 0
  if (penunjuk.size === 2) {
    const [a, b] = [...penunjuk.values()]
    jarakAwal = Math.hypot(a.x - b.x, a.y - b.y)
  }
}
const gerak = (e: PointerEvent) => {
  const lama = penunjuk.get(e.pointerId)
  if (!lama) return
  const skala = 1 / (svg.value?.getScreenCTM()?.a || 1)
  if (penunjuk.size === 1) {
    const dx = e.clientX - lama.x
    const dy = e.clientY - lama.y
    jarakTempuh += Math.abs(dx) + Math.abs(dy)
    if (jarakTempuh > 4 && !svg.value?.hasPointerCapture(e.pointerId)) svg.value?.setPointerCapture(e.pointerId)
    panX.value += dx * skala
    panY.value += dy * skala
  }
  penunjuk.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (penunjuk.size === 2) {
    const [a, b] = [...penunjuk.values()]
    const jarak = Math.hypot(a.x - b.x, a.y - b.y)
    if (jarakAwal > 0) zoomDi(jarak / jarakAwal, keSvg((a.x + b.x) / 2, (a.y + b.y) / 2))
    jarakAwal = jarak
    jarakTempuh = 99
  }
}
const lepas = (e: PointerEvent) => {
  penunjuk.delete(e.pointerId)
  if (penunjuk.size < 2) jarakAwal = 0
}
// Klik setelah menyeret tidak dianggap memilih ruang.
const pilih = (p: Pilihan) => { if (jarakTempuh <= 4) emit('pilih', p) }
const tombolPeta = (e: KeyboardEvent) => {
  const langkah = 40
  const aksi: Record<string, () => void> = {
    ArrowLeft: () => geserTombol(langkah, 0), ArrowRight: () => geserTombol(-langkah, 0),
    ArrowUp: () => geserTombol(0, langkah), ArrowDown: () => geserTombol(0, -langkah),
    '+': () => zoomDi(1.25), '=': () => zoomDi(1.25), '-': () => zoomDi(0.8), '0': pusatkan,
  }
  if (aksi[e.key] && e.target === svg.value) { e.preventDefault(); aksi[e.key]() }
}
</script>

<template>
  <svg ref="svg" class="w-full h-full select-none peta" :viewBox="`${batas.kiri} ${batas.atas} ${batas.lebar} ${batas.tinggi}`"
    preserveAspectRatio="xMidYMid meet" role="application" tabindex="0"
    aria-label="Peta isometrik Virtual Office. Seret untuk menggeser, roda mouse atau cubit untuk zoom, panah untuk menggeser, plus/minus untuk zoom."
    @wheel.prevent="roda" @pointerdown="tekan" @pointermove="gerak" @pointerup="lepas" @pointercancel="lepas" @pointerleave="lepas"
    @keydown="tombolPeta">
    <defs>
      <filter id="vo-bayang" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.12" />
      </filter>
    </defs>
    <g :transform="`translate(${panX} ${panY}) scale(${zoom})`">
      <!-- lantai berpetak -->
      <g filter="url(#vo-bayang)">
        <polygon :points="tebalLantai(denahPos).selatan" fill="#cbd5e1" />
        <polygon :points="tebalLantai(denahPos).timur" fill="#94a3b8" />
        <polygon :points="lantai(denahPos)" fill="#f8fafc" stroke="#cbd5e1" />
      </g>
      <path :d="garisPetak" stroke="#e2e8f0" stroke-width="1" fill="none" />

      <!-- zona unit berisi ruang (poli, ruangan rawat inap) -->
      <g v-for="z in susunan.zona" :key="'z-' + z.kodeUnit" class="cursor-pointer" role="button" tabindex="0"
        :aria-label="`Zona ${z.nama}: ${z.sub}`" @click="pilih({ jenis: 'unit', kodeUnit: z.kodeUnit })"
        @keydown.enter.prevent="emit('pilih', { jenis: 'unit', kodeUnit: z.kodeUnit })">
        <polygon :points="lantai(z.posisi)" :fill="brand.muda" :stroke="unitDipilih(z.kodeUnit) && !(pilihan as any)?.kodeRuang ? brand.tua : brand.sedang"
          :stroke-width="unitDipilih(z.kodeUnit) && !(pilihan as any)?.kodeRuang ? 3 : 1.5" stroke-dasharray="6 4" />
      </g>

      <!-- ruang -->
      <g v-for="r in susunan.ruangan" :key="r.kunci" class="cursor-pointer ruang" role="button" tabindex="0" :aria-label="r.aria"
        :aria-pressed="unitDipilih(r.kodeUnit, r.kodeRuang)"
        @click="pilih({ jenis: 'unit', kodeUnit: r.kodeUnit, kodeRuang: r.kodeRuang })"
        @keydown.enter.prevent="emit('pilih', { jenis: 'unit', kodeUnit: r.kodeUnit, kodeRuang: r.kodeRuang })"
        @keydown.space.prevent="emit('pilih', { jenis: 'unit', kodeUnit: r.kodeUnit, kodeRuang: r.kodeRuang })">
        <title>{{ r.aria }}</title>
        <polygon :points="lantai(r.posisi)" :fill="r.terkunci ? '#f1f5f9' : '#ffffff'" stroke="#cbd5e1" />
        <polygon :points="dindingUtara(r.posisi, r.tinggi)" :fill="r.terkunci ? '#e2e8f0' : brand.lembut" stroke="#94a3b8" stroke-width="0.6" />
        <polygon :points="dindingBarat(r.posisi, r.tinggi)" :fill="r.terkunci ? '#cbd5e1' : brand.sedang" stroke="#94a3b8" stroke-width="0.6" />
        <template v-if="!r.terkunci && !r.galat">
          <g>
            <polygon :points="meja(r.posisi).atas" fill="#f1f5f9" stroke="#94a3b8" stroke-width="0.6" />
            <polygon :points="meja(r.posisi).selatan" fill="#cbd5e1" />
            <polygon :points="meja(r.posisi).timur" fill="#94a3b8" />
          </g>
          <g v-for="(a, i) in posisiAvatar(r.posisi, r.menunggu, r.dilayani)" :key="i" :class="a.jenis === 'dilayani' ? 'layani' : 'antre'"
            :style="{ animationDelay: `${-((i * 0.53) % 3)}s` }">
            <ellipse :cx="a.x" :cy="a.y" rx="5" ry="2.4" fill="#0f172a" opacity="0.12" />
            <path :d="`M${a.x - 4.5},${a.y} q0,-11 4.5,-11 q4.5,0 4.5,11 z`" :fill="a.jenis === 'dilayani' ? brand.utama : '#f59e0b'" />
            <circle :cx="a.x" :cy="a.y - 14" r="3.6" :fill="a.jenis === 'dilayani' ? brand.tua : '#b45309'" />
          </g>
          <text v-if="r.menunggu > MAKS_AVATAR_MENUNGGU || r.dilayani > MAKS_AVATAR_DILAYANI" :x="iso(r.posisi.x + r.posisi.w - 0.2, r.posisi.y + r.posisi.d - 0.2)[0]"
            :y="iso(r.posisi.x + r.posisi.w - 0.2, r.posisi.y + r.posisi.d - 0.2)[1] - 4" font-size="9" text-anchor="end" fill="#475569">
            +{{ Math.max(0, r.menunggu - MAKS_AVATAR_MENUNGGU) + Math.max(0, r.dilayani - MAKS_AVATAR_DILAYANI) }}
          </text>
        </template>
        <g v-else>
          <g v-if="r.terkunci" :transform="`translate(${tengah(r.posisi, 4)[0]} ${tengah(r.posisi, 4)[1]})`" fill="#64748b">
            <path d="M-4.5,-4 v-3 a4.5,4.5 0 0 1 9,0 v3" fill="none" stroke="#64748b" stroke-width="2" />
            <rect x="-7" y="-4" width="14" height="11" rx="2" />
          </g>
          <text v-else :x="tengah(r.posisi, 6)[0]" :y="tengah(r.posisi, 6)[1]" text-anchor="middle" font-size="16" font-weight="700" fill="#64748b">!</text>
        </g>
        <!-- dinding depan rendah = warna beban -->
        <polygon v-if="r.beban === 'merah' && !r.terkunci && !r.galat" :points="lantai(r.posisi)" fill="#dc2626" class="denyut-lantai" />
        <polygon :points="dindingSelatan(r.posisi, TINGGI_DEPAN)" :fill="warnaBeban(r.beban, r.terkunci, r.galat).garis" opacity="0.9" :class="{ denyut: r.beban === 'merah' }" />
        <polygon :points="dindingTimur(r.posisi, TINGGI_DEPAN)" :fill="warnaBeban(r.beban, r.terkunci, r.galat).garis" opacity="0.7" :class="{ denyut: r.beban === 'merah' }" />
        <polygon v-if="kilat.kunci.has(r.kunci)" :key="'k' + kilat.versi" :points="lantai(r.posisi)" :fill="brand.utama" class="kilat" />
        <polygon v-if="unitDipilih(r.kodeUnit, r.kodeRuang) && (r.kodeRuang || !(pilihan as any)?.kodeRuang)" :points="lantai(r.posisi)" fill="none" :stroke="brand.tua" stroke-width="3" />
      </g>

      <!-- jalur lintas unit -->
      <g v-for="x in jalurGambar" :key="x.j.asal + '>' + x.j.tujuan" class="cursor-pointer" role="button" tabindex="0"
        :aria-label="`Jalur ${x.j.label}: ${x.j.jumlah}`" @click="pilih({ jenis: 'jalur', asal: x.j.asal, tujuan: x.j.tujuan })"
        @keydown.enter.prevent="emit('pilih', { jenis: 'jalur', asal: x.j.asal, tujuan: x.j.tujuan })">
        <title>{{ x.j.label }}: {{ x.j.jumlah }}</title>
        <path :d="x.g!.d" fill="none" stroke="transparent" stroke-width="14" />
        <path :d="x.g!.d" fill="none" :stroke="jalurDipilih(x.j) ? brand.tua : brand.utama" :stroke-width="jalurDipilih(x.j) ? x.tebal + 1.5 : x.tebal"
          :stroke-opacity="x.j.jumlah > 0 ? 0.75 : 0.25" stroke-linecap="round" :stroke-dasharray="x.j.jumlah > 0 ? '10 8' : '2 6'"
          :class="{ alir: beraliran.has(x.j.asal + '>' + x.j.tujuan) }" />
        <g v-if="x.j.jumlah > 0">
          <rect :x="x.g!.label[0] - 13" :y="x.g!.label[1] - 9" width="26" height="16" rx="8" fill="#ffffff" :stroke="brand.utama" />
          <text :x="x.g!.label[0]" :y="x.g!.label[1] + 3" text-anchor="middle" font-size="10" font-weight="600" :fill="brand.tua">{{ n(`j-${x.j.asal}>${x.j.tujuan}`, x.j.jumlah) }}</text>
        </g>
      </g>

      <!-- pasien berjalan untuk perpindahan nyata sejak snapshot sebelumnya -->
      <LapisanPejalan :snapshot="snapshot" :gerakan="gerakan ?? null" :kurang="kurang" :warna="brand.tua" />

      <!-- label (lapisan teratas agar tetap terbaca) -->
      <g pointer-events="none">
        <!-- nama zona "dicat" di tepi depan lantai zona, mengikuti sumbu x isometrik -->
        <g v-for="z in susunan.zona" :key="'lz-' + z.kodeUnit" :transform="tulisLantai(z.posisi)">
          <text x="0" y="-12" font-size="13" font-weight="700" :fill="brand.tua">{{ z.nama }}</text>
          <text x="0" y="0" font-size="10" fill="#475569">{{ subZona(z) }}</text>
        </g>
        <g v-for="r in susunan.ruangan" :key="'l-' + r.kunci">
          <circle :cx="tengah(r.posisi, r.tinggi + 34)[0] - Math.min(r.nama.length, 22) * 3.2 - 8" :cy="tengah(r.posisi, r.tinggi + 34)[1] - 3.5" r="4"
            :fill="warnaBeban(r.beban, r.terkunci, r.galat).garis" />
          <text :x="tengah(r.posisi, r.tinggi + 34)[0]" :y="tengah(r.posisi, r.tinggi + 34)[1]" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1e293b" class="label">
            {{ r.nama.length > 22 ? r.nama.slice(0, 21) + '…' : r.nama }}
          </text>
          <text :x="tengah(r.posisi, r.tinggi + 21)[0]" :y="tengah(r.posisi, r.tinggi + 21)[1]" text-anchor="middle" font-size="9.5" fill="#475569" class="label">{{ subRuang(r) }}</text>
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.peta { touch-action: none; cursor: grab; }
.peta:active { cursor: grabbing; }
.peta:focus-visible { outline: 3px solid rgb(var(--opensimrs-300)); outline-offset: -3px; }
.ruang:focus-visible, g[role="button"]:focus-visible { outline: none; }
.ruang:focus-visible polygon:first-child { stroke: rgb(var(--opensimrs-400)); stroke-width: 3; }
.ruang:hover polygon:first-child { stroke: rgb(var(--opensimrs-300)); stroke-width: 2; }
.label { paint-order: stroke; stroke: #ffffff; stroke-width: 3px; stroke-linejoin: round; }
.alir { animation: alir 1.4s linear infinite; }
@keyframes alir { to { stroke-dashoffset: -18; } }
.antre, .layani { transform-box: fill-box; transform-origin: bottom; }
/* menunggu: bergeser/bergoyang pelan di baris antre; dilayani: mengangguk ringan di depan meja */
.antre { animation: antre 3.2s ease-in-out infinite; }
@keyframes antre { 0%, 100% { transform: translate(0, 0); } 30% { transform: translate(0.9px, -0.8px); } 60% { transform: translate(-0.7px, 0); } }
.layani { animation: layani 1.6s ease-in-out infinite; }
@keyframes layani { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-4deg) translateY(-0.6px); } 50% { transform: rotate(2deg); } }
.denyut { animation: denyut 1.8s ease-in-out infinite; }
@keyframes denyut { 50% { opacity: 0.4; } }
.denyut-lantai { opacity: 0; animation: denyut-lantai 1.8s ease-in-out infinite; pointer-events: none; }
@keyframes denyut-lantai { 50% { opacity: 0.12; } }
.kilat { opacity: 0; animation: kilat 1.4s ease-out 1; pointer-events: none; }
@keyframes kilat { 15% { opacity: 0.35; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .alir, .antre, .layani, .denyut, .denyut-lantai { animation: none; }
  .kilat { animation-duration: 0.01s; }
}
</style>
