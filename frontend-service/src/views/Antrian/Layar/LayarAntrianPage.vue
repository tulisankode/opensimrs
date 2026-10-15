<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import { namaFaskesAktif } from "@/utils/Helpers";
const namaFaskes = namaFaskesAktif();
import CustomChip from "@/components/Base/CustomChip.vue";
import HeaderFilter from "../Layout/LayarHeader.vue";
import { onMounted, ref, computed, onUnmounted, watch } from "vue";
import { useToast } from "primevue/usetoast";
import {
  adaSuaraIndonesia,
  siapkanSuara,
  teksPanggilanAdmisi,
  teksPanggilanPoli,
  umumkan,
} from "@/utils/pengumumanAntrian";
import { fiturAktif } from "@/stores/modulFaskes";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import type { MenuItem } from "primevue/menuitem";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useConfigLayarAntrianStore } from "@/stores/antrian/configLayarAntrian";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import PreviewLayout3x3 from "@/views/Antrian/Konfigurasi/KonfigurasiLayar/PreviewLayar/Layout3x3Panggilan.vue";
import PreviewLayout3x2 from "@/views/Antrian/Konfigurasi/KonfigurasiLayar/PreviewLayar/Layout3x2Panggilan.vue";
import PreviewLayoutList3Panggilan3 from "@/views/Antrian/Konfigurasi/KonfigurasiLayar/PreviewLayar/LayoutList3Panggilan3.vue";
import PreviewLayout2List2Panggilan from "@/views/Antrian/Konfigurasi/KonfigurasiLayar/PreviewLayar/Layout2List2Panggilan.vue";
import PreviewLayout1List1Panggilan from "@/views/Antrian/Konfigurasi/KonfigurasiLayar/PreviewLayar/Layout1List1Panggilan.vue";
import opensimrsLogo from "@/assets/images/opensimrs-logo.png";
import opensimrsText from "@/assets/images/opensimrs.png";

const pageType = ref("");
const route = useRoute();

const marqueeDuration = ref(20); // durasi dalam detik

const searchQuery = ref("");
const selectedStatus = ref<string[]>([]);

const configLayarAntrianStore = useConfigLayarAntrianStore();
const toast = useToast();
const useUtilsStore = utilsStore();

const jadwalAntrianPayload = ref<any[]>();
const jadwalLayarAntrianProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
  nama_layar: "",
  aktif: undefined as boolean | undefined,
});

const antrianCallPayload = ref();
const antrianCallProperties = ref({
  status_panggilan: 0,
});

const admisiCallsActive = ref<any[]>([]);
const admisiCallsWaiting = ref<any[]>([]);

const poliCallsActive = ref<any[]>([]);
const poliCallsWaiting = ref<any[]>([]);

const fetchLayarAntrian = async () => {
  useUtilsStore.setLoading(true);
  try {
    const res = await configLayarAntrianStore.getApi(
      jadwalLayarAntrianProperties.value.page,
      jadwalLayarAntrianProperties.value.page_size,
      jadwalLayarAntrianProperties.value.nama_layar,
      undefined,
      jadwalLayarAntrianProperties.value.aktif
    );
    jadwalAntrianPayload.value = res.payload;
    jadwalLayarAntrianProperties.value.total = res.properties.total;

    console.log("layar Antrian:", res);
  } catch (error) {
    console.log(error);
    // Pastikan state kosong saat error
    jadwalAntrianPayload.value = [];
    jadwalLayarAntrianProperties.value.total = 0;
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const fetchLayarPoli = async (diam = false) => {
  if (!diam) useUtilsStore.setLoading(true);
  try {
    const res = await configLayarAntrianStore.getApiLayarPoli();
    if (res && Array.isArray(res.payload)) {
      poliCallsActive.value = res.payload.filter(
        (item: any) => item.statusPanggilan === 1
      );
      poliCallsWaiting.value = res.payload.filter(
        (item: any) => item.statusPanggilan === 0
      );
    } else {
      poliCallsActive.value = [];
      poliCallsWaiting.value = [];
    }
  } catch (error) {
    console.log(error);
    poliCallsActive.value = [];
    poliCallsWaiting.value = [];
  } finally {
    if (!diam) useUtilsStore.setLoading(false);
  }
};

const handlePage = (event: any) => {
  jadwalLayarAntrianProperties.value.page = event.page + 1;
  jadwalLayarAntrianProperties.value.page_size = event.rows;
  fetchLayarAntrian();
};

const fetchAntrianCall = async (diam = false) => {
  if (!diam) useUtilsStore.setLoading(true);
  try {
    // Ambil kedua status sekaligus sesuai kebutuhan layout
    const [resActive, resWaiting] = await Promise.all([
      configLayarAntrianStore.getAntrianCall(1),
      configLayarAntrianStore.getAntrianCall(0),
    ]);
    admisiCallsActive.value = Array.isArray(resActive.payload)
      ? resActive.payload
      : [];
    admisiCallsWaiting.value = Array.isArray(resWaiting.payload)
      ? resWaiting.payload
      : [];

    // Backward-compatible: masih simpan payload lama jika diperlukan
    antrianCallPayload.value = resActive.payload;
  } catch (error) {
    console.log("error fetch antrian call:", error);
    admisiCallsActive.value = [];
    admisiCallsWaiting.value = [];
  } finally {
    if (!diam) useUtilsStore.setLoading(false);
  }
};

const headerFilterRef = ref<typeof HeaderFilter>();

const dataBreadCrumb = ref<MenuItem[]>([]);

const changeSection = (label: string) => {
  if (dataBreadCrumb.value.length) {
    dataBreadCrumb.value[0] = { label: label };
  } else {
    dataBreadCrumb.value.push({ label: label });
  }
};

onMounted(() => {
  fetchLayarAntrian();
  fetchAntrianCall();
  fetchLayarPoli();
});

const selectedPatient = ref([]);

const convertLayarType = (type: number): string => {
  const layarTypes = {
    1: "Layar 3 x 3 Panggilan",
    2: "Layar 3 x 2 Panggilan",
    3: "Layar 3 List & 3 Panggilan",
    4: "Layar 2 List & 2 Panggilan",
    5: "Layar 1 List, 1 Panggilan, 1 Gambar",
  };
  return layarTypes[type as keyof typeof layarTypes] || "Unknown Type";
};

const isAdmisi = (row: any) =>
  row?.is_admisi === true || row?.isAdmisi === true;
const isPoli = (row: any) => row?.is_poli === true || row?.isPoli === true;
const isFarmasi = (row: any) =>
  row?.is_farmasi === true || row?.isFarmasi === true;

const handleSearch = (query: string, statusFilters: string[]) => {
  // set parameter pencarian untuk API
  jadwalLayarAntrianProperties.value.page = 1;
  jadwalLayarAntrianProperties.value.nama_layar = query || "";

  // status: jika hanya satu dipilih, terjemahkan ke boolean; jika 0 atau 2 (keduanya), jangan kirim filter (undefined)
  if (statusFilters.length === 1) {
    jadwalLayarAntrianProperties.value.aktif =
      statusFilters[0] === "AKTIF" ? true : false;
  } else {
    jadwalLayarAntrianProperties.value.aktif = undefined;
  }

  // panggil API dengan parameter di atas
  fetchLayarAntrian();
};

const handleResetFilters = () => {
  searchQuery.value = "";
  selectedStatus.value = [];

  // Reset semua parameter pencarian
  jadwalLayarAntrianProperties.value.page = 1;
  jadwalLayarAntrianProperties.value.nama_layar = "";
  jadwalLayarAntrianProperties.value.aktif = undefined;

  // Fetch data fresh dari server
  fetchLayarAntrian();
};

const showPreviewDialog = ref(false);
const previewTitle = ref("");
const previewType = ref<number | null>(null);
const previewRow = ref<any | null>(null);

const activeOrderForRow = (row: any): Array<"poli" | "admisi" | "farmasi"> => {
  const defaultOrder: Array<"poli" | "admisi" | "farmasi"> = [
    "admisi",
    "poli",
    "farmasi",
  ];
  return defaultOrder.filter((k) =>
    k === "poli" ? isPoli(row) : k === "admisi" ? isAdmisi(row) : isFarmasi(row)
  );
};

const getRowPoliUuids = (row: any): string[] => {
  const lokasi = Array.isArray(row?.lokasi) ? row.lokasi : [];
  return lokasi
    .map((x: any) => x?.uuid)
    .filter((x: any) => typeof x === "string" && x);
};

const getPoliLokasiUuid = (item: any): string | null => {
  return (
    item?.patient_data?.jadwal_dokter?.lokasi_uuid ??
    item?.patientData?.jadwalDokter?.lokasiUuid ??
    item?.patientData?.jadwalDokter?.lokasi_uuid ??
    null
  );
};

const filterPoliCallsByRow = (calls: any[], row: any): any[] => {
  const uuids = new Set(getRowPoliUuids(row));
  if (!uuids.size) return Array.isArray(calls) ? calls : [];
  return (Array.isArray(calls) ? calls : []).filter((item: any) => {
    const lokasiUuid = getPoliLokasiUuid(item);
    return !!lokasiUuid && uuids.has(lokasiUuid);
  });
};

// ── Panggilan bersuara saat layar ditampilkan ──────────────────────────────
// Selama layar terbuka, data panggilan diperbarui berkala. Panggilan baru atau panggilan ulang
// (status 1 dengan updated_at berubah) diumumkan dengan bunyi & suara bahasa Indonesia.
const INTERVAL_PANTAU_MS = 3000;
let pantauId: number | null = null;
const panggilanTerakhir = new Map<string, string>();

const kunciPanggilan = (item: any) => String(item?.updatedAt ?? item?.updated_at ?? "");

const umumkanPanggilanBaru = (awal: boolean) => {
  const row = previewRow.value;
  if (!row) return;
  const daftar: Array<{ item: any; teks: string }> = [];
  if (isAdmisi(row)) {
    for (const item of admisiCallsActive.value) {
      const nomor = item?.patientData?.antrian?.noAntrianAdmisi;
      if (nomor) daftar.push({ item, teks: teksPanggilanAdmisi(nomor) });
    }
  }
  if (isPoli(row)) {
    for (const item of filterPoliCallsByRow(poliCallsActive.value, row)) {
      const nomor = item?.patientData?.antrian?.noAntrianPoli;
      const jd = item?.patientData?.jadwalDokter ?? {};
      if (nomor) daftar.push({ item, teks: teksPanggilanPoli(nomor, jd.namaPoli, jd.namaDokter) });
    }
  }
  for (const { item, teks } of daftar) {
    const kunci = kunciPanggilan(item);
    if (panggilanTerakhir.get(item.uuid) === kunci) continue;
    panggilanTerakhir.set(item.uuid, kunci);
    // Saat layar baru dibuka, panggilan yang sudah ada tidak diumumkan ulang.
    if (!awal) umumkan(teks);
  }
};

const pantauPanggilan = async (awal = false) => {
  await Promise.all([fetchAntrianCall(true), fetchLayarPoli(true)]);
  umumkanPanggilanBaru(awal);
};

const hentikanPantau = () => {
  if (pantauId) clearInterval(pantauId);
  pantauId = null;
};

const mulaiPantau = () => {
  hentikanPantau();
  panggilanTerakhir.clear();
  pantauPanggilan(true);
  pantauId = window.setInterval(() => pantauPanggilan(), INTERVAL_PANTAU_MS);
};

const tesSuara = () => {
  siapkanSuara();
  umumkan(teksPanggilanPoli("PU-01-001", "Poli Umum"));
  if (!adaSuaraIndonesia()) {
    toast.add({
      severity: "warn",
      summary: "Suara bahasa Indonesia tidak ditemukan",
      detail: "Pasang suara Indonesia di sistem operasi atau gunakan Google Chrome agar pengucapan benar.",
      life: 8000,
    });
  }
};

// ── Link mode kiosk untuk TV ───────────────────────────────────────────────
const dialogKiosk = ref(false);
const kiosk = ref<{ nama: string; uuid: string; url: string }>({ nama: "", uuid: "", url: "" });

const susunUrlKiosk = (uuid: string, kunci: string) =>
  `${window.location.origin}/layar/${uuid}?kunci=${encodeURIComponent(kunci)}`;

const perintahChrome = computed(
  () => `chrome --kiosk --autoplay-policy=no-user-gesture-required --noerrdialogs --disable-session-crashed-bubble "${kiosk.value.url}"`
);

const bukaLinkKiosk = async (row: any) => {
  const res = await configLayarAntrianStore.getKunciKiosk(row.uuid);
  if (!res?.payload?.kunci) return;
  kiosk.value = { nama: row.namaLayar ?? "", uuid: row.uuid, url: susunUrlKiosk(row.uuid, res.payload.kunci) };
  dialogKiosk.value = true;
};

const salin = async (teks: string) => {
  try {
    await navigator.clipboard.writeText(teks);
    toast.add({ severity: "success", summary: "Tersalin", life: 2500 });
  } catch {
    toast.add({ severity: "warn", summary: "Gagal menyalin", detail: "Salin manual dari kolom teks.", life: 4000 });
  }
};

const bukaKiosk = () => window.open(kiosk.value.url, "_blank");

const buatUlangKunci = async () => {
  const res = await configLayarAntrianStore.buatUlangKunciKiosk(kiosk.value.uuid);
  if (!res?.payload?.kunci) return;
  kiosk.value.url = susunUrlKiosk(kiosk.value.uuid, res.payload.kunci);
  toast.add({
    severity: "info",
    summary: "Kunci baru dibuat",
    detail: "Link lama tidak berlaku lagi. Perbarui URL di semua TV layar ini.",
    life: 6000,
  });
};

const openPreview = (row: any) => {
  siapkanSuara();
  previewRow.value = row;
  // tipeLayar sudah numeric sesuai convertLayarType di kolom; gunakan langsung
  previewType.value = row?.tipeLayar ?? 0;
  previewTitle.value = `Preview - ${row?.namaLayar ?? ""} (${convertLayarType(
    previewType.value || 0
  )})`;
  showPreviewDialog.value = true;
};

const closePreview = () => {
  showPreviewDialog.value = false;
};

watch(showPreviewDialog, (terbuka) => (terbuka ? mulaiPantau() : hentikanPantau()));

const previewComponent = computed(() => {
  switch (previewType.value) {
    case 1:
      return PreviewLayout3x3;
    case 2:
      return PreviewLayout3x2;
    case 3:
      return PreviewLayoutList3Panggilan3;
    case 4:
      return PreviewLayout2List2Panggilan;
    case 5:
      return PreviewLayout1List1Panggilan;
    default:
      return null;
  }
});

const previewProps = computed(() => {
  const row = previewRow.value || {};
  const payload = Array.isArray(row?.payload) ? row.payload : [];
  switch (previewType.value) {
    case 1: // 3x3 panggilan
      return {
        payload,
        isPoli: isPoli(row),
        isAdmisi: isAdmisi(row),
        isFarmasi: isFarmasi(row),
        activeOrder: activeOrderForRow(row),
        admisiCallsActive: admisiCallsActive.value,
        poliCallsActive: isPoli(row)
          ? filterPoliCallsByRow(poliCallsActive.value, row)
          : [],
      };
    case 2: // 3x2 panggilan
      return {
        payload,
        isPoli: isPoli(row),
        isAdmisi: isAdmisi(row),
        isFarmasi: isFarmasi(row),
        activeOrder: activeOrderForRow(row),
        admisiCallsActive: admisiCallsActive.value,
        poliCallsActive: isPoli(row)
          ? filterPoliCallsByRow(poliCallsActive.value, row)
          : [],
      };
    case 3: // 3 list & 3 panggilan
      return {
        payload,
        isPoli: isPoli(row),
        isAdmisi: isAdmisi(row),
        isFarmasi: isFarmasi(row),
        activeOrder: activeOrderForRow(row),
        admisiCallsWaiting: admisiCallsWaiting.value,
        poliCallsWaiting: isPoli(row)
          ? filterPoliCallsByRow(poliCallsWaiting.value, row)
          : [],
        admisiCallsActive: admisiCallsActive.value,
        poliCallsActive: isPoli(row)
          ? filterPoliCallsByRow(poliCallsActive.value, row)
          : [],
      };
    case 4: // 2 list & 2 panggilan
      return {
        isPoli: isPoli(row),
        isAdmisi: isAdmisi(row),
        isFarmasi: isFarmasi(row),
        activeOrder: activeOrderForRow(row),
        admisiCallsWaiting: admisiCallsWaiting.value,
        poliCallsWaiting: isPoli(row)
          ? filterPoliCallsByRow(poliCallsWaiting.value, row)
          : [],
        admisiCallsActive: admisiCallsActive.value,
        poliCallsActive: isPoli(row)
          ? filterPoliCallsByRow(poliCallsActive.value, row)
          : [],
      };
    case 5: // 1 list, 1 panggilan, 1 Youtube
      return {
        isPoli: isPoli(row),
        isAdmisi: isAdmisi(row),
        isFarmasi: isFarmasi(row),
        activeOrder: activeOrderForRow(row),
        media: (row?.media ?? row?.payload?.media ?? "") || "",
        admisiCallsWaiting: admisiCallsWaiting.value,
        poliCallsWaiting: isPoli(row)
          ? filterPoliCallsByRow(poliCallsWaiting.value, row)
          : [],
        admisiCallsActive: admisiCallsActive.value,
        poliCallsActive: isPoli(row)
          ? filterPoliCallsByRow(poliCallsActive.value, row)
          : [],
      };
    default:
      return {};
  }
});

// Flash text untuk running text di bagian bawah preview dialog
const previewFlashText = computed<string[]>(() => {
  const row = previewRow.value || {};
  return Array.isArray(row.flashText) ? row.flashText : [];
});

const timeNow = ref("");
const dateNow = ref("");

let timerId: number | null = null;
function updateDateTime() {
  const now = new Date();

  const time = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
  timeNow.value = `${time} WIB`;

  const date = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  dateNow.value = date;
}

onMounted(() => {
  updateDateTime();
  timerId = window.setInterval(updateDateTime, 1000);
});

onUnmounted(() => {
  if (timerId) {
    clearInterval(timerId);
  }
  hentikanPantau();
});
</script>

<template>
  <Card
    v-if="dataBreadCrumb.length == 0"
    pt:body:class="overflow-auto pt-0 h-full"
    pt:content:class="overflow-auto w-full h-full"
    class="w-full"
  >
    <template #header>
      <HeaderFilter
        ref="headerFilterRef"
        :pageType="pageType"
        @daftar="changeSection('Daftar')"
        @search="handleSearch"
        @reset="handleResetFilters"
      />
    </template>
    <template #content>
      <DataTable
        v-if="jadwalLayarAntrianProperties.total > 0"
        v-model:selection="selectedPatient"
        :value="jadwalAntrianPayload"
        class="w-full"
        tableStyle="min-width: 50rem; width: 100%"
        stripedRows
        scrollable
        scrollHeight="flex"
        :pt="{
          headerRow: 'text-SM',
          table: { class: 'w-full' },
          root: { class: 'w-full' },
        }"
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
        <Column field="Layar" header="Layar" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <div class="text-SM">{{ slotProps.data.namaLayar }}</div>
            <div class="flex flex-wrap gap-1 items-center">
              <CustomChip
                :showCheckedIcon="false"
                :label="slotProps.data.judul"
                bgColor="bg-opensimrs-300"
                textColor="text-white"
                customClass="h-5 border-none"
              />
              <CustomChip
                :showCheckedIcon="false"
                :label="convertLayarType(slotProps.data.tipeLayar)"
                bgColor="bg-opensimrs-300"
                textColor="text-white"
                customClass="h-5 border-none"
              />
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
          class="max-w-[520px]"
        >
          <template #body="slotProps">
            <div class="flex flex-wrap items-center">
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
            </div>
          </template>
        </Column>
        <Column field="status" headerClass="bg-opensimrs-50 ">
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
        <Column
          field="action"
          header="Action"
          headerClass="bg-opensimrs-50 justify-center"
        >
          <template #body="slotProps">
            <div class="flex gap-2.5 items-center">
              <CustomButton
                size="small"
                icon="PhScreencast"
                customClass="bg-opensimrs-300 rounded-full p-0 flex"
                @click="openPreview(slotProps.data)"
                title="Lihat layar"
              >
              </CustomButton>
              <CustomButton
                v-if="fiturAktif('antrian_layar_kiosk')"
                size="small"
                icon="PhTelevisionSimple"
                customClass="bg-opensimrs-300 rounded-full p-0 flex"
                @click="bukaLinkKiosk(slotProps.data)"
                title="Link kiosk (TV)"
              >
              </CustomButton>
            </div>
          </template>
        </Column>
      </DataTable>

      <NoData v-else />
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
  <CustomDialog v-model:visible="dialogKiosk" dismissableMask @closeDialog="dialogKiosk = false">
    <template #header>Link Kiosk TV — {{ kiosk.nama }}</template>
    <template #body>
      <div class="flex flex-col gap-4 pt-4 text-sm max-w-[720px]">
        <p>
          Buka link ini di browser TV. Layar langsung tampil penuh, diperbarui otomatis, dan
          mengumumkan panggilan dengan suara, tanpa login.
        </p>
        <div>
          <div class="font-semibold mb-1">URL layar</div>
          <div class="flex gap-2">
            <input :value="kiosk.url" readonly class="flex-1 rounded-md border px-3 py-2 text-xs" @focus="($event.target as HTMLInputElement).select()" />
            <CustomButton label="Salin" @click="salin(kiosk.url)" />
            <CustomButton label="Buka" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaKiosk" />
          </div>
        </div>
        <div>
          <div class="font-semibold mb-1">Agar otomatis tampil & bersuara saat TV/mini PC menyala</div>
          <ol class="list-decimal pl-5 space-y-1">
            <li>Pasang Google Chrome di mini PC/TV box.</li>
            <li>Buat shortcut di folder Startup (Windows: <code>shell:startup</code>) dengan perintah berikut:</li>
          </ol>
          <div class="flex gap-2 mt-2">
            <textarea :value="perintahChrome" readonly rows="3" class="flex-1 rounded-md border px-3 py-2 text-xs font-mono" @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
            <CustomButton label="Salin" @click="salin(perintahChrome)" />
          </div>
          <p class="mt-2 text-gray-500">
            Opsi <code>--autoplay-policy=no-user-gesture-required</code> membuat suara langsung aktif tanpa diketuk.
            Tanpa opsi itu, layar akan meminta diketuk sekali.
          </p>
        </div>
        <div class="flex items-center justify-between border-t pt-3">
          <span class="text-gray-500">Link bocor atau TV hilang? Buat kunci baru — link lama langsung tidak berlaku.</span>
          <CustomButton label="Buat Ulang Kunci" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="buatUlangKunci" />
        </div>
      </div>
    </template>
  </CustomDialog>
  <CustomDialog
    v-model:visible="showPreviewDialog"
    :fullScreen="true"
    dismissableMask
    @closeDialog="closePreview"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <span>{{ previewTitle }}</span>
        <CustomButton
          label="Tes Suara"
          outlined
          borderColor="border-opensimrs-300"
          textColor="text-opensimrs-300"
          @click="tesSuara"
        />
      </div>
    </template>
    <template #body>
      <div class="pt-5 h-full">
        <!-- Wrapper Preview: meniru struktur SectionTambahKonfigurasiLayar -->
        <div
          class="w-full h-full flex flex-col bg-opensimrs-75 overflow-hidden rounded-[10px] px-1 pt-1"
        >
          <!-- Navbar Preview Layar -->
          <div
            class="flex gap-4 items-center font-semibold text-white rounded-lg bg-opensimrs-300 text-subHeading"
          >
            <!-- Logo -->
            <div
              class="flex bg-white w-[180px] justify-center items-center gap-1 rounded-lg h-full"
            >
              <img
                loading="lazy"
                :src="opensimrsLogo"
                class="shrink-0 self-stretch my-auto mx-1 aspect-square w-[50px] h-full"
              />
              <div
                class="bg-opensimrs-300 w-[3px] h-[50px] my-auto rounded-md"
              ></div>
              <img
                loading="lazy"
                :src="opensimrsText"
                class="self-stretch object-contain w-[106px] my-auto shrink-0"
              />
            </div>
            <!-- Komponen di sebelah Logo -->
            <div class="">{{ namaFaskes }}</div>
            <div class="mr-3 ml-auto font-semibold text-right">
              <div class="text-2xl font-semibold">{{ timeNow }}</div>
              <div class="text-sm">{{ dateNow }}</div>
            </div>
          </div>

          <!-- Blok Konten -->
          <div class="flex-1 min-h-[500px] px-1" id="wrapper-antrian">
            <component
              v-if="previewComponent"
              :is="previewComponent"
              v-bind="previewProps"
              class="h-full"
            />
          </div>

          <!-- Running Text -->
          <div
            class="mt-3 font-semibold text-white rounded-tl-lg rounded-tr-lg bg-opensimrs-300"
          >
            <div class="marquee" aria-label="Running text">
              <div
                class="marquee__track"
                :style="{ '--duration': marqueeDuration + 's' }"
              >
                <span
                  v-for="(item, idx) in previewFlashText"
                  :key="`${idx}-${item}`"
                  class="mx-2"
                  >{{ item }}</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </CustomDialog>
</template>

<style>
:deep(.p-card) {
  width: 100%;
}

/* Pastikan area konten Card (p-card-content) juga penuh */
:deep(.p-card-content) {
  width: 100%;
}

/* Paksa DataTable dan tabel di dalamnya penuh lebar */
:deep(.p-datatable) {
  width: 100%;
}

:deep(.p-datatable-table) {
  width: 100%;
}

.marquee {
  overflow: hidden;
  white-space: nowrap;
  display: block;
  width: 100%;
  position: relative;
}
.marquee__track {
  padding: 6px 0;
  will-change: transform;
  display: inline-block; /* width mengikuti konten */
  width: max-content; /* cegah melar mengikuti kontainer */
  padding-left: 100%; /* mulai dari luar kanan */
  animation: marquee var(--duration, 20s) linear infinite;
}
@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-100%);
  }
}
</style>
