<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import HeaderFilter from "../../Layout/KonfigurasiLayarHeader.vue";
import { onMounted, ref, computed } from "vue";
import type { MenuItem } from "primevue/menuitem";
import TambahDataKonfigurasiLayar from "./SectionTambahKonfigurasiLayar.vue";
import NoData from "@/components/section/NoData.vue";
import { useConfigLayarAntrianStore } from "@/stores/antrian/configLayarAntrian";
import { utilsStore } from "@/stores/utils";
import EditDataKonfigurasiLayar from "./SectionEditKonfigurasiLayar.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import DeleteModalComponent from "@/components/Antrian/DeleteModalComponent.vue";

const pageType = ref("");

const configLayarAntrianStore = useConfigLayarAntrianStore();
const useUtilsStore = utilsStore();

const jadwalAntrianPayload = ref<any[]>();
const originalJadwalAntrianPayload = ref<any[]>(); // Store original data
const jadwalLayarAntrianProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
  nama_layar: "",
  tipe_layar: 0,
  aktif: undefined as boolean | undefined,
});

// Search and filter states
const searchQuery = ref("");
const selectedTipeLayar = ref(null);
const selectedStatus = ref<string[]>([]);
const fetchRequestId = ref(0);

const fetchJadwalAntrian = async () => {
  const currentId = ++fetchRequestId.value;
  useUtilsStore.setLoading(true);
  try {
    const namaParam =
      jadwalLayarAntrianProperties.value.nama_layar?.trim() || undefined;
    const tipeParam =
      jadwalLayarAntrianProperties.value.tipe_layar &&
      jadwalLayarAntrianProperties.value.tipe_layar > 0
        ? jadwalLayarAntrianProperties.value.tipe_layar
        : undefined;
    const aktifParam = jadwalLayarAntrianProperties.value.aktif;

    const response = await configLayarAntrianStore.getApi(
      jadwalLayarAntrianProperties.value.page,
      jadwalLayarAntrianProperties.value.page_size,
      namaParam,
      tipeParam,
      aktifParam
    );

    if (currentId === fetchRequestId.value) {
      console.log("Respon layar antrian get:", response?.payload);
      // ... existing code ...
      if (response && response.payload) {
        originalJadwalAntrianPayload.value = response.payload;
        jadwalAntrianPayload.value = response.payload;
        jadwalLayarAntrianProperties.value.total =
          response.properties?.total || response.payload.length;

        // Setelah tahu total, refresh opsi tipe layar berdasarkan SELURUH dataset saat ini (abaikan filter tipe)
        await fetchAvailableTipeLayarOptions();
      } else {
        // Jika response undefined (misal API return 404 untuk list kosong), kosongkan tampilan
        originalJadwalAntrianPayload.value = [];
        jadwalAntrianPayload.value = [];
        jadwalLayarAntrianProperties.value.total = 0;

        // Pastikan dropdown tipe tetap akurat (himpun dari seluruh dataset tanpa filter)
        await fetchAvailableTipeLayarOptions();
      }
    }
  } catch (error) {
    console.log(error);
    if (currentId === fetchRequestId.value) {
      // Perlakukan sebagai 'tidak ada data' agar UI menampilkan NoData
      originalJadwalAntrianPayload.value = [];
      jadwalAntrianPayload.value = [];
      jadwalLayarAntrianProperties.value.total = 0;
    }
  } finally {
    if (currentId === fetchRequestId.value) {
      useUtilsStore.setLoading(false);
    }
  }
};

const availableTipeCodes = ref<number[] | null>(null);
const fetchAvailableTipeLayarOptions = async () => {
  try {
    // Ambil SELURUH dataset tanpa filter nama maupun status
    const head = await configLayarAntrianStore.getApi(
      1,
      1,
      undefined, // tanpa filter nama
      undefined, // tanpa filter tipe
      undefined // tanpa filter status
    );
    const unfilteredTotal =
      head?.properties?.total ??
      (Array.isArray(head?.payload) ? head.payload.length : 0);

    const pageSize = unfilteredTotal > 0 ? unfilteredTotal : 1000; // fallback aman
    const resp = await configLayarAntrianStore.getApi(
      1,
      pageSize,
      undefined, // tanpa filter nama
      undefined, // tanpa filter tipe
      undefined // tanpa filter status
    );

    if (resp && Array.isArray(resp.payload)) {
      const codesSet = new Set<number>();
      for (const item of resp.payload) {
        const code = Number(item.tipeLayar ?? item.tipe_layar);
        if (!Number.isNaN(code)) codesSet.add(code);
      }

      // Pastikan tipe yang sedang dipilih tetap ada di opsi (mencegah label hilang)
      const selectedCode = jadwalLayarAntrianProperties.value.tipe_layar;
      if (selectedCode && selectedCode > 0) codesSet.add(selectedCode);

      availableTipeCodes.value = Array.from(codesSet);
    } else {
      availableTipeCodes.value = [];
    }
  } catch (e) {
    console.log("Gagal memuat daftar tipe layar:", e);
    availableTipeCodes.value = [];
  }
};

const adjustPageAfterDelete = () => {
  const { total, page, page_size } = jadwalLayarAntrianProperties.value;
  const newTotal = Math.max(0, (total || 0) - 1);
  const maxPage = Math.max(1, Math.ceil(newTotal / page_size));
  if (page > maxPage) {
    jadwalLayarAntrianProperties.value.page = maxPage;
  }
};

// Get unique tipe layar from database
const availableTipeLayar = computed(() => {
  // Jika sudah ada hasil komputasi global (unfiltered), gunakan itu
  if (availableTipeCodes.value && availableTipeCodes.value.length > 0) {
    const codesSet = new Set(availableTipeCodes.value);

    // Safety: paksa masukkan tipe yang sedang dipilih agar tidak hilang dari dropdown
    const selectedCode = jadwalLayarAntrianProperties.value.tipe_layar;
    if (selectedCode && selectedCode > 0) codesSet.add(selectedCode);

    return itemsLayar.value.filter((layar) =>
      codesSet.has(parseInt(layar.code))
    );
  }

  // Fallback: hitung dari payload halaman saat ini (termasuk menjaga selected)
  if (!originalJadwalAntrianPayload.value) return [];

  const unique = new Set(
    originalJadwalAntrianPayload.value
      .map((item) => Number(item.tipeLayar ?? item.tipe_layar))
      .filter((v) => !Number.isNaN(v))
  );

  const selectedCode = jadwalLayarAntrianProperties.value.tipe_layar;
  if (selectedCode && selectedCode > 0) unique.add(selectedCode);

  return itemsLayar.value.filter((layar) => unique.has(parseInt(layar.code)));
});

// Handle search from header
const handleSearch = (
  query: string,
  tipeLayar: any,
  statusFilters: string[]
) => {
  // set parameter pencarian untuk API
  jadwalLayarAntrianProperties.value.page = 1;
  jadwalLayarAntrianProperties.value.nama_layar = query || "";

  // tipe layar: jika ada pilihannya, pakai angkanya, kalau tidak ada pakai 0 (tanpa filter)
  jadwalLayarAntrianProperties.value.tipe_layar = tipeLayar
    ? parseInt(tipeLayar)
    : 0;

  // status: jika hanya satu dipilih, terjemahkan ke boolean; jika 0 atau 2 (keduanya), jangan kirim filter (undefined)
  if (statusFilters.length === 1) {
    jadwalLayarAntrianProperties.value.aktif =
      statusFilters[0] === "AKTIF" ? true : false;
  } else {
    jadwalLayarAntrianProperties.value.aktif = undefined;
  }

  // panggil API dengan parameter di atas
  fetchJadwalAntrian();
};

// Handle reset filters
const handleResetFilters = () => {
  searchQuery.value = "";
  selectedTipeLayar.value = null;
  selectedStatus.value = [];

  // Reset semua parameter pencarian
  jadwalLayarAntrianProperties.value.page = 1;
  jadwalLayarAntrianProperties.value.nama_layar = "";
  jadwalLayarAntrianProperties.value.tipe_layar = 0;
  jadwalLayarAntrianProperties.value.aktif = undefined;

  // Fetch data fresh dari server
  fetchJadwalAntrian();
};

const deleteLayarAntrian = async (layarAntrianUuid: string) => {
  useUtilsStore.setLoading(true);
  try {
    await configLayarAntrianStore.deleteLayarAntrian(layarAntrianUuid);

    // Hitung total baru secara optimistis
    const currentTotal = jadwalLayarAntrianProperties.value.total || 0;
    const newTotal = Math.max(0, currentTotal - 1);
    jadwalLayarAntrianProperties.value.total = newTotal;

    if (newTotal === 0) {
      // Kosongkan tampilan untuk filter aktif saat ini,
      // namun tetap refresh daftar opsi tipe secara GLOBAL agar dropdown akurat
      jadwalAntrianPayload.value = [];
      originalJadwalAntrianPayload.value = [];
      availableTipeCodes.value = [];

      await fetchAvailableTipeLayarOptions();
    } else {
      // Jika masih ada data, pastikan page tidak melebihi max page
      adjustPageAfterDelete();
    }

    // Selalu refresh data list berdasar filter aktif (aman walau hasilnya 0)
    await fetchJadwalAntrian();
  } catch (error) {
    console.log("Failed to delete layar antrian", error);
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const headerFilterRef = ref<typeof HeaderFilter>();

const deleteModal = ref({
  isVisible: false,
  entityName: "",
  layarAntrianUuid: "",
});

const showDeleteConfirmation = (rowData: any) => {
  deleteModal.value = {
    isVisible: true,
    entityName: rowData.namaLayar,
    layarAntrianUuid: rowData.uuid,
  };
};

const handleDeleteConfirm = async () => {
  await deleteLayarAntrian(deleteModal.value.layarAntrianUuid);
  deleteModal.value.isVisible = false;
};

// Handle delete modal close
const handleDeleteClose = () => {
  deleteModal.value.isVisible = false;
};

const dataBreadCrumb = ref<MenuItem[]>([]);

const changeSection = (label: string) => {
  if (dataBreadCrumb.value.length) {
    dataBreadCrumb.value[0] = { label: label };
  } else {
    dataBreadCrumb.value.push({ label: label });
  }
};

onMounted(() => {
  fetchJadwalAntrian();
});

const itemsLayar = ref([
  {
    code: "1",
    tipe_layar: "Layar 3 x 3 Panggilan",
  },
  {
    code: "2",
    tipe_layar: "Layar 3 x 2 Panggilan",
  },
  {
    code: "3",
    tipe_layar: "Layar 3 list & 3 Panggilan",
  },
  {
    code: "4",
    tipe_layar: "Layar 2 list & 2 Panggilan",
  },
  {
    code: "5",
    tipe_layar: "Layar 1 List, 1 Panggilan, 1 Gambar",
  },
]);

// Fungsi konverter tipe layar
const getTipeLayarDescription = (tipeLayarCode: number): string => {
  const tipeLayar = itemsLayar.value.find(
    (item) => parseInt(item.code) === tipeLayarCode
  );
  return tipeLayar ? tipeLayar.tipe_layar : `Tipe ${tipeLayarCode}`;
};

const isAdmisi = (row: any) =>
  row?.is_admisi === true || row?.isAdmisi === true;
const isPoli = (row: any) => row?.is_poli === true || row?.isPoli === true;
const isFarmasi = (row: any) =>
  row?.is_farmasi === true || row?.isFarmasi === true;

const dialogData = ref({
  isVisible: false,
  method: "add",
  title: "Tambah",
  payload: {},
});

function handleEdit(rowData: any) {
  dialogData.value = {
    isVisible: true,
    method: "edit",
    title: "Edit",
    payload: { ...rowData },
  };
}

const handlePage = (event: any) => {
  jadwalLayarAntrianProperties.value.page = event.page + 1;
  jadwalLayarAntrianProperties.value.page_size = event.rows;
  fetchJadwalAntrian();
};

function handleRefresh(updatedRow?: any) {
  dialogData.value.isVisible = false;

  // Optimistic update: jika baris yang disimpan tidak lagi cocok dengan filter aktif, hapus dari tabel
  if (
    updatedRow &&
    updatedRow.uuid &&
    Array.isArray(jadwalAntrianPayload.value)
  ) {
    const list = jadwalAntrianPayload.value;
    const idx = list.findIndex((x: any) => x.uuid === updatedRow.uuid);
    if (idx !== -1) {
      const currentTypeFilter =
        jadwalLayarAntrianProperties.value.tipe_layar || 0;
      const newType = Number(updatedRow.tipeLayar ?? updatedRow.tipe_layar);

      const currentStatusFilter = jadwalLayarAntrianProperties.value.aktif; // true | false | undefined
      const newStatus =
        typeof updatedRow.status === "boolean"
          ? updatedRow.status
          : updatedRow.aktif;

      const typeMismatch =
        currentTypeFilter > 0 &&
        !Number.isNaN(newType) &&
        newType !== currentTypeFilter;
      const statusMismatch =
        typeof currentStatusFilter === "boolean" &&
        newStatus !== currentStatusFilter;

      if (typeMismatch || statusMismatch) {
        // Tidak lagi cocok dengan filter aktif -> keluarkan dari tabel secara lokal
        list.splice(idx, 1);
        jadwalLayarAntrianProperties.value.total = Math.max(
          0,
          (jadwalLayarAntrianProperties.value.total || 0) - 1
        );
      } else {
        // Masih cocok dengan filter aktif -> perbarui datanya saja
        list[idx] = { ...list[idx], ...updatedRow };
      }
    }
  }

  // Refresh opsi tipe global dan sinkronkan ulang data dari server
  fetchAvailableTipeLayarOptions();
  fetchJadwalAntrian();
}

function handleClose() {
  dialogData.value.isVisible = false;
}

const selectedPatient = ref([]);
</script>

<template>
  <Card
    pt:body:class="overflow-auto pt-0 h-full"
    pt:content:class="overflow-auto h-full"
    class=""
  >
    <template #header>
      <HeaderFilter
        ref="headerFilterRef"
        :pageType="pageType"
        :availableTipeLayar="availableTipeLayar"
        @search="handleSearch"
        @reset="handleResetFilters"
        @daftar="changeSection('Daftar')"
        @refresh="fetchJadwalAntrian"
      />
    </template>
    <template #content>
      <DataTable
        v-if="jadwalLayarAntrianProperties.total > 0"
        v-model:selection="selectedPatient"
        :value="jadwalAntrianPayload"
        tableStyle="min-width: 50rem"
        stripedRows
        scrollable
        scrollHeight="flex"
        :pt="{ headerRow: 'text-SM' }"
      >
        <Column field="No." headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full font-semibold text-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="text-center">
              <div class="text-sm">
                {{
                  (jadwalLayarAntrianProperties.page - 1) *
                    jadwalLayarAntrianProperties.page_size +
                  slotProps.index +
                  1
                }}
              </div>
            </div>
          </template>
        </Column>
        <Column
          field="Nama Layar"
          header="Nama Layar"
          headerClass="bg-opensimrs-50"
        >
          <template #body="slotProps">
            <div class="text-SM max-w-28">{{ slotProps.data.namaLayar }}</div>
          </template>
        </Column>
        <Column
          field="Tipe Layar"
          header="Tipe Layar"
          headerClass="bg-opensimrs-50"
        >
          <template #body="slotProps">
            <div class="text-SM">
              {{ getTipeLayarDescription(slotProps.data.tipeLayar) }}
            </div>
          </template>
        </Column>
        <Column
          field="Isi Konten"
          header="Isi Konten"
          headerClass="bg-opensimrs-50"
        >
          <template #body="slotProps">
            <div class="flex flex-wrap gap-1">
              <template
                v-if="
                  isAdmisi(slotProps.data) ||
                  isPoli(slotProps.data) ||
                  isFarmasi(slotProps.data)
                "
              >
                <CustomChip
                  v-if="isAdmisi(slotProps.data)"
                  :showCheckedIcon="false"
                  label="Admisi"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="px-2 py-[2px] border-none whitespace-normal break-words leading-tight"
                />
                <CustomChip
                  v-if="isPoli(slotProps.data)"
                  :showCheckedIcon="false"
                  label="Poli"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="px-2 py-[2px] border-none whitespace-normal break-words leading-tight"
                />
                <CustomChip
                  v-if="isFarmasi(slotProps.data)"
                  :showCheckedIcon="false"
                  label="Farmasi"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="px-2 py-[2px] border-none whitespace-normal break-words leading-tight"
                />
              </template>
              <div v-else class="flex justify-center items-center">
                <PhMinus :size="18" weight="bold" />
              </div>
            </div>
          </template>
        </Column>
        <Column
          field="flash-text"
          header="Flash Text"
          headerClass="bg-opensimrs-50"
        >
          <template #body="slotProps">
            <div class="flex flex-wrap">
              <div
                v-if="
                  Array.isArray(slotProps.data.flashText) &&
                  slotProps.data.flashText.length > 0
                "
              >
                <CustomChip
                  v-for="(konten, index) in slotProps.data.flashText"
                  :key="index"
                  :showCheckedIcon="false"
                  :label="konten"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-auto min-h-[20px] mr-[5px] max-w-[320px] whitespace-normal break-words leading-tight px-2 py-1 border-none"
                />
              </div>
              <div v-else class="flex justify-center items-center">
                <PhMinus :size="18" weight="bold" />
              </div>
            </div>
          </template>
        </Column>
        <Column
          field="status"
          headerClass="bg-opensimrs-50 items-center justify-center"
        >
          <template #header>
            <div class="w-full font-semibold text-center">Status</div>
          </template>
          <template #body="slotProps">
            <div class="flex justify-center items-center min-w-[120px]">
              <CustomChip
                :label="slotProps.data.status ? 'AKTIF' : 'NON-AKTIF'"
                :textColor="
                  slotProps.data.status ? 'text-white' : 'text-[#80868d]'
                "
                :bgColor="slotProps.data.status ? 'bg-opensimrs-300' : 'bg-white'"
                :borderColor="
                  slotProps.data.status ? 'border-none' : 'border-[#80868d]'
                "
                :icon-color="slotProps.data.status ? 'white' : '#80868d'"
                customClass="text-xs font-semibold h-6 flex"
              />
            </div>
          </template>
        </Column>
        <Column field="Action" headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full font-semibold text-center">Action</div>
          </template>
          <template #body="slotProps">
            <div class="flex gap-2.5 justify-center items-center">
              <div title="Edit">
                <CustomButton
                  label=""
                  background-color="bg-[#3D84E5] rounded-lg"
                  @click="handleEdit(slotProps.data)"
                >
                  <PhPencilSimple :size="18" color="#ffffff" weight="fill" />
                </CustomButton>
              </div>
              <div title="Hapus">
                <CustomButton
                  label=""
                  background-color="bg-danger-300 rounded-lg"
                  @click="showDeleteConfirmation(slotProps.data)"
                >
                  <PhTrash :size="18" color="#ffffff" weight="fill" />
                </CustomButton>
              </div>
            </div>
          </template>
        </Column>
      </DataTable>

      <NoData v-else />
      <TambahDataKonfigurasiLayar
        :full-screen="true"
        v-model:isDialogVisible="dialogData.isVisible"
        :title="dialogData.title"
        :method="dialogData.method"
        @close="handleClose"
        @refresh="handleRefresh"
      />
      <EditDataKonfigurasiLayar
        :full-screen="true"
        v-model:isDialogVisible="dialogData.isVisible"
        :title="dialogData.title"
        :method="dialogData.method"
        @close="handleClose"
        @refresh="handleRefresh"
        :payload="dialogData.payload"
      />
      <DeleteModalComponent
        :isVisible="deleteModal.isVisible"
        :entityName="deleteModal.entityName"
        @close="handleDeleteClose"
        @confirm="handleDeleteConfirm"
      />
    </template>
    <template #footer>
      <div class="flex justify-between px-5 py-2.5">
        <CustomPaginator
          class="ml-auto"
          :rows="jadwalLayarAntrianProperties.page_size"
          :totalRecords="jadwalLayarAntrianProperties.total"
          :rowsPerPageOptions="[10, 20, 30]"
          @page="handlePage"
        />
      </div>
    </template>
  </Card>
</template>

<style></style>
