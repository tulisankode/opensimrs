<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { buatPerulangan } from './animasi'
import { type Gerakan, type Pejalan, posisiPejalan, selesaiPada, susunPejalan } from './gerakan'
import { type Snapshot, iso } from './petaIsometrik'

// Lapisan avatar berjalan (2.5D) untuk perpindahan nyata antar-snapshot. Dipisah dari peta agar hanya lapisan ini yang
// digambar ulang tiap frame. Tanpa gerakan (atau gerak berkurang) lapisan kosong.
const props = defineProps<{ snapshot: Snapshot; gerakan: Gerakan | null; kurang: boolean; warna: string }>()

const pejalan = shallowRef<Pejalan[]>([])
const sekarang = ref(0)
let awal = 0
let akhir = 0

const loop = buatPerulangan((t) => {
  if (!awal) awal = t
  sekarang.value = t - awal
  if (sekarang.value <= akhir) return true
  pejalan.value = []
  return false
})

watch(() => props.gerakan?.versi, () => {
  loop.henti()
  const g = props.gerakan
  pejalan.value = g && !props.kurang ? susunPejalan(props.snapshot, g.daftar, g.versi) : []
  if (!pejalan.value.length) return
  awal = 0
  sekarang.value = 0
  akhir = selesaiPada(pejalan.value)
  loop.mulai()
})
watch(() => props.kurang, (k) => { if (k) { loop.henti(); pejalan.value = [] } })

// Tab kembali terlihat: lanjutkan (avatar yang waktunya lewat langsung dianggap tiba).
const saatTerlihat = () => { if (!document.hidden && pejalan.value.length) loop.mulai() }
onMounted(() => document.addEventListener('visibilitychange', saatTerlihat))
onUnmounted(() => { loop.henti(); document.removeEventListener('visibilitychange', saatTerlihat) })

const gambar = () =>
  pejalan.value.flatMap((p) => {
    const q = posisiPejalan(p, sekarang.value)
    if (!q) return []
    const [x, y] = iso(q.x, q.y)
    const ayun = Math.sin(q.langkah * 10)
    return [{ id: p.id, x, y: y - Math.abs(ayun) * 1.6, kaki: ayun * 2.2, opasitas: q.opasitas }]
  }).sort((a, b) => a.y - b.y)
</script>

<template>
  <g pointer-events="none" aria-hidden="true">
    <g v-for="a in gambar()" :key="a.id" :opacity="a.opasitas">
      <ellipse :cx="a.x" :cy="a.y + 1" rx="4.6" ry="2.2" fill="#0f172a" opacity="0.14" />
      <path :d="`M${a.x - 1.5},${a.y - 3} l${-a.kaki * 0.6},3.4 M${a.x + 1.5},${a.y - 3} l${a.kaki * 0.6},3.4`" stroke="#92400e" stroke-width="1.6" stroke-linecap="round" />
      <path :d="`M${a.x - 4.2},${a.y - 2.5} q0,-10 4.2,-10 q4.2,0 4.2,10 z`" fill="#f59e0b" :stroke="warna" stroke-width="0.8" />
      <circle :cx="a.x" :cy="a.y - 15.5" r="3.4" fill="#b45309" />
    </g>
  </g>
</template>
