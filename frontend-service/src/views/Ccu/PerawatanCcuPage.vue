<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import SerahTerimaICU from "@/components/RawatInap/ICU/SerahTerimaICU.vue";
import FlowsheetICU from "@/components/RawatInap/ICU/FlowsheetICU.vue";
import BalanceCairan from "@/components/RawatInap/ICU/BalanceCairan.vue";
import DialogMulaiIntensif from "@/components/RawatInap/ICU/DialogMulaiIntensif.vue";
import KlinisKardiakCCU from "@/components/RawatInap/CCU/KlinisKardiakCCU.vue";
import EkgCCU from "@/components/RawatInap/CCU/EkgCCU.vue";
import PenandaJantungCCU from "@/components/RawatInap/CCU/PenandaJantungCCU.vue";
import SkorRisikoCCU from "@/components/RawatInap/CCU/SkorRisikoCCU.vue";
import IntervensiCCU from "@/components/RawatInap/CCU/IntervensiCCU.vue";
import { utilsStore } from "@/stores/utils";
import { useCcuStore, LABEL_SINDROM } from "@/stores/rawatInap/ccu";

// Halaman kerja perawatan CCU: pilih pasien aktif CCU, lalu kelola data klinis kardiak, EKG & irama, penanda jantung,
// skor risiko, intervensi kardiak, flowsheet, balance cairan, dan serah terima dalam satu halaman. Komponen flowsheet,
// balance, serah terima, dan mulai perawatan dipakai bersama ICU (basis "/ccu").
const storeUtils = utilsStore();
const ccuStore = useCcuStore();
const route = useRoute();

const daftarAktif = ref<any[]>([]);
const perawatanUuid = ref<string>("");
const detail = ref<any>(null);
const klinis = ref<any>(null);

const muatDaftarAktif = async () => {
  const res = await ccuStore.getDashboard();
  daftarAktif.value = (res?.payload ?? []).map((p: any) => ({ ...p, labelPilihan: `${p.namaPasien ?? "-"} · ${p.noRm ?? "-"} · Bed ${p.bed?.noBed ?? "-"}` }));
};

const muatDetail = async () => {
  if (!perawatanUuid.value) {
    detail.value = null;
    klinis.value = null;
    return;
  }
  storeUtils.setLoading(true);
  try {
    const [res, resKlinis] = await Promise.all([ccuStore.getPerawatan(perawatanUuid.value), ccuStore.getKlinis(perawatanUuid.value)]);
    detail.value = res?.payload ?? null;
    klinis.value = resKlinis?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};

watch(perawatanUuid, muatDetail);

const selesaiKeluar = async () => {
  await muatDaftarAktif();
  perawatanUuid.value = "";
};

const dialogMulai = ref(false);
const setelahMulai = async (perawatan: any) => {
  await muatDaftarAktif();
  perawatanUuid.value = perawatan.uuid;
};

onMounted(async () => {
  await muatDaftarAktif();
  const queryPerawatan = route.query.perawatan;
  if (typeof queryPerawatan === "string") perawatanUuid.value = queryPerawatan;
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Perawatan CCU</h1>
          <CustomSelect
            v-model="perawatanUuid"
            label="Pasien aktif CCU"
            placeHolder="Pilih pasien"
            :options="daftarAktif"
            optionValue="perawatanUuid"
            optionLabel="labelPilihan"
            class="min-w-[300px]"
          />
          <CustomButton label="Mulai Perawatan CCU Baru" icon="PhPlus" @click="dialogMulai = true" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!detail" />
        <div v-else class="flex flex-col h-full gap-3 p-4 overflow-auto">
          <div class="p-3 text-sm border rounded-lg border-grey-75 bg-opensimrs-50">
            <b>{{ detail.rawatInap?.name ?? detail.rawatInap?.patient?.name }}</b>
            · No. RM {{ detail.rawatInap?.noRm }}
            · {{ detail.perawatan.diagnosisRingkas || "Diagnosis belum diisi" }}
            <span v-if="klinis"> · {{ LABEL_SINDROM[klinis.sindrom] ?? klinis.sindrom }}<span v-if="klinis.kelasKillip"> · Killip {{ klinis.kelasKillip }}</span></span>
            · Status: <span class="font-semibold">{{ detail.perawatan.status === "aktif" ? "Aktif di CCU" : "Sudah keluar CCU" }}</span>
          </div>
          <Tabs value="klinis">
            <TabList>
              <Tab value="klinis">Data Klinis</Tab>
              <Tab value="ekg">EKG & Irama</Tab>
              <Tab value="penanda">Penanda Jantung</Tab>
              <Tab value="skor">Skor Risiko</Tab>
              <Tab value="intervensi">Intervensi Kardiak</Tab>
              <Tab value="flowsheet">Flowsheet Observasi</Tab>
              <Tab value="balance">Balance Cairan</Tab>
              <Tab value="serah-terima">Serah Terima</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="klinis"><KlinisKardiakCCU :perawatan-uuid="perawatanUuid" @tersimpan="muatDetail" /></TabPanel>
              <TabPanel value="ekg"><EkgCCU :perawatan-uuid="perawatanUuid" :aktif="detail.perawatan.status === 'aktif'" /></TabPanel>
              <TabPanel value="penanda"><PenandaJantungCCU :perawatan-uuid="perawatanUuid" :aktif="detail.perawatan.status === 'aktif'" /></TabPanel>
              <TabPanel value="skor"><SkorRisikoCCU :perawatan-uuid="perawatanUuid" :aktif="detail.perawatan.status === 'aktif'" /></TabPanel>
              <TabPanel value="intervensi"><IntervensiCCU :perawatan-uuid="perawatanUuid" :aktif="detail.perawatan.status === 'aktif'" /></TabPanel>
              <TabPanel value="flowsheet"><FlowsheetICU :perawatan-uuid="perawatanUuid" basis="/ccu" /></TabPanel>
              <TabPanel value="balance"><BalanceCairan :perawatan-uuid="perawatanUuid" basis="/ccu" /></TabPanel>
              <TabPanel value="serah-terima">
                <SerahTerimaICU
                  :perawatan-uuid="perawatanUuid"
                  :status="detail.perawatan.status"
                  :serah-terima="detail.serahTerima ?? []"
                  basis="/ccu"
                  label="CCU"
                  @selesai="selesaiKeluar"
                />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </template>
    </Card>

    <DialogMulaiIntensif v-model:visible="dialogMulai" basis="/ccu" label="CCU" @dimulai="setelahMulai" />
  </div>
</template>
