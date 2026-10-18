<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  JENIS_LAYANAN,
  PRIORITAS,
  batalPenugasan,
  daftarArmada,
  daftarKru,
  daftarPenugasanAktif,
  daftarPermintaan,
  izinAmbulans,
  tugaskanArmada,
  waktuAmbulans,
} from "@/stores/penunjang/ambulans";

// Penugasan koordinator: menetapkan armada & kru untuk permintaan yang menunggu, serta membatalkan penugasan
// sebelum perjalanan dimulai (KF-6/A3). Pencatatan perjalanan dilakukan di halaman Perjalanan.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinAmbulans("Penugasan", aksi);

const menunggu = ref<any[]>([]);
const aktif = ref<any[]>([]);
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [m, a] = await Promise.all([daftarPermintaan({ status: "menunggu", limit: 100 }), daftarPenugasanAktif()]);
    menunggu.value = m?.payload?.data ?? [];
    aktif.value = a?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);

// ── Tugaskan armada & kru
const dialog = ref(false);
const permintaanDipilih = ref<any>(null);
const armadaOpsi = ref<any[]>([]);
const sopirOpsi = ref<any[]>([]);
const perawatOpsi = ref<any[]>([]);
const form = ref({ armadaUuid: "", sopirKruUuid: "", perawatKruUuid: "" });
const galat = ref("");

const buka = async (permintaan: any) => {
  galat.value = "";
  permintaanDipilih.value = permintaan;
  form.value = { armadaUuid: "", sopirKruUuid: "", perawatKruUuid: "" };
  storeUtils.setLoading(true);
  try {
    const [a, s, p] = await Promise.all([
      daftarArmada({ status: "siap", limit: 200 }),
      daftarKru({ peran: "sopir", aktif: "1", limit: 200 }),
      daftarKru({ peran: "perawat", aktif: "1", limit: 200 }),
    ]);
    armadaOpsi.value = a?.payload?.data ?? [];
    sopirOpsi.value = s?.payload?.data ?? [];
    perawatOpsi.value = p?.payload?.data ?? [];
    dialog.value = true;
  } finally {
    storeUtils.setLoading(false);
  }
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.armadaUuid || !f.sopirKruUuid) return (galat.value = "Armada dan sopir wajib dipilih");
  storeUtils.setLoading(true);
  try {
    const res = await tugaskanArmada(permintaanDipilih.value.uuid, {
      armada_uuid: f.armadaUuid,
      sopir_kru_uuid: f.sopirKruUuid,
      perawat_kru_uuid: f.perawatKruUuid || undefined,
    });
    if (res?.payload) {
      dialog.value = false;
      muat();
    } else galat.value = "Gagal menugaskan armada & kru";
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Batalkan penugasan (sebelum perjalanan dimulai)
const dialogBatal = ref(false);
const penugasanDipilih = ref<any>(null);
const alasanBatal = ref("");
const bukaBatal = (pn: any) => {
  penugasanDipilih.value = pn;
  alasanBatal.value = "";
  dialogBatal.value = true;
};
const batalkan = async () => {
  if (!alasanBatal.value.trim()) return;
  storeUtils.setLoading(true);
  try {
    const res = await batalPenugasan(penugasanDipilih.value.uuid, alasanBatal.value.trim());
    if (res) {
      dialogBatal.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full gap-3 overflow-auto">
    <Card pt:body:class="pt-0">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Menunggu Penugasan</h1>
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!menunggu.length" />
        <DataTable v-else :value="menunggu" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 55rem">
          <Column header="No. Permintaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.nomorPermintaan }}</div>
              <div class="text-grey-400">{{ waktuAmbulans(d.waktuPermintaan) }}</div>
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.namaPasien ?? "Umum" }}</template>
          </Column>
          <Column header="Jenis" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ JENIS_LAYANAN[d.jenisLayanan] ?? d.jenisLayanan }}</template>
          </Column>
          <Column header="Prioritas" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ PRIORITAS[d.prioritas] ?? d.prioritas }}</template>
          </Column>
          <Column field="tujuan" header="Tujuan" headerClass="bg-opensimrs-50" />
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[140px]">
            <template #body="{ data: d }">
              <CustomButton v-if="boleh('CREATE')" label="Tugaskan" size="small" @click="buka(d)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Card pt:body:class="pt-0" class="grow">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Penugasan Aktif</h1>
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!aktif.length" />
        <DataTable v-else :value="aktif" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 55rem">
          <Column header="No. Permintaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.nomorPermintaan }}</template>
          </Column>
          <Column header="Armada" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.nomorPolisi }} ({{ d.jenisArmada }})</template>
          </Column>
          <Column header="Kru" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ (d.kru ?? []).map((k: any) => k.namaPegawai).join(", ") || "-" }}</template>
          </Column>
          <Column header="Ditugaskan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuAmbulans(d.waktuPenugasan) }}</template>
          </Column>
          <Column header="Status Perjalanan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.statusPerjalanan ?? "Belum dimulai" }}</template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[140px]">
            <template #body="{ data: d }">
              <CustomButton v-if="boleh('BATAL') && !d.perjalananUuid" label="Batalkan" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="bukaBatal(d)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="640px">
      <template #header>Tugaskan Armada & Kru — {{ permintaanDipilih?.nomorPermintaan }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="form.armadaUuid" label="Armada" placeHolder="Pilih armada siap" :options="armadaOpsi" optionValue="uuid" optionLabel="nomorPolisi" class="col-span-2" required />
          <CustomSelect v-model="form.sopirKruUuid" label="Sopir" placeHolder="Pilih sopir" :options="sopirOpsi" optionValue="uuid" optionLabel="namaPegawai" required />
          <CustomSelect v-model="form.perawatKruUuid" label="Perawat Pendamping (opsional)" placeHolder="Pilih perawat" :options="perawatOpsi" optionValue="uuid" optionLabel="namaPegawai" />
        </div>
        <div class="mt-2 text-xs text-grey-400">Armada hanya menampilkan yang berstatus siap; kesesuaian jenis armada dan jadwal jaga kru tetap divalidasi sistem.</div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Tugaskan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogBatal" width="460px" headerBg="bg-danger-300">
      <template #header>Batalkan Penugasan</template>
      <template #body>
        <div class="pt-4">
          <CustomTextfield v-model="alasanBatal" label="Alasan pembatalan" placeholder="mis. Armada diminta unit lain" :maxLength="255" required />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBatal = false" />
          <CustomButton label="Batalkan Penugasan" backgroundColor="bg-danger-300" @click="batalkan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
