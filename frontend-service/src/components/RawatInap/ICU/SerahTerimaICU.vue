<script setup lang="ts">
import { ref } from "vue";
import { hasPermission } from "@/utils/permissions";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { apiIntensif } from "@/stores/rawatInap/icu";

// Serah terima terstruktur (masuk/keluar), tertaut ke transaksi ri_perpindahan yang berlaku (KF-1/KF-18; aturan
// bisnis use case STD-0008 §7 butir 2: tidak membuat status perpindahan paralel).
// basis/label: unit intensif pemilik episode ("/icu"·"ICU" bawaan, "/ccu"·"CCU", "/hdu"·"HDU").
const props = withDefaults(
  defineProps<{ perawatanUuid: string; status: string; serahTerima: any[]; basis?: string; label?: string }>(),
  { basis: "/icu", label: "ICU" },
);
const emit = defineEmits<{ selesai: [] }>();
const storeUtils = utilsStore();
const icuStore = apiIntensif(props.basis);

const kosongKeluar = () => ({
  perpindahanKeluarUuid: "",
  kondisiKeluar: "hidup" as "hidup" | "meninggal",
  kriteria: "",
  kondisi: "",
  tindakan: "",
  terapiBerjalan: "",
  alergiRelevan: "",
  aksesAlat: "",
  tindakLanjut: "",
});
const formKeluar = ref(kosongKeluar());
const dialogKeluar = ref(false);
const galat = ref("");

// Pilihan perpindahan keluar = perpindahan Rawat Inap berstatus approve dari bed episode ini (tanpa mengetik UUID).
const perpindahanSiap = ref<any[]>([]);
const labelPerpindahan = (p: any) =>
  `${p.ruanganTujuan ?? "-"} · Bed ${p.bedTujuan ?? "-"}${p.waktuPindah ? " · " + new Date(p.waktuPindah * 1000).toLocaleString("id-ID") : ""}`;

const bukaDialogKeluar = async () => {
  formKeluar.value = kosongKeluar();
  galat.value = "";
  dialogKeluar.value = true;
  const res = await icuStore.getPerpindahanSiap("keluar", props.perawatanUuid);
  perpindahanSiap.value = (res?.payload ?? []).map((p: any) => ({ ...p, labelPilihan: labelPerpindahan(p) }));
  if (perpindahanSiap.value.length === 1) formKeluar.value.perpindahanKeluarUuid = perpindahanSiap.value[0].uuid;
};

const simpanKeluar = async () => {
  galat.value = "";
  if (!formKeluar.value.perpindahanKeluarUuid?.trim()) return (galat.value = "Pilih perpindahan keluar yang sudah disetujui (approve) di Rawat Inap");
  storeUtils.setLoading(true);
  try {
    const f = formKeluar.value;
    const res = await icuStore.keluarPerawatan(props.perawatanUuid, {
      perpindahanKeluarUuid: f.perpindahanKeluarUuid.trim(),
      kondisiKeluar: f.kondisiKeluar,
      ringkasan: {
        kriteria: f.kriteria || undefined,
        kondisi: f.kondisi || undefined,
        tindakan: f.tindakan || undefined,
        terapiBerjalan: f.terapiBerjalan || undefined,
        alergiRelevan: f.alergiRelevan || undefined,
        aksesAlat: f.aksesAlat || undefined,
        tindakLanjut: f.tindakLanjut || undefined,
      },
    });
    if (res?.payload) {
      dialogKeluar.value = false;
      emit("selesai");
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex justify-between">
      <div class="font-semibold">Riwayat Serah Terima</div>
      <CustomButton v-if="status === 'aktif' && hasPermission(label, 'Serah Terima', 'KELOLA')" :label="`Keluar ${label}`" icon="PhSignOut" @click="bukaDialogKeluar" />
    </div>
    <NoData v-if="!serahTerima.length" />
    <div v-else class="flex flex-col gap-3">
      <div v-for="s in serahTerima" :key="s.uuid" class="p-3 text-sm border rounded-lg border-grey-75">
        <div class="flex items-center justify-between mb-1">
          <span class="font-semibold">{{ s.jenis === "masuk" ? "Serah Terima Masuk" : "Serah Terima Keluar" }}</span>
          <span class="text-xs text-grey-400">{{ new Date(s.createdAt * 1000).toLocaleString("id-ID") }} · {{ s.pencatat }}</span>
        </div>
        <div v-if="s.kriteria" class="text-xs"><b>Kriteria:</b> {{ s.kriteria }}</div>
        <div v-if="s.kondisi" class="text-xs"><b>Kondisi:</b> {{ s.kondisi }}</div>
        <div v-if="s.tindakan" class="text-xs"><b>Tindakan:</b> {{ s.tindakan }}</div>
        <div v-if="s.terapiBerjalan" class="text-xs"><b>Terapi berjalan:</b> {{ s.terapiBerjalan }}</div>
        <div v-if="s.alergiRelevan" class="text-xs"><b>Alergi:</b> {{ s.alergiRelevan }}</div>
        <div v-if="s.aksesAlat" class="text-xs"><b>Akses/alat:</b> {{ s.aksesAlat }}</div>
        <div v-if="s.tindakLanjut" class="text-xs"><b>Tindak lanjut:</b> {{ s.tindakLanjut }}</div>
      </div>
    </div>

    <CustomDialog v-model:visible="dialogKeluar" width="620px">
      <template #header>Keluar {{ label }} — Ringkasan Perawatan Intensif</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-xs text-grey-400">
            Ajukan dan setujui perpindahan keluar terlebih dahulu di Rawat Inap › Perpindahan Bangsal; perpindahan yang sudah berstatus approve dari bed ini tampil di bawah.
          </div>
          <div class="grid grid-cols-2 gap-3">
            <CustomSelect
              v-model="formKeluar.perpindahanKeluarUuid"
              label="Perpindahan keluar (tujuan)"
              placeHolder="Belum ada perpindahan approve"
              :options="perpindahanSiap"
              optionValue="uuid"
              optionLabel="labelPilihan"
            />
            <CustomSelect
              v-model="formKeluar.kondisiKeluar"
              label="Kondisi Keluar"
              :options="[{ label: 'Hidup', value: 'hidup' }, { label: 'Meninggal', value: 'meninggal' }]"
              optionValue="value"
              optionLabel="label"
              :showFilter="false"
              :clearable="false"
            />
          </div>
          <CustomTextArea v-model="formKeluar.kriteria" label="Kriteria keluar" />
          <CustomTextArea v-model="formKeluar.kondisi" label="Kondisi terakhir" />
          <CustomTextArea v-model="formKeluar.tindakan" label="Perjalanan perawatan / tindakan" />
          <CustomTextArea v-model="formKeluar.terapiBerjalan" label="Terapi/obat yang masih berjalan" />
          <CustomTextArea v-model="formKeluar.aksesAlat" label="Alat yang masih terpasang" />
          <CustomTextArea v-model="formKeluar.tindakLanjut" label="Tindak lanjut" />
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKeluar = false" />
          <CustomButton :label="`Selesaikan Perawatan ${label}`" @click="simpanKeluar" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
