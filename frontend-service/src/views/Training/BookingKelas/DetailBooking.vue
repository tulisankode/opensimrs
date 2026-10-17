<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import PilihPasien from "../Komponen/PilihPasien.vue";
import TabelSlot from "../Komponen/TabelSlot.vue";
import {
  apiTraining, dariIso, izinTraining, keIso, labelCaraBayar, labelGender, labelSesi, OPSI_CARA_BAYAR, rupiah, STATUS_ORDER, tglIndo, waktuEpoch,
  type OrderTraining, type PasienRingkas, type SlotSesi,
} from "@/stores/penunjang/training";

// Detail booking / order kelas Training (satu baris training_order) beserta aksinya:
//   booking → Ubah booking (tanggal, sesi, pasien), Daftar (lanjut ke pendaftaran + tagihan), Batal booking
//   order   → Batal pendaftaran (tagihan terkait dihapus)
const props = defineProps({
  isDialogVisible: { type: Boolean, default: false },
  uuid: { type: String, default: "" },
  jenis: { type: String as () => "booking" | "order", default: "booking" },
});
const emit = defineEmits(["update:isDialogVisible", "berubah"]);

const d = ref<OrderTraining | null>(null);
const memuat = ref(false);
const mode = ref<"detail" | "ubah" | "daftar" | "batal">("detail");
const galat = ref("");
const menyimpan = ref(false);

const izin = computed(() => ({
  ubah: izinTraining("Booking Kelas", "UPDATE BOOKING"),
  daftar: izinTraining("Booking Kelas", "DAFTAR"),
  batalBooking: izinTraining("Booking Kelas", "BATAL BOOKING"),
  batalOrder: izinTraining("Daftar Kelas", "BATAL DAFTAR"),
}));
const bolehBatal = computed(() => (d.value?.status === "booking" ? izin.value.batalBooking : d.value?.status === "order" ? izin.value.batalOrder : false));

const muat = async () => {
  mode.value = "detail";
  galat.value = "";
  d.value = null;
  if (!props.uuid) return;
  memuat.value = true;
  try {
    const r = props.jenis === "order" ? await apiTraining.detailOrder(props.uuid) : await apiTraining.detailBooking(props.uuid);
    d.value = r?.payload ?? null;
    if (!d.value) emit("update:isDialogVisible", false);
  } finally {
    memuat.value = false;
  }
};
watch(
  () => props.isDialogVisible,
  (v) => {
    if (v) muat();
  },
);
const tutup = () => emit("update:isDialogVisible", false);
const selesai = (baru?: OrderTraining) => {
  if (baru) d.value = baru;
  mode.value = "detail";
  emit("berubah");
};

// ── Ubah booking
const tanggalUbah = ref<Date>(new Date());
const sesiUbah = ref<{ sesiUuid: string | null } | null>(null);
const pasienUbah = ref<PasienRingkas | null>(null);
const bukaUbah = () => {
  if (!d.value) return;
  tanggalUbah.value = dariIso(d.value.tanggalKelas);
  sesiUbah.value = { sesiUuid: d.value.sesiUuid ?? null };
  pasienUbah.value = { uuid: d.value.patientUuid, name: d.value.namaPasien ?? "", noRm: d.value.noRm ?? "", gender: d.value.gender, phone: d.value.noHp };
  galat.value = "";
  mode.value = "ubah";
};
watch(tanggalUbah, (t, lama) => {
  // Ganti tanggal → sesi dipilih ulang dari ketersediaan tanggal baru (kecuali kelas tanpa sesi).
  if (mode.value === "ubah" && lama && keIso(t) !== keIso(lama) && d.value?.isSesi) sesiUbah.value = null;
});
const pilihSesi = (s: SlotSesi) => (sesiUbah.value = { sesiUuid: s.sesiUuid ?? null });
const simpanUbah = async () => {
  if (!d.value) return;
  galat.value = "";
  if (!pasienUbah.value) return (galat.value = "Pilih pasien");
  if (d.value.isSesi && !sesiUbah.value?.sesiUuid) return (galat.value = "Pilih sesi pada tabel ketersediaan");
  menyimpan.value = true;
  try {
    const r = await apiTraining.ubahBooking(d.value.uuid, {
      tanggalKelas: keIso(tanggalUbah.value),
      sesiUuid: d.value.isSesi ? sesiUbah.value?.sesiUuid : null,
      patientUuid: pasienUbah.value.uuid,
    });
    if (r?.payload) selesai(r.payload);
  } finally {
    menyimpan.value = false;
  }
};

// ── Lanjut daftar (booking → order + tagihan)
const caraBayar = ref(1);
const bukaDaftar = () => {
  caraBayar.value = 1;
  galat.value = "";
  mode.value = "daftar";
};
const simpanDaftar = async () => {
  if (!d.value) return;
  menyimpan.value = true;
  try {
    const r = await apiTraining.lanjutDaftar(d.value.uuid, { paymentMethod: caraBayar.value });
    if (r?.payload) selesai(r.payload);
  } finally {
    menyimpan.value = false;
  }
};

// ── Batal
const alasan = ref("");
const bukaBatal = () => {
  alasan.value = "";
  galat.value = "";
  mode.value = "batal";
};
const simpanBatal = async () => {
  if (!d.value) return;
  if (!alasan.value.trim()) return (galat.value = "Alasan pembatalan wajib diisi");
  menyimpan.value = true;
  try {
    const r = d.value.status === "booking" ? await apiTraining.batalBooking(d.value.uuid, alasan.value.trim()) : await apiTraining.batalOrder(d.value.uuid, alasan.value.trim());
    if (r?.payload) selesai(r.payload);
  } finally {
    menyimpan.value = false;
  }
};
</script>
<template>
  <CustomDialog width="800px" :visible="isDialogVisible" headerBg="bg-opensimrs-300" @update:visible="emit('update:isDialogVisible', $event)">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <span class="font-semibold text-MD text-white mr-2.5">{{ d?.noOrder ?? (jenis === "order" ? "Order Kelas" : "Booking Kelas") }}</span>
          <CustomChip v-if="d" label="APS" borderColor="border-grey-400" bgColor="bg-grey-100" textColor="text-grey-400" :showCheckedIcon="false" class="mr-1 font-semibold text-XS" />
          <CustomChip
            v-if="d?.paymentMethod"
            :label="labelCaraBayar(d.paymentMethod)"
            borderColor="border-opensimrs-300"
            bgColor="bg-opensimrs-50"
            textColor="text-opensimrs-300"
            :showCheckedIcon="false"
            class="mr-1 font-semibold text-XS"
          />
          <span v-if="d" class="px-2 py-0.5 border rounded-full text-XS font-semibold" :class="STATUS_ORDER[d.status]?.kelas">{{ STATUS_ORDER[d.status]?.label ?? d.status }}</span>
        </div>
        <div v-if="d" class="font-semibold text-SM border-l pl-5 mr-2.5">Dibuat: {{ waktuEpoch(d.createdAt) }}</div>
      </div>
    </template>
    <template #body>
      <div v-if="memuat || !d" class="py-8 text-sm text-center text-grey-400">Memuat data…</div>
      <template v-else>
        <!-- Ringkasan -->
        <div class="flex items-center justify-between gap-5 mt-5">
          <div class="flex flex-col pr-10 border-r border-grey-200">
            <div class="font-semibold text-MD">{{ d.namaPasien ?? "-" }}</div>
            <div class="flex gap-1 mt-1">
              <CustomChip :label="d.noRm ?? '-'" bgColor="bg-opensimrs-300" borderColor="border-opensimrs-300" textColor="text-white" :showCheckedIcon="false" class="font-semibold text-XS" />
              <CustomChip
                :label="labelGender(d.gender)"
                :bgColor="d.gender === 'Female' ? 'bg-female-75' : 'bg-male-75'"
                :borderColor="d.gender === 'Female' ? 'border-female-75' : 'border-male-75'"
                :textColor="d.gender === 'Female' ? 'text-female-300' : 'text-male-300'"
                :showCheckedIcon="false"
                class="font-semibold text-XS"
              />
            </div>
          </div>
          <div class="flex flex-col">
            <div class="font-semibold underline text-SM">No. Handphone</div>
            <div class="font-normal text-normal">{{ d.noHp || "-" }}</div>
          </div>
          <div class="flex flex-col">
            <div class="font-semibold underline text-SM">Tarif</div>
            <div class="font-normal text-normal">{{ rupiah(d.harga) }}</div>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-2.5 pt-5 mt-5 border-t border-grey-100">
          <div class="flex flex-col">
            <div class="font-semibold underline text-SM">Tanggal Kelas</div>
            <div class="font-normal text-normal">{{ tglIndo(d.tanggalKelas, true) }}</div>
          </div>
          <div class="flex flex-col">
            <div class="font-semibold underline text-SM">Kelas</div>
            <div class="font-normal text-normal">{{ d.kelasNama }}</div>
            <div class="text-xs text-grey-400">{{ [d.kelasJenis, d.instruktur].filter(Boolean).join(" · ") }}</div>
          </div>
          <div class="flex flex-col">
            <div class="font-semibold underline text-SM">Sesi</div>
            <div class="font-normal text-normal">{{ d.namaSesi ? labelSesi(d) : "-" }}</div>
          </div>
          <div class="flex flex-col">
            <div class="font-semibold underline text-SM">Petugas</div>
            <div class="font-normal text-normal">{{ d.dibuatOleh ?? "-" }}</div>
          </div>
        </div>
        <div v-if="d.status === 'batal'" class="p-3 mt-5 text-sm rounded-lg bg-danger-50 text-danger-300">
          Dibatalkan oleh {{ d.dibatalkanOleh ?? "-" }} pada {{ waktuEpoch(d.dibatalkanPada) }} — {{ d.alasanBatal ?? "-" }}
        </div>

        <!-- Ubah booking -->
        <div v-if="mode === 'ubah'" class="flex flex-col gap-3 p-3 mt-5 border rounded-lg border-grey-100">
          <h3 class="text-sm font-semibold">Ubah Booking</h3>
          <CustomDatePicker v-model="tanggalUbah" label="Tanggal Kelas" :min-date="new Date()" class="md:w-1/3" />
          <TabelSlot
            :kelasUuid="d.kelasUuid"
            :tanggal="keIso(tanggalUbah)"
            :terpilih="sesiUbah ? sesiUbah.sesiUuid : undefined"
            labelPilih="Pilih"
            @pilih="pilihSesi"
          />
          <p class="text-xs text-grey-400">Slot booking ini sendiri ikut terhitung di kolom Terisi pada tanggal & sesi asalnya.</p>
          <PilihPasien v-model="pasienUbah" label="Pasien" />
        </div>

        <!-- Lanjut daftar -->
        <div v-if="mode === 'daftar'" class="flex flex-col gap-3 p-3 mt-5 border rounded-lg border-grey-100">
          <h3 class="text-sm font-semibold">Lanjut ke Pendaftaran</h3>
          <p class="text-xs text-grey-500">Booking menjadi order kelas dan tagihan {{ rupiah(d.harga) }} dikirim ke Pembayaran.</p>
          <CustomSelect v-model="caraBayar" label="Cara Bayar" :options="OPSI_CARA_BAYAR" optionLabel="label" optionValue="value" :showFilter="false" class="md:w-1/2" />
        </div>

        <!-- Batal -->
        <div v-if="mode === 'batal'" class="flex flex-col gap-3 p-3 mt-5 border rounded-lg border-danger-75">
          <h3 class="text-sm font-semibold text-danger-300">{{ d.status === "booking" ? "Batalkan Booking" : "Batalkan Pendaftaran" }}</h3>
          <p class="text-xs text-grey-500">
            {{ d.status === "booking" ? "Slot kembali tersedia." : "Slot kembali tersedia dan tagihan terkait dihapus dari Pembayaran." }}
          </p>
          <CustomTextArea v-model="alasan" label="Alasan pembatalan" />
        </div>
        <p v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</p>
      </template>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2.5">
        <template v-if="d && mode === 'detail'">
          <CustomButton v-if="bolehBatal" label="Batalkan" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="bukaBatal" />
          <template v-if="d.status === 'booking'">
            <CustomButton v-if="izin.ubah" label="Ubah Booking" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaUbah" />
            <CustomButton v-if="izin.daftar" label="Daftar" backgroundColor="bg-opensimrs-300" @click="bukaDaftar" />
          </template>
          <CustomButton v-if="!bolehBatal && d.status !== 'booking'" label="Tutup" @click="tutup" />
        </template>
        <template v-else-if="d">
          <CustomButton label="Kembali" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="mode = 'detail'" />
          <CustomButton v-if="mode === 'ubah'" label="Simpan Perubahan" :loading="menyimpan" @click="simpanUbah" />
          <CustomButton v-if="mode === 'daftar'" label="Daftarkan" :loading="menyimpan" @click="simpanDaftar" />
          <CustomButton v-if="mode === 'batal'" label="Ya, Batalkan" backgroundColor="bg-danger-300" :loading="menyimpan" @click="simpanBatal" />
        </template>
      </div>
    </template>
  </CustomDialog>
</template>
