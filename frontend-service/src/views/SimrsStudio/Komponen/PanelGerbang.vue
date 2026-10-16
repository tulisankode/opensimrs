<script setup lang="ts">
// Gerbang persetujuan tahap aktif: setiap peran wajib menyetujui (rancangan §8). Tombol hanya untuk peran yang dipegang.
import CustomButton from "@/components/Base/CustomButton.vue";
import { formatWaktu } from "../umum";

// belumSiap: alasan tombol Setujui belum bisa dipakai (mis. belum ada perubahan kode).
defineProps<{ gerbang: any[]; risiko: string; sibuk: boolean; labelSetuju: string; belumSiap?: string | null }>();
const emit = defineEmits<{ (e: "setuju", peran: string): void; (e: "revisi"): void; (e: "tolak"): void }>();
</script>

<template>
  <div class="flex flex-col gap-2 rounded-lg bg-opensimrs-50 p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="text-XS text-grey-500">
        <div class="font-semibold">Gerbang persetujuan</div>
        <div>Tahap berpindah setelah semua peran di bawah menyetujui dokumen/kode terbaru. Risiko <b class="capitalize">{{ risiko }}</b>.</div>
      </div>
      <div class="flex gap-2">
        <CustomButton label="Minta revisi" outlined text-color="text-opensimrs-300" border-color="border-opensimrs-300" :disabled="sibuk || !gerbang.some((g) => g.bisa)" @click="emit('revisi')" />
        <CustomButton label="Tolak" outlined text-color="text-danger-300" border-color="border-danger-300" :disabled="sibuk || !gerbang.some((g) => g.bisa)" @click="emit('tolak')" />
      </div>
    </div>
    <div v-if="belumSiap" class="flex items-start gap-2 rounded-lg bg-warning-50 p-2 text-XS text-warning-400">
      <PhHandPalm :size="16" class="shrink-0" aria-hidden="true" /> {{ belumSiap }}
    </div>
    <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
      <div v-for="g in gerbang" :key="g.kode" class="flex items-center justify-between gap-2 rounded-lg bg-white p-2">
        <div class="flex items-center gap-2 text-XS">
          <PhSealCheck v-if="g.disetujui" :size="20" weight="fill" class="shrink-0 text-success-300" aria-hidden="true" />
          <PhCircleDashed v-else :size="20" class="shrink-0 text-grey-300" aria-hidden="true" />
          <div>
            <div class="font-semibold text-grey-500">{{ g.label }}</div>
            <div v-if="g.disetujui" class="text-grey-400">{{ g.oleh }} · {{ formatWaktu(g.pada) }}</div>
            <div v-else class="text-grey-300">{{ g.bisa ? "Menunggu Anda" : "Menunggu pemegang peran" }}</div>
          </div>
        </div>
        <CustomButton v-if="!g.disetujui && g.bisa" :label="gerbang.length === 1 ? labelSetuju : 'Setujui'" icon="PhCheck" :disabled="sibuk || !!belumSiap" :title="belumSiap ?? undefined" @click="emit('setuju', g.kode)" />
      </div>
    </div>
  </div>
</template>
