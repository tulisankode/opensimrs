<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { daftarRecallCssd, gayaRecallCssd, gayaSetCssd, izinCssd, opsi, recallLoadCssd, referensiPilihanCssd, tindakLanjutRecallCssd, waktuRingkas } from "@/stores/penunjang/cssd";

// Recall: set terdampak dari satu load gagal, lokasi/unit terakhir, dan pemakaian pasien terkait (KF-22);
// pencatatan tindak lanjut per set (KF-23). Recall dibuat otomatis saat load dinyatakan gagal.
const storeUtils = utilsStore();
const route = useRoute();
const boleh = (aksi: string) => izinCssd("Recall", aksi);

const data = ref<any[]>([]);
const filterStatus = ref("");
const statusPenanganan = ref<Record<string, string>>({});

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    data.value = (await daftarRecallCssd({ status: filterStatus.value, limit: 100 }))?.payload?.data ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(async () => {
  const ref1 = await referensiPilihanCssd();
  statusPenanganan.value = ref1?.payload?.statusPenanganan ?? {};
  await muat();
  if (route.query.load) bukaDariLoad(route.query.load as string);
});

const dialogDetail = ref(false);
const detail = ref<any>(null);
const bukaDetail = async (baris: any) => {
  detail.value = (await recallLoadCssd(baris.loadUuid))?.payload;
  dialogDetail.value = true;
};
const bukaDariLoad = async (loadUuid: string) => {
  detail.value = (await recallLoadCssd(loadUuid))?.payload;
  dialogDetail.value = true;
};

const formTindakLanjut = ref<Record<string, { statusPenanganan: string; catatan: string }>>({});
const simpanTindakLanjut = async (s: any) => {
  const f = formTindakLanjut.value[s.uuid] ?? { statusPenanganan: s.statusPenanganan, catatan: "" };
  storeUtils.setLoading(true);
  try {
    const res = await tindakLanjutRecallCssd(detail.value.recall.uuid, s.uuid, f);
    if (res) {
      detail.value = (await recallLoadCssd(detail.value.load.uuid))?.payload;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Recall Load Gagal</h1>
          <CustomSelect
            v-model="filterStatus"
            label="Status"
            :options="[{ value: 'dibuka', label: 'Dibuka' }, { value: 'ditindaklanjuti', label: 'Ditindaklanjuti' }, { value: 'selesai', label: 'Selesai' }]"
            optionValue="value"
            optionLabel="label"
            placeHolder="Semua status"
            @update:modelValue="muat"
          />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex">
          <Column field="nomorLoad" header="Load" headerClass="bg-opensimrs-50" />
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaRecallCssd(d.status)?.bg, gayaRecallCssd(d.status)?.text]">{{ gayaRecallCssd(d.status)?.label }}</span>
            </template>
          </Column>
          <Column header="Set Belum Ditindaklanjuti" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.jumlahBelumDitindaklanjuti }} / {{ d.jumlahSet }}</template>
          </Column>
          <Column header="Dibuka" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuRingkas(d.waktuDibuka) }}</template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[100px]">
            <template #body="{ data: d }">
              <CustomButton label="Detail" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaDetail(d)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogDetail" width="900px">
      <template #header>Recall Load {{ detail?.load?.nomorLoad }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4">
          <div class="grid grid-cols-3 gap-3 text-sm">
            <div><span class="text-grey-400">Metode:</span> {{ detail.load.metode }}</div>
            <div><span class="text-grey-400">Indikator Kimia:</span> {{ detail.load.hasilIndikatorKimia ?? "-" }}</div>
            <div><span class="text-grey-400">Indikator Biologi:</span> {{ detail.load.hasilIndikatorBiologi ?? "-" }}</div>
          </div>

          <NoData v-if="!detail.set?.length" />
          <div v-for="s in detail.set" :key="s.uuid" class="p-3 border rounded-lg border-grey-100">
            <div class="flex items-center gap-2">
              <div class="font-semibold">{{ s.namaSet }} — {{ s.kodeSetFisik }} ({{ s.kodeBarcode }})</div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaSetCssd(s.status)?.bg, gayaSetCssd(s.status)?.text]">{{ gayaSetCssd(s.status)?.label }}</span>
              <span class="ml-auto text-xs text-grey-400">Lokasi terakhir: {{ s.lokasiTipe === "cssd" ? "CSSD" : s.lokasiUuid }}</span>
            </div>

            <div v-if="s.pemakaian?.length" class="mt-2 text-xs">
              <div class="font-semibold text-danger-300">Sudah dipakai pada pasien:</div>
              <div v-for="p in s.pemakaian" :key="p.uuid" class="mt-1">
                {{ p.namaPasien ?? "Pasien tidak diketahui" }} ({{ p.noRm ?? "-" }}) — {{ p.namaTindakan }} — {{ waktuRingkas(p.waktuPakai) }}
              </div>
            </div>

            <div class="grid items-end grid-cols-[1fr_2fr_120px] gap-2 mt-3">
              <CustomSelect
                v-model="(formTindakLanjut[s.uuid] ??= { statusPenanganan: s.statusPenanganan, catatan: '' }).statusPenanganan"
                label="Tindak Lanjut"
                :options="opsi(statusPenanganan)"
                optionValue="value"
                optionLabel="label"
                :clearable="false"
                :showFilter="false"
              />
              <CustomTextArea v-model="(formTindakLanjut[s.uuid] ??= { statusPenanganan: s.statusPenanganan, catatan: '' }).catatan" label="Catatan" />
              <CustomButton v-if="boleh('TINDAK LANJUT')" label="Simpan" size="small" @click="simpanTindakLanjut(s)" />
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDetail = false" />
      </template>
    </CustomDialog>
  </div>
</template>
