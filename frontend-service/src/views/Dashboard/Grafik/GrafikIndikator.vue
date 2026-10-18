<script setup lang="ts">
import { computed } from 'vue'
import Chart from 'primevue/chart'
import { formatNilaiIndikator } from '@/utils/pdf/pdfDashboardEksekutif'
import { warnaTema } from '@/utils/tema'

// Satu indikator Dashboard Eksekutif sebagai grafik sesuai konteks datanya:
// - persentase (BOR, kesiapan akreditasi)              → gauge setengah lingkaran berwarna status target;
// - volume berderet waktu (kunjungan, pendapatan)      → garis tren;
// - rasio/rerata dengan rentang target (ALOS, TOI, …)  → batang horizontal nilai vs target min/maks;
// - jumlah lain (kas, piutang, SEP, pegawai, …)        → batang periode lalu vs periode ini.
const props = defineProps<{
  indikator: any
  labelTren?: string[]
  nilaiTren?: number[]
  targetBerlaku?: boolean
}>()

const WARNA_STATUS: Record<string, string> = { hijau: '#12B76A', kuning: '#F79009', merah: '#F04438' }
const warnaNilai = computed(() => WARNA_STATUS[props.indikator.statusTarget] ?? warnaTema('300'))
const tersedia = computed(() => props.indikator.statusData === 'tersedia' && props.indikator.nilai !== null && props.indikator.nilai !== undefined)
const nilaiTeks = computed(() => formatNilaiIndikator(props.indikator.nilai, props.indikator.satuan))

const jenis = computed(() => {
  const i = props.indikator
  if (i.satuan === '%') return 'gauge'
  if (props.nilaiTren?.length) return 'tren'
  const t = props.targetBerlaku ? i.target : null
  if (t && (t.min !== null && t.min !== undefined || t.maks !== null && t.maks !== undefined)) return 'rentang'
  return 'banding'
})

const angka = (v: any) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v))
const sumbu = (satuan: string) => (satuan === 'Rp'
  ? { ticks: { callback: (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString('id-ID')} jt` : v.toLocaleString('id-ID')) } }
  : { ticks: { callback: (v: number) => Number(v).toLocaleString('id-ID') } })
const tooltipNilai = (satuan: string) => ({ callbacks: { label: (c: any) => `${c.dataset.label ?? c.label}: ${formatNilaiIndikator(c.raw, satuan)}` } })

const data = computed(() => {
  const i = props.indikator
  const v = angka(i.nilai) ?? 0
  if (jenis.value === 'gauge') {
    const isi = Math.max(0, Math.min(100, v))
    return { labels: ['Capaian', 'Sisa'], datasets: [{ data: [isi, 100 - isi], backgroundColor: [warnaNilai.value, '#EAECF0'], borderWidth: 0 }] }
  }
  if (jenis.value === 'tren') {
    return {
      labels: props.labelTren ?? [],
      datasets: [{ label: i.nama, data: props.nilaiTren ?? [], borderColor: warnaTema('300'), backgroundColor: warnaTema('100'), fill: true, tension: 0.35, pointRadius: 2 }],
    }
  }
  if (jenis.value === 'rentang') {
    const t = i.target ?? {}
    const label = ['Nilai']
    const isi = [v]
    const warna = [warnaNilai.value]
    if (angka(t.min) !== null) { label.push('Target min'); isi.push(Number(t.min)); warna.push('#98A2B3') }
    if (angka(t.maks) !== null) { label.push('Target maks'); isi.push(Number(t.maks)); warna.push('#D0D5DD') }
    return { labels: label, datasets: [{ data: isi, backgroundColor: warna, borderRadius: 4, barThickness: 18 }] }
  }
  // banding: periode lalu dihitung dari persen perubahan bila ada
  const p = angka(i.perubahanPersen)
  const lalu = p !== null && p !== -100 && !i.periode?.posisiSaatIni ? v / (1 + p / 100) : null
  return lalu === null
    ? { labels: ['Periode ini'], datasets: [{ data: [v], backgroundColor: [warnaNilai.value], borderRadius: 4, barThickness: 28 }] }
    : { labels: ['Periode lalu', 'Periode ini'], datasets: [{ data: [Math.round(lalu * 100) / 100, v], backgroundColor: ['#D0D5DD', warnaNilai.value], borderRadius: 4, barThickness: 28 }] }
})

const opsi = computed(() => {
  const s = props.indikator.satuan
  if (jenis.value === 'gauge') {
    return { rotation: -90, circumference: 180, cutout: '72%', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
  }
  if (jenis.value === 'tren') {
    return { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipNilai(s) }, scales: { x: { ticks: { maxTicksLimit: 6 } }, y: { beginAtZero: true, ...sumbu(s) } } }
  }
  if (jenis.value === 'rentang') {
    return { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipNilai(s) }, scales: { x: { beginAtZero: true, ...sumbu(s) } } }
  }
  return { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipNilai(s) }, scales: { y: { beginAtZero: true, ...sumbu(s) } } }
})

const tipeChart = computed(() => (jenis.value === 'gauge' ? 'doughnut' : jenis.value === 'tren' ? 'line' : 'bar'))
</script>

<template>
  <div class="relative h-[150px]">
    <template v-if="tersedia">
      <Chart :type="tipeChart" :data="data" :options="opsi" class="h-full" />
      <div v-if="jenis === 'gauge'" class="absolute inset-x-0 bottom-3 text-center">
        <span class="text-lg font-semibold" :style="{ color: warnaNilai }">{{ nilaiTeks }}</span>
      </div>
    </template>
    <div v-else class="flex flex-col items-center justify-center h-full px-4 text-sm text-center"
      :class="indikator.statusData === 'gagal' ? 'text-danger-300' : 'text-grey-300'">
      {{ indikator.statusData === 'gagal' ? 'Gagal dimuat' : indikator.statusData === 'belum_dapat_dihitung' ? 'Belum dapat dihitung' : 'Belum tersedia' }}
      <span v-if="indikator.keterangan" class="block mt-1 text-xs">{{ indikator.keterangan }}</span>
    </div>
  </div>
</template>
