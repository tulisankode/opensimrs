<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useCcuStore, LABEL_SINDROM, LABEL_IRAMA, LABEL_PENANDA, LABEL_INTERVENSI, IRAMA_BERBAHAYA, tampilWaktu } from "@/stores/rawatInap/ccu";

// Dasbor CCU: satu kartu per bed CCU terisi — tanda vital terakhir & peringatan nilai kritis (sama dengan ICU) ditambah
// ringkasan kardiak: sindrom, Killip, EKG terakhir, troponin terakhir + delta, skor risiko, intervensi terakhir.
const storeUtils = utilsStore();
const ccuStore = useCcuStore();
const router = useRouter();

const data = ref<any[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [res, resKardiak] = await Promise.all([ccuStore.getDashboard(), ccuStore.getDashboardKardiak()]);
    const kardiak = resKardiak?.payload ?? {};
    data.value = (res?.payload ?? []).map((p: any) => {
      const k = kardiak[p.perawatanUuid] ?? {};
      return { ...p, kardiak: k, semuaPeringatan: [...(k.peringatan ?? []), ...(p.peringatan ?? [])] };
    });
  } finally {
    storeUtils.setLoading(false);
  }
};

const bukaPerawatan = (perawatanUuid: string) => router.push({ path: "/ccu/perawatan", query: { perawatan: perawatanUuid } });
const skorTeks = (s: any) => (s.jenis === "killip" ? `Killip ${s.totalSkor}` : `${s.jenis === "timi_nste" ? "TIMI NSTE" : "TIMI STEMI"} ${s.totalSkor} (${s.kategori})`);

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Dasbor CCU</h1>
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <div v-else class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="p in data"
            :key="p.perawatanUuid"
            class="flex flex-col gap-2 p-4 border rounded-lg cursor-pointer border-grey-75 hover:border-opensimrs-300"
            @click="bukaPerawatan(p.perawatanUuid)"
          >
            <div class="flex items-start justify-between">
              <div>
                <div class="font-semibold">{{ p.namaPasien ?? "-" }}</div>
                <div class="text-xs text-grey-400">{{ p.noRm }} · Bed {{ p.bed?.noBed ?? "-" }} ({{ p.bed?.ruangan ?? "-" }})</div>
              </div>
              <span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-opensimrs-50 text-opensimrs-300">Hari ke-{{ p.hariRawat }}</span>
            </div>
            <div class="text-sm text-grey-500">
              {{ p.kardiak.klinis ? LABEL_SINDROM[p.kardiak.klinis.sindrom] ?? p.kardiak.klinis.sindrom : p.diagnosisRingkas || "Sindrom belum diisi" }}
              <span v-if="p.kardiak.klinis?.kelasKillip"> · Killip {{ p.kardiak.klinis.kelasKillip }}</span>
            </div>
            <div class="text-xs">
              <span class="font-semibold">EKG:</span>
              <template v-if="p.kardiak.ekgTerakhir">
                <span :class="IRAMA_BERBAHAYA.includes(p.kardiak.ekgTerakhir.irama) ? 'font-semibold text-danger-400' : ''">
                  {{ LABEL_IRAMA[p.kardiak.ekgTerakhir.irama] ?? p.kardiak.ekgTerakhir.irama }}
                </span>
                · {{ p.kardiak.ekgTerakhir.lajuJantung ?? "-" }}x/mnt · {{ tampilWaktu(p.kardiak.ekgTerakhir.waktuRekam) }}
              </template>
              <span v-else class="text-grey-400">belum ada</span>
            </div>
            <div class="text-xs">
              <span class="font-semibold">Troponin:</span>
              <template v-if="p.kardiak.troponinTerakhir">
                <span :class="p.kardiak.troponinTerakhir.diAtasBatas ? 'font-semibold text-danger-400' : ''">
                  {{ LABEL_PENANDA[p.kardiak.troponinTerakhir.jenis] }} {{ Number(p.kardiak.troponinTerakhir.nilai) }} {{ p.kardiak.troponinTerakhir.satuan }}
                </span>
                <span v-if="p.kardiak.troponinTerakhir.deltaPersen !== null"> (Δ {{ p.kardiak.troponinTerakhir.deltaPersen }}%)</span>
              </template>
              <span v-else class="text-grey-400">belum ada</span>
            </div>
            <div v-if="p.kardiak.skor?.length" class="flex flex-wrap gap-1 text-xs">
              <span v-for="s in p.kardiak.skor" :key="s.jenis" class="px-2 py-0.5 rounded-full bg-grey-50">{{ skorTeks(s) }}</span>
            </div>
            <div v-if="p.kardiak.intervensiTerakhir" class="text-xs text-grey-500">
              Intervensi terakhir: {{ LABEL_INTERVENSI[p.kardiak.intervensiTerakhir.jenis] ?? p.kardiak.intervensiTerakhir.jenis }} ·
              {{ tampilWaktu(p.kardiak.intervensiTerakhir.waktuMulai) }}
            </div>
            <div v-if="p.observasiTerakhir" class="grid grid-cols-2 text-xs gap-x-2 text-grey-500">
              <span>TD: {{ p.observasiTerakhir.tekananSistolik ?? "-" }}/{{ p.observasiTerakhir.tekananDiastolik ?? "-" }}</span>
              <span>Nadi: {{ p.observasiTerakhir.nadi ?? "-" }}</span>
              <span>SpO2: {{ p.observasiTerakhir.spo2 ?? "-" }}%</span>
              <span>Suhu: {{ p.observasiTerakhir.suhu ?? "-" }}°C</span>
            </div>
            <div v-else class="text-xs text-grey-400">Belum ada observasi</div>
            <div v-if="p.semuaPeringatan.length" class="flex flex-col gap-1">
              <span v-for="(pe, i) in p.semuaPeringatan" :key="i" class="px-2 py-0.5 text-xs font-semibold rounded bg-danger-50 text-danger-400">{{ pe }}</span>
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
