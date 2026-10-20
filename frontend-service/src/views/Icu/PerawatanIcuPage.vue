<script setup lang="ts">
import { onMounted, ref, watch, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import SerahTerimaICU from "@/components/RawatInap/ICU/SerahTerimaICU.vue";
import FlowsheetICU from "@/components/RawatInap/ICU/FlowsheetICU.vue";
import BalanceCairan from "@/components/RawatInap/ICU/BalanceCairan.vue";
import SkorSOFA from "@/components/RawatInap/ICU/SkorSOFA.vue";
import DialogMulaiIntensif from "@/components/RawatInap/ICU/DialogMulaiIntensif.vue";
import { utilsStore } from "@/stores/utils";
import { useIcuStore } from "@/stores/rawatInap/icu";

// Halaman kerja perawatan ICU: pilih pasien aktif di ruang intensif, lalu kelola serah terima, flowsheet, balance
// cairan & skor SOFA dalam satu halaman (Desain Teknis STD-0008 — PerawatanIcuPage menaungi komponen per fitur).
import { hasPermission } from "@/utils/permissions";
import { fiturAktif } from "@/stores/modulFaskes";
import { useAuthStore } from "@/stores/auth";
import DokumentasiIcu from "@/components/RawatInap/ICU/DokumentasiIcu.vue";
const layanan = ref<any[]>([]); const templates = ref<any[]>([]); const kelengkapan = ref<any>(null); const riwayat = ref<any[]>([]);
const halamanTemplate = ref(1); const totalTemplate = ref(0);
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
    const dipilih = perawatanUuid.value;
    detail.value = null; kelengkapan.value = null; riwayat.value = [];
    const res = await icuStore.getPerawatan(dipilih);
    if (dipilih !== perawatanUuid.value) return;
    detail.value = res?.payload ?? null;
    if (hasPermission("ICU", "Perawatan", "READ")) riwayat.value = (await icuStore.getRiwayat(dipilih))?.payload?.data ?? [];
    await muatKelengkapan();
  } finally {
    storeUtils.setLoading(false);
  }
};

const muatKelengkapan = async () => {
  if (!perawatanUuid.value || !hasPermission("ICU", "Kelengkapan Dokumentasi", "READ") || !fiturAktif("icu_kelengkapan_dokumentasi")) return;
  const id = perawatanUuid.value;
  const r = await icuStore.getKelengkapan(id);
  if (id === perawatanUuid.value) kelengkapan.value = r?.payload;
};
watch(perawatanUuid, muatDetail);
const bersihkan = () => { perawatanUuid.value = ""; detail.value = null; daftarAktif.value = []; riwayat.value = []; kelengkapan.value = null; templates.value = []; layanan.value = []; dialogMulai.value = false; formMulai.value = kosongMulai(); };
const lepasLangganan = useAuthStore().$subscribe(bersihkan, { flush: "sync" });
onBeforeUnmount(() => { lepasLangganan(); bersihkan(); });

const selesaiKeluarIcu = async () => {
  await muatDaftarAktif();
  perawatanUuid.value = "";
};

// ── Mulai perawatan ICU baru (tertaut ke perpindahan yang sudah approve di Rawat Inap)
const dialogMulai = ref(false);
const kosongMulai = () => ({ layananKode: "umum", templateVersiUuid: "" });
const formMulai = ref(kosongMulai());
const muatPilihanTemplate = async (lanjut = false) => {
  if (lanjut) halamanTemplate.value++;
  else { halamanTemplate.value = 1; templates.value = []; }
  const kode = formMulai.value.layananKode;
  const res = await icuStore.getTemplate({ layananKode: kode, halaman: halamanTemplate.value }, true);
  if (kode !== formMulai.value.layananKode) return;
  templates.value = lanjut ? [...templates.value, ...(res?.payload?.data ?? [])] : res?.payload?.data ?? [];
  totalTemplate.value = res?.payload?.total ?? 0;
};
const bukaDialogMulai = async () => {
  layanan.value = (await icuStore.getLayanan(true))?.payload?.layanan ?? [];
  formMulai.value = kosongMulai();
  formMulai.value.layananKode = layanan.value[0]?.kode ?? "umum";
  await muatPilihanTemplate();
  dialogMulai.value = true;
};
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
          <CustomButton v-if="hasPermission('ICU', 'Serah Terima', 'KELOLA')" label="Mulai Perawatan ICU Baru" icon="PhPlus" @click="bukaDialogMulai" />
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
          <p>{{ detail.layanan?.nama }} - Template {{ detail.template?.nama ?? 'Belum memakai template' }} - Versi {{ detail.template?.nomorVersi ?? '-' }}</p>
          <div v-if="kelengkapan"><b>Kelengkapan: {{ kelengkapan.status }}</b><p v-for="(k, i) in kelengkapan.kekurangan" :key="i">{{ k.sumber }} - {{ k.parameter.join(', ') }} - {{ new Date(k.dari * 1000).toLocaleString('id-ID') }}{{ k.periodeBerjalan ? ' (periode berjalan)' : '' }}</p></div>
          <details v-if="detail.referensiIntegrasi"><summary>Referensi kesinambungan perawatan</summary><p>Episode ICU: {{ detail.referensiIntegrasi.perawatanUuid }}</p><p>Admisi Rawat Inap: {{ detail.referensiIntegrasi.rawatInapUuid }}</p><p>Rekam medis: {{ detail.referensiIntegrasi.rekamMedisUuid ?? 'Belum tersedia' }}</p></details>
          <details><summary>Riwayat perawatan dan perpindahan</summary><p v-for="r in riwayat" :key="r.uuid">{{ r.layananKode ?? 'Belum diklasifikasikan' }} - {{ new Date(Number(r.waktuMasuk) * 1000).toLocaleString('id-ID') }} - Masuk {{ r.perpindahanMasukUuid }} - Keluar {{ r.perpindahanKeluarUuid ?? '-' }}</p></details>
          <Tabs value="serah-terima">
            <TabList>
              <Tab v-if="hasPermission('ICU', 'Serah Terima', 'READ')" value="serah-terima">Serah Terima</Tab>
              <Tab v-if="hasPermission('ICU', 'Flowsheet Observasi', 'READ')" value="flowsheet">Flowsheet Observasi</Tab>
              <Tab v-if="hasPermission('ICU', 'Balance Cairan', 'READ')" value="balance">Balance Cairan</Tab>
              <Tab v-if="hasPermission('ICU', 'Skor SOFA', 'READ')" value="sofa">Skor SOFA</Tab>
              <Tab v-if="fiturAktif('icu_dokumentasi_klinis') && hasPermission('ICU', 'Dokumentasi Klinis', 'READ')" value="dokumentasi">Dokumentasi Klinis</Tab>
            </TabList>
            <TabPanels>
              <TabPanel v-if="hasPermission('ICU', 'Serah Terima', 'READ')" value="serah-terima">
                <SerahTerimaICU
                  :perawatan-uuid="perawatanUuid"
                  :status="detail.perawatan.status"
                  :serah-terima="detail.serahTerima ?? []"
                  @selesai="selesaiKeluarIcu"
                />
              </TabPanel>
              <TabPanel v-if="hasPermission('ICU', 'Flowsheet Observasi', 'READ')" value="flowsheet"><FlowsheetICU :key="perawatanUuid" :perawatan-uuid="perawatanUuid" :template="detail.template" @tersimpan="muatKelengkapan" /></TabPanel>
              <TabPanel v-if="hasPermission('ICU', 'Balance Cairan', 'READ')" value="balance"><BalanceCairan :perawatan-uuid="perawatanUuid" /></TabPanel>
              <TabPanel v-if="hasPermission('ICU', 'Skor SOFA', 'READ')" value="sofa"><SkorSOFA :perawatan-uuid="perawatanUuid" /></TabPanel>
              <TabPanel v-if="fiturAktif('icu_dokumentasi_klinis') && hasPermission('ICU', 'Dokumentasi Klinis', 'READ')" value="dokumentasi"><DokumentasiIcu :key="perawatanUuid" :perawatan-uuid="perawatanUuid" :template="detail.template" :status="detail.perawatan.status" @tersimpan="muatKelengkapan" /></TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </template>
    </Card>

    <DialogMulaiIntensif v-model:visible="dialogMulai" basis="/icu" label="ICU" :data-tambahan="{ layananKode: formMulai.layananKode, templateVersiUuid: formMulai.templateVersiUuid || undefined }" @dimulai="setelahMulai">
      <template #konfigurasi>
        <CustomSelect v-model="formMulai.layananKode" label="Layanan ICU" :options="layanan" optionValue="kode" optionLabel="nama" @update:modelValue="formMulai.templateVersiUuid = ''; muatPilihanTemplate()" />
        <CustomSelect v-model="formMulai.templateVersiUuid" label="Versi template" :options="templates.filter((t) => t.layananKode === formMulai.layananKode).map((t) => ({ ...t, namaPilihan: `${t.nama} (versi ${t.nomorVersi})` }))" optionValue="uuid" optionLabel="namaPilihan" />
        <CustomButton v-if="templates.length < totalTemplate" label="Muat Versi Lainnya" @click="muatPilihanTemplate(true)" />
      </template>
    </DialogMulaiIntensif>
  </div>
</template>
