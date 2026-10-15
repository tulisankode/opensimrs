<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import KonfigurasiJadwalHeader from "../../Layout/KonfigurasiJadwalHeader.vue";
import { onMounted, ref, computed } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import EditDataKonfigurasiJadwal from "./SectionEditKonfigurasiJadwal.vue";
import NoData from "@/components/section/NoData.vue";
import { useJadwalDokterStore } from "@/stores/antrian/jadwalDokter";
import { utilsStore } from "@/stores/utils";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import DeleteModalComponent from "@/components/Antrian/DeleteModalComponent.vue";

const headerFilterRef = ref<typeof KonfigurasiJadwalHeader>();
const resetFilter = () => {
  headerFilterRef.value?.resetFilter();
};

const jadwalDokterStore = useJadwalDokterStore();
const utils = utilsStore();

const jadwalDokterPayload = ref<any[]>([]);
const allPoliData = ref<any[]>([]);
const allDokterData = ref<
  Array<{ uuid: string; name: string; poliUuids: string[] }>
>([]);

const allSchedulesPayload = ref<any[]>([]);
const jadwalDokterProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Utilities: builder untuk menghindari duplikasi mapping
const buildPoliOptionsFromPayload = (payload: any[]) => {
  const poliMap = new Map<string, { uuid: string; name: string }>();
  payload.forEach((item: any) => {
    const p = item.poli;
    if (p?.uuid) {
      poliMap.set(p.uuid, { uuid: p.uuid, name: p.name });
    }
  });
  return Array.from(poliMap.values());
};

const buildDokterOptionsFromPayload = (
  payload: any[]
): Array<{ uuid: string; name: string; poliUuids: string[] }> => {
  const dokterMap = new Map<
    string,
    { uuid: string; name: string; poliUuids: Set<string> }
  >();
  payload.forEach((item: any) => {
    const d = item.doctor;
    const poliUuid = item.poli?.uuid;
    if (!d?.uuid) return;
    if (!dokterMap.has(d.uuid)) {
      dokterMap.set(d.uuid, {
        uuid: d.uuid,
        name: d.name,
        poliUuids: new Set<string>(),
      });
    }
    if (poliUuid) {
      dokterMap.get(d.uuid)!.poliUuids.add(poliUuid);
    }
  });
  return Array.from(dokterMap.values()).map((d) => ({
    uuid: d.uuid,
    name: d.name,
    poliUuids: Array.from(d.poliUuids),
  }));
};

// Konsolidasi fetch referensi poli & dokter ke satu fungsi
const fetchAllReferenceData = async () => {
  try {
    const response = await jadwalDokterStore.getApi(1, 1000, undefined);
    if (response?.payload) {
      allPoliData.value = buildPoliOptionsFromPayload(response.payload);
      allDokterData.value = buildDokterOptionsFromPayload(response.payload);
      allSchedulesPayload.value = response.payload;
    }
  } catch (error) {
    console.error("Failed to fetch all reference data", error);
  }
};

const excludedDoctorUuidsByPoli = computed(() => {
  const map: Record<string, Set<string>> = {};
  (allSchedulesPayload.value || []).forEach((item: any) => {
    const poliUuid = item?.poli?.uuid;
    const doctorUuid = item?.doctor?.uuid;
    if (!poliUuid || !doctorUuid) return;
    if (!map[poliUuid]) map[poliUuid] = new Set<string>();
    map[poliUuid]!.add(doctorUuid);
  });
  return Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k, Array.from(v)])
  ) as Record<string, string[]>;
});

const fetchJadwalDokter = async () => {
  utils.setLoading(true);
  try {
    const response = await jadwalDokterStore.getApi(
      jadwalDokterProperties.value.page,
      jadwalDokterProperties.value.page_size,
      filterCriteria.value.aktif,
      filterCriteria.value.poliUuid || undefined,
      filterCriteria.value.dokterUuid || undefined
    );
    if (response && response.payload) {
      jadwalDokterPayload.value = response.payload;
      jadwalDokterProperties.value.total = response.properties.total;

      if (allPoliData.value.length === 0) {
        allPoliData.value = buildPoliOptionsFromPayload(response.payload);
      }
      if (allDokterData.value.length === 0) {
        allDokterData.value = buildDokterOptionsFromPayload(response.payload);
      }
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    jadwalDokterPayload.value = [];
  } finally {
    utils.setLoading(false);
  }
};

const expandedRows = ref();

const dialogData = ref({
  isVisible: false,
  method: "add",
  title: "Tambah",
  editData: {},
});

const deleteModalData = ref({
  isVisible: false,
  doctorUuid: "",
  poliUuid: "",
  doctorName: "",
});

// Fungsi untuk menampilkan modal konfirmasi
const showDeleteModal = (
  doctorUuid: string,
  poliUuid: string,
  doctorName: string
) => {
  deleteModalData.value = {
    isVisible: true,
    doctorUuid,
    poliUuid,
    doctorName,
  };
};

// Fungsi untuk menutup modal
const closeDeleteModal = () => {
  deleteModalData.value.isVisible = false;
};

// Fungsi untuk konfirmasi penghapusan
const confirmDelete = async () => {
  utils.setLoading(true);
  try {
    const response = await jadwalDokterStore.deleteDoctor(
      deleteModalData.value.doctorUuid,
      deleteModalData.value.poliUuid
    );
    await fetchJadwalDokter();
    await fetchAllReferenceData();
  } catch (error) {
    console.error("Failed to delete doctor", error);
  } finally {
    utils.setLoading(false);
  }
};

const existingDoctorUuids = computed(() =>
  jadwalDokterPayload.value.map((item) => item.doctor.uuid)
);

const dokterOptions = computed(() => {
  // Utamakan referensi global; fallback ke payload tabel bila referensi belum siap
  return allDokterData.value.length
    ? allDokterData.value
    : buildDokterOptionsFromPayload(jadwalDokterPayload.value);
});

const poliOptions = computed(() => {
  // Utamakan referensi global; fallback ke payload tabel bila referensi belum siap
  return allPoliData.value.length
    ? allPoliData.value
    : buildPoliOptionsFromPayload(jadwalDokterPayload.value);
});

const fetchAllPoliData = async () => {
  // Konsolidasikan melalui fetchAllReferenceData untuk menghindari duplikasi request/logika
  await fetchAllReferenceData();
};

const fetchAllDokterData = async () => {
  // Konsolidasikan melalui fetchAllReferenceData untuk menghindari duplikasi request/logika
  await fetchAllReferenceData();
};

const handleEdit = (data: any) => {
  dialogData.value = {
    isVisible: true,
    method: "edit",
    title: "Edit",
    editData: data,
  };
};

const handleClose = () => {
  dialogData.value.isVisible = false;
};

const handleRefresh = async () => {
  dialogData.value.isVisible = false; // tutup dialog
  // Penting: refresh tabel + refresh referensi untuk update excludedDoctorUuidsByPoli
  await fetchJadwalDokter();
  await fetchAllReferenceData();
};

const handlePage = (event: any) => {
  jadwalDokterProperties.value.page = event.page + 1;
  jadwalDokterProperties.value.page_size = event.rows;
  fetchJadwalDokter();
};

const filterCriteria = ref({
  dokterUuid: "",
  poliUuid: "",
  aktif: undefined as boolean | undefined,
  isValidSearch: true,
});

const paginatorKey = ref(0);

function handleHeaderSearch(payload: {
  dokterUuid?: string;
  poliUuid?: string;
  aktif?: boolean | undefined;
  isValidSearch?: boolean;
}) {
  filterCriteria.value = payload as any;

  if (payload.isValidSearch !== false) {
    // Reset ke halaman pertama lalu fetch ulang
    jadwalDokterProperties.value.page = 1;
    paginatorKey.value++; // paksa paginator kembali ke page 1
    fetchJadwalDokter();
  }
}

const displayedJadwalDokter = computed(() => {
  // Jika pencarian ditandai tidak valid (contoh: teks filter poli tidak cocok dengan opsi),
  // kembalikan data kosong agar tabel menampilkan "No data available".
  if (filterCriteria.value.isValidSearch === false) {
    return [];
  }
  // Karena filtering sekarang dilakukan di backend, langsung return semua data
  return jadwalDokterPayload.value;
});

onMounted(() => {
  fetchAllReferenceData();
  fetchJadwalDokter();
});
</script>

<template>
  <Card
    pt:body:class="overflow-auto pt-0 h-full"
    pt:content:class="overflow-auto h-full"
    class=""
  >
    <template #header>
      <konfigurasi-jadwal-header
        @refresh="handleRefresh"
        ref="headerFilterRef"
        :excludedDoctorUuids="existingDoctorUuids"
        :excludedDoctorUuidsByPoli="excludedDoctorUuidsByPoli"
        @search="handleHeaderSearch"
        :dokterOptions="dokterOptions"
        :poliOptions="poliOptions"
        :jadwalDokterData="jadwalDokterPayload"
      />
    </template>
    <template #content>
      <DataTable
        v-model:expandedRows="expandedRows"
        v-if="displayedJadwalDokter.length"
        :value="displayedJadwalDokter"
        tableStyle="min-width: 50rem"
        stripedRows
        scrollable
        scrollHeight="flex"
        :pt="{ headerRow: 'text-SM' }"
      >
        <Column
          expander
          style="width: 5rem"
          header-class="text-black bg-opensimrs-50"
        />
        <Column header="No." header-class="text-black bg-opensimrs-50">
          <template #body="slotProps">
            <div class="">
              {{
                (jadwalDokterProperties.page - 1) *
                  jadwalDokterProperties.page_size +
                slotProps.index +
                1
              }}
            </div>
          </template>
        </Column>
        <Column
          header="Nama Dokter"
          header-class="text-black bg-opensimrs-50"
          class="text-sm"
        >
          <template #body="slotProps">
            <div class="text-sm">{{ slotProps.data.doctor.name }}</div>
          </template>
        </Column>
        <Column
          header="Jumlah Jadwal"
          header-class="text-black bg-opensimrs-50"
          class="text-sm"
        >
          <template #body="slotProps">
            <div class="text-sm">
              {{ slotProps.data.jadwalDokter.length }} Jadwal
            </div>
          </template>
        </Column>
        <Column
          header="Poli"
          header-class="text-black bg-opensimrs-50"
          class="text-sm"
        >
          <template #body="slotProps">
            <div class="text-sm">
              {{ slotProps.data.poli.name }}
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
                  @click="
                    showDeleteModal(
                      slotProps.data.doctor.uuid,
                      slotProps.data.poli.uuid,
                      slotProps.data.doctor.name
                    )
                  "
                >
                  <PhTrash :size="18" color="#ffffff" weight="fill" />
                </CustomButton>
              </div>
            </div>
          </template>
        </Column>
        <template #expansion="slotProps">
          <div class="p-3 -mx-3 -my-1.5 bg-opensimrs-100">
            <DataTable
              :value="slotProps.data.jadwalDokter"
              class="overflow-hidden text-sm rounded-lg bg-opensimrs-50"
            >
              <Column
                header="No."
                header-class="text-black bg-opensimrs-50"
                class="flex justify-center items-center text-sm"
              >
                <template #body="slotProps">
                  {{ slotProps.index + 1 }}
                </template>
              </Column>
              <Column
                header="Hari"
                header-class="text-black bg-opensimrs-50"
                class="text-sm"
              >
                <template #body="slotProps">
                  {{ slotProps.data.day }}
                </template>
              </Column>
              <Column
                field="jam_praktek"
                header-class="text-black bg-opensimrs-50"
                class="text-sm"
              >
                <template #header>
                  <div class="flex justify-center items-center w-full h-full">
                    <div class="font-bold">Jam Praktek</div>
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center">
                    {{ slotProps.data.startTime }} -
                    {{ slotProps.data.endTime }}
                  </div>
                </template>
              </Column>

              <Column
                field="kuota_jkn"
                header-class="text-center text-black bg-opensimrs-50"
                class="text-sm"
              >
                <template #header>
                  <div class="flex justify-center items-center w-full h-full">
                    <div class="font-bold">Kuota JKN</div>
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center">
                    {{ slotProps.data.kuotaJkn }} Slot
                  </div>
                </template>
              </Column>
              <Column
                field="kuota_non_jkn"
                header-class="text-center text-black bg-opensimrs-50"
                class="text-sm"
              >
                <template #header>
                  <div class="flex justify-center items-center w-full h-full">
                    <div class="font-bold">Kuota Non-JKN</div>
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center">
                    {{ slotProps.data.kuotaNonJkn }} Slot
                  </div>
                </template>
              </Column>
              <Column
                field="total_kuota"
                headerClass="text-center text-black bg-opensimrs-50 "
                class="text-sm"
              >
                <template #header>
                  <div class="flex justify-center items-center w-full h-full">
                    <div class="font-bold">Total Kuota</div>
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center">
                    {{ slotProps.data.kuota }} Slot
                  </div>
                </template>
              </Column>
              <Column
                field="durasi_pasien"
                header-class="text-black bg-opensimrs-50"
                class="text-sm"
              >
                <template #header>
                  <div class="flex justify-center items-center w-full h-full">
                    <div class="font-bold">Durasi Per-Pasien</div>
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center">
                    {{ slotProps.data.durasiPelayanan }} Menit
                  </div>
                </template>
              </Column>
              <Column
                field="status"
                header="Status"
                headerClass="bg-opensimrs-50 flex items-center justify-center"
                class="flex justify-center items-center text-sm"
              >
                <template #body="slotProps">
                  <div class="min-w-MD">
                    <CustomChip
                      :label="slotProps.data.status"
                      :textColor="
                        slotProps.data.status === 'aktif'
                          ? 'text-white'
                          : 'text-[#80868d]'
                      "
                      :bgColor="
                        slotProps.data.status === 'aktif'
                          ? 'bg-opensimrs-300'
                          : 'bg-white'
                      "
                      :borderColor="
                        slotProps.data.status === 'aktif'
                          ? 'border-none'
                          : 'border-[#80868d]'
                      "
                      :icon-color="
                        slotProps.data.status === 'aktif' ? 'white' : '#80868d'
                      "
                      customClass="text-xs font-semibold h-6 flex"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </template>
      </DataTable>
      <NoData v-else />
      <EditDataKonfigurasiJadwal
        v-model:isDialogVisible="dialogData.isVisible"
        :title="dialogData.title"
        :method="dialogData.method"
        :editData="dialogData.editData"
        @close="handleClose"
        @refresh="handleRefresh"
      />
      <DeleteModalComponent
        :isVisible="deleteModalData.isVisible"
        :entityName="deleteModalData.doctorName"
        @close="closeDeleteModal"
        @confirm="confirmDelete"
      />
    </template>
    <template #footer>
      <div class="flex justify-between px-5 py-2.5">
        <CustomPaginator
          class="ml-auto"
          :key="`paginator-${paginatorKey}`"
          :rows="jadwalDokterProperties.page_size"
          :totalRecords="jadwalDokterProperties.total"
          :rowsPerPageOptions="[10, 20, 30]"
          @page="handlePage"
        />
      </div>
    </template>
  </Card>
</template>

<style></style>
