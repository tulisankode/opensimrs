<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { daftarKerjaAsesmenGizi, gayaRisikoGizi, izinGizi, riwayatAsesmenGizi, simpanAsesmenGizi, ubahAsesmenGizi, waktuGizi } from "@/stores/penunjang/gizi";

// Daftar kerja ahli gizi: pasien rawat inap dengan skrining "berisiko" yang belum ditindaklanjuti asesmen baru.
// Asesmen & asuhan gizi (PAGT): asesmen, diagnosis gizi, intervensi, monitoring-evaluasi.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinGizi("Asesmen Gizi", aksi);

const data = ref<any[]>([]);
const cari = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarKerjaAsesmenGizi();
    data.value = res?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const dataTerfilter = computed(() =>
  cari.value ? data.value.filter((d) => `${d.namaPasien} ${d.noRm}`.toLowerCase().includes(cari.value.toLowerCase())) : data.value,
);

// ── Dialog PAGT (riwayat + form)
const dialog = ref(false);
const pasienDipilih = ref<any>(null);
const riwayat = ref<any[]>([]);
const kosong = () => ({ uuid: "", asesmen: "", diagnosisGizi: "", intervensi: "", monitoringEvaluasi: "" });
const form = ref<any>(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);

const buka = async (pasien: any) => {
  galat.value = "";
  pasienDipilih.value = pasien;
  form.value = kosong();
  dialog.value = true;
  storeUtils.setLoading(true);
  try {
    const res = await riwayatAsesmenGizi(pasien.uuid);
    riwayat.value = res?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
const ubahDariRiwayat = (r: any) => {
  form.value = {
    uuid: r.uuid,
    asesmen: r.asesmen ?? "",
    diagnosisGizi: r.diagnosisGizi ?? "",
    intervensi: r.intervensi ?? "",
    monitoringEvaluasi: r.monitoringEvaluasi ?? "",
  };
};
const batalUbah = () => (form.value = kosong());

const simpan = async () => {
  const f = form.value;
  if (!f.asesmen?.trim() || !f.diagnosisGizi?.trim() || !f.intervensi?.trim()) {
    galat.value = "Asesmen, diagnosis gizi, dan intervensi wajib diisi";
    return;
  }
  storeUtils.setLoading(true);
  try {
    const payload = { asesmen: f.asesmen, diagnosisGizi: f.diagnosisGizi, intervensi: f.intervensi, monitoringEvaluasi: f.monitoringEvaluasi };
    const res = modeUbah.value ? await ubahAsesmenGizi(f.uuid, payload) : await simpanAsesmenGizi(pasienDipilih.value.uuid, payload);
    if (res) {
      form.value = kosong();
      const r = await riwayatAsesmenGizi(pasienDipilih.value.uuid);
      riwayat.value = r?.payload ?? [];
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Daftar Kerja Ahli Gizi (Pasien Berisiko)</h1>
          <CustomTextfield v-model="cari" label="Cari pasien" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM" :maxLength="100" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!dataTerfilter.length" />
        <DataTable v-else :value="dataTerfilter" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ index + 1 }}</template>
          </Column>
          <Column field="noRm" header="No. RM" headerClass="bg-opensimrs-50" />
          <Column field="namaPasien" header="Nama Pasien" headerClass="bg-opensimrs-50" />
          <Column field="namaBangsal" header="Ruangan" headerClass="bg-opensimrs-50" />
          <Column header="Skrining" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-1.5 rounded" :class="[gayaRisikoGizi(d.kategoriRisiko).bg, gayaRisikoGizi(d.kategoriRisiko).text]">
                Skor {{ d.skor }} — {{ gayaRisikoGizi(d.kategoriRisiko).label }}
              </span>
            </template>
          </Column>
          <Column header="Waktu Skrining" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuGizi(d.waktuSkrining) }}</template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[140px]">
            <template #body="{ data: d }">
              <CustomButton v-if="boleh('CREATE')" icon="PhNotebook" size="small" label="Asesmen" @click="buka(d)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="760px">
      <template #header>Asuhan Gizi (PAGT) — {{ pasienDipilih?.namaPasien }}</template>
      <template #body>
        <div class="pt-4">
          <div v-if="riwayat.length" class="mb-4 border rounded border-grey-100 divide-y divide-grey-100">
            <div v-for="r in riwayat" :key="r.uuid" class="p-3 flex justify-between items-start gap-3">
              <div class="text-xs">
                <div class="text-grey-400">{{ waktuGizi(r.createdAt) }} — {{ r.ahliGiziUuid }}</div>
                <div><b>Asesmen:</b> {{ r.asesmen }}</div>
                <div><b>Diagnosis Gizi:</b> {{ r.diagnosisGizi }}</div>
                <div><b>Intervensi:</b> {{ r.intervensi }}</div>
                <div v-if="r.monitoringEvaluasi"><b>Monitoring-Evaluasi:</b> {{ r.monitoringEvaluasi }}</div>
              </div>
              <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ubahDariRiwayat(r)" />
            </div>
          </div>
          <div class="grid grid-cols-1 gap-4">
            <CustomTextArea v-model="form.asesmen" label="Asesmen Gizi" required height="h-20" />
            <CustomTextArea v-model="form.diagnosisGizi" label="Diagnosis Gizi" required height="h-20" />
            <CustomTextArea v-model="form.intervensi" label="Intervensi Gizi" required height="h-20" />
            <CustomTextArea v-model="form.monitoringEvaluasi" label="Monitoring-Evaluasi (opsional)" height="h-20" />
          </div>
          <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton v-if="modeUbah" label="Batal Ubah" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="batalUbah" />
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton :label="modeUbah ? 'Simpan Perubahan' : 'Simpan Asesmen Baru'" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
