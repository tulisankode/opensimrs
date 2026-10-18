<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import * as XLSX from "xlsx-js-style";
import MainHeaderSetting from "../MainHeaderSetting.vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { useSettingStore } from "@/stores/setting";
import { utilsStore } from "@/stores/utils";
import { hasPermission } from "@/utils/permissions";
import { epochToDate, dateToEpoch, setTimeForDate } from "@/utils/Helpers";

const settingStore = useSettingStore();
const useUtilsStore = utilsStore();

const bolehEkspor = computed(() => hasPermission("Setting", "Audit Trail", "EKSPOR"));

const daftarAksi = [
  { label: "Semua aksi", value: "" },
  { label: "Login", value: "login" },
  { label: "Login gagal", value: "login_gagal" },
  { label: "Logout", value: "logout" },
  { label: "Baca", value: "baca" },
  { label: "Buat", value: "buat" },
  { label: "Ubah", value: "ubah" },
  { label: "Hapus", value: "hapus" },
  { label: "Ekspor", value: "ekspor" },
  { label: "Cetak", value: "cetak" },
  { label: "Ubah izin", value: "ubah_izin" },
];

const filter = ref({
  patientUuid: "",
  penggunaUuid: "",
  aksi: "",
  entitas: "",
  layanan: "",
});
const dariTanggal = ref<Date | null>(null);
const sampaiTanggal = ref<Date | null>(null);

const items = ref<any[]>([]);
const halaman = ref({ page: 1, page_size: 20, total: 0 });

const itemDetail = ref<any | null>(null);
const dialogDetailTampil = ref(false);

const statusVerifikasi = ref<any | null>(null);

const hasData = computed(() => items.value.length > 0);

const susunParam = () => ({
  patient_uuid: filter.value.patientUuid || undefined,
  pengguna_uuid: filter.value.penggunaUuid || undefined,
  aksi: filter.value.aksi || undefined,
  entitas: filter.value.entitas || undefined,
  layanan: filter.value.layanan || undefined,
  dari: dariTanggal.value ? dateToEpoch(setTimeForDate(dariTanggal.value, 0, 0, 0)) : undefined,
  sampai: sampaiTanggal.value ? dateToEpoch(setTimeForDate(sampaiTanggal.value, 23, 59, 59)) : undefined,
  page: halaman.value.page,
  page_size: halaman.value.page_size,
});

const cariAudit = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await settingStore.getAuditTrailApi(susunParam());
    if (response?.payload) {
      items.value = response.payload.items ?? [];
      halaman.value.total = response.payload.total ?? 0;
    } else {
      items.value = [];
    }
  } catch (error) {
    console.error("Gagal mengambil audit trail", error);
    items.value = [];
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const terapkanFilter = () => {
  halaman.value.page = 1;
  cariAudit();
};

const resetFilter = () => {
  filter.value = { patientUuid: "", penggunaUuid: "", aksi: "", entitas: "", layanan: "" };
  dariTanggal.value = null;
  sampaiTanggal.value = null;
  halaman.value.page = 1;
  cariAudit();
};

const ubahHalaman = (event: any) => {
  halaman.value.page = event.page + 1;
  halaman.value.page_size = event.rows;
  cariAudit();
};

const bukaDetail = async (baris: any) => {
  try {
    const response = await settingStore.getAuditTrailDetailApi(baris.uuid);
    itemDetail.value = response?.payload?.item ?? baris;
  } catch (error) {
    itemDetail.value = baris;
  }
  dialogDetailTampil.value = true;
};

const eksporExcel = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await settingStore.eksporAuditTrailApi({ filter: susunParam() });
    const payload = response?.data?.payload ?? response?.payload;
    const baris = payload?.items ?? [];
    const workbook = XLSX.utils.book_new();
    const data = [
      ["Waktu", "Layanan", "Aksi", "Entitas", "ID Entitas", "ID Pasien", "Pengguna", "Alamat IP"],
      ...baris.map((b: any) => [
        epochToDate(b.waktuEpoch ?? b.waktu_epoch, "dateTime"),
        b.layanan,
        b.aksi,
        b.entitas ?? "",
        b.entitasUuid ?? b.entitas_uuid ?? "",
        b.patientUuid ?? b.patient_uuid ?? "",
        b.identitasAkun ?? b.identitas_akun ?? "",
        b.alamatIp ?? b.alamat_ip ?? "",
      ]),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Trail");
    XLSX.writeFile(workbook, `audit-trail-${Date.now()}.xlsx`);
  } catch (error) {
    console.error("Gagal mengekspor audit trail", error);
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const verifikasiRantai = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await settingStore.verifikasiAuditTrailApi({
      dari: dariTanggal.value ? dateToEpoch(setTimeForDate(dariTanggal.value, 0, 0, 0)) : undefined,
      sampai: sampaiTanggal.value ? dateToEpoch(setTimeForDate(sampaiTanggal.value, 23, 59, 59)) : undefined,
    });
    statusVerifikasi.value = response?.payload ?? null;
  } catch (error) {
    console.error("Gagal memverifikasi rantai hash", error);
  } finally {
    useUtilsStore.setLoading(false);
  }
};

onMounted(() => {
  cariAudit();
});
</script>

<template>
  <div class="flex flex-col h-full">
    <MainHeaderSetting heading="Audit Trail" />
    <div class="p-5 flex flex-col gap-4">
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <CustomTextfield label="ID Pasien" v-model="filter.patientUuid" placeHolder="UUID pasien" />
        <CustomTextfield label="Pengguna" v-model="filter.penggunaUuid" placeHolder="UUID pengguna" />
        <CustomSelect label="Aksi" v-model="filter.aksi" :options="daftarAksi" optionLabel="label" optionValue="value" />
        <CustomTextfield label="Entitas" v-model="filter.entitas" placeHolder="mis. Pasien" />
        <CustomTextfield label="Layanan" v-model="filter.layanan" placeHolder="mis. auth-service" />
        <CustomDatePicker label="Dari tanggal" v-model="dariTanggal" />
        <CustomDatePicker label="Sampai tanggal" v-model="sampaiTanggal" />
      </div>
      <div class="flex gap-2 flex-wrap">
        <CustomButton label="Cari" @click="terapkanFilter" />
        <CustomButton label="Reset" text-color="text-opensimrs-300" border-color="border-opensimrs-300" outlined @click="resetFilter" />
        <CustomButton label="Verifikasi Rantai Hash" text-color="text-opensimrs-300" border-color="border-opensimrs-300" outlined @click="verifikasiRantai" />
        <CustomButton v-if="bolehEkspor" label="Ekspor Excel" text-color="text-opensimrs-300" border-color="border-opensimrs-300" outlined @click="eksporExcel" />
      </div>

      <div
        v-if="statusVerifikasi"
        class="p-3 rounded-lg"
        :class="statusVerifikasi.status === 'utuh' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'"
      >
        <template v-if="statusVerifikasi.status === 'utuh'">
          Rantai hash utuh untuk {{ statusVerifikasi.diperiksa }} catatan yang diperiksa.
        </template>
        <template v-else>
          Ditemukan {{ statusVerifikasi.uuid_tidak_cocok?.length ?? 0 }} catatan dengan rantai hash tidak cocok dari
          {{ statusVerifikasi.diperiksa }} catatan yang diperiksa.
        </template>
        <div v-if="statusVerifikasi.terpotong" class="mt-1 text-xs">
          Rentang terlalu besar untuk diperiksa sekaligus — hasil di atas hanya mencakup {{ statusVerifikasi.diperiksa }}
          catatan pertama. Persempit rentang tanggal untuk memeriksa sisanya.
        </div>
      </div>

      <NoData v-if="!hasData" />
      <DataTable v-else :value="items" responsiveLayout="scroll" dataKey="uuid" @row-click="(e: any) => bukaDetail(e.data)" class="cursor-pointer">
        <Column header="Waktu">
          <template #body="{ data }">{{ epochToDate(data.waktuEpoch ?? data.waktu_epoch, "dateTime") }}</template>
        </Column>
        <Column field="layanan" header="Layanan" />
        <Column field="aksi" header="Aksi" />
        <Column field="entitas" header="Entitas" />
        <Column header="Pengguna">
          <template #body="{ data }">{{ data.identitasAkun ?? data.identitas_akun ?? "-" }}</template>
        </Column>
        <Column header="ID Pasien">
          <template #body="{ data }">{{ data.patientUuid ?? data.patient_uuid ?? "-" }}</template>
        </Column>
        <Column header="Alamat IP">
          <template #body="{ data }">{{ data.alamatIp ?? data.alamat_ip ?? "-" }}</template>
        </Column>
      </DataTable>

      <CustomPaginator
        :rows="halaman.page_size"
        :totalRecords="halaman.total"
        @page="ubahHalaman"
      />
    </div>

    <CustomDialog v-model:visible="dialogDetailTampil" headerBg="bg-opensimrs-300" width="700px">
      <template #header>Detail Audit</template>
      <template #body>
        <div v-if="itemDetail" class="flex flex-col gap-2 p-3">
          <div><strong>Waktu:</strong> {{ epochToDate(itemDetail.waktuEpoch ?? itemDetail.waktu_epoch, "dateTime") }}</div>
          <div><strong>Layanan:</strong> {{ itemDetail.layanan }}</div>
          <div><strong>Aksi:</strong> {{ itemDetail.aksi }}</div>
          <div><strong>Entitas:</strong> {{ itemDetail.entitas ?? "-" }} ({{ itemDetail.entitasUuid ?? itemDetail.entitas_uuid ?? "-" }})</div>
          <div><strong>Pasien:</strong> {{ itemDetail.patientUuid ?? itemDetail.patient_uuid ?? "-" }}</div>
          <div><strong>Pengguna:</strong> {{ itemDetail.identitasAkun ?? itemDetail.identitas_akun ?? "-" }}</div>
          <div><strong>Alamat IP:</strong> {{ itemDetail.alamatIp ?? itemDetail.alamat_ip ?? "-" }}</div>
          <div><strong>User Agent:</strong> {{ itemDetail.userAgent ?? itemDetail.user_agent ?? "-" }}</div>
          <div><strong>ID Permintaan:</strong> {{ itemDetail.requestId ?? itemDetail.request_id ?? "-" }}</div>
          <div>
            <strong>Ringkasan perubahan:</strong>
            <pre class="bg-gray-50 p-2 rounded text-xs overflow-auto">{{
              JSON.stringify(itemDetail.ringkasanPerubahan ?? itemDetail.ringkasan_perubahan ?? null, null, 2)
            }}</pre>
          </div>
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
