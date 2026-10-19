<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { apiLaporanGet } from '@/utils/apiHandler'

type Unit = { kodeUnit: string; nama: string; bidangKerja: string; x: number; y: number; antre: number; aktif: number; tertunda: number; selesai: number; belumDipetakan: number }
const authStore = useAuthStore()
const unit = ref<Unit[]>([])
const jalur = ref<Array<{ asal: string; tujuan: string }>>([])
const selectedUnit = ref('')
const selectedPath = ref('')
const detail = computed(() => unit.value.filter(u => selectedPath.value ? selectedPath.value.split(':').includes(u.kodeUnit) : u.kodeUnit === selectedUnit.value))
const connectionState = ref('Belum dimuat')
const generatedAt = ref<number | null>(null)
const loading = ref(false)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const pilih = (kode: string) => { selectedUnit.value = kode; selectedPath.value = '' }
let active = true
let requestVersion = 0
const muat = async () => {
  const version = ++requestVersion
  loading.value = true
  connectionState.value = 'Menyinkronkan simulasi'
  try {
    const response = await apiLaporanGet('/virtual-office/snapshot')
    if (!active || version !== requestVersion) return
    if (!response?.payload || response.payload.mode_data !== 'simulasi') throw new Error('Snapshot tidak tersedia')
    const data = response.payload
    unit.value = data.unit.map((u: any) => ({ kodeUnit: u.kode_unit, nama: u.nama, bidangKerja: u.bidang_kerja, x: u.x, y: u.y, antre: u.antre, aktif: u.aktif, tertunda: u.tertunda, selesai: u.selesai, belumDipetakan: u.belum_dipetakan }))
    jalur.value = data.jalur
    selectedUnit.value = ''
    selectedPath.value = ''
    generatedAt.value = data.generated_at
    connectionState.value = 'Simulasi tersinkron; sumber operasional belum terhubung'
  } catch {
    if (!active || version !== requestVersion) return
    unit.value = []
    jalur.value = []
    generatedAt.value = null
    connectionState.value = 'Offline ? snapshot tidak tersedia'
  } finally { if (active && version === requestVersion) loading.value = false }
}
const titik = (kode: string) => unit.value.find(u => u.kodeUnit === kode)
const pusatkan = () => { panX.value = 0; panY.value = 0; zoom.value = 1 }
let drag: { x: number; y: number } | null = null
const mulaiGeser = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId) }
const geser = (e: PointerEvent) => { if (drag) { panX.value += (e.clientX - drag.x) / zoom.value; panY.value += (e.clientY - drag.y) / zoom.value; drag = { x: e.clientX, y: e.clientY } } }
const offline = () => { ++requestVersion; loading.value = false; connectionState.value = 'Offline ? data simulasi tertunda' }
const tertunda = () => { if (!loading.value && generatedAt.value && Date.now() / 1000 - generatedAt.value > 45) connectionState.value = 'Tertunda ? muat snapshot simulasi terbaru' }
watch(() => authStore.faskesUuid, () => {
  ++requestVersion
  loading.value = false
  unit.value = []
  jalur.value = []
  generatedAt.value = null
  selectedUnit.value = ''
  selectedPath.value = ''
  connectionState.value = 'Konteks fasilitas berubah ? sinkronkan ulang'
})
let timer: ReturnType<typeof setInterval>
onMounted(() => { muat(); timer = setInterval(tertunda, 15000); window.addEventListener('offline', offline); window.addEventListener('online', muat) })
onUnmounted(() => { active = false; ++requestVersion; clearInterval(timer); window.removeEventListener('offline', offline); window.removeEventListener('online', muat); unit.value = []; jalur.value = [] })
</script>

<template>
  <main class="p-6 space-y-4">
    <h1 class="text-2xl font-bold">Virtual Office</h1>
    <p class="p-3 bg-amber-100 rounded" role="note"><strong>Simulasi</strong> ? seluruh angka dan jalur bersifat sintetis, bukan kondisi operasional. Avatar mewakili bidang kerja, bukan kehadiran pegawai.</p>
    <p role="status">{{ connectionState }}<span v-if="generatedAt"> ? Snapshot {{ new Date(generatedAt * 1000).toLocaleString('id-ID') }}</span></p>
    <div class="flex gap-3 flex-wrap">
      <button :disabled="loading" @click="muat">Sinkronkan ulang</button>
      <button aria-label="Perbesar peta" @click="zoom = Math.min(2, zoom + 0.2)">Perbesar</button>
      <button aria-label="Perkecil peta" @click="zoom = Math.max(0.6, zoom - 0.2)">Perkecil</button>
      <button @click="pusatkan">Pusatkan peta</button>
      <button @click="panX -= 40">Geser kiri</button><button @click="panX += 40">Geser kanan</button>
      <button @click="panY -= 40">Geser atas</button><button @click="panY += 40">Geser bawah</button>
    </div>
    <svg viewBox="0 0 800 540" class="w-full border rounded bg-slate-50" style="max-height: 65vh; touch-action: none" aria-label="Peta isometrik simulasi lintas unit" @pointerdown="mulaiGeser" @pointermove="geser" @pointerup="drag = null" @pointercancel="drag = null">
      <g :transform="`translate(${panX} ${panY}) scale(${zoom})`">
        <g v-for="j in jalur" :key="j.asal + j.tujuan" tabindex="0" role="button" :aria-label="`Jalur simulasi ${j.asal} ke ${j.tujuan}`" @pointerdown.stop @click="selectedPath = j.asal + ':' + j.tujuan" @keydown.enter.prevent="selectedPath = j.asal + ':' + j.tujuan" @keydown.space.prevent="selectedPath = j.asal + ':' + j.tujuan">
          <line :x1="titik(j.asal)?.x" :y1="(titik(j.asal)?.y ?? 0) + 50" :x2="titik(j.tujuan)?.x" :y2="(titik(j.tujuan)?.y ?? 0) + 50" stroke="#64748b" stroke-width="12" stroke-dasharray="8 5" />
        </g>
        <g v-for="u in unit" :key="u.kodeUnit" :transform="`translate(${u.x} ${u.y})`" tabindex="0" role="button" :aria-label="`${u.nama}: antre ${u.antre}, aktif ${u.aktif}, tertunda ${u.tertunda}`" @pointerdown.stop @click="pilih(u.kodeUnit)" @keydown.enter.prevent="pilih(u.kodeUnit)" @keydown.space.prevent="pilih(u.kodeUnit)">
          <path d="M-110 20 L0 -35 L110 20 L0 75 Z" fill="#dbeafe" stroke="#1d4ed8" />
          <path d="M-110 20 L0 75 L110 20 L110 45 L0 100 L-110 45 Z" fill="#93c5fd" stroke="#1d4ed8" />
          <text text-anchor="middle" y="18" font-size="16">{{ u.nama }}</text>
          <text text-anchor="middle" y="44" font-size="12">Antre {{ u.antre }} ? Aktif {{ u.aktif }}</text>
          <g role="button" tabindex="0" :aria-label="`Bidang kerja: ${u.bidangKerja}`" @click.stop="pilih(u.kodeUnit)" @keydown.enter.stop.prevent="pilih(u.kodeUnit)" @keydown.space.stop.prevent="pilih(u.kodeUnit)">
            <circle cx="75" cy="-15" r="12" fill="#475569" /><path d="M60 12 Q75 -15 90 12" fill="#475569" />
          </g>
        </g>
      </g>
    </svg>
    <section aria-label="Daftar unit alternatif" class="flex gap-3 flex-wrap">
      <button v-for="u in unit" :key="u.kodeUnit" @click="pilih(u.kodeUnit)">{{ u.nama }} ? antre {{ u.antre }}, aktif {{ u.aktif }}, tertunda {{ u.tertunda }}</button>
      <p v-if="!loading && !unit.length">Tidak ada unit yang tersedia sesuai modul dan izin Anda.</p>
    </section>
    <section v-for="u in detail" :key="u.kodeUnit" class="p-4 border rounded" aria-live="polite">
      <h2 class="font-bold">{{ u.nama }} ? Simulasi</h2><p>Bidang kerja: {{ u.bidangKerja }}</p>
      <p>Antre {{ u.antre }} ? Aktif {{ u.aktif }} ? Tertunda {{ u.tertunda }} ? Selesai {{ u.selesai }} ? Belum dipetakan {{ u.belumDipetakan }}</p>
      <p>Waktu tunggu dan SLA belum tersedia. Penelusuran transaksi belum tersedia pada prototipe sintetis.</p>
    </section>
  </main>
</template>

<style scoped>
button { padding: 0.5rem 0.75rem; border: 1px solid #64748b; border-radius: 0.375rem; }
button:focus-visible, g:focus-visible { outline: 3px solid #b45309; }
button:disabled { opacity: 0.5; }
g[role="button"] { cursor: pointer; }
</style>
