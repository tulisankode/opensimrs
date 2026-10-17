<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import SerahTerimaICU from "@/components/RawatInap/ICU/SerahTerimaICU.vue";
import FlowsheetICU from "@/components/RawatInap/ICU/FlowsheetICU.vue";
import BalanceCairan from "@/components/RawatInap/ICU/BalanceCairan.vue";
import SkorSOFA from "@/components/RawatInap/ICU/SkorSOFA.vue";
import { utilsStore } from "@/stores/utils";
import { useIcuStore } from "@/stores/rawatInap/icu";

// Halaman kerja perawatan ICU: pilih pasien aktif di ruang intensif, lalu kelola serah terima, flowsheet, balance
// cairan & skor SOFA dalam satu halaman (Desain Teknis STD-0008 — PerawatanIcuPage menaungi komponen per fitur).
const storeUtils = utilsStore();
const icuStore = useIcuStore();
const route = useRoute();

const daftarAktif = ref<any[]>([]);
const perawatanUuid = ref<string>("");
const detail = ref<any>(null);

const muatDaftarAktif = async () => {
  const res = await icuStore.getDashboard();
  daftarAktif.value = res?.payload ?? [];
};

const muatDetail = async () => {
  if (!perawatanUuid.value) {
    detail.value = null;
    return;
  }
  storeUtils.setLoading(true);
  try {
    const res = await icuStore.getPerawatan(perawatanUuid.value);
    detail.value = res?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};

watch(perawatanUuid, muatDetail);

const selesaiKeluarIcu = async () => {
  await muatDaftarAktif();
  perawatanUuid.value = "";
};

// ── Mulai perawatan ICU baru (tertaut ke perpindahan yang sudah approve di Rawat Inap)
const dialogMulai = ref(false);
const kosongMulai = () => ({
  perpindahanUuid: "",
  diagnosisRingkas: "",
  kriteria: "",
  kondisi: "",
  tindakan: "",
  terapiBerjalan: "",
  alergiRelevan: "",
  aksesAlat: "",
  tindakLanjut: "",
});
const formMulai = ref(kosongMulai());
const galatMulai = ref("");
const bukaDialogMulai = () => {
  formMulai.value = kosongMulai();
  galatMulai.value = "";
  dialogMulai.value = true;
};
const simpanMulai = async () => {
  galatMulai.value = "";
  if (!formMulai.value.perpindahanUuid.trim()) return (galatMulai.value = "UUID perpindahan (sudah approve di Rawat Inap) wajib diisi");
  storeUtils.setLoading(true);
  try {
    const f = formMulai.value;
    const res = await icuStore.mulaiPerawatan(f.perpindahanUuid.trim(), {
      diagnosisRingkas: f.diagnosisRingkas || undefined,
      serahTerima: {
        kriteria: f.kriteria || undefined,
        kondisi: f.kondisi || undefined,
        tindakan: f.tindakan || undefined,
        terapiBerjalan: f.terapiBerjalan || undefined,
        alergiRelevan: f.alergiRelevan || undefined,
        aksesAlat: f.aksesAlat || undefined,
        tindakLanjut: f.tindakLanjut || undefined,
      },
    });
    if (res?.payload) {
      dialogMulai.value = false;
      await muatDaftarAktif();
      perawatanUuid.value = res.payload.uuid;
    }
  } finally {
    storeUtils.setLoading(false);
  }
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
          <h1 class="toolbar-heading text-opensimrs-300">Perawatan ICU</h1>
          <CustomSelect
            v-model="perawatanUuid"
            label="Pasien aktif ICU"
            placeHolder="Pilih pasien"
            :options="daftarAktif"
            optionValue="perawatanUuid"
            optionLabel="namaPasien"
            class="min-w-[260px]"
          />
          <CustomButton label="Mulai Perawatan ICU Baru" icon="PhPlus" @click="bukaDialogMulai" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!detail" />
        <div v-else class="flex flex-col h-full gap-3 p-4 overflow-auto">
          <div class="p-3 text-sm border rounded-lg border-grey-75 bg-opensimrs-50">
            <b>{{ detail.rawatInap?.name ?? detail.rawatInap?.patient?.name }}</b>
            · No. RM {{ detail.rawatInap?.noRm }}
            · {{ detail.perawatan.diagnosisRingkas || "Diagnosis belum diisi" }}
            · Status: <span class="font-semibold">{{ detail.perawatan.status === "aktif" ? "Aktif di ICU" : "Sudah keluar ICU" }}</span>
          </div>
          <Tabs value="serah-terima">
            <TabList>
              <Tab value="serah-terima">Serah Terima</Tab>
              <Tab value="flowsheet">Flowsheet Observasi</Tab>
              <Tab value="balance">Balance Cairan</Tab>
              <Tab value="sofa">Skor SOFA</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="serah-terima">
                <SerahTerimaICU
                  :perawatan-uuid="perawatanUuid"
                  :status="detail.perawatan.status"
                  :serah-terima="detail.serahTerima ?? []"
                  @selesai="selesaiKeluarIcu"
                />
              </TabPanel>
              <TabPanel value="flowsheet"><FlowsheetICU :perawatan-uuid="perawatanUuid" /></TabPanel>
              <TabPanel value="balance"><BalanceCairan :perawatan-uuid="perawatanUuid" /></TabPanel>
              <TabPanel value="sofa"><SkorSOFA :perawatan-uuid="perawatanUuid" /></TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogMulai" width="620px">
      <template #header>Mulai Perawatan ICU — Serah Terima Masuk</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-xs text-grey-400">
            Ajukan dan setujui perpindahan ke bed ICU terlebih dahulu di Rawat Inap › Perpindahan Bangsal, lalu masukkan UUID perpindahan yang sudah berstatus approve.
          </div>
          <CustomTextfield v-model="formMulai.perpindahanUuid" label="UUID Perpindahan" />
          <CustomTextfield v-model="formMulai.diagnosisRingkas" label="Diagnosis ringkas" :maxLength="500" />
          <CustomTextArea v-model="formMulai.kriteria" label="Kriteria masuk ICU" />
          <CustomTextArea v-model="formMulai.kondisi" label="Kondisi terkini" />
          <CustomTextArea v-model="formMulai.tindakan" label="Tindakan yang sudah dilakukan" />
          <CustomTextArea v-model="formMulai.terapiBerjalan" label="Obat/terapi yang sedang berjalan" />
          <CustomTextArea v-model="formMulai.alergiRelevan" label="Alergi relevan" />
          <CustomTextArea v-model="formMulai.aksesAlat" label="Akses/alat terpasang" />
          <CustomTextArea v-model="formMulai.tindakLanjut" label="Hal yang perlu dipantau" />
          <div v-if="galatMulai" class="text-sm text-danger-300">{{ galatMulai }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogMulai = false" />
          <CustomButton label="Mulai Perawatan ICU" @click="simpanMulai" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
