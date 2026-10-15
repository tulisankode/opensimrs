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
import { useSatuSehatStore } from "@/stores/satusehat";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";

// Pemantauan pengiriman kunjungan rawat jalan ke SATUSEHAT (satusehat-service)
const store = useSatuSehatStore();
const storeUtils = utilsStore();
const toast = useToast();

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  terkirim: { label: "Terkirim", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  gagal: { label: "Gagal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  belum: { label: "Belum dikirim", bg: "bg-[#D4D8DC]", text: "text-[#687077]" },
  menunggu: { label: "Menunggu", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
};
const OPSI_STATUS = [
  { value: "", label: "Semua" },
  { value: "belum", label: "Belum dikirim" },
  { value: "terkirim", label: "Terkirim" },
  { value: "gagal", label: "Gagal" },
];

const ringkasan = ref<any>(null);
const baris = ref<any[]>([]);
const total = ref(0);
const halaman = ref(1);
const perHalaman = ref(10);
const filterStatus = ref("");
const cari = ref("");
const layananTersedia = ref(true);

const muatRingkasan = async () => {
  const res = await store.getStatus();
  layananTersedia.value = !!res;
  ringkasan.value = res?.payload ?? null;
};

const muatBaris = async () => {
  const res = await store.getSinkron({ page: halaman.value, limit: perHalaman.value, status: filterStatus.value, q: cari.value });
  baris.value = res?.payload ?? [];
  total.value = res?.pagination?.total ?? 0;
};

const muatSemua = async () => {
  storeUtils.setLoading(true);
  try {
    await Promise.all([muatRingkasan(), muatBaris()]);
  } finally {
    storeUtils.setLoading(false);
  }
};

const ujiKoneksi = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.ujiKoneksi();
    if (res?.gagal) {
      toast.add({ severity: "error", summary: "Uji koneksi gagal", detail: res.message, life: 6000 });
    } else if (res) {
      const org = res.payload?.organisasi;
      toast.add({
        severity: "success",
        summary: "Koneksi SATUSEHAT berhasil",
        detail: `Organisasi: ${org?.nama ?? "-"} (${org?.id ?? "-"}) · ${res.payload?.lingkungan}${res.payload?.mode === "mock" ? " · mode simulasi" : ""}`,
        life: 6000,
      });
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const kirimSekarang = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.jalankanPekerja();
    if (res?.payload) {
      const { diproses, terkirim, gagal } = res.payload;
      toast.add({
        severity: gagal ? "warn" : "success",
        summary: "Sinkronisasi selesai",
        detail: `${diproses} kunjungan diproses: ${terkirim} terkirim, ${gagal} gagal`,
        life: 6000,
      });
    }
  } finally {
    storeUtils.setLoading(false);
    await muatSemua();
  }
};

const kirimSatu = async (row: any) => {
  storeUtils.setLoading(true);
  try {
    const res = await store.kirimRawatJalan(row.uuid);
    if (res) {
      toast.add({
        severity: res.gagal ? "warn" : "success",
        summary: row.noPelayanan,
        detail: res.message,
        life: 6000,
      });
    }
  } finally {
    storeUtils.setLoading(false);
    await muatSemua();
  }
};

const cariData = () => {
  halaman.value = 1;
  muatBaris();
};

const onPage = (event: { page: number; rows: number }) => {
  halaman.value = event.page + 1;
  perHalaman.value = event.rows;
  muatBaris();
};

const tanggal = (epoch: number) => (epoch ? epochToDate(Number(epoch), "dateTime") : "-");

onMounted(muatSemua);
</script>

<template>
  <GreenCard cardHeading="Sinkronisasi SATUSEHAT" hrEnableCustomClass>
    <div class="flex flex-col gap-4 pl-2 text-base">
      <div v-if="!layananTersedia" class="p-3 text-sm rounded-md bg-[#FDE2E1] text-[#B42318]">
        Layanan integrasi SATUSEHAT tidak dapat dihubungi. Hubungi administrator sistem.
      </div>

      <div v-if="ringkasan" class="flex flex-wrap items-center gap-2.5">
        <CustomChip
          :label="ringkasan.aktif ? 'Integrasi aktif' : 'Integrasi nonaktif'"
          :show-checked-icon="false"
          :bg-color="ringkasan.aktif ? 'bg-[#D1FADF]' : 'bg-[#D4D8DC]'"
          border-color="border-transparent"
          :text-color="ringkasan.aktif ? 'text-[#027A48]' : 'text-[#687077]'"
        />
        <CustomChip
          :label="`Lingkungan: ${ringkasan.lingkungan}${ringkasan.mode === 'mock' ? ' (simulasi)' : ''}`"
          :show-checked-icon="false"
          bg-color="bg-opensimrs-50"
          border-color="border-transparent"
          text-color="text-opensimrs-300"
        />
        <CustomChip
          v-if="!ringkasan.kredensialLengkap"
          label="Kredensial belum lengkap"
          :show-checked-icon="false"
          bg-color="bg-[#FEF0C7]"
          border-color="border-transparent"
          text-color="text-[#B54708]"
        />
        <span class="text-sm text-grey-400">
          Terkirim {{ ringkasan.jumlah?.terkirim ?? 0 }} · Gagal {{ ringkasan.jumlah?.gagal ?? 0 }} · Belum dikirim
          {{ ringkasan.belumDiproses ?? 0 }}
          <template v-if="ringkasan.pekerja?.aktif">
            · Pengiriman otomatis tiap {{ ringkasan.pekerja.intervalMenit }} menit ({{ ringkasan.pekerja.rentangHari }} hari terakhir)
          </template>
        </span>
        <div class="flex gap-2.5 ml-auto">
          <CustomButton label="Uji Koneksi" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ujiKoneksi" />
          <CustomButton label="Kirim Sekarang" icon="PhPaperPlaneTilt" :disabled="!ringkasan.aktif" @click="kirimSekarang" />
        </div>
      </div>

      <PageToolbar>
        <CustomTextfield v-model="cari" label="Cari" placeholder="Nama pasien / No. RM / No. Pelayanan" prependIcon="PhMagnifyingGlass" @keyup.enter="cariData" />
        <CustomSelect
          v-model="filterStatus"
          label="Status"
          placeHolder="Semua"
          :options="OPSI_STATUS"
          optionValue="value"
          optionLabel="label"
          @update:modelValue="cariData"
        />
        <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
      </PageToolbar>

      <DataTable :value="baris" stripedRows class="text-xs">
        <Column header="No. Pelayanan" field="noPelayanan" headerClass="bg-opensimrs-50" />
        <Column header="Pasien" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ data.namaPasien ?? "-" }} ({{ data.noRm }})</template>
        </Column>
        <Column header="Selesai" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ tanggal(data.dischargeDate) }}</template>
        </Column>
        <Column header="Status" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <CustomChip
              :label="STATUS[data.status]?.label ?? data.status"
              :show-checked-icon="false"
              :bg-color="STATUS[data.status]?.bg ?? 'bg-[#D4D8DC]'"
              border-color="border-transparent"
              :text-color="STATUS[data.status]?.text ?? 'text-[#687077]'"
            />
          </template>
        </Column>
        <Column header="Keterangan" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <span v-if="data.status === 'terkirim'">Encounter {{ data.encounterId }} · {{ tanggal(data.dikirimAt) }}</span>
            <span v-else-if="data.pesan" class="text-[#B42318]">{{ data.pesan }}<template v-if="data.percobaan"> (percobaan {{ data.percobaan }})</template></span>
            <span v-else>-</span>
          </template>
        </Column>
        <Column header="" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <CustomButton
              v-if="data.status !== 'terkirim'"
              :label="data.status === 'gagal' ? 'Kirim Ulang' : 'Kirim'"
              :disabled="!ringkasan?.aktif"
              @click="kirimSatu(data)"
            />
          </template>
        </Column>
        <template #empty>
          <div class="py-4 text-center text-grey-400">Tidak ada kunjungan rawat jalan yang sudah selesai.</div>
        </template>
      </DataTable>
      <div class="flex justify-end">
        <CustomPaginator :rows="perHalaman" :totalRecords="total" @page="onPage" />
      </div>
    </div>
  </GreenCard>
</template>
