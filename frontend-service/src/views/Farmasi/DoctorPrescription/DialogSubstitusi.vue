<script setup lang="ts">
// Substitusi obat non-racikan oleh apoteker sebelum verifikasi (Resep Masuk/Sudah Ditelaah).
// Pilihan obat pengganti hanya obat yang punya stok di lokasi stok (depo) resep; stok & tagihan
// mengikuti obat pengganti saat verifikasi.
// Wajib persetujuan dokter: diajukan ke dokter (obat baru diganti setelah disetujui di Farmasi › Persetujuan
// Substitusi) atau dicatat sebagai konfirmasi lisan/telepon (langsung berlaku, diverifikasi dokter kemudian).
import { ref, computed, watch } from "vue";
import { useDoctorPrescriptionStore } from "@/stores/farmasi/DoctorPrescription";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  // item resep (camelCase dari detail resep): uuid, namaItem, totalObat, satuanDosis
  obat: {
    type: Object,
    default: null,
  },
  lokasiStokNama: {
    type: String,
    default: "",
  },
  dokterOrder: {
    type: String,
    default: "",
  },
});
const emit = defineEmits(["update:visible", "saved"]);

const store = useDoctorPrescriptionStore();

const KATEGORI_ALASAN = [
  { kode: "stok_kosong", label: "Stok kosong" },
  { kode: "tidak_ada_di_formularium", label: "Tidak tersedia di formularium" },
  { kode: "permintaan_pasien", label: "Permintaan pasien" },
  { kode: "penjamin", label: "Ketentuan penjamin" },
  { kode: "lainnya", label: "Lainnya" },
];

const opsi = ref<any[]>([]);
const memuat = ref(false);
const menyimpan = ref(false);
const pilihan = ref<string | null>(null);
const jumlah = ref<number | null>(null);
const kategoriAlasan = ref<string | null>(null);
const alasan = ref("");
const MODE = [
  { kode: "ajukan", label: "Ajukan ke dokter (menunggu persetujuan)" },
  { kode: "konfirmasi_lisan", label: "Sudah dikonfirmasi dokter (lisan/telepon)" },
];
const CARA_KONFIRMASI = [
  { kode: "telepon", label: "Telepon" },
  { kode: "lisan", label: "Lisan / tatap muka" },
  { kode: "langsung", label: "Pesan langsung (chat)" },
];
const mode = ref("ajukan");
const caraKonfirmasi = ref<string | null>(null);
const lisan = computed(() => mode.value === "konfirmasi_lisan");
const dokterPenyetuju = ref("");
const catatan = ref("");
const galat = ref<Record<string, string>>({});

// satu opsi = satu obat pada satu jenis stok; label memuat sisa stok di depo resep
const opsiObat = computed(() =>
  opsi.value.map((o: any) => ({
    ...o,
    kunci: `${o.itemMedisUuid}|${o.jenisStokUuid}`,
    label: `${o.name} — ${o.jenisStok} (sisa ${o.sisaStok}${o.satuan ? ` ${o.satuan}` : ""})`,
  }))
);
const terpilih = computed(() => opsiObat.value.find((o: any) => o.kunci === pilihan.value) ?? null);

const muatOpsi = async () => {
  opsi.value = [];
  if (!props.obat?.uuid) return;
  memuat.value = true;
  try {
    const res = await store.opsiSubstitusi(props.obat.uuid);
    opsi.value = res?.payload ?? [];
  } finally {
    memuat.value = false;
  }
};

watch(
  () => props.visible,
  (terbuka) => {
    if (!terbuka) return;
    pilihan.value = null;
    jumlah.value = Number(props.obat?.totalObat) || null;
    kategoriAlasan.value = null;
    alasan.value = "";
    mode.value = "ajukan";
    caraKonfirmasi.value = null;
    dokterPenyetuju.value = props.dokterOrder ?? "";
    catatan.value = "";
    galat.value = {};
    muatOpsi();
  }
);

const tutup = () => emit("update:visible", false);

const periksa = () => {
  const g: Record<string, string> = {};
  if (!terpilih.value) g.pilihan = "Obat pengganti harus dipilih";
  if (!jumlah.value || jumlah.value <= 0) g.jumlah = "Jumlah harus lebih dari 0";
  else if (terpilih.value && jumlah.value > Number(terpilih.value.sisaStok)) g.jumlah = `Melebihi sisa stok (${terpilih.value.sisaStok})`;
  if (!kategoriAlasan.value) g.kategoriAlasan = "Kategori alasan harus dipilih";
  if (!alasan.value.trim()) g.alasan = "Alasan substitusi wajib diisi";
  if (lisan.value && !dokterPenyetuju.value.trim()) g.dokterPenyetuju = "Nama dokter wajib diisi";
  if (lisan.value && !caraKonfirmasi.value) g.caraKonfirmasi = "Cara konfirmasi harus dipilih";
  galat.value = g;
  return Object.keys(g).length === 0;
};

const simpan = async () => {
  if (!periksa() || !terpilih.value) return;
  menyimpan.value = true;
  try {
    const res = await store.substitusiObat({
      prescriptionItemUuid: props.obat?.uuid,
      itemMedisUuid: terpilih.value.itemMedisUuid,
      jenisStokUuid: terpilih.value.jenisStokUuid,
      medicationQty: jumlah.value,
      kategoriAlasan: kategoriAlasan.value,
      alasan: alasan.value.trim(),
      mode: mode.value,
      dokterPenyetuju: lisan.value ? dokterPenyetuju.value.trim() : null,
      caraKonfirmasi: lisan.value ? caraKonfirmasi.value : null,
      catatan: catatan.value.trim() || null,
    });
    if (res) {
      emit("saved");
      tutup();
    }
  } finally {
    menyimpan.value = false;
  }
};
</script>

<template>
  <CustomDialog :visible="visible" width="640px" @update:visible="(v: boolean) => emit('update:visible', v)" @close-dialog="tutup">
    <template #header>Substitusi Obat</template>
    <template #body>
      <div class="grid grid-cols-1 gap-3 mt-[15px] text-sm">
        <div class="p-3 rounded-lg bg-opensimrs-50">
          <p class="text-xs text-grey-300">Obat pada resep</p>
          <p class="font-bold">
            {{ obat?.namaItem ?? "-" }} — {{ obat?.totalObat ?? "-" }} {{ obat?.satuanDosis ?? "" }}
          </p>
          <p v-if="lokasiStokNama" class="text-xs text-grey-300 mt-[4px]">Stok pengganti diambil dari: {{ lokasiStokNama }}</p>
        </div>
        <CustomSelect
          v-model="pilihan"
          label="Obat Pengganti"
          place-holder="Pilih obat pengganti"
          optionLabel="label"
          optionValue="kunci"
          :filterFields="['name', 'code', 'jenisStok']"
          :options="opsiObat"
          :isLoading="memuat"
          :invalid="!!galat.pilihan"
          :invalidMessage="galat.pilihan"
          required
        />
        <p v-if="!memuat && !opsiObat.length" class="text-xs italic text-danger-300">
          Tidak ada obat lain yang memiliki stok di lokasi stok resep.
        </p>
        <div class="grid grid-cols-2 gap-3">
          <CustomInputNumber
            v-model="jumlah"
            label="Jumlah"
            :min="0"
            :maxFractionDigits="2"
            :invalid="!!galat.jumlah"
            :invalidMessage="galat.jumlah"
            required
          />
          <CustomSelect
            v-model="kategoriAlasan"
            label="Kategori Alasan"
            place-holder="Pilih kategori"
            optionLabel="label"
            optionValue="kode"
            :options="KATEGORI_ALASAN"
            :showFilter="false"
            :invalid="!!galat.kategoriAlasan"
            :invalidMessage="galat.kategoriAlasan"
            required
          />
        </div>
        <CustomTextArea
          v-model="alasan"
          label="Alasan Substitusi"
          placeholder="Mis. stok kosong di depo, diganti generik dengan zat aktif & kekuatan sama"
          :invalid="!!galat.alasan"
          :invalidMessage="galat.alasan"
          required
        />
        <CustomSelect
          v-model="mode"
          label="Persetujuan Dokter"
          optionLabel="label"
          optionValue="kode"
          :options="MODE"
          :showFilter="false"
          required
        />
        <p v-if="!lisan" class="text-xs italic text-grey-300">
          Obat pada resep belum diganti sampai dokter menyetujui. Resep tidak dapat diverifikasi selama pengajuan
          masih menunggu.
        </p>
        <div v-else class="grid grid-cols-2 gap-3 items-start">
          <CustomSelect
            v-model="caraKonfirmasi"
            label="Cara Konfirmasi"
            place-holder="Pilih cara"
            optionLabel="label"
            optionValue="kode"
            :options="CARA_KONFIRMASI"
            :showFilter="false"
            :invalid="!!galat.caraKonfirmasi"
            :invalidMessage="galat.caraKonfirmasi"
            required
          />
          <CustomTextfield
            v-model="dokterPenyetuju"
            label="Dokter yang Menyetujui"
            placeholder="Nama dokter"
            :invalid="!!galat.dokterPenyetuju"
            :invalidMessage="galat.dokterPenyetuju"
            required
          />
        </div>
        <CustomTextfield v-model="catatan" label="Catatan (opsional)" placeholder="Catatan untuk pasien/petugas" />
        <p class="text-xs italic text-grey-300">
          Dosis, aturan pakai, dan cara pakai tetap mengikuti resep dokter. Stok yang dipotong dan harga yang
          ditagihkan saat verifikasi adalah obat pengganti.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <CustomButton
          @click="tutup"
          label="Batal"
          outlined
          borderColor="border-grey-200"
          textColor="text-grey-300"
        />
        <CustomButton
          @click="simpan"
          :label="lisan ? 'Simpan Substitusi' : 'Ajukan ke Dokter'"
          class="ml-[10px]"
          :disabled="menyimpan"
        />
      </div>
    </template>
  </CustomDialog>
</template>
