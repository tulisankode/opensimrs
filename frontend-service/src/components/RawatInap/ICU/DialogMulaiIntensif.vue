<script setup lang="ts">
import { ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { utilsStore } from "@/stores/utils";
import { apiIntensif } from "@/stores/rawatInap/icu";

// Mulai episode perawatan intensif (ICU/CCU/HDU) + serah terima masuk, tertaut ke perpindahan Rawat Inap yang sudah
// approve. Pilihan perpindahan diambil dari endpoint perpindahan-siap (pasien masih di bed tujuan & belum punya episode
// intensif aktif), sehingga petugas tidak perlu mengetik UUID.
const props = withDefaults(defineProps<{ basis?: string; label?: string; dataTambahan?: Record<string, unknown> }>(), { basis: "/icu", label: "ICU" });
const visible = defineModel<boolean>("visible", { default: false });
const emit = defineEmits<{ dimulai: [perawatan: any] }>();
const storeUtils = utilsStore();
const api = apiIntensif(props.basis);

const kosong = () => ({
  perpindahanUuid: "",
  diagnosisRingkas: "",
  kriteria: "",
  kondisi: "",
  tindakan: "",
  terapiBerjalan: "",
  alergiRelevan: "",
  aksesAlat: "",
  tindakLanjut: "",
});
const form = ref(kosong());
const galat = ref("");
const perpindahanSiap = ref<any[]>([]);

const labelPerpindahan = (p: any) =>
  `${p.namaPasien ?? "-"} (${p.noRm ?? "-"}) · ${p.ruanganAsal ?? "-"} → ${p.ruanganTujuan ?? "-"} Bed ${p.bedTujuan ?? "-"}`;

const muatPerpindahan = async () => {
  const res = await api.getPerpindahanSiap("masuk");
  perpindahanSiap.value = (res?.payload ?? []).map((p: any) => ({ ...p, labelPilihan: labelPerpindahan(p) }));
};

watch(visible, async (buka) => {
  if (!buka) return;
  form.value = kosong();
  galat.value = "";
  await muatPerpindahan();
});

const simpan = async () => {
  galat.value = "";
  if (!form.value.perpindahanUuid) return (galat.value = "Pilih perpindahan yang sudah disetujui (approve) di Rawat Inap");
  storeUtils.setLoading(true);
  try {
    const f = form.value;
    const res = await api.mulaiPerawatan(f.perpindahanUuid, {
      ...props.dataTambahan,
      diagnosisRingkas: f.diagnosisRingkas || undefined,
      serahTerima: {
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
      visible.value = false;
      emit("dimulai", res.payload);
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <CustomDialog v-model:visible="visible" width="620px">
    <template #header>Mulai Perawatan {{ label }} — Serah Terima Masuk</template>
    <template #body>
      <div class="flex flex-col gap-3 pt-4">
        <div class="text-xs text-grey-400">
          Ajukan dan setujui perpindahan ke bed {{ label }} terlebih dahulu di Rawat Inap › Perpindahan Bangsal; perpindahan
          berstatus approve yang belum ditautkan ke episode intensif tampil di bawah.
        </div>
        <slot name="konfigurasi" />
        <CustomSelect
          v-model="form.perpindahanUuid"
          label="Perpindahan masuk"
          placeHolder="Belum ada perpindahan approve"
          :options="perpindahanSiap"
          optionValue="uuid"
          optionLabel="labelPilihan"
        />
        <CustomTextfield v-model="form.diagnosisRingkas" label="Diagnosis ringkas" :maxLength="500" />
        <CustomTextArea v-model="form.kriteria" :label="`Kriteria masuk ${label}`" />
        <CustomTextArea v-model="form.kondisi" label="Kondisi terkini" />
        <CustomTextArea v-model="form.tindakan" label="Tindakan yang sudah dilakukan" />
        <CustomTextArea v-model="form.terapiBerjalan" label="Obat/terapi yang sedang berjalan" />
        <CustomTextArea v-model="form.alergiRelevan" label="Alergi relevan" />
        <CustomTextArea v-model="form.aksesAlat" label="Akses/alat terpasang" />
        <CustomTextArea v-model="form.tindakLanjut" label="Hal yang perlu dipantau" />
        <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="visible = false" />
        <CustomButton :label="`Mulai Perawatan ${label}`" @click="simpan" />
      </div>
    </template>
  </CustomDialog>
</template>
