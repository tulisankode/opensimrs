<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { belumSkriningGizi, izinGizi, referensiGizi, simpanSkriningGizi, waktuGizi } from "@/stores/penunjang/gizi";

// Daftar pasien rawat inap aktif yang belum punya skrining gizi (batas waktu 1x24 jam sejak masuk) + form
// pengisian skrining (MST/NRS-2002); skor dihitung server dari jawaban agar tidak bisa dimanipulasi klien.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinGizi("Skrining", aksi);

const data = ref<any[]>([]);
const cari = ref("");
const instrumenRef = ref<any[]>([]);
const ruanganRef = ref<any[]>([]);
const filterRuangan = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await belumSkriningGizi({ cari: cari.value, ruangan_uuid: filterRuangan.value });
    data.value = res?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
const muatReferensi = async () => {
  const res = await referensiGizi();
  instrumenRef.value = res?.payload?.instrumen ?? [];
  ruanganRef.value = res?.payload?.ruangan ?? [];
};

// ── Form skrining
const dialog = ref(false);
const pasienDipilih = ref<any>(null);
const instrumenDipilih = ref("");
const jawaban = ref<Record<string, string>>({});
const galat = ref("");

const pertanyaanAktif = computed(() => instrumenRef.value.find((i) => i.kode === instrumenDipilih.value)?.pertanyaan ?? []);

const buka = (pasien: any) => {
  galat.value = "";
  pasienDipilih.value = pasien;
  instrumenDipilih.value = instrumenRef.value[0]?.kode ?? "";
  jawaban.value = {};
  dialog.value = true;
};

const simpan = async () => {
  if (!pasienDipilih.value || !instrumenDipilih.value) return;
  const belumDijawab = pertanyaanAktif.value.some((p: any) => !jawaban.value[p.kode]);
  if (belumDijawab) return (galat.value = "Semua pertanyaan wajib dijawab");
  storeUtils.setLoading(true);
  try {
    const res = await simpanSkriningGizi(pasienDipilih.value.uuid, {
      instrumen: instrumenDipilih.value,
      jawaban: pertanyaanAktif.value.map((p: any) => ({ kode: p.kode, nilai: jawaban.value[p.kode] })),
    });
    if (res) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(async () => {
  await muatReferensi();
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Belum Diskrining</h1>
          <CustomTextfield v-model="cari" label="Cari pasien" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM" :maxLength="100" @keydown.enter="muat" />
          <CustomSelect v-model="filterRuangan" label="Ruangan" :options="ruanganRef" optionValue="uuid" optionLabel="nama" @update:modelValue="muat" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ index + 1 }}</template>
          </Column>
          <Column field="noRm" header="No. RM" headerClass="bg-opensimrs-50" />
          <Column field="namaPasien" header="Nama Pasien" headerClass="bg-opensimrs-50" />
          <Column header="Ruangan / Kamar" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.namaBangsal ?? "-" }} / {{ d.namaKamar ?? "-" }}</template>
          </Column>
          <Column header="Batas Skrining" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span :class="d.terlambat ? 'text-danger-300 font-semibold' : ''">{{ waktuGizi(d.batasWaktuSkrining) }}</span>
              <span v-if="d.terlambat" class="ml-1 text-danger-300">(Terlambat)</span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[140px]">
            <template #body="{ data: d }">
              <CustomButton v-if="boleh('CREATE')" icon="PhClipboardText" size="small" label="Isi Skrining" @click="buka(d)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="720px">
      <template #header>Skrining Gizi — {{ pasienDipilih?.namaPasien }}</template>
      <template #body>
        <div class="pt-4">
          <CustomSelect
            v-model="instrumenDipilih"
            label="Instrumen Skrining"
            :options="instrumenRef"
            optionValue="kode"
            optionLabel="label"
            :clearable="false"
            :showFilter="false"
            @update:modelValue="jawaban = {}"
          />
          <div v-for="p in pertanyaanAktif" :key="p.kode" class="mt-4">
            <CustomSelect
              v-model="jawaban[p.kode]"
              :label="p.teks"
              :options="p.opsi"
              optionValue="nilai"
              optionLabel="label"
              :clearable="false"
              :showFilter="false"
            />
          </div>
          <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
