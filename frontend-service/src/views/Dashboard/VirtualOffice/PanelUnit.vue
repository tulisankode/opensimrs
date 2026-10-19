<script setup lang="ts">
import { computed } from 'vue'
import { canAccessPermission, resolveRoutePermission } from '@/utils/permissions'
import { type Metrik, type Pilihan, type Snapshot, warnaBeban } from './petaIsometrik'

// Panel rincian pilihan peta: angka agregat unit/ruang atau jalur. Tidak ada identitas pasien; penelusuran transaksi
// hanya lewat tautan ke halaman modul sumber, yang tampil bila pengguna berizin pada rute itu.
const props = defineProps<{ snapshot: Snapshot; pilihan: Pilihan }>()
const emit = defineEmits<{ (e: 'tutup'): void; (e: 'pilih', p: Pilihan): void }>()

const unit = computed(() => (props.pilihan?.jenis === 'unit' ? props.snapshot.unit.find((u) => u.kodeUnit === (props.pilihan as any).kodeUnit) ?? null : null))
const ruang = computed(() => {
  const kode = props.pilihan?.jenis === 'unit' ? props.pilihan.kodeRuang : undefined
  return kode ? unit.value?.ruang?.find((r) => r.kodeRuang === kode) ?? null : null
})
const jalur = computed(() => {
  const p = props.pilihan
  return p?.jenis === 'jalur' ? props.snapshot.jalur.find((j) => j.asal === p.asal && j.tujuan === p.tujuan) ?? null : null
})
const namaUnit = (kode: string) => props.snapshot.unit.find((u) => u.kodeUnit === kode)?.nama ?? kode
const subjek = computed(() => ruang.value ?? unit.value)
const warna = computed(() => warnaBeban(subjek.value?.beban ?? null, !!unit.value?.terkunci, !!unit.value?.galat))
const bolehBuka = computed(() => {
  const rute = unit.value?.rute
  return !!rute && canAccessPermission(resolveRoutePermission(rute))
})
const nilai = (m: Metrik) => (m.nilai === null || m.nilai === undefined ? '—' : `${m.nilai}${m.satuan === '%' ? '%' : m.satuan ? ' ' + m.satuan : ''}`)
const urutRuang = computed(() => [...(unit.value?.ruang ?? [])].sort((a, b) => b.menunggu - a.menunggu || a.nama.localeCompare(b.nama)))
</script>

<template>
  <aside class="flex flex-col gap-4 p-4 bg-white rounded-lg" aria-live="polite">
    <template v-if="jalur">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-xs text-grey-300">Jalur lintas unit</p>
          <h2 class="font-semibold text-opensimrs-300">{{ namaUnit(jalur.asal) }} → {{ namaUnit(jalur.tujuan) }}</h2>
        </div>
        <button type="button" class="tutup" aria-label="Tutup rincian" @click="emit('tutup')"><PhX :size="16" /></button>
      </div>
      <div class="p-3 rounded-lg bg-opensimrs-50">
        <p class="text-3xl font-bold text-opensimrs-400">{{ jalur.jumlah }}</p>
        <p class="text-xs text-grey-300">{{ jalur.label }} (hari ini)</p>
      </div>
      <p class="text-xs text-grey-300">Jalur menunjukkan jumlah transaksi yang mengalir dari unit asal ke unit tujuan pada hari ini, bukan perjalanan pasien perorangan.</p>
    </template>

    <template v-else-if="unit">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs text-grey-300">{{ ruang ? unit.nama : unit.bidangKerja }}</p>
          <h2 class="font-semibold truncate text-opensimrs-300">{{ ruang?.nama ?? unit.nama }}</h2>
        </div>
        <button type="button" class="tutup" aria-label="Tutup rincian" @click="emit('tutup')"><PhX :size="16" /></button>
      </div>

      <div v-if="unit.terkunci" class="p-3 text-sm rounded-lg bg-grey-50 text-grey-300">
        Rincian unit ini memerlukan izin <strong>Dashboard › Virtual Office › {{ unit.izinDibutuhkan }}</strong>. Hubungi admin untuk mengatur Hak Akses.
      </div>
      <div v-else-if="unit.galat" class="p-3 text-sm rounded-lg bg-grey-50 text-grey-300">
        Data sumber unit ini gagal dimuat. Angka tidak ditampilkan agar tidak terbaca sebagai nol; coba muat ulang beberapa saat lagi.
      </div>

      <template v-else-if="subjek">
        <span class="self-start inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full"
          :style="{ background: warna.isi, color: warna.garis }">
          <span class="w-2 h-2 rounded-full" :style="{ background: warna.garis }"></span>
          Beban: {{ warna.label }}
          <template v-if="unit.ambang">
            ({{ unit.metrikBeban === 'bor' ? `BOR kuning ≥ ${unit.ambang.kuning}%, merah ≥ ${unit.ambang.merah}%` : `antre kuning ≥ ${unit.ambang.kuning}, merah ≥ ${unit.ambang.merah}` }})
          </template>
        </span>
        <div class="grid grid-cols-3 gap-2">
          <div class="kotak"><p class="angka text-amber-600">{{ subjek.menunggu }}</p><p class="ket">Menunggu</p></div>
          <div class="kotak"><p class="angka text-opensimrs-400">{{ subjek.dilayani }}</p><p class="ket">Dilayani</p></div>
          <div class="kotak"><p class="angka text-grey-400">{{ subjek.selesai }}</p><p class="ket">Selesai</p></div>
        </div>
        <ul v-if="(ruang?.metrik ?? unit.metrik ?? []).length" class="flex flex-col gap-1 text-sm">
          <li v-for="m in ruang?.metrik ?? unit.metrik" :key="m.kode" class="flex justify-between gap-3">
            <span class="text-grey-300">{{ m.label }}</span><span class="font-medium text-right">{{ nilai(m) }}</span>
          </li>
        </ul>

        <div v-if="!ruang && urutRuang.length">
          <p class="mb-1 text-xs font-semibold text-grey-300">Per {{ unit.kodeUnit === 'rawat_inap' ? 'ruangan' : 'poli' }}</p>
          <table class="w-full text-xs">
            <thead><tr class="text-left text-grey-300"><th class="py-1 font-medium">Nama</th><th class="font-medium text-right">Antre</th><th class="font-medium text-right">Dilayani</th><th class="font-medium text-right">Selesai</th></tr></thead>
            <tbody>
              <tr v-for="r in urutRuang" :key="r.kodeRuang" class="border-t cursor-pointer border-grey-100 hover:bg-opensimrs-50"
                tabindex="0" @click="emit('pilih', { jenis: 'unit', kodeUnit: unit.kodeUnit, kodeRuang: r.kodeRuang })"
                @keydown.enter.prevent="emit('pilih', { jenis: 'unit', kodeUnit: unit.kodeUnit, kodeRuang: r.kodeRuang })">
                <td class="py-1.5 pr-2"><span class="inline-block w-2 h-2 mr-1.5 rounded-full" :style="{ background: warnaBeban(r.beban).garis }"></span>{{ r.nama }}</td>
                <td class="text-right">{{ r.menunggu }}</td><td class="text-right">{{ r.dilayani }}</td><td class="text-right">{{ r.selesai }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button v-if="ruang" type="button" class="self-start text-xs underline text-opensimrs-300" @click="emit('pilih', { jenis: 'unit', kodeUnit: unit.kodeUnit })">
          Lihat ringkasan {{ unit.nama }}
        </button>
        <p v-if="unit.keterangan" class="text-xs text-grey-300">{{ unit.keterangan }}</p>
      </template>

      <RouterLink v-if="bolehBuka && !unit.terkunci" :to="unit.rute!"
        class="self-start px-3 py-1.5 text-xs font-medium rounded-lg border border-opensimrs-300 text-opensimrs-300 hover:bg-opensimrs-50">
        Buka modul {{ unit.nama }}
      </RouterLink>
    </template>

    <template v-else>
      <h2 class="font-semibold text-opensimrs-300">Rincian unit</h2>
      <p class="text-sm text-grey-300">Pilih ruang, zona, atau jalur pada peta untuk melihat angka agregat hari ini.</p>
    </template>
  </aside>
</template>

<style scoped>
.kotak { @apply p-2 text-center rounded-lg bg-grey-50; }
.angka { @apply text-2xl font-bold leading-tight; }
.ket { @apply text-[11px] text-grey-300; }
.tutup { @apply p-1 rounded text-grey-300 hover:bg-grey-50; }
</style>
