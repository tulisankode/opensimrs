<script setup lang="ts">
import { isoWib, type Temuan } from "@/stores/penunjang/jadwalDinas";

// Daftar hasil validasi jadwal. Klik temuan memfokuskan sel terkait di grid jadwal.
defineProps<{ temuan: Temuan[]; pegawai?: { uuid: string; nama: string }[] }>();
defineEmits<{ pilih: [pegawai: string, tanggal?: number] }>();
</script>

<template>
  <section aria-label="Hasil validasi" aria-live="polite" class="flex flex-col gap-2">
    <div v-if="!temuan.length" class="flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-success-50 text-success-400">
      <PhCheckCircle :size="16" weight="bold" /> Tidak ada temuan pada pemeriksaan terakhir.
    </div>
    <button
      v-for="(t, i) in temuan"
      :key="i"
      type="button"
      class="flex items-start w-full gap-2 px-3 py-2 text-xs text-left border rounded-lg"
      :class="t.tingkat === 'pemblokir' ? 'border-danger-75 bg-danger-50 hover:bg-danger-75/40' : 'border-warning-75 bg-warning-50 hover:bg-warning-75/40'"
      @click="$emit('pilih', t.kepegawaianUuid ?? '', t.tanggalKerja)"
    >
      <span
        class="px-2 py-0.5 font-semibold rounded-full whitespace-nowrap text-white"
        :class="t.tingkat === 'pemblokir' ? 'bg-danger-300' : 'bg-warning-300'"
      >{{ t.tingkat === "pemblokir" ? "Pemblokir" : "Peringatan" }}</span>
      <span class="flex flex-col gap-0.5">
        <span class="font-semibold text-grey-500">{{ t.message }}</span>
        <span class="text-grey-400">
          <span v-if="t.kepegawaianUuid">{{ pegawai?.find((p) => p.uuid === t.kepegawaianUuid)?.nama ?? t.kepegawaianUuid }}</span>
          <span v-if="t.tanggalKerja"> · {{ isoWib(t.tanggalKerja) }}</span>
          <span v-if="t.minimumMenit != null"> · Jeda {{ t.jedaMenit }} / minimum {{ t.minimumMenit }} menit</span>
          <span v-if="t.maksimumMenit != null"> · Jam kerja {{ t.aktualMenit }} / batas {{ t.maksimumMenit }} menit</span>
          <span v-if="t.minimumStaf != null"> · Minimum {{ t.minimumStaf }}, kurang {{ t.kekurangan }}</span>
        </span>
      </span>
    </button>
  </section>
</template>
