<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import { useBpjsPcareStore } from "@/stores/bpjsPcare";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";

// Kunjungan rawat jalan BPJS → pendaftaran (nomor urut) & kunjungan (nomor kunjungan) PCare
const store = useBpjsPcareStore();
const storeUtils = utilsStore();
const toast = useToast();

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  terkirim: { label: "Terkirim", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  gagal: { label: "Gagal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  belum: { label: "Belum", bg: "bg-[#D4D8DC]", text: "text-[#687077]" },
};
const OPSI_STATUS = [
  { value: "", label: "Semua" },
  { value: "belum", label: "Kunjungan belum dikirim" },
  { value: "terkirim", label: "Kunjungan terkirim" },
  { value: "gagal", label: "Gagal" },
];

const baris = ref<any[]>([]);
const total = ref(0);
const halaman = ref(1);
const perHalaman = ref(10);
const filterStatus = ref("");
const cari = ref("");

const muat = async () => {
  const res = await store.getKunjungan({ page: halaman.value, limit: perHalaman.value, status: filterStatus.value, q: cari.value });
  baris.value = res?.payload ?? [];
  total.value = res?.pagination?.total ?? 0;
};

const muatDenganLoading = async () => {
  storeUtils.setLoading(true);
  try {
    await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

const kirimSekarang = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.jalankanPekerja();
    if (res?.gagal) toast.add({ severity: "error", summary: "Sinkronisasi PCare gagal", detail: res.message, life: 6000 });
    else if (res?.payload) {
      const { diproses, berhasil, gagal } = res.payload;
      toast.add({ severity: gagal ? "warn" : "success", summary: "Sinkronisasi PCare selesai", detail: `${diproses} kunjungan diproses: ${berhasil} berhasil, ${gagal} gagal`, life: 6000 });
    }
    await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

const kirimSatu = async (row: any) => {
  storeUtils.setLoading(true);
  try {
    const res = await store.kirimKunjungan(row.uuid);
    if (res) toast.add({ severity: res.gagal ? "warn" : "success", summary: row.noPelayanan, detail: res.message, life: 6000 });
    await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

const cariData = () => {
  halaman.value = 1;
  muatDenganLoading();
};

const onPage = (event: { page: number; rows: number }) => {
  halaman.value = event.page + 1;
  perHalaman.value = event.rows;
  muatDenganLoading();
};

const tanggal = (epoch: number) => (epoch ? epochToDate(Number(epoch), "dateTime") : "-");

defineExpose({ muat: muatDenganLoading });
onMounted(muatDenganLoading);
</script>

<template>
  <GreenCard cardHeading="Sinkronisasi BPJS PCare" hrEnableCustomClass>
    <div class="flex flex-col gap-4 pl-2 text-base">
      <PageToolbar>
        <CustomTextfield v-model="cari" label="Cari" placeholder="Nama pasien / No. RM / No. kartu / No. pelayanan" prependIcon="PhMagnifyingGlass" @keyup.enter="cariData" />
        <CustomSelect v-model="filterStatus" label="Status" placeHolder="Semua" :options="OPSI_STATUS" optionValue="value" optionLabel="label" @update:modelValue="cariData" />
        <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
        <CustomButton class="ml-auto" label="Kirim Sekarang" icon="PhPaperPlaneTilt" @click="kirimSekarang" />
      </PageToolbar>

      <DataTable :value="baris" stripedRows class="text-xs">
        <Column header="No. Pelayanan" field="noPelayanan" headerClass="bg-opensimrs-50" />
        <Column header="Pasien" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ data.namaPasien ?? "-" }} ({{ data.noRm }})<br /><span class="text-grey-400">Kartu {{ data.noKartu || "-" }}</span></template>
        </Column>
        <Column header="Daftar / Selesai" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ tanggal(data.tanggalDaftar) }}<br /><span class="text-grey-400">{{ data.statusRj === 5 ? tanggal(data.dischargeDate) : "belum selesai" }}</span></template>
        </Column>
        <Column header="Pendaftaran" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <CustomChip :label="STATUS[data.statusPendaftaran]?.label ?? data.statusPendaftaran" :show-checked-icon="false" :bg-color="STATUS[data.statusPendaftaran]?.bg" border-color="border-transparent" :text-color="STATUS[data.statusPendaftaran]?.text" />
            <div v-if="data.noUrut" class="mt-1">No. urut {{ data.noUrut }}</div>
          </template>
        </Column>
        <Column header="Kunjungan" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <CustomChip :label="STATUS[data.statusKunjungan]?.label ?? data.statusKunjungan" :show-checked-icon="false" :bg-color="STATUS[data.statusKunjungan]?.bg" border-color="border-transparent" :text-color="STATUS[data.statusKunjungan]?.text" />
            <div v-if="data.noKunjungan" class="mt-1">{{ data.noKunjungan }}</div>
          </template>
        </Column>
        <Column header="Keterangan" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <span v-if="data.pesan" class="text-[#B42318]">{{ data.pesan }}<template v-if="data.percobaan"> (percobaan {{ data.percobaan }})</template></span>
            <span v-else>-</span>
          </template>
        </Column>
        <Column header="" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <CustomButton
              v-if="data.statusKunjungan !== 'terkirim'"
              :label="data.statusPendaftaran === 'gagal' || data.statusKunjungan === 'gagal' ? 'Kirim Ulang' : 'Kirim'"
              @click="kirimSatu(data)"
            />
          </template>
        </Column>
        <template #empty>
          <div class="py-4 text-center text-grey-400">Belum ada kunjungan rawat jalan dengan penjamin BPJS.</div>
        </template>
      </DataTable>
      <div class="flex justify-end">
        <CustomPaginator :rows="perHalaman" :totalRecords="total" @page="onPage" />
      </div>
    </div>
  </GreenCard>
</template>
