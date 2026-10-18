<script setup lang="ts">
// Beranda SIMRS Studio: papan item per tahap + ringkasan (termasuk kuota langganan Claude).
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiStudioGet } from "@/utils/apiHandler";
import { NAMA_JENIS, TAHAP, WARNA_RISIKO, agenBekerja, formatUsd, formatWaktu, keteranganTunggu, nomorItem, ringkasKuota } from "../umum";

const router = useRouter();
const items = ref<any[]>([]);
const sistem = ref<any>(null);
const tampilSelesai = ref(false);
let pewaktu: ReturnType<typeof setInterval> | undefined;

const muat = async () => {
  const [a, b] = await Promise.all([apiStudioGet("/item", true), apiStudioGet("/sistem", true)]);
  items.value = a?.payload ?? [];
  sistem.value = b?.payload ?? null;
};
onMounted(() => {
  muat();
  pewaktu = setInterval(muat, 10000);
});
onBeforeUnmount(() => clearInterval(pewaktu));

const kolom = computed(() => [
  ...TAHAP.map((t) => ({ kode: t.kode, nama: t.nama, item: items.value.filter((i) => i.tahap === t.kode) })),
  ...(tampilSelesai.value
    ? [{ kode: "selesai", nama: "Selesai / batal", item: items.value.filter((i) => ["selesai", "dibatalkan"].includes(i.tahap)) }]
    : []),
]);

const kuota = computed(() => ringkasKuota(sistem.value?.kuota));
const tunggu = (i: any) => keteranganTunggu(i.statusTugas, i.lanjutPadaTugas, i.menungguSlotTugas);
const jumlahMenunggu = computed(() => items.value.filter((i) => tunggu(i)).length);
const ringkasan = computed(() => [
  { label: "Item berjalan", nilai: items.value.filter((i) => !["selesai", "dibatalkan"].includes(i.tahap)).length, ikon: "PhKanban" },
  {
    label: jumlahMenunggu.value ? `Agen sedang bekerja (${jumlahMenunggu.value} menunggu kuota/slot)` : "Agen sedang bekerja",
    nilai: items.value.filter((i) => agenBekerja(i.statusTugas, i.menungguSlotTugas)).length,
    ikon: "PhRobot",
  },
  { label: "Selesai", nilai: items.value.filter((i) => i.tahap === "selesai").length, ikon: "PhRocketLaunch" },
  {
    label: kuota.value ? `Kuota langganan (${kuota.value.jenis})` : "Kuota langganan",
    nilai: kuota.value?.persen != null ? `${kuota.value.persen}% terpakai` : "-",
    ikon: "PhGauge",
  },
]);
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full">
    <template #header>
      <PageToolbar>
        <h1 class="toolbar-heading text-opensimrs-300">Beranda Studio</h1>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-1 text-XS text-grey-400"><input v-model="tampilSelesai" type="checkbox" /> Tampilkan selesai</label>
          <CustomButton label="Permintaan Baru" icon="PhPlus" @click="router.push('/studio/permintaan-baru')" />
        </div>
      </PageToolbar>
    </template>
    <template #content>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div v-for="r in ringkasan" :key="r.label" class="flex items-center gap-3 rounded-lg bg-opensimrs-50 p-3">
          <component :is="r.ikon" :size="28" weight="duotone" class="text-opensimrs-300" aria-hidden="true" />
          <div>
            <div class="text-heading font-bold text-grey-500">{{ r.nilai }}</div>
            <div class="text-XS text-grey-400">{{ r.label }}</div>
          </div>
        </div>
      </div>
      <div v-if="sistem" class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-grey-400">
        <span class="flex items-center gap-1"><PhTerminalWindow :size="14" aria-hidden="true" /> {{ sistem.claude.terpasang ? sistem.claude.versi : sistem.claude.pesan }}</span>
        <span class="flex items-center gap-1"><PhGitBranch :size="14" aria-hidden="true" /> {{ sistem.branch }}</span>
        <span v-if="kuota?.reset">Kuota direset {{ kuota.reset }}</span>
        <span>Pemakaian 30 hari ≈ {{ formatUsd(sistem.biaya30Hari?.total) }} (setara harga API)</span>
      </div>

      <div class="mt-4 grid min-w-[1100px] gap-3" :style="{ gridTemplateColumns: `repeat(${kolom.length}, minmax(0, 1fr))` }">
        <div v-for="k in kolom" :key="k.kode" class="flex flex-col gap-2 rounded-lg bg-grey-75 p-2">
          <div class="flex items-center justify-between px-1 text-SM font-semibold text-grey-500">
            {{ k.nama }}
            <span class="rounded-full bg-white px-2 text-XS">{{ k.item.length }}</span>
          </div>
          <button
            v-for="i in k.item"
            :key="i.uuid"
            type="button"
            class="flex flex-col gap-1.5 rounded-lg bg-white p-2.5 text-left shadow-sm hover:ring-1 hover:ring-opensimrs-300"
            @click="router.push(`/studio/item/${i.uuid}`)"
          >
            <div class="flex items-center justify-between text-[10px] text-grey-400">
              <span class="font-semibold">{{ nomorItem(i.nomor) }} · {{ NAMA_JENIS[i.jenis] ?? i.jenis }}</span>
              <span class="rounded px-1.5 font-semibold capitalize" :class="WARNA_RISIKO[i.risiko]">{{ i.risiko }}</span>
            </div>
            <div class="text-SM font-semibold leading-tight text-grey-500">{{ i.judul }}</div>
            <div class="flex items-center justify-between text-[10px] text-grey-400">
              <span class="flex items-center gap-1">
                <PhHourglassMedium v-if="tunggu(i)" :size="12" class="text-warning-400" aria-hidden="true" />
                <PhSpinnerGap v-else-if="agenBekerja(i.statusTugas, i.menungguSlotTugas)" :size="12" class="animate-spin text-opensimrs-300" aria-hidden="true" />
                <PhWarningCircle v-else-if="i.statusTugas === 'gagal'" :size="12" class="text-danger-300" aria-hidden="true" />
                {{ i.prioritas }}<template v-if="i.tahap === 'dibatalkan'"> · dibatalkan</template>
              </span>
              <span>{{ formatWaktu(i.updatedAt) }}</span>
            </div>
            <div v-if="tunggu(i)" class="rounded bg-warning-50 px-1.5 py-0.5 text-[10px] text-warning-400">{{ tunggu(i) }}</div>
          </button>
          <div v-if="!k.item.length" class="py-4 text-center text-XS text-grey-300">Kosong</div>
        </div>
      </div>
    </template>
  </Card>
</template>
