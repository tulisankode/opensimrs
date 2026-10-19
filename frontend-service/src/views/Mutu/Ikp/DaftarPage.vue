<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import DetailLaporan from "./DetailLaporan.vue";
import { utilsStore } from "@/stores/utils";
import {
  GRADE_IKP,
  SINGKAT_JENIS,
  STATUS_LAPORAN_IKP,
  daftarLaporanIkp,
  gayaGrade,
  gayaStatusIkp,
  gayaTenggat,
  opsi,
  referensiIkp,
  waktuIkp,
} from "@/stores/penunjang/mutu";

// Daftar laporan Insiden Keselamatan Pasien untuk peninjau (izin READ: kepala unit, Tim/Komite KP). Identitas pelapor
// anonim tidak dikirim backend; rujukan pasien hanya tampil bagi pemegang LIHAT PASIEN. Klik baris → detail & proses.
const storeUtils = utilsStore();
const route = useRoute();
const referensi = ref<any>({ unit: [], pengaturan: {} });
const opsiUnit = computed(() => (referensi.value.unit ?? []).map((u: any) => ({ value: u.uuid, label: u.nama })));
const OPSI_STATUS = [{ value: "aktif", label: "Belum ditutup" }, ...opsi(STATUS_LAPORAN_IKP)];
const OPSI_JENIS = Object.entries(SINGKAT_JENIS).map(([value, label]) => ({ value, label }));
const OPSI_GRADE = [{ value: "belum", label: "Belum digrading" }, ...opsi(GRADE_IKP)];

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const filter = ref({ status: "aktif", jenisInsiden: "", grade: "", unitUuid: "", terlambat: false, cari: "" });
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const f = filter.value;
    const res = await daftarLaporanIkp({
      page: page.value,
      limit: limit.value,
      status: f.status === "aktif" ? "" : f.status,
      aktif: f.status === "aktif" ? "true" : "",
      jenisInsiden: f.jenisInsiden,
      grade: f.grade,
      unitUuid: f.unitUuid,
      terlambat: f.terlambat ? "true" : "",
      cari: f.cari.trim(),
    });
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const cariData = () => {
  page.value = 1;
  muat();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

const dialog = ref(false);
const pilihan = ref("");
const buka = (uuid: string) => {
  pilihan.value = uuid;
  dialog.value = true;
};

onMounted(async () => {
  const r = await referensiIkp();
  if (r?.payload) referensi.value = r.payload;
  await muat();
  if (route.query.laporan) buka(String(route.query.laporan));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Insiden Keselamatan Pasien</h1>
          <CustomTextfield v-model="filter.cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nomor / unit" :maxLength="100" @keydown.enter="cariData" />
          <CustomSelect v-model="filter.status" label="Status" placeHolder="Semua" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filter.jenisInsiden" label="Jenis" placeHolder="Semua" :options="OPSI_JENIS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filter.grade" label="Grade" placeHolder="Semua" :options="OPSI_GRADE" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filter.unitUuid" label="Unit" placeHolder="Semua" :options="opsiUnit" optionValue="value" optionLabel="label" @update:modelValue="cariData" />
          <label class="flex items-center gap-1 text-xs whitespace-nowrap"><Checkbox v-model="filter.terlambat" binary @update:modelValue="cariData" /> Laporan terlambat</label>
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 72rem" @rowClick="buka($event.data.uuid)">
          <Column header="Nomor" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.nomor }}</div>
              <div class="text-grey-400">{{ waktuIkp(d.waktuLapor) }}</div>
            </template>
          </Column>
          <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ SINGKAT_JENIS[d.jenisInsiden] ?? d.jenisInsiden }}</template></Column>
          <Column header="Kejadian" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ waktuIkp(d.waktuKejadian) }}</div>
              <div class="text-grey-400 line-clamp-2">{{ d.kronologi }}</div>
            </template>
          </Column>
          <Column field="unitNama" header="Unit" headerClass="bg-opensimrs-50" />
          <Column header="Pelapor" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.anonim ? "Anonim" : d.pelaporNama || d.dibuatOleh || "-" }}</template></Column>
          <Column header="Batas Lapor" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span :class="d.terlambatLapor ? 'text-danger-300 font-semibold' : 'text-[#027A48]'">{{ d.terlambatLapor ? "Terlambat" : "Tepat waktu" }}</span></template>
          </Column>
          <Column header="Grade" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaGrade(d.grade).bg, gayaGrade(d.grade).text]">{{ gayaGrade(d.grade).label }}</span>
            </template>
          </Column>
          <Column header="Investigasi" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span v-if="d.statusTenggatInvestigasi" class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaTenggat(d.statusTenggatInvestigasi).bg, gayaTenggat(d.statusTenggatInvestigasi).text]">
                {{ gayaTenggat(d.statusTenggatInvestigasi).label }}
              </span>
              <span v-else>-</span>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusIkp(d.status).bg, gayaStatusIkp(d.status).text]">{{ gayaStatusIkp(d.status).label }}</span>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="1040px">
      <template #header>Laporan Insiden Keselamatan Pasien</template>
      <template #body>
        <DetailLaporan v-if="dialog && pilihan" :uuid="pilihan" :referensi="referensi" @berubah="muat" />
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
