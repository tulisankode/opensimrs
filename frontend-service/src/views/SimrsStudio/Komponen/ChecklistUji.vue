<script setup lang="ts">
// Checklist kasus uji QA (dari rencana uji agen). QA mengisi hasil per kasus; QA lulus mensyaratkan semuanya lulus/tidak berlaku.
import { ref } from "vue";
import { apiStudioPut } from "@/utils/apiHandler";

const props = defineProps<{ itemUuid: string; uji: any[]; bolehUbah: boolean }>();
const emit = defineEmits<{ (e: "berubah"): void }>();
const catatan = ref<Record<string, string>>({});
const terbuka = ref<string | null>(null);

const simpan = async (u: any, status: string) => {
  if (await apiStudioPut(`/item/${props.itemUuid}/uji/${u.uuid}`, { status, catatan: catatan.value[u.uuid] ?? u.catatan ?? null }, true)) emit("berubah");
};

const WARNA: Record<string, string> = {
  belum: "bg-grey-75 text-grey-400",
  lulus: "bg-success-50 text-success-400",
  gagal: "bg-danger-50 text-danger-400",
  na: "bg-info-50 text-info-400",
};
const LABEL: Record<string, string> = { belum: "Belum", lulus: "Lulus", gagal: "Gagal", na: "Tidak berlaku" };
</script>

<template>
  <div class="rounded-lg border border-grey-200">
    <div class="flex items-center justify-between border-b border-grey-200 px-3 py-2 text-SM font-semibold text-grey-500">
      <span class="flex items-center gap-2"><PhListChecks :size="18" class="text-opensimrs-300" aria-hidden="true" /> Checklist uji</span>
      <span class="text-XS font-normal text-grey-400">
        {{ uji.filter((u) => ["lulus", "na"].includes(u.status)).length }}/{{ uji.length }} selesai
      </span>
    </div>
    <div v-if="!uji.length" class="p-4 text-center text-XS text-grey-300">Checklist muncul setelah agen menulis rencana uji.</div>
    <div v-for="u in uji" :key="u.uuid" class="border-b border-grey-100 last:border-0">
      <div class="flex items-start gap-2 px-3 py-2">
        <button type="button" class="mt-0.5 shrink-0" :aria-label="`Rincian ${u.kode}`" @click="terbuka = terbuka === u.uuid ? null : u.uuid">
          <PhCaretRight :size="12" :class="terbuka === u.uuid ? 'rotate-90' : ''" aria-hidden="true" />
        </button>
        <div class="min-w-0 grow">
          <div class="text-XS font-semibold text-grey-500">{{ u.kode }}<span v-if="u.kt" class="font-normal text-grey-400"> · {{ u.kt }}</span> — {{ u.skenario }}</div>
          <div v-if="u.peran" class="text-[11px] text-grey-400">{{ u.peran }}<template v-if="u.otomatis"> · otomatis</template></div>
        </div>
        <div class="flex shrink-0 gap-1">
          <template v-if="bolehUbah">
            <button v-for="s in ['lulus', 'gagal', 'na']" :key="s" type="button" class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="u.status === s ? WARNA[s] : 'bg-white text-grey-300 ring-1 ring-grey-200'" @click="simpan(u, s)">
              {{ LABEL[s] }}
            </button>
          </template>
          <span v-else class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="WARNA[u.status]">{{ LABEL[u.status] }}</span>
        </div>
      </div>
      <div v-if="terbuka === u.uuid" class="flex flex-col gap-1 bg-grey-50 px-8 py-2 text-XS text-grey-500">
        <div v-if="u.langkah" class="whitespace-pre-wrap"><b>Langkah:</b> {{ u.langkah }}</div>
        <div v-if="u.harapan"><b>Hasil diharapkan:</b> {{ u.harapan }}</div>
        <div v-if="u.diujiOleh" class="text-grey-400">Diuji {{ u.diujiOleh }}</div>
        <textarea
          v-if="bolehUbah"
          :value="catatan[u.uuid] ?? u.catatan ?? ''"
          rows="2"
          class="mt-1 rounded border border-grey-200 px-2 py-1"
          placeholder="Catatan hasil uji (mis. langkah yang gagal) — tanpa data pasien asli"
          @input="catatan[u.uuid] = ($event.target as HTMLTextAreaElement).value"
          @blur="u.status !== 'belum' && simpan(u, u.status)"
        />
        <div v-else-if="u.catatan"><b>Catatan:</b> {{ u.catatan }}</div>
      </div>
    </div>
  </div>
</template>
