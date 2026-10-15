<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "primevue/usetoast";
import CustomButton from "@/components/Base/CustomButton.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import FormBuatSep from "./Section/FormBuatSep.vue";
import { useBpjsVclaimStore } from "@/stores/bpjsVclaim";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";

// Admisi › SEP: daftar SEP BPJS VClaim yang diterbitkan dari OpenSIMRS per jenis pelayanan, pembuatan & penghapusan SEP
const route = useRoute();
const store = useBpjsVclaimStore();
const storeUtils = utilsStore();
const toast = useToast();

const pageType = computed(() => String(route.path.split("/")[3] ?? "rawat-jalan"));
const judul = computed(() => (pageType.value === "rawat-inap" ? "Rawat Inap" : pageType.value === "igd" ? "IGD" : "Rawat Jalan"));
const sumber = computed(() => (pageType.value === "rawat-inap" ? "rawat_inap" : pageType.value === "igd" ? "igd" : "rawat_jalan"));

const OPSI_STATUS = [
  { value: "aktif", label: "Aktif" },
  { value: "dihapus", label: "Dihapus" },
  { value: "", label: "Semua" },
];

const modeBuat = ref(false);
const konfigurasi = ref<any>(null);
const baris = ref<any[]>([]);
const total = ref(0);
const halaman = ref(1);
const perHalaman = ref(10);
const cari = ref("");
const filterStatus = ref("aktif");
const sepTerbit = ref<any>(null);
const sepDihapus = ref<any>(null);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.getSep({ page: halaman.value, limit: perHalaman.value, q: cari.value, status: filterStatus.value, sumber: sumber.value });
    baris.value = res?.payload ?? [];
    total.value = res?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};

const muatKonfigurasi = async () => {
  const res = await store.getKonfigurasi();
  konfigurasi.value = res?.gagal ? null : res?.payload ?? null;
};

const cariData = () => {
  halaman.value = 1;
  muat();
};

const onPage = (event: { page: number; rows: number }) => {
  halaman.value = event.page + 1;
  perHalaman.value = event.rows;
  muat();
};

const selesaiBuat = (sep: any) => {
  modeBuat.value = false;
  sepTerbit.value = sep;
  toast.add({ severity: "success", summary: "SEP berhasil dibuat", detail: sep.noSep, life: 6000 });
  cariData();
};

const hapus = async () => {
  const noSep = sepDihapus.value?.noSep;
  sepDihapus.value = null;
  if (!noSep) return;
  storeUtils.setLoading(true);
  try {
    const res = await store.hapusSep(noSep);
    if (res?.gagal) toast.add({ severity: "error", summary: "SEP gagal dihapus", detail: res.message, life: 7000 });
    else if (res) toast.add({ severity: "success", summary: "SEP dihapus", detail: noSep, life: 4000 });
  } finally {
    storeUtils.setLoading(false);
  }
  await muat();
};

const ASAL = (asal: string) => (asal === "2" ? "RS" : "FKTP");
const dibuat = (epoch: number) => (epoch ? epochToDate(Number(epoch), "dateTime") : "-");

watch(pageType, () => {
  modeBuat.value = false;
  cari.value = "";
  cariData();
});
onMounted(() => {
  muatKonfigurasi();
  muat();
});
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto">
    <template #header>
      <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
      <PageToolbar>
        <h1 class="toolbar-heading text-opensimrs-300">SEP BPJS · {{ judul }}</h1>
        <CustomChip
          v-if="konfigurasi"
          :label="konfigurasi.lengkap ? `VClaim ${konfigurasi.lingkungan === 'production' ? 'produksi' : 'development'}${konfigurasi.mode === 'mock' ? ' (simulasi)' : ''}` : 'Konfigurasi VClaim belum lengkap'"
          :show-checked-icon="false"
          :bg-color="konfigurasi.lengkap ? 'bg-opensimrs-50' : 'bg-[#FEF0C7]'"
          border-color="border-transparent"
          :text-color="konfigurasi.lengkap ? 'text-opensimrs-300' : 'text-[#B54708]'"
        />
        <template v-if="!modeBuat">
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="No. SEP / No. kartu / No. RM / nama pasien" @keyup.enter="cariData" />
          <CustomSelect v-model="filterStatus" label="Status" :options="OPSI_STATUS" optionValue="value" optionLabel="label" @update:modelValue="cariData" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
        </template>
        <CustomButton v-if="!modeBuat" label="Buat SEP" icon="PhPlus" :disabled="!konfigurasi?.lengkap" @click="modeBuat = true" />
      </PageToolbar>
    </template>
    <template #content>
      <div v-if="konfigurasi && !konfigurasi.lengkap" class="p-3 mb-3 text-sm rounded-md bg-[#FEF0C7] text-[#B54708]">
        Lengkapi Cons ID, Secret Key, User Key dan Kode PPK di Setting › Konfigurasi Integrasi › BPJS VClaim sebelum membuat SEP.
      </div>

      <FormBuatSep v-if="modeBuat" :pageType="pageType" @selesai="selesaiBuat" @batal="modeBuat = false" />

      <div v-else class="flex flex-col gap-3">
        <DataTable :value="baris" stripedRows class="text-xs">
          <Column header="No. SEP" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ data.noSep }}</div>
              <div class="text-grey-400">Tgl. SEP {{ data.tglSep }}</div>
              <CustomChip v-if="data.status === 'dihapus'" label="Dihapus" :show-checked-icon="false" bg-color="bg-[#FDE2E1]" border-color="border-transparent" text-color="text-[#B42318]" />
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ data.namaPasien ?? data.sep?.peserta?.nama ?? "-" }}</div>
              <div class="text-grey-400">RM {{ data.noRm || "-" }} · Kartu {{ data.noKartu }}</div>
            </template>
          </Column>
          <Column header="Pelayanan" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div>{{ data.jenisPelayanan === "1" ? "Rawat Inap" : "Rawat Jalan" }}{{ data.poliTujuan ? ` · Poli ${data.poliTujuan}` : "" }} · Kelas {{ data.kelasRawat }}</div>
              <div class="text-grey-400">Diagnosis {{ data.diagAwal }} · DPJP {{ data.dpjp }}</div>
            </template>
          </Column>
          <Column header="Rujukan" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div>{{ data.noRujukan || "-" }}</div>
              <div class="text-grey-400">{{ data.noRujukan ? ASAL(data.asalRujukan) : "" }}</div>
            </template>
          </Column>
          <Column header="Dibuat" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ dibuat(data.createdAt) }}<br /><span class="text-grey-400">{{ data.dibuatOleh ?? "-" }}</span></template>
          </Column>
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="flex gap-2">
                <CustomButton label="Detail" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="sepTerbit = { ...data.sep, noSep: data.noSep }" />
                <CustomButton v-if="data.status === 'aktif'" label="Hapus" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="sepDihapus = data" />
              </div>
            </template>
          </Column>
          <template #empty>
            <div class="py-4 text-center text-grey-400">Belum ada SEP {{ judul.toLowerCase() }} yang dibuat dari OpenSIMRS.</div>
          </template>
        </DataTable>
        <div class="flex justify-end">
          <CustomPaginator :rows="perHalaman" :totalRecords="total" @page="onPage" />
        </div>
      </div>
    </template>
  </Card>

  <!-- Detail SEP (setelah terbit atau dari daftar) -->
  <Dialog :visible="!!sepTerbit" modal header="Surat Eligibilitas Peserta" :style="{ width: '640px' }" @update:visible="sepTerbit = null">
    <div v-if="sepTerbit" class="grid grid-cols-2 gap-3 text-sm">
      <div class="col-span-2"><span class="underline">No. SEP</span><div class="text-lg font-semibold text-opensimrs-300">{{ sepTerbit.noSep }}</div></div>
      <div><span class="underline">Tanggal SEP</span><div class="font-semibold">{{ sepTerbit.tglSep ?? "-" }}</div></div>
      <div><span class="underline">Jenis Pelayanan</span><div class="font-semibold">{{ sepTerbit.jnsPelayanan ?? "-" }}</div></div>
      <div><span class="underline">Peserta</span><div class="font-semibold">{{ sepTerbit.peserta?.nama ?? "-" }} ({{ sepTerbit.peserta?.noKartu ?? "-" }})</div></div>
      <div><span class="underline">Jenis Peserta · Hak Kelas</span><div class="font-semibold">{{ sepTerbit.peserta?.jnsPeserta ?? "-" }} · {{ sepTerbit.peserta?.hakKelas ?? "-" }}</div></div>
      <div><span class="underline">Poli</span><div class="font-semibold">{{ sepTerbit.poli || "-" }}</div></div>
      <div><span class="underline">Diagnosis</span><div class="font-semibold">{{ sepTerbit.diagnosa ?? "-" }}</div></div>
      <div><span class="underline">No. Rujukan</span><div class="font-semibold">{{ sepTerbit.noRujukan || "-" }}</div></div>
      <div><span class="underline">Catatan</span><div class="font-semibold">{{ sepTerbit.catatan || "-" }}</div></div>
    </div>
    <template #footer>
      <CustomButton label="Tutup" @click="sepTerbit = null" />
    </template>
  </Dialog>

  <!-- Konfirmasi hapus -->
  <Dialog :visible="!!sepDihapus" modal header="Hapus SEP" :style="{ width: '460px' }" @update:visible="sepDihapus = null">
    <div class="text-sm">
      SEP <b>{{ sepDihapus?.noSep }}</b> atas nama <b>{{ sepDihapus?.namaPasien ?? sepDihapus?.noKartu }}</b> akan dihapus di BPJS.
      SEP yang sudah dipakai untuk klaim tidak dapat dihapus.
    </div>
    <template #footer>
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="sepDihapus = null" />
      <CustomButton label="Hapus SEP" backgroundColor="bg-[#B42318]" @click="hapus" />
    </template>
  </Dialog>
</template>
