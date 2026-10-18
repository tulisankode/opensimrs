<script setup lang="ts">
// Perubahan berkas buatan agen (diff per berkas) + hasil pemeriksa kebijakan.
import { ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiStudioGet } from "@/utils/apiHandler";

const props = defineProps<{ itemUuid: string; muatUlang?: number }>();
const data = ref<any>(null);
const terbuka = ref<string | null>(null);
const memuat = ref(false);

const muat = async () => {
  memuat.value = true;
  const res = await apiStudioGet(`/item/${props.itemUuid}/perubahan`, true);
  data.value = res?.payload ?? null;
  memuat.value = false;
};
watch(() => [props.itemUuid, props.muatUlang], muat, { immediate: true });

const kelasBaris = (b: string) =>
  b.startsWith("+") && !b.startsWith("+++") ? "bg-success-50 text-success-400"
    : b.startsWith("-") && !b.startsWith("---") ? "bg-danger-50 text-danger-400"
    : b.startsWith("@@") ? "text-info-300" : "text-grey-500";

const LABEL: Record<string, string> = { "??": "baru", A: "baru", M: "ubah", D: "hapus", R: "ganti nama" };
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="rounded-lg border border-grey-200 p-3">
      <div class="mb-2 flex items-center justify-between">
        <div class="flex items-center gap-2 text-SM font-semibold text-grey-500">
          <PhShieldCheck :size="18" class="text-opensimrs-300" aria-hidden="true" /> Pemeriksa kebijakan
          <span
            v-if="data"
            class="rounded px-1.5 text-[10px] font-bold"
            :class="data.kebijakan.lulus ? 'bg-success-50 text-success-400' : 'bg-danger-50 text-danger-400'"
          >{{ data.kebijakan.lulus ? "LULUS" : "BELUM LULUS" }}</span>
        </div>
        <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" icon="PhArrowClockwise" outlined :disabled="memuat" @click="muat" />
      </div>
      <div v-if="data" class="grid grid-cols-1 gap-1 md:grid-cols-2">
        <div v-for="t in data.kebijakan.temuan" :key="t.cek" class="flex items-start gap-1.5 text-XS">
          <PhCheckCircle v-if="t.lulus" :size="15" weight="fill" class="mt-[1px] shrink-0 text-success-300" aria-hidden="true" />
          <PhWarningCircle v-else :size="15" weight="fill" class="mt-[1px] shrink-0" :class="['Uji', 'Urutan migrasi'].includes(t.cek) ? 'text-warning-300' : 'text-danger-300'" aria-hidden="true" />
          <span><b class="text-grey-500">{{ t.cek }}:</b> <span class="text-grey-400">{{ t.pesan }}</span></span>
        </div>
      </div>
    </div>

    <div class="rounded-lg border border-grey-200">
      <div class="flex items-center justify-between border-b border-grey-200 px-3 py-2 text-SM font-semibold text-grey-500">
        <span class="flex items-center gap-2"><PhGitDiff :size="18" class="text-opensimrs-300" aria-hidden="true" /> Perubahan berkas ({{ data?.berkas.length ?? 0 }})</span>
        <span v-if="data?.branch" class="font-mono text-[10px] text-grey-400">{{ data.branch }}{{ data.commitSha ? ` @ ${data.commitSha.slice(0, 7)}` : "" }}</span>
      </div>
      <div v-if="!data?.berkas.length" class="p-4 text-center text-XS text-grey-300">Belum ada perubahan berkas.</div>
      <div v-for="b in data?.berkas ?? []" :key="b.path" class="border-b border-grey-100 last:border-0">
        <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-XS hover:bg-grey-50" @click="terbuka = terbuka === b.path ? null : b.path">
          <PhCaretRight :size="12" :class="terbuka === b.path ? 'rotate-90' : ''" aria-hidden="true" />
          <span class="w-14 shrink-0 rounded bg-grey-75 px-1 text-center text-[10px]">{{ LABEL[b.status] ?? b.status }}</span>
          <span class="grow truncate text-grey-500">{{ b.path }}</span>
          <span class="text-success-400">+{{ b.tambah }}</span>
          <span class="text-danger-300">−{{ b.hapus }}</span>
        </button>
        <div v-if="terbuka === b.path" class="max-h-96 overflow-auto bg-grey-50 font-mono text-[11px]">
          <div v-for="(baris, i) in b.patch.split('\n')" :key="i" class="whitespace-pre px-3" :class="kelasBaris(baris)">{{ baris || " " }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
