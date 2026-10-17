<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import { apiTraining, izinTraining, jam, labelSesi, rupiah, useTrainingStore, type KelasTraining, type SesiKelas } from "@/stores/penunjang/training";

// Dialog tambah / ubah / detail datamaster kelas Training. Kelas bersesi (is_sesi) wajib minimal satu sesi;
// slot dihitung per sesi. Validasi akhir (kode unik per faskes, jumlah_slot bulat positif, harga ≥ 0) di backend.
const props = defineProps({
  isDialogVisible: { type: Boolean, default: false },
  method: { type: String, default: "add" },
  uuid: { type: String, default: "" },
});
const emit = defineEmits(["update:isDialogVisible", "data-updated"]);

const store = useTrainingStore();
const mode = ref(props.method);
const memuat = ref(false);
const menyimpan = ref(false);
const galat = ref("");

const kosong = () => ({
  kode: "",
  nama: "",
  jenis: "",
  instruktur: "",
  harga: 0 as number | null,
  jumlahSlot: 1 as number | null,
  isSesi: false,
  status: true,
  sesi: [] as SesiKelas[],
});
const form = ref(kosong());
const bisaUbah = computed(() => izinTraining("Datamaster", "UPDATE", "Kelas"));
const judul = computed(() => (mode.value === "add" ? "Tambah" : mode.value === "edit" ? "Ubah" : "Detail"));

const sesiBaru = (): SesiKelas => ({ namaSesi: `Sesi ${form.value.sesi.length + 1}`, jamMulai: "", jamSelesai: "" });
const tambahSesi = () => form.value.sesi.push(sesiBaru());
const hapusSesi = (i: number) => form.value.sesi.splice(i, 1);
watch(
  () => form.value.isSesi,
  (v) => {
    if (v && !form.value.sesi.length && mode.value !== "detail") tambahSesi();
  },
);

const muat = async () => {
  galat.value = "";
  mode.value = props.method;
  form.value = kosong();
  if (!props.uuid || props.method === "add") return;
  memuat.value = true;
  try {
    const r = await apiTraining.detailKelas(props.uuid);
    const k: KelasTraining | undefined = r?.payload;
    if (!k) return emit("update:isDialogVisible", false);
    form.value = {
      kode: k.kode,
      nama: k.nama,
      jenis: k.jenis ?? "",
      instruktur: k.instruktur ?? "",
      harga: Number(k.harga) || 0,
      jumlahSlot: Number(k.jumlahSlot) || 1,
      isSesi: !!k.isSesi,
      status: !!k.status,
      sesi: (k.sesi ?? []).map((s) => ({ namaSesi: s.namaSesi, jamMulai: jam(s.jamMulai), jamSelesai: jam(s.jamSelesai), urutan: s.urutan })),
    };
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

const simpan = async () => {
  galat.value = "";
  const f = form.value;
  if (!f.kode.trim()) return (galat.value = "Kode kelas wajib diisi");
  if (!f.nama.trim()) return (galat.value = "Nama kelas wajib diisi");
  if (!Number.isInteger(Number(f.jumlahSlot)) || Number(f.jumlahSlot) < 1) return (galat.value = "Jumlah slot harus bilangan bulat positif");
  if (Number(f.harga ?? 0) < 0) return (galat.value = "Harga tidak boleh negatif");
  if (f.isSesi && !f.sesi.length) return (galat.value = "Kelas bersesi wajib memiliki minimal satu sesi");
  if (f.isSesi && f.sesi.some((s) => !String(s.namaSesi ?? "").trim())) return (galat.value = "Nama sesi wajib diisi pada setiap sesi");
  menyimpan.value = true;
  try {
    const r = await apiTraining.simpanKelas(
      {
        kode: f.kode.trim(),
        nama: f.nama.trim(),
        jenis: f.jenis.trim() || null,
        instruktur: f.instruktur.trim() || null,
        harga: Number(f.harga ?? 0),
        jumlahSlot: Number(f.jumlahSlot),
        isSesi: f.isSesi,
        status: f.status,
        sesi: f.isSesi ? f.sesi.map((s, i) => ({ namaSesi: String(s.namaSesi).trim(), jamMulai: s.jamMulai || null, jamSelesai: s.jamSelesai || null, urutan: i + 1 })) : [],
      },
      mode.value === "edit" ? props.uuid : undefined,
    );
    if (!r?.payload) return;
    store.muatKelas(true);
    emit("data-updated");
    tutup();
  } finally {
    menyimpan.value = false;
  }
};
</script>

<template>
  <CustomDialog width="680px" :visible="isDialogVisible" headerBg="bg-opensimrs-300" @update:visible="emit('update:isDialogVisible', $event)">
    <template #header>{{ judul }} Kelas Training</template>
    <template #body>
      <div v-if="memuat" class="py-8 text-sm text-center text-grey-400">Memuat data kelas…</div>
      <!-- Form -->
      <div v-else-if="mode !== 'detail'" class="grid grid-cols-12 gap-5 mt-5">
        <CustomTextfield v-model="form.kode" label="Kode Kelas" placeholder="Mis. ZMB" class="col-span-4" :maxLength="50" required />
        <CustomTextfield v-model="form.nama" label="Nama Kelas" placeholder="Mis. Zumba Pagi" class="col-span-8" :maxLength="200" required />
        <CustomTextfield v-model="form.jenis" label="Jenis" placeholder="Mis. Olahraga / Edukasi" class="col-span-6" :maxLength="100" />
        <CustomTextfield v-model="form.instruktur" label="Instruktur" placeholder="Nama instruktur" class="col-span-6" :maxLength="200" />
        <CustomInputNumber v-model="form.harga" class="col-span-6" label="Harga" :min="0" required>
          <template #prependText>
            <div class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD bg-opensimrs-300 rounded-l-md">Rp.</div>
          </template>
        </CustomInputNumber>
        <CustomInputNumber v-model="form.jumlahSlot" label="Jumlah Slot" class="col-span-3" :min="1" required />
        <CustomSwitch v-model="form.isSesi" :show-label="true" label="Sesi" sideLabel="TIDAK" sideLabelTrue="BERSESI" class="col-span-3" />

        <div v-if="form.isSesi" class="flex flex-col col-span-12 gap-2.5">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold">Sesi Kelas</span>
            <CustomButton icon="PhPlus" label="Tambah Sesi" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="tambahSesi" />
          </div>
          <div v-for="(s, i) in form.sesi" :key="i" class="grid items-end grid-cols-12 gap-2.5">
            <CustomTextfield v-model="s.namaSesi" label="Nama Sesi" class="col-span-5" :maxLength="100" />
            <CustomTextfield v-model="s.jamMulai" type="time" label="Jam Mulai" class="col-span-3" />
            <CustomTextfield v-model="s.jamSelesai" type="time" label="Jam Selesai" class="col-span-3" />
            <div class="flex justify-end col-span-1 pb-1">
              <CustomButton icon="PhTrash" backgroundColor="bg-danger-300" size="small" @click="hapusSesi(i)" />
            </div>
          </div>
        </div>

        <hr class="col-span-12 border-grey-200" />
        <CustomSwitch v-model="form.status" :show-label="true" label="Status" sideLabel="NON-AKTIF" sideLabelTrue="AKTIF" class="col-span-12" />
        <div v-if="galat" class="col-span-12 text-sm text-danger-300">{{ galat }}</div>
      </div>

      <!-- Detail -->
      <div v-else class="flex flex-col gap-5 mt-5">
        <CustomInfoRow label="Kode Kelas" :value="form.kode" />
        <CustomInfoRow label="Nama Kelas" :value="form.nama" />
        <CustomInfoRow label="Jenis" :value="form.jenis || '-'" />
        <CustomInfoRow label="Instruktur" :value="form.instruktur || '-'" />
        <CustomInfoRow label="Harga" :value="rupiah(form.harga)" />
        <CustomInfoRow label="Jumlah Slot" :value="String(form.jumlahSlot ?? '-')" />
        <CustomInfoRow label="Sesi">
          <template #value>
            <div v-if="form.isSesi && form.sesi.length" class="flex flex-wrap gap-1">
              <CustomChip
                v-for="(s, i) in form.sesi"
                :key="i"
                :label="labelSesi(s)"
                :showCheckedIcon="false"
                border-color="border-none"
                bg-color="bg-opensimrs-300"
                customClass="text-xs font-semibold cursor-auto h-5 text-white"
              />
            </div>
            <span v-else>Tanpa sesi</span>
          </template>
        </CustomInfoRow>
        <hr class="col-span-12 border-grey-200" />
        <CustomInfoRow label="Status">
          <template #value>
            <CustomChip
              :label="form.status ? 'AKTIF' : 'NON-AKTIF'"
              :textColor="form.status ? 'text-white' : 'text-[#80868d]'"
              :bgColor="form.status ? 'bg-opensimrs-300' : 'bg-white'"
              :borderColor="form.status ? 'border-none' : 'border-[#80868d]'"
              :icon-color="form.status ? 'white' : '#80868d'"
              customClass="text-xs font-semibold h-5 flex w-fit"
            />
          </template>
        </CustomInfoRow>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <template v-if="mode !== 'detail'">
            <CustomButton label="Batal" border-color="border-grey-200" background-color="bg-white" text-color="text-grey-300" @click="tutup" />
            <CustomButton label="Simpan" :loading="menyimpan" :disabled="memuat" @click="simpan" />
          </template>
          <CustomButton v-else-if="bisaUbah" label="Ubah" @click="mode = 'edit'" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
