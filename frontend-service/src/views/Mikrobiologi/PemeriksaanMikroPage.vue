<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import DialogPemeriksaanMikro from "./Komponen/DialogPemeriksaanMikro.vue";
import { utilsStore } from "@/stores/utils";
import {
  KULTUR_MIKRO,
  PELAYANAN_MIKRO,
  SPESIMEN_MIKRO,
  STATUS_ITEM_MIKRO,
  SUMBER_MIKRO,
  gayaItemMikro,
  keTanggal,
  namaSpesimen,
  umurMikro,
  waktuMikro,
  worklistMikro,
} from "@/stores/penunjang/mikrobiologi";

// Worklist pemeriksaan mikrobiologi (per spesimen): penerimaan/penolakan spesimen → pewarnaan → kultur → isolat & uji
// kepekaan → laporan sementara → verifikasi Sp.MK (final) → cetak. Klik baris untuk membuka lembar kerja.
const storeUtils = utilsStore();
const route = useRoute();

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref(String(route.query.cari ?? ""));
const tglMulai = ref<Date | null>(null);
const tglSelesai = ref<Date | null>(null);
const STATUS_AKTIF = ["menunggu", "diterima", "diproses", "sementara"];
const filterStatus = ref<string[]>(route.query.cari ? [] : [...STATUS_AKTIF]);
const filterSpesimen = ref<string[]>([]);
const filterSumber = ref<string[]>([]);
const hanyaCito = ref(false);
const FILTER = { status: filterStatus, spesimen: filterSpesimen, sumber: filterSumber };
const toggle = (jenis: keyof typeof FILTER, nilai: string) => {
  const d = FILTER[jenis];
  d.value = d.value.includes(nilai) ? d.value.filter((x) => x !== nilai) : [...d.value, nilai];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await worklistMikro({
      page: page.value,
      limit: limit.value,
      cari: cari.value,
      status: filterStatus.value,
      spesimen: filterSpesimen.value,
      sumber: filterSumber.value,
      cito: hanyaCito.value ? 1 : "",
      tanggal_mulai: keTanggal(tglMulai.value),
      tanggal_selesai: keTanggal(tglSelesai.value ?? tglMulai.value),
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
  cari.value = "";
  tglMulai.value = null;
  tglSelesai.value = null;
  filterStatus.value = [...STATUS_AKTIF];
  filterSpesimen.value = [];
  filterSumber.value = [];
  hanyaCito.value = false;
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// Lama sejak spesimen diterima (hari) dibanding target TAT.
const lamaHari = (r: any) => (r.waktuTerima ? Math.floor((Date.now() / 1000 - Number(r.waktuTerima)) / 86400) : null);
const lewatTat = (r: any) => r.status !== "selesai" && r.status !== "ditolak" && lamaHari(r) !== null && r.tatHari != null && (lamaHari(r) as number) > r.tatHari;

const dialog = ref(false);
const itemUuid = ref("");
const buka = (uuid: string) => {
  itemUuid.value = uuid;
  dialog.value = true;
};

const JK: Record<string, string> = { Male: "L", Female: "P", "Laki-laki": "L", Perempuan: "P" };
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Pemeriksaan Mikrobiologi</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM / No. Order / No. Mikro" :maxLength="100" @keydown.enter="cariData" />
          <CustomDatePicker v-model="tglMulai" label="Order mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Order selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <ToolbarFilterMenu :count="filterStatus.length">
            <template #label>Status</template>
            <CustomChip
              v-for="(s, kode) in STATUS_ITEM_MIKRO"
              :key="kode"
              :label="s.label"
              :value="String(kode)"
              :isSelected="filterStatus.includes(String(kode))"
              @selected="toggle('status', $event)"
            />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterSpesimen.length">
            <template #label>Spesimen</template>
            <CustomChip
              v-for="(nama, kode) in SPESIMEN_MIKRO"
              :key="kode"
              :label="nama"
              :value="String(kode)"
              :isSelected="filterSpesimen.includes(String(kode))"
              @selected="toggle('spesimen', $event)"
            />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterSumber.length + (hanyaCito ? 1 : 0)">
            <template #label>Lainnya</template>
            <CustomChip
              v-for="(s, kode) in SUMBER_MIKRO"
              :key="kode"
              :label="s"
              :value="String(kode)"
              :isSelected="filterSumber.includes(String(kode))"
              @selected="toggle('sumber', $event)"
            />
            <CustomChip label="Hanya CITO" value="cito" :isSelected="hanyaCito" @selected="hanyaCito = !hanyaCito" />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable
          v-else
          :value="data"
          stripedRows
          class="text-xs cursor-pointer"
          scrollable
          scrollHeight="flex"
          tableStyle="min-width: 64rem"
          @rowClick="buka($event.data.uuid)"
        >
          <Column header="No. Mikro / Order" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.noMikro ?? "—" }}</div>
              <div class="text-grey-400">{{ d.noOrder }} · {{ waktuMikro(d.waktuOrder) }}</div>
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaPasien ?? "-" }}</div>
              <div class="text-grey-400">{{ d.noRm }} · {{ JK[d.gender] ?? "-" }} · {{ umurMikro(d.birthDate) }}</div>
            </template>
          </Column>
          <Column header="Pemeriksaan / Spesimen" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span v-if="d.cito" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
              <b>{{ d.nama }}</b>
              <div class="text-grey-400">{{ namaSpesimen(d.jenisSpesimen) }}{{ d.lokasiSpesimen ? ` · ${d.lokasiSpesimen}` : "" }}</div>
            </template>
          </Column>
          <Column header="Asal" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              {{ SUMBER_MIKRO[d.sumber] }} · {{ PELAYANAN_MIKRO[d.pelayanan] ?? d.pelayanan }}
              <div class="text-grey-400">{{ d.dokterPengirim ?? "" }}</div>
            </template>
          </Column>
          <Column header="Diterima / TAT" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ d.waktuTerima ? waktuMikro(d.waktuTerima) : "-" }}</div>
              <div :class="lewatTat(d) ? 'text-danger-300 font-semibold' : 'text-grey-400'">
                <template v-if="lamaHari(d) !== null">Hari ke-{{ lamaHari(d) }} / target {{ d.tatHari }} hr</template>
                <template v-else>Target {{ d.tatHari }} hr</template>
              </div>
            </template>
          </Column>
          <Column header="Hasil" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ d.kulturStatus ? KULTUR_MIKRO[d.kulturStatus] : "-" }}</div>
              <i class="text-grey-400">{{ d.organisme ?? "" }}</i>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap" :class="[gayaItemMikro(d.status)?.bg, gayaItemMikro(d.status)?.text]">
                {{ gayaItemMikro(d.status)?.label ?? d.status }}
              </span>
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

    <DialogPemeriksaanMikro v-model:visible="dialog" :itemUuid="itemUuid" @berubah="muat" />
  </div>
</template>
