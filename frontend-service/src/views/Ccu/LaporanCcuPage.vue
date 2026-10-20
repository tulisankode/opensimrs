<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useCcuStore, LABEL_SINDROM, LABEL_INTERVENSI } from "@/stores/rawatInap/ccu";

// Laporan CCU: indikator dasar ruang intensif (BOR, ALOS, angka kematian — definisi sama dengan ICU, dibatasi unit CCU)
// ditambah indikator kardiak: distribusi sindrom & Killip, door-to-balloon/needle STEMI, dan jumlah intervensi.
const storeUtils = utilsStore();
const ccuStore = useCcuStore();

const dari = ref<Date>(new Date(new Date().setDate(new Date().getDate() - 30)));
const sampai = ref<Date>(new Date());
const dasar = ref<any>(null);
const kardiak = ref<any>(null);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const d = Math.floor(dari.value.getTime() / 1000);
    const s = Math.floor(sampai.value.getTime() / 1000);
    const [resDasar, resKardiak] = await Promise.all([ccuStore.getLaporan(d, s), ccuStore.getLaporanKardiak(d, s)]);
    dasar.value = resDasar?.payload ?? null;
    kardiak.value = resKardiak?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};

const persen = (v: number | null | undefined) => (v === null || v === undefined ? "-" : `${v}%`);

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Laporan CCU</h1>
          <CustomDatePicker v-model="dari" label="Dari" />
          <CustomDatePicker v-model="sampai" label="Sampai" />
          <CustomButton label="Tampilkan" icon="PhMagnifyingGlass" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!dasar && !kardiak" />
        <div v-else class="flex flex-col gap-4 p-4">
          <div v-if="dasar" class="grid grid-cols-4 gap-3">
            <div class="p-4 text-center border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">BOR CCU</div>
              <div class="text-2xl font-semibold">{{ persen(dasar.bor) }}</div>
            </div>
            <div class="p-4 text-center border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">ALOS (hari)</div>
              <div class="text-2xl font-semibold">{{ dasar.alos ?? "-" }}</div>
            </div>
            <div class="p-4 text-center border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">Angka Kematian</div>
              <div class="text-2xl font-semibold">{{ persen(dasar.angkaKematian) }}</div>
            </div>
            <div class="p-4 text-center border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">Episode Masuk</div>
              <div class="text-2xl font-semibold">{{ kardiak?.jumlahEpisode ?? "-" }}</div>
            </div>
          </div>

          <div v-if="kardiak" class="grid grid-cols-3 gap-3">
            <div class="p-4 border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">Door-to-balloon (PCI primer STEMI)</div>
              <div class="text-2xl font-semibold">{{ kardiak.doorToBalloon.medianMenit ?? "-" }} <span class="text-sm">menit (median)</span></div>
              <div class="text-xs text-grey-500">
                {{ kardiak.doorToBalloon.jumlah }} kasus · ≤ {{ kardiak.doorToBalloon.targetMenit }} menit: {{ persen(kardiak.doorToBalloon.persenSesuaiTarget) }}
              </div>
            </div>
            <div class="p-4 border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">Door-to-needle (trombolisis STEMI)</div>
              <div class="text-2xl font-semibold">{{ kardiak.doorToNeedle.medianMenit ?? "-" }} <span class="text-sm">menit (median)</span></div>
              <div class="text-xs text-grey-500">
                {{ kardiak.doorToNeedle.jumlah }} kasus · ≤ {{ kardiak.doorToNeedle.targetMenit }} menit: {{ persen(kardiak.doorToNeedle.persenSesuaiTarget) }}
              </div>
            </div>
            <div class="p-4 border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">STEMI mendapat reperfusi</div>
              <div class="text-2xl font-semibold">{{ persen(kardiak.stemiReperfusi.persen) }}</div>
              <div class="text-xs text-grey-500">{{ kardiak.stemiReperfusi.mendapatReperfusi }} dari {{ kardiak.stemiReperfusi.stemi }} episode STEMI</div>
            </div>
          </div>

          <div v-if="kardiak" class="grid grid-cols-3 gap-3">
            <div class="col-span-2 p-4 border rounded-lg border-grey-75">
              <div class="mb-2 font-semibold">Distribusi Sindrom</div>
              <DataTable :value="kardiak.perSindrom" class="text-xs" stripedRows>
                <Column header="Sindrom" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ LABEL_SINDROM[d.sindrom] ?? (d.sindrom === "belum_diisi" ? "Belum diisi" : d.sindrom) }}</template></Column>
                <Column field="jumlah" header="Episode" headerClass="bg-opensimrs-50" />
                <Column field="selesai" header="Selesai" headerClass="bg-opensimrs-50" />
                <Column field="meninggal" header="Meninggal" headerClass="bg-opensimrs-50" />
              </DataTable>
            </div>
            <div class="p-4 border rounded-lg border-grey-75">
              <div class="mb-2 font-semibold">Kelas Killip Saat Masuk</div>
              <div v-for="k in ['1', '2', '3', '4']" :key="k" class="flex justify-between text-sm">
                <span>Killip {{ ["I", "II", "III", "IV"][Number(k) - 1] }}</span><span class="font-semibold">{{ kardiak.killip[k] ?? 0 }}</span>
              </div>
              <div class="flex justify-between text-sm text-grey-400"><span>Belum diisi</span><span>{{ kardiak.killip.belumDiisi ?? 0 }}</span></div>
              <div class="mt-3 mb-1 font-semibold">Intervensi</div>
              <div v-if="!kardiak.intervensi.length" class="text-xs text-grey-400">Belum ada</div>
              <div v-for="i in kardiak.intervensi" :key="i.jenis" class="flex justify-between text-sm">
                <span>{{ LABEL_INTERVENSI[i.jenis] ?? i.jenis }}</span><span class="font-semibold">{{ i.jumlah }}</span>
              </div>
            </div>
          </div>
          <div v-if="dasar" class="p-3 text-xs rounded-lg text-grey-400 bg-grey-25">{{ dasar.definisi }}</div>
          <div v-if="kardiak" class="p-3 text-xs rounded-lg text-grey-400 bg-grey-25">{{ kardiak.definisi }}</div>
        </div>
      </template>
    </Card>
  </div>
</template>
