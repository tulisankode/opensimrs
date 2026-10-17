<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  BELUM_KONFIRMASI_ALERGI,
  OPSI_WAKTU_MAKAN,
  bentukDistribusiGizi,
  cetakDistribusiGizi,
  izinGizi,
  keTanggal,
  lihatDistribusiGizi,
  referensiGizi,
  rekapPorsiGizi,
} from "@/stores/penunjang/gizi";

// Daftar distribusi makan (per ruangan & waktu makan) + rekap porsi dapur. Selalu dibentuk dari data Rawat Inap &
// order diet TERKINI; "Bentuk Daftar" menyimpan snapshot (untuk dicetak/diarsipkan) sebagai versi baru.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinGizi("Distribusi", aksi);

const ruanganRef = ref<any[]>([]);
const tanggal = ref<Date>(new Date());
const ruanganUuid = ref("");
const waktuMakan = ref("pagi");

const distribusi = ref<any>(null);
const data = ref<any[]>([]);
const rekap = ref<any[]>([]);
const tanpaOrder = ref(0);

const filterSiap = () => !!ruanganUuid.value && !!waktuMakan.value;

const muat = async () => {
  if (!filterSiap()) return;
  storeUtils.setLoading(true);
  try {
    const filter = { tanggal: keTanggal(tanggal.value), ruanganUuid: ruanganUuid.value, waktuMakan: waktuMakan.value };
    const [res, rek] = await Promise.all([lihatDistribusiGizi(filter), rekapPorsiGizi(filter)]);
    distribusi.value = res?.payload?.distribusi ?? null;
    data.value = res?.payload?.data ?? [];
    rekap.value = rek?.payload?.data ?? [];
    tanpaOrder.value = rek?.payload?.tanpaOrder ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};

const bentukDaftar = async () => {
  if (!filterSiap()) return;
  storeUtils.setLoading(true);
  try {
    const res = await bentukDistribusiGizi({ tanggal: keTanggal(tanggal.value), ruanganUuid: ruanganUuid.value, waktuMakan: waktuMakan.value });
    if (res) {
      distribusi.value = res?.payload?.distribusi ?? null;
      data.value = res?.payload?.data ?? [];
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const cetak = async () => {
  if (!distribusi.value?.uuid) return;
  const res = await cetakDistribusiGizi(distribusi.value.uuid);
  if (res) window.print();
};

onMounted(async () => {
  const res = await referensiGizi();
  ruanganRef.value = res?.payload?.ruangan ?? [];
  if (ruanganRef.value.length) {
    ruanganUuid.value = ruanganRef.value[0].uuid;
    muat();
  }
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden gap-3">
    <Card pt:body:class="pt-0" class="flex-none">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Distribusi Makan & Rekap Porsi</h1>
          <CustomDatePicker v-model="tanggal" label="Tanggal" @update:modelValue="muat" />
          <CustomSelect v-model="ruanganUuid" label="Ruangan" :options="ruanganRef" optionValue="uuid" optionLabel="nama" :clearable="false" @update:modelValue="muat" />
          <CustomSelect v-model="waktuMakan" label="Waktu Makan" :options="OPSI_WAKTU_MAKAN" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" @update:modelValue="muat" />
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <CustomButton v-if="boleh('CREATE')" icon="PhFloppyDisk" label="Bentuk Daftar" @click="bentukDaftar" />
          <CustomButton v-if="boleh('CETAK') && distribusi" icon="PhPrinter" label="Cetak" @click="cetak" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="distribusi" class="px-4 pb-3 text-xs text-grey-400">
          Daftar status: <b>{{ distribusi.status }}</b> — dibentuk oleh {{ distribusi.dibuatOleh }}
        </div>
        <div v-if="rekap.length" class="px-4 pb-3 flex flex-wrap gap-2">
          <span v-for="r in rekap" :key="r.namaDiet" class="px-2 py-1 rounded bg-opensimrs-50 text-opensimrs-300 text-xs">{{ r.namaDiet }}: {{ r.jumlahPorsi }} porsi</span>
          <span v-if="tanpaOrder" class="px-2 py-1 rounded bg-danger-50 text-danger-300 text-xs">{{ tanpaOrder }} pasien belum ada order diet</span>
        </div>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 60rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ index + 1 }}</template>
          </Column>
          <Column field="noRm" header="No. RM" headerClass="bg-opensimrs-50" />
          <Column field="namaPasien" header="Nama Pasien" headerClass="bg-opensimrs-50" />
          <Column header="Kamar" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.namaKamar ?? "-" }}{{ d.noBed ? ` / ${d.noBed}` : "" }}</template>
          </Column>
          <Column header="Diet" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span v-if="d.namaDiet">{{ d.namaDiet }} — {{ d.namaBentukMakanan }}</span>
              <span v-else class="text-danger-300">Belum ada order diet</span>
            </template>
          </Column>
          <Column header="Alergi" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span :class="d.alergiTercatat ? 'text-danger-300 font-semibold' : 'text-grey-400'">{{ d.alergi ?? BELUM_KONFIRMASI_ALERGI }}</span>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
