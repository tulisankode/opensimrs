<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import JejakKantongUtd from "@/views/Utd/JejakKantongUtd.vue";
import { utilsStore } from "@/stores/utils";
import {
  GOLONGAN_DARAH_UTD,
  JENIS_KOMPONEN_UTD,
  RHESUS_UTD,
  SARAN_MASA_SIMPAN_HARI,
  STATUS_KOMPONEN_UTD,
  bolehLihatReaktifUtd,
  daftarAftapUtd,
  daftarKomponenUtd,
  detailAftapUtd,
  gayaKantongUtd,
  gayaKomponenUtd,
  golonganRhUtd,
  izinUtd,
  jejakKomponenUtd,
  keTanggal,
  olahKomponenUtd,
  opsi,
  sisaHariUtd,
  tambahHari,
  tglUtd,
  waktuUtd,
} from "@/stores/penunjang/utd";

// Pengolahan Komponen: pemisahan satu kantong (whole blood) menjadi PRC/TC/FFP/cryo dengan label unik otomatis.
// Komponen dari kantong yang belum dilepas berstatus karantina (ikut dilepas saat pelepasan IMLTD); kantong yang sudah
// dilepas menghasilkan komponen tersedia. Hasil IMLTD kantong wajib lengkap sebelum diolah. Komponen "tersedia" yang
// lewat tanggal kedaluwarsa ditandai backend saat daftar dimuat.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinUtd("Komponen", aksi);
const bolehReaktif = bolehLihatReaktifUtd();

// ── Daftar & filter
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterGolongan = ref<string[]>([]);
const filterJenis = ref<string[]>([]);
const filterStatus = ref<string[]>([]);
const tersediaSaja = ref(false);

const toggle = (daftar: typeof filterGolongan, nilai: string) => {
  daftar.value = daftar.value.includes(nilai) ? daftar.value.filter((x) => x !== nilai) : [...daftar.value, nilai];
};
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarKomponenUtd({
      page: page.value,
      limit: limit.value,
      cari: cari.value.trim(),
      golongan_darah: filterGolongan.value,
      jenis_komponen: filterJenis.value,
      status: tersediaSaja.value ? undefined : filterStatus.value,
      tersedia_saja: tersediaSaja.value ? 1 : undefined,
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
  filterGolongan.value = [];
  filterJenis.value = [];
  filterStatus.value = [];
  tersediaSaja.value = false;
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};
onMounted(muat);

// ── Jejak komponen
const jejak = ref<any>(null);
const dialogJejak = ref(false);
const bukaJejak = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await jejakKomponenUtd(uuid);
    if (res?.payload) {
      jejak.value = res.payload;
      dialogJejak.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Pengolahan komponen dari satu kantong
const dialogOlah = ref(false);
const kataKantong = ref("");
const hasilKantong = ref<any[]>([]);
const kantong = ref<any>(null);
type ItemKomponen = { jenisKomponen: string; volumeMl: number; tanggalKedaluwarsa: Date | null; golonganDarah: string; rhesus: string };
const items = ref<ItemKomponen[]>([]);
const galatOlah = ref("");

const itemBaru = (jenis = "PRC"): ItemKomponen => ({
  jenisKomponen: jenis,
  volumeMl: 0,
  tanggalKedaluwarsa: tambahHari(SARAN_MASA_SIMPAN_HARI[jenis] ?? 35),
  golonganDarah: kantong.value?.golonganDarah ?? "",
  rhesus: kantong.value?.rhesus ?? "",
});
const bukaOlah = () => {
  kataKantong.value = "";
  hasilKantong.value = [];
  kantong.value = null;
  items.value = [];
  galatOlah.value = "";
  dialogOlah.value = true;
};
const cariKantong = async () => {
  hasilKantong.value = (await daftarAftapUtd({ cari: kataKantong.value.trim(), status: ["karantina", "tersedia"], limit: 20 }))?.payload?.data ?? [];
};
const pilihKantong = async (a: any) => {
  hasilKantong.value = [];
  storeUtils.setLoading(true);
  try {
    const res = await detailAftapUtd(a.uuid);
    if (!res?.payload) return;
    kantong.value = res.payload;
    items.value = [itemBaru("PRC"), itemBaru("FFP")];
  } finally {
    storeUtils.setLoading(false);
  }
};
const imltdLengkap = computed(() => {
  const i = kantong.value?.imltd;
  if (!i) return false;
  // Hasil disamarkan (tanpa izin Lihat Hasil Reaktif): backend hanya mengirim status ringkas, termasuk kelengkapan.
  if (i.disamarkan) return !!i.lengkap;
  return ["hiv", "hbsag", "hcv", "sifilis"].every((p) => i[`${p}Hasil`]);
});
const gantiJenis = (it: ItemKomponen, jenis: string) => {
  it.tanggalKedaluwarsa = tambahHari(SARAN_MASA_SIMPAN_HARI[jenis] ?? 35);
};
const totalVolume = computed(() => items.value.reduce((n, it) => n + (Number(it.volumeMl) || 0), 0));

const simpanOlah = async () => {
  galatOlah.value = "";
  if (!kantong.value) return (galatOlah.value = "Pilih kantong terlebih dahulu");
  if (!items.value.length) return (galatOlah.value = "Tambahkan minimal satu komponen");
  for (const it of items.value) {
    if (!it.jenisKomponen) return (galatOlah.value = "Jenis komponen wajib dipilih");
    if (!it.volumeMl || it.volumeMl <= 0) return (galatOlah.value = `Volume ${it.jenisKomponen} harus lebih dari 0 mL`);
    if (!it.tanggalKedaluwarsa) return (galatOlah.value = `Tanggal kedaluwarsa ${it.jenisKomponen} wajib diisi`);
  }
  if (totalVolume.value > Number(kantong.value.volumeMl)) return (galatOlah.value = `Total volume komponen (${totalVolume.value} mL) melebihi volume kantong`);
  storeUtils.setLoading(true);
  try {
    const res = await olahKomponenUtd(
      kantong.value.uuid,
      items.value.map((it) => ({
        jenisKomponen: it.jenisKomponen,
        volumeMl: Number(it.volumeMl),
        tanggalKedaluwarsa: keTanggal(it.tanggalKedaluwarsa),
        golonganDarah: it.golonganDarah || undefined,
        rhesus: it.rhesus || undefined,
      })),
    );
    if (res?.payload) {
      dialogOlah.value = false;
      cariData();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Pengolahan Komponen</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Label / No. Kantong" :maxLength="100" @keydown.enter="cariData" />
          <ToolbarFilterMenu :count="filterJenis.length">
            <template #label>Jenis</template>
            <CustomChip v-for="j in Object.keys(JENIS_KOMPONEN_UTD)" :key="j" :label="j" :value="j" :isSelected="filterJenis.includes(j)" @selected="toggle(filterJenis, $event)" />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterGolongan.length">
            <template #label>Golongan</template>
            <CustomChip v-for="g in Object.keys(GOLONGAN_DARAH_UTD)" :key="g" :label="g" :value="g" :isSelected="filterGolongan.includes(g)" @selected="toggle(filterGolongan, $event)" />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterStatus.length + (tersediaSaja ? 1 : 0)">
            <template #label>Status</template>
            <CustomChip label="Siap pakai (tersedia & belum kedaluwarsa)" value="siap" :isSelected="tersediaSaja" @selected="tersediaSaja = !tersediaSaja" />
            <template v-if="!tersediaSaja">
              <CustomChip
                v-for="(s, kode) in STATUS_KOMPONEN_UTD"
                :key="kode"
                :label="s.label"
                :value="String(kode)"
                :isSelected="filterStatus.includes(String(kode))"
                @selected="toggle(filterStatus, $event)"
              />
            </template>
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Olah Komponen" @click="bukaOlah" />
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
          tableStyle="min-width: 60rem"
          @rowClick="bukaJejak($event.data.uuid)"
        >
          <Column header="Label" headerClass="bg-opensimrs-50">
            <template #body="{ data: k }">
              <div class="font-semibold">{{ k.labelUnik }}</div>
              <div class="text-grey-400">Kantong {{ k.noKantong }}</div>
            </template>
          </Column>
          <Column header="Jenis" headerClass="bg-opensimrs-50">
            <template #body="{ data: k }">{{ JENIS_KOMPONEN_UTD[k.jenisKomponen] ?? k.jenisKomponen }}</template>
          </Column>
          <Column header="Gol." headerClass="bg-opensimrs-50">
            <template #body="{ data: k }"><b>{{ golonganRhUtd(k.golonganDarah, k.rhesus) }}</b></template>
          </Column>
          <Column header="Volume" headerClass="bg-opensimrs-50">
            <template #body="{ data: k }">{{ k.volumeMl }} mL</template>
          </Column>
          <Column header="Kedaluwarsa" headerClass="bg-opensimrs-50">
            <template #body="{ data: k }">
              <div>{{ tglUtd(k.tanggalKedaluwarsa) }}</div>
              <span
                v-if="k.status === 'tersedia' && (sisaHariUtd(k.tanggalKedaluwarsa) ?? 99) <= 3"
                class="px-1.5 rounded text-[10px] font-semibold bg-[#FEF0C7] text-[#B54708]"
              >{{ sisaHariUtd(k.tanggalKedaluwarsa) }} hari lagi</span>
            </template>
          </Column>
          <Column header="Diolah" headerClass="bg-opensimrs-50">
            <template #body="{ data: k }">{{ waktuUtd(k.createdAt) }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: k }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaKomponenUtd(k.status)?.bg, gayaKomponenUtd(k.status)?.text]">
                {{ gayaKomponenUtd(k.status)?.label ?? k.status }}
              </span>
              <div v-if="k.dilepasPada" class="text-grey-400">Dilepas {{ waktuUtd(k.dilepasPada, true) }}</div>
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

    <!-- Jejak komponen -->
    <CustomDialog v-model:visible="dialogJejak" width="900px">
      <template #header>Jejak Komponen — Kantong {{ jejak?.noKantong }}</template>
      <template #body>
        <JejakKantongUtd v-if="jejak" :jejak="jejak" class="pt-4" />
      </template>
    </CustomDialog>

    <!-- Olah komponen -->
    <CustomDialog v-model:visible="dialogOlah" width="900px">
      <template #header>Pengolahan Komponen</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div>
            <div class="mb-1 text-sm font-semibold">Kantong (whole blood)</div>
            <div v-if="kantong" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
              <div class="text-sm">
                <b>{{ kantong.noKantong }}</b> · Gol. {{ golonganRhUtd(kantong.golonganDarah, kantong.rhesus) }} · {{ kantong.volumeMl }} mL ·
                <span :class="[gayaKantongUtd(kantong.statusKantong, bolehReaktif)?.text]">{{ gayaKantongUtd(kantong.statusKantong, bolehReaktif)?.label }}</span>
                <span v-if="kantong.komponen?.length" class="text-grey-400"> · sudah ada {{ kantong.komponen.length }} komponen</span>
              </div>
              <CustomButton label="Ganti" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="(kantong = null), (items = [])" />
            </div>
            <div v-else class="flex flex-col gap-2">
              <div class="flex gap-2">
                <InputText v-model="kataKantong" placeholder="Cari nomor kantong (karantina/tersedia)" class="text-sm grow" @keydown.enter="cariKantong" />
                <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariKantong" />
              </div>
              <div v-if="hasilKantong.length" class="overflow-auto border rounded-lg max-h-[180px] border-grey-75">
                <div
                  v-for="a in hasilKantong"
                  :key="a.uuid"
                  class="flex justify-between px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50"
                  @click="pilihKantong(a)"
                >
                  <span><b>{{ a.noKantong }}</b> · {{ golonganRhUtd(a.golonganDarah, a.rhesus) }} · {{ a.volumeMl }} mL</span>
                  <span class="text-grey-400">{{ gayaKantongUtd(a.statusKantong, bolehReaktif)?.label }} · {{ waktuUtd(a.createdAt, true) }}</span>
                </div>
              </div>
            </div>
          </div>

          <template v-if="kantong">
            <div v-if="!imltdLengkap" class="px-3 py-2 text-sm rounded-lg bg-[#FEF0C7] text-[#B54708]">
              Hasil uji saring IMLTD kantong ini belum lengkap (atau tidak dapat ditampilkan); backend akan menolak pengolahan.
            </div>
            <div class="flex flex-col gap-2">
              <div v-for="(it, idx) in items" :key="idx" class="grid items-end grid-cols-12 gap-3">
                <CustomSelect
                  v-model="it.jenisKomponen"
                  label="Jenis"
                  :options="opsi(JENIS_KOMPONEN_UTD)"
                  optionValue="value"
                  optionLabel="label"
                  :showFilter="false"
                  :clearable="false"
                  class="col-span-3"
                  @update:modelValue="(v: string) => gantiJenis(it, v)"
                />
                <CustomInputNumber v-model="it.volumeMl" label="Volume (mL)" :min="0" :max="600" class="col-span-2" />
                <CustomDatePicker v-model="it.tanggalKedaluwarsa" label="Kedaluwarsa" :minDate="new Date()" class="col-span-3" />
                <CustomSelect v-model="it.golonganDarah" label="Gol." :options="opsi(GOLONGAN_DARAH_UTD)" optionValue="value" optionLabel="label" :showFilter="false" class="col-span-2" />
                <CustomSelect v-model="it.rhesus" label="Rh" :options="opsi(RHESUS_UTD)" optionValue="value" optionLabel="label" :showFilter="false" class="col-span-1" />
                <div class="col-span-1 pb-1">
                  <CustomButton icon="PhTrash" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="items.splice(idx, 1)" />
                </div>
              </div>
              <div class="flex items-center justify-between">
                <CustomButton icon="PhPlus" label="Tambah Komponen" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="items.push(itemBaru())" />
                <span class="text-xs text-grey-400">Total {{ totalVolume }} / {{ kantong.volumeMl }} mL</span>
              </div>
            </div>
            <div class="text-xs text-grey-400">
              Tanggal kedaluwarsa terisi saran bawaan per jenis (PRC {{ SARAN_MASA_SIMPAN_HARI.PRC }} hari, TC {{ SARAN_MASA_SIMPAN_HARI.TC }} hari, FFP/cryo
              {{ SARAN_MASA_SIMPAN_HARI.FFP }} hari); sesuaikan dengan SOP & jenis kantong. Label unik dibuat otomatis dari nomor kantong.
            </div>
          </template>
          <div v-if="galatOlah" class="text-sm text-danger-300">{{ galatOlah }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogOlah = false" />
          <CustomButton label="Simpan Komponen" icon="PhFloppyDisk" @click="simpanOlah" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
