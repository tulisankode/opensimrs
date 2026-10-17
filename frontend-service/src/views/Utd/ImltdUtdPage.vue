<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import JejakKantongUtd from "@/views/Utd/JejakKantongUtd.vue";
import { utilsStore } from "@/stores/utils";
import {
  HASIL_IMLTD,
  PARAMETER_IMLTD,
  bolehLihatReaktifUtd,
  dariEpoch,
  detailAftapUtd,
  gayaImltdUtd,
  gayaKantongUtd,
  izinUtd,
  keEpoch,
  konfirmasiImltdUtd,
  opsi,
  pelepasanKantongUtd,
  simpanImltdUtd,
  waktuUtd,
  worklistImltdUtd,
} from "@/stores/penunjang/utd";

// Uji Saring IMLTD (HIV, HBsAg, HCV, sifilis) per kantong: antrean kantong karantina, input hasil awal, pemeriksaan
// konfirmasi, dan pelepasan ke stok (hanya bila status akhir non-reaktif). Satu hasil reaktif mengarantina kantong &
// komponennya serta menahan donor (oleh backend). Tanpa izin Lihat Hasil Reaktif, hasil reaktif & identitas donor
// terkait disembunyikan; backend juga menyamarkan detail hasil dan mencatat upaya aksesnya.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinUtd("IMLTD", aksi);
const bolehReaktif = bolehLihatReaktifUtd();

// ── Antrean (worklist)
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await worklistImltdUtd({ page: page.value, limit: limit.value });
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};
onMounted(muat);
// Baris reaktif tanpa izin: nama donor tidak ditampilkan.
const samarkanBaris = (w: any) => !bolehReaktif && (w.statusAkhir === "reaktif" || w.statusKantong === "karantina_reaktif");

// ── Detail kantong + form hasil
const jejak = ref<any>(null);
const dialog = ref(false);
type BarisHasil = { hasil: string; metode: string; waktu: Date | null };
const formHasil = ref<Record<string, BarisHasil>>({});
const galat = ref("");

const isiForm = () => {
  const i = jejak.value?.imltd ?? {};
  formHasil.value = Object.fromEntries(
    Object.keys(PARAMETER_IMLTD).map((p) => [p, { hasil: i[`${p}Hasil`] ?? "", metode: i[`${p}Metode`] ?? "", waktu: dariEpoch(i[`${p}Waktu`]) }]),
  );
};
const muatJejak = async (aftapUuid: string) => {
  const res = await detailAftapUtd(aftapUuid);
  if (res?.payload) {
    jejak.value = res.payload;
    isiForm();
  }
  return !!res?.payload;
};
const buka = async (aftapUuid: string) => {
  galat.value = "";
  formKonfirmasi.value = kosongKonfirmasi();
  storeUtils.setLoading(true);
  try {
    if (await muatJejak(aftapUuid)) dialog.value = true;
  } finally {
    storeUtils.setLoading(false);
  }
};

const disamarkan = computed(() => !!jejak.value?.imltd?.disamarkan);
const dapatDiubah = computed(() => !disamarkan.value && ["karantina", "karantina_reaktif"].includes(jejak.value?.statusKantong));
const bisaInput = computed(() => dapatDiubah.value && boleh("INPUT HASIL"));
const bisaLepas = computed(
  () => boleh("PELEPASAN") && jejak.value?.statusKantong === "karantina" && jejak.value?.imltd?.statusAkhir === "non_reaktif" && !jejak.value?.imltd?.dilepasPada,
);

const simpanHasil = async () => {
  galat.value = "";
  const isi: Record<string, any> = {};
  const lama = jejak.value?.imltd ?? {};
  for (const [p, b] of Object.entries(formHasil.value)) {
    // Hasil awal yang sudah tercatat tidak dikosongkan dari layar ini (koreksi lewat konfirmasi).
    if (!b.hasil && lama[`${p}Hasil`]) return (galat.value = `Hasil ${PARAMETER_IMLTD[p]} yang sudah tercatat tidak dapat dikosongkan; gunakan konfirmasi`);
    if (!b.hasil) continue;
    isi[`${p}Hasil`] = b.hasil;
    isi[`${p}Metode`] = b.metode.trim() || null;
    isi[`${p}Waktu`] = keEpoch(b.waktu) ?? Math.floor(Date.now() / 1000);
  }
  if (!Object.keys(isi).length) return (galat.value = "Isi minimal satu hasil parameter");
  const adaReaktifBaru = Object.keys(PARAMETER_IMLTD).some((p) => isi[`${p}Hasil`] === "reaktif" && lama[`${p}Hasil`] !== "reaktif");
  if (adaReaktifBaru && !window.confirm("Ada hasil REAKTIF. Kantong & komponennya akan dikarantina dan donor ditahan. Lanjutkan?")) return;
  storeUtils.setLoading(true);
  try {
    const res = await simpanImltdUtd(jejak.value.uuid, isi);
    if (res?.payload) {
      await muatJejak(jejak.value.uuid);
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Konfirmasi per parameter (hanya parameter yang sudah punya hasil awal)
const kosongKonfirmasi = () => ({ parameter: "", hasil: "", metode: "", waktu: new Date() as Date | null });
const formKonfirmasi = ref(kosongKonfirmasi());
const opsiParameterKonfirmasi = computed(() =>
  Object.entries(PARAMETER_IMLTD)
    .filter(([p]) => jejak.value?.imltd?.[`${p}Hasil`])
    .map(([value, label]) => ({ value, label })),
);
const simpanKonfirmasi = async () => {
  const f = formKonfirmasi.value;
  galat.value = "";
  if (!f.parameter || !f.hasil) return (galat.value = "Parameter dan hasil konfirmasi wajib dipilih");
  storeUtils.setLoading(true);
  try {
    const res = await konfirmasiImltdUtd(jejak.value.uuid, { parameter: f.parameter, hasil: f.hasil, metode: f.metode.trim() || undefined, waktu: keEpoch(f.waktu) });
    if (res?.payload) {
      formKonfirmasi.value = kosongKonfirmasi();
      await muatJejak(jejak.value.uuid);
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Pelepasan ke stok
const lepas = async () => {
  if (!window.confirm(`Lepaskan kantong ${jejak.value.noKantong} beserta komponen karantinanya ke stok tersedia?`)) return;
  storeUtils.setLoading(true);
  try {
    const res = await pelepasanKantongUtd(jejak.value.uuid);
    if (res?.payload) {
      await muatJejak(jejak.value.uuid);
      muat();
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
          <h1 class="toolbar-heading text-opensimrs-300">Uji Saring IMLTD</h1>
          <span class="text-xs text-grey-400">Antrean kantong karantina (terlama dulu)</span>
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
          tableStyle="min-width: 50rem"
          @rowClick="buka($event.data.aftapUuid)"
        >
          <Column header="No. Kantong" headerClass="bg-opensimrs-50">
            <template #body="{ data: w }">
              <div class="font-semibold">{{ w.noKantong }}</div>
              <div class="text-grey-400">Aftap {{ waktuUtd(w.createdAt) }}</div>
            </template>
          </Column>
          <Column header="Donor" headerClass="bg-opensimrs-50">
            <template #body="{ data: w }">
              <i v-if="samarkanBaris(w)" class="text-grey-400">disembunyikan</i>
              <template v-else>
                <div class="font-semibold">{{ w.namaDonor }}</div>
                <div class="text-grey-400">{{ w.noDonor }}</div>
              </template>
            </template>
          </Column>
          <Column header="Status Kantong" headerClass="bg-opensimrs-50">
            <template #body="{ data: w }">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                :class="[gayaKantongUtd(w.statusKantong, bolehReaktif)?.bg, gayaKantongUtd(w.statusKantong, bolehReaktif)?.text]"
              >
                {{ gayaKantongUtd(w.statusKantong, bolehReaktif)?.label ?? w.statusKantong }}
              </span>
            </template>
          </Column>
          <Column header="Status Uji Saring" headerClass="bg-opensimrs-50">
            <template #body="{ data: w }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaImltdUtd(w.statusAkhir, bolehReaktif)?.bg, gayaImltdUtd(w.statusAkhir, bolehReaktif)?.text]">
                {{ gayaImltdUtd(w.statusAkhir, bolehReaktif)?.label }}
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

    <!-- Detail kantong & input hasil -->
    <CustomDialog v-model:visible="dialog" width="960px">
      <template #header>Uji Saring Kantong {{ jejak?.noKantong }}</template>
      <template #body>
        <div v-if="jejak" class="flex flex-col gap-5 pt-4">
          <JejakKantongUtd :jejak="jejak" />

          <section v-if="bisaInput" class="flex flex-col gap-3 p-3 border rounded-lg border-grey-75">
            <h3 class="text-sm font-semibold">Input Hasil Awal</h3>
            <div v-for="(nama, p) in PARAMETER_IMLTD" :key="p" class="grid items-end grid-cols-4 gap-3">
              <div class="pb-2 text-sm font-semibold">{{ nama }}</div>
              <CustomSelect v-model="formHasil[p].hasil" label="Hasil" placeHolder="Belum diperiksa" :options="opsi(HASIL_IMLTD)" optionValue="value" optionLabel="label" :showFilter="false" />
              <CustomTextfield v-model="formHasil[p].metode" label="Metode" placeholder="mis. ChLIA / ELISA" :maxLength="100" />
              <CustomDatePicker v-model="formHasil[p].waktu" label="Waktu periksa" showTime :maxDate="new Date()" />
            </div>
            <div class="flex justify-end">
              <CustomButton label="Simpan Hasil" icon="PhFloppyDisk" @click="simpanHasil" />
            </div>
          </section>

          <section v-if="bisaInput && opsiParameterKonfirmasi.length" class="flex flex-col gap-3 p-3 border rounded-lg border-grey-75">
            <h3 class="text-sm font-semibold">Pemeriksaan Konfirmasi</h3>
            <div class="grid items-end grid-cols-4 gap-3">
              <CustomSelect v-model="formKonfirmasi.parameter" label="Parameter" placeHolder="Pilih" :options="opsiParameterKonfirmasi" optionValue="value" optionLabel="label" :showFilter="false" />
              <CustomSelect v-model="formKonfirmasi.hasil" label="Hasil Konfirmasi" placeHolder="Pilih" :options="opsi(HASIL_IMLTD)" optionValue="value" optionLabel="label" :showFilter="false" />
              <CustomTextfield v-model="formKonfirmasi.metode" label="Metode" placeholder="mis. NAT" :maxLength="100" />
              <CustomDatePicker v-model="formKonfirmasi.waktu" label="Waktu" showTime :maxDate="new Date()" />
            </div>
            <div class="text-xs text-grey-400">Hasil konfirmasi terakhir menggantikan hasil awal parameter tersebut dalam penentuan status akhir.</div>
            <div class="flex justify-end">
              <CustomButton label="Simpan Konfirmasi" icon="PhCheckCircle" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="simpanKonfirmasi" />
            </div>
          </section>

          <div v-if="!dapatDiubah && !disamarkan" class="text-xs text-grey-400">Kantong sudah dilepas/dimusnahkan; hasil tidak dapat diubah.</div>
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton v-if="bisaLepas" label="Lepas ke Stok" icon="PhSealCheck" @click="lepas" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
