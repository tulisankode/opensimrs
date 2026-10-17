<script setup lang="ts">
import { ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiTraining, labelSesi, type Ketersediaan, type SlotSesi } from "@/stores/penunjang/training";

// Ketersediaan slot kelas pada satu tanggal (GET /slot): per sesi untuk kelas bersesi, atau satu baris untuk kelas
// tanpa sesi. Tombol pilih memancarkan slot terpilih (sesiUuid null untuk kelas tanpa sesi).
const props = defineProps<{ kelasUuid?: string | null; tanggal?: string; labelPilih?: string; terpilih?: string | null }>();
const emit = defineEmits<{ (e: "pilih", slot: SlotSesi): void; (e: "dimuat", data: Ketersediaan | null): void }>();

const data = ref<Ketersediaan | null>(null);
const baris = ref<SlotSesi[]>([]);
const memuat = ref(false);

const muat = async () => {
  data.value = null;
  baris.value = [];
  if (!props.kelasUuid || !props.tanggal) return emit("dimuat", null);
  memuat.value = true;
  try {
    const r = await apiTraining.slot(props.kelasUuid, props.tanggal);
    const k: Ketersediaan | null = r?.payload ?? null;
    data.value = k;
    baris.value = !k ? [] : k.isSesi ? k.sesi ?? [] : [{ sesiUuid: null, namaSesi: null, kuota: k.kuota ?? 0, terisi: k.terisi ?? 0, tersedia: k.tersedia ?? 0 }];
    emit("dimuat", k);
  } finally {
    memuat.value = false;
  }
};
watch(() => [props.kelasUuid, props.tanggal], muat, { immediate: true });
defineExpose({ muat });
</script>

<template>
  <div>
    <div v-if="!kelasUuid || !tanggal" class="p-4 text-xs text-center text-grey-400">Pilih kelas dan tanggal untuk melihat ketersediaan slot.</div>
    <div v-else-if="memuat" class="p-4 text-xs text-center text-grey-400">Memuat ketersediaan slot…</div>
    <div v-else-if="data?.isSesi && !baris.length" class="p-4 text-xs text-center text-grey-400">Kelas bersesi ini belum memiliki sesi. Lengkapi di Datamaster › Kelas.</div>
    <DataTable v-else-if="baris.length" :value="baris" stripedRows class="text-xs" tableStyle="min-width: 32rem">
      <Column header="Sesi" headerClass="bg-opensimrs-50">
        <template #body="{ data: s }">{{ s.namaSesi ? labelSesi(s) : "Tanpa sesi" }}</template>
      </Column>
      <Column field="kuota" header="Kuota" headerClass="bg-opensimrs-50" />
      <Column field="terisi" header="Terisi" headerClass="bg-opensimrs-50" />
      <Column header="Tersedia" headerClass="bg-opensimrs-50">
        <template #body="{ data: s }">
          <span class="px-2 py-0.5 rounded-full font-semibold" :class="s.tersedia > 0 ? 'bg-success-50 text-success-400' : 'bg-danger-50 text-danger-300'">
            {{ s.tersedia > 0 ? s.tersedia : "Penuh" }}
          </span>
        </template>
      </Column>
      <Column headerClass="bg-opensimrs-50">
        <template #header><div class="w-full font-semibold text-center">Aksi</div></template>
        <template #body="{ data: s }">
          <div class="flex justify-center">
            <CustomButton
              :label="terpilih !== undefined && (terpilih ?? null) === (s.sesiUuid ?? null) ? 'Terpilih' : labelPilih ?? 'Pilih'"
              :disabled="s.tersedia < 1"
              :background-color="s.tersedia > 0 ? 'bg-opensimrs-300' : 'bg-transparent'"
              :text-color="s.tersedia > 0 ? 'text-white' : 'text-grey-300'"
              size="small"
              class="px-2.5 h-[24px]"
              @click="emit('pilih', s)"
            />
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>
