<script setup lang="ts">
import { computed } from 'vue'
import { type Pilihan, type Snapshot, warnaBeban } from './petaIsometrik'
import { type EntriLog, jamLog } from './logAktivitas'
import AngkaHalus from './AngkaHalus.vue'

// Panel samping Kantor: ringkasan hari ini, daftar unit berstatus (klik = fokus kamera + rincian), dan Log Aktivitas
// yang diturunkan dari selisih snapshot. Semua angka agregat; tidak ada identitas pasien.
const props = defineProps<{ snapshot: Snapshot; log: EntriLog[]; pilihan: Pilihan; hanyaLog?: boolean }>()
const emit = defineEmits<{ (e: 'pilih', kodeUnit: string, kodeRuang?: string): void }>()

const terbuka = computed(() => props.snapshot.unit.filter((u) => !u.terkunci && !u.galat))
const jumlah = (k: 'menunggu' | 'dilayani' | 'selesai') => terbuka.value.reduce((a, u) => a + (u[k] ?? 0), 0)
const status = (u: Snapshot['unit'][number]) => (u.terkunci ? 'Terkunci' : u.galat ? 'Gagal dimuat' : warnaBeban(u.beban).label)
const IKON: Record<EntriLog['jenis'], string> = { masuk: 'PhUserPlus', layan: 'PhStethoscope', selesai: 'PhCheckCircle', alur: 'PhArrowsLeftRight', beban: 'PhWarning', info: 'PhInfo' }
const WARNA: Record<EntriLog['jenis'], string> = { masuk: 'text-amber-600', layan: 'text-opensimrs-400', selesai: 'text-green-600', alur: 'text-opensimrs-300', beban: 'text-red-600', info: 'text-grey-300' }
</script>

<template>
  <section class="flex flex-col gap-4 p-4 bg-white rounded-lg">
    <template v-if="!hanyaLog">
      <div>
        <h2 class="mb-2 text-sm font-semibold text-opensimrs-300">Status hari ini</h2>
        <div class="grid grid-cols-3 gap-2">
          <div class="kotak"><p class="angka text-amber-600"><AngkaHalus :nilai="jumlah('menunggu')" /></p><p class="ket">Menunggu</p></div>
          <div class="kotak"><p class="angka text-opensimrs-400"><AngkaHalus :nilai="jumlah('dilayani')" /></p><p class="ket">Dilayani</p></div>
          <div class="kotak"><p class="angka text-grey-400"><AngkaHalus :nilai="jumlah('selesai')" /></p><p class="ket">Selesai</p></div>
        </div>
      </div>
      <ul class="flex flex-col gap-1" aria-label="Daftar unit">
        <li v-for="u in snapshot.unit" :key="u.kodeUnit">
          <button type="button" class="flex items-center w-full gap-2 px-2 py-1.5 text-xs text-left border rounded-lg transition-colors"
            :class="pilihan?.jenis === 'unit' && pilihan.kodeUnit === u.kodeUnit ? 'border-opensimrs-300 bg-opensimrs-50' : 'border-grey-100 hover:border-opensimrs-300'"
            :aria-label="u.terkunci ? `${u.nama}: terkunci` : u.galat ? `${u.nama}: sumber gagal dimuat` : `${u.nama}: ${u.menunggu} menunggu, ${u.dilayani} dilayani, ${status(u)}`"
            @click="emit('pilih', u.kodeUnit)">
            <PhLock v-if="u.terkunci" :size="12" class="shrink-0 text-grey-300" />
            <span v-else class="w-2 h-2 rounded-full shrink-0" :style="{ background: warnaBeban(u.beban, u.terkunci, u.galat).garis }"></span>
            <span class="truncate grow text-grey-500">{{ u.nama }}</span>
            <span v-if="!u.terkunci && !u.galat" class="tabular-nums text-grey-300">{{ u.menunggu }}/{{ u.dilayani }}</span>
            <span class="px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0"
              :style="{ background: warnaBeban(u.beban, u.terkunci, u.galat).isi, color: warnaBeban(u.beban, u.terkunci, u.galat).garis }">{{ status(u) }}</span>
          </button>
        </li>
      </ul>
    </template>

    <div>
      <h2 class="mb-1 text-sm font-semibold text-opensimrs-300">Log Aktivitas</h2>
      <p class="mb-2 text-[11px] text-grey-300">Diturunkan dari perubahan angka antar-pembaruan; tanpa identitas pasien.</p>
      <ol v-if="log.length" class="flex flex-col gap-1.5 overflow-y-auto max-h-72 pr-1" aria-live="polite">
        <li v-for="e in log" :key="e.id">
          <button type="button" class="flex items-start w-full gap-2 text-xs text-left rounded hover:bg-opensimrs-50" :disabled="!e.kodeUnit"
            @click="e.kodeUnit && emit('pilih', e.kodeUnit, e.kodeRuang)">
            <span class="font-medium tabular-nums text-grey-300 shrink-0">{{ jamLog(e.waktu) }}</span>
            <component :is="IKON[e.jenis]" :size="14" class="shrink-0 mt-px" :class="WARNA[e.jenis]" />
            <span class="text-grey-500">{{ e.teks }}</span>
          </button>
        </li>
      </ol>
      <p v-else class="text-xs text-grey-300">Belum ada perubahan sejak halaman dibuka. Log terisi otomatis saat angka berubah.</p>
    </div>
  </section>
</template>

<style scoped>
.kotak { @apply p-2 text-center rounded-lg bg-grey-50; }
.angka { @apply text-xl font-bold leading-tight; }
.ket { @apply text-[11px] text-grey-300; }
</style>
