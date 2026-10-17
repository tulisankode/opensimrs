<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import DialogDetailOperasi from "./Komponen/DialogDetailOperasi.vue";
import { utilsStore } from "@/stores/utils";
import { JK_OK, STATUS_JADWAL_OK, batalJadwalOk, daftarJadwalOk, gayaJadwalOk, izinOk, keTanggalOk, waktuOk } from "@/stores/penunjang/kamarOperasi";

// Jadwal OK: daftar jadwal operasi (semua status), filter tanggal & status; detail membuka dialog pra-operasi,
// checklist keselamatan bedah, pemakaian BHP, dan laporan operasi/anestesi.
const storeUtils = utilsStore();
const bolehJadwal = (aksi: string) => izinOk("Jadwal OK", aksi);

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const tglMulai = ref<Date | null>(new Date());
const tglSelesai = ref<Date | null>(null);
const filterStatus = ref<string[]>(["terjadwal"]);

const toggleStatus = (nilai: string) => {
  filterStatus.value = filterStatus.value.includes(nilai) ? filterStatus.value.filter((x) => x !== nilai) : [...filterStatus.value, nilai];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarJadwalOk({
      page: page.value,
      limit: limit.value,
      status: filterStatus.value,
      tanggal_mulai: tglMulai.value ? keTanggalOk(tglMulai.value) : undefined,
      tanggal_selesai: tglSelesai.value ? keTanggalOk(tglSelesai.value) : undefined,
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
const reset = () => {
  tglMulai.value = new Date();
  tglSelesai.value = null;
  filterStatus.value = ["terjadwal"];
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Detail (dialog gabungan pra-operasi/checklist/pemakaian/laporan)
const jadwalUuidDetail = ref("");
const dialogDetail = ref(false);
const bukaDetail = (uuid: string) => {
  jadwalUuidDetail.value = uuid;
  dialogDetail.value = true;
};

// ── Batal jadwal
const dialogBatal = ref(false);
const jadwalBatal = ref<any>(null);
const alasanBatal = ref("");
const galatBatal = ref("");
const bukaBatal = (j: any) => {
  jadwalBatal.value = j;
  alasanBatal.value = "";
  galatBatal.value = "";
  dialogBatal.value = true;
};
const kirimBatal = async () => {
  if (!alasanBatal.value.trim()) return (galatBatal.value = "Alasan pembatalan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await batalJadwalOk(jadwalBatal.value.uuid, alasanBatal.value);
    if (res?.payload) {
      dialogBatal.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Jadwal OK</h1>
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <ToolbarFilterMenu :count="filterStatus.length">
            <template #label>Status</template>
            <CustomChip v-for="(s, kode) in STATUS_JADWAL_OK" :key="kode" :label="s.label" :value="String(kode)" :isSelected="filterStatus.includes(String(kode))" @selected="toggleStatus" />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 64rem" @rowClick="bukaDetail($event.data.uuid)">
          <Column header="Waktu" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ waktuOk(d.waktuMulai) }}</div>
              <div class="text-grey-400">s.d. {{ waktuOk(d.waktuSelesai, true) }}</div>
            </template>
          </Column>
          <Column header="Ruang" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.ruangKode }} — {{ d.ruangNama }}</template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaPasien ?? "-" }}</div>
              <div class="text-grey-400">{{ d.noRm }} · {{ JK_OK[d.gender] ?? "-" }}</div>
            </template>
          </Column>
          <Column header="Diagnosis / Order" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span v-if="d.jenisOperasi === 'cito'" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
              {{ d.diagnosisNama ?? "-" }}
              <div class="text-grey-400">{{ d.noOrder }}</div>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" :class="[gayaJadwalOk(d.status)?.bg, gayaJadwalOk(d.status)?.text]">
                {{ gayaJadwalOk(d.status)?.label ?? d.status }}
              </span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <CustomButton
                v-if="d.status === 'terjadwal' && bolehJadwal('BATAL')"
                label="Batalkan"
                size="small"
                outlined
                borderColor="border-danger-300"
                textColor="text-danger-300"
                @click.stop="bukaBatal(d)"
              />
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

    <!-- Batal jadwal -->
    <CustomDialog v-model:visible="dialogBatal" width="460px" headerBg="bg-danger-300">
      <template #header>Batalkan Jadwal Operasi</template>
      <template #body>
        <div class="flex flex-col gap-2 pt-4">
          <div class="text-sm">{{ jadwalBatal?.noOrder }} — {{ jadwalBatal?.namaPasien }}</div>
          <CustomTextfield v-model="alasanBatal" label="Alasan pembatalan" required />
          <div v-if="galatBatal" class="text-sm text-danger-300">{{ galatBatal }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBatal = false" />
          <CustomButton label="Batalkan Jadwal" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="kirimBatal" />
        </div>
      </template>
    </CustomDialog>

    <DialogDetailOperasi v-model:visible="dialogDetail" :jadwal-uuid="jadwalUuidDetail" @tersimpan="muat" />
  </div>
</template>
