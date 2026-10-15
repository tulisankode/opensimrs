<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { HARI_RAD, MODALITAS_RAD, OPSI_HARI_RAD, daftarRuangRad, hapusRuangRad, simpanRuangRad, type RuangRad } from "@/stores/penunjang/radiologi";

// Datamaster Ruang Pemeriksaan & Alat Radiologi: modalitas yang dilayani, merk/tipe alat, jam & hari operasional,
// dan durasi slot. Menjadi kolom papan Penjadwalan Pemeriksaan.
const storeUtils = utilsStore();

const data = ref<RuangRad[]>([]);
const cari = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarRuangRad({ limit: 200, cari: cari.value });
    data.value = res?.payload?.data ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const ringkasHari = (h: number[]) => {
  const urut = [...(h ?? [])].map(Number).sort();
  if (urut.length === 7) return "Setiap hari";
  const berurutan = urut.every((x, i) => !i || x === urut[i - 1] + 1);
  return berurutan && urut.length > 2 ? `${HARI_RAD[urut[0]]}–${HARI_RAD[urut[urut.length - 1]]}` : urut.map((x) => HARI_RAD[x].slice(0, 3)).join(", ");
};
const jumlahSlot = (r: { jamBuka: string; jamTutup: string; durasiSlot: number }) => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return Math.max(Math.floor((m(r.jamTutup) - m(r.jamBuka)) / (Number(r.durasiSlot) || 15)), 0);
};

// ── Form tambah / ubah
const dialog = ref(false);
const kosong = () => ({
  uuid: "",
  kode: "",
  nama: "",
  namaAlat: "",
  modalitas: ["XR"] as string[],
  jamBuka: "08:00",
  jamTutup: "16:00",
  durasiSlot: 15,
  hariOperasional: [1, 2, 3, 4, 5, 6] as number[],
  keterangan: "",
  status: true,
});
const form = ref(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);
const buka = (baris?: RuangRad) => {
  galat.value = "";
  form.value = baris
    ? { ...kosong(), ...baris, namaAlat: baris.namaAlat ?? "", keterangan: baris.keterangan ?? "", hariOperasional: [...baris.hariOperasional].map(Number), modalitas: [...baris.modalitas] }
    : kosong();
  dialog.value = true;
};
const toggleModalitas = (kode: string) => {
  const m = form.value.modalitas;
  form.value.modalitas = m.includes(kode) ? m.filter((x) => x !== kode) : [...m, kode];
};
const toggleHari = (h: string) => {
  const n = Number(h);
  const d = form.value.hariOperasional;
  form.value.hariOperasional = d.includes(n) ? d.filter((x) => x !== n) : [...d, n].sort();
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.kode.trim() || !f.nama.trim()) return (galat.value = "Kode dan nama ruang wajib diisi");
  if (!f.modalitas.length) return (galat.value = "Pilih minimal satu modalitas yang dilayani");
  if (!f.hariOperasional.length) return (galat.value = "Pilih minimal satu hari operasional");
  if (!f.jamBuka || !f.jamTutup || f.jamTutup <= f.jamBuka) return (galat.value = "Jam tutup harus setelah jam buka");
  storeUtils.setLoading(true);
  try {
    const res = await simpanRuangRad(
      {
        kode: f.kode,
        nama: f.nama,
        namaAlat: f.namaAlat,
        modalitas: f.modalitas,
        jamBuka: f.jamBuka,
        jamTutup: f.jamTutup,
        durasiSlot: Number(f.durasiSlot) || 15,
        hariOperasional: f.hariOperasional,
        keterangan: f.keterangan,
        status: f.status,
      },
      f.uuid || undefined
    );
    if (res) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialogHapus = ref(false);
const akanDihapus = ref<RuangRad | null>(null);
const hapus = async () => {
  if (!akanDihapus.value) return;
  if (await hapusRuangRad(akanDihapus.value.uuid)) {
    dialogHapus.value = false;
    muat();
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
          <h1 class="toolbar-heading text-opensimrs-300">Ruang &amp; Alat Radiologi</h1>
          <CustomTextfield v-model="cari" label="Cari ruang" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama / alat" :maxLength="100" @keydown.enter="muat" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="muat" />
          <CustomButton icon="PhPlus" label="Ruang" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 60rem">
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" class="w-[80px] font-semibold" />
          <Column header="Ruang / Alat" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.nama }}</div>
              <div class="text-grey-400">{{ d.namaAlat || "-" }}</div>
            </template>
          </Column>
          <Column header="Modalitas" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="flex flex-wrap gap-1">
                <span v-for="m in d.modalitas" :key="m" class="px-1.5 rounded bg-opensimrs-50 text-opensimrs-400" :title="MODALITAS_RAD[m]">{{ m }}</span>
              </div>
            </template>
          </Column>
          <Column header="Jam Operasional" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ d.jamBuka }}–{{ d.jamTutup }}</div>
              <div class="text-grey-400">{{ ringkasHari(d.hariOperasional) }}</div>
            </template>
          </Column>
          <Column header="Slot" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.durasiSlot }} menit · {{ jumlahSlot(d) }} slot/hari</template>
          </Column>
          <Column header="Jadwal Aktif" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.jadwalAktif ?? 0 }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span :class="d.status ? 'text-mint-400' : 'text-grey-300'">{{ d.status ? "Aktif" : "Nonaktif" }}</span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[110px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                <CustomButton
                  icon="PhTrash"
                  size="small"
                  outlined
                  borderColor="border-danger-300"
                  textColor="text-danger-300"
                  @click="(akanDihapus = d), (dialogHapus = true)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="720px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Ruang &amp; Alat</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.kode" label="Kode Ruang" placeholder="mis. RX1" required :maxLength="30" />
          <CustomTextfield v-model="form.nama" label="Nama Ruang" placeholder="mis. Ruang X-Ray 1" required :maxLength="150" />
          <CustomTextfield v-model="form.namaAlat" label="Alat (merk / tipe)" placeholder="mis. DR 500 mA" class="col-span-2" :maxLength="200" />
          <div class="col-span-2">
            <div class="mb-1 text-sm font-semibold">Modalitas yang dilayani<span class="text-danger-300">*</span></div>
            <div class="flex flex-wrap gap-2">
              <CustomChip
                v-for="(nama, kode) in MODALITAS_RAD"
                :key="kode"
                :label="`${kode} — ${nama}`"
                :value="String(kode)"
                :isSelected="form.modalitas.includes(String(kode))"
                selectedColor="bg-opensimrs-300 border-opensimrs-300"
                @selected="toggleModalitas"
              />
            </div>
          </div>
          <div class="grid grid-cols-3 col-span-2 gap-4">
            <CustomTextfield v-model="form.jamBuka" type="time" label="Jam Buka" required />
            <CustomTextfield v-model="form.jamTutup" type="time" label="Jam Tutup" required />
            <CustomInputNumber v-model="form.durasiSlot" label="Durasi Slot (menit)" :min="5" :max="240" />
          </div>
          <div class="col-span-2">
            <div class="mb-1 text-sm font-semibold">Hari Operasional<span class="text-danger-300">*</span></div>
            <div class="flex flex-wrap gap-2">
              <CustomChip
                v-for="h in OPSI_HARI_RAD"
                :key="h.value"
                :label="h.label"
                :value="String(h.value)"
                :isSelected="form.hariOperasional.includes(h.value)"
                selectedColor="bg-opensimrs-300 border-opensimrs-300"
                @selected="toggleHari"
              />
            </div>
            <div class="mt-1 text-xs text-grey-400">
              {{ jumlahSlot(form) }} slot per hari. Ruang yang melayani IGD/rawat inap dapat diatur jam panjang & setiap hari.
            </div>
          </div>
          <CustomTextArea v-model="form.keterangan" label="Keterangan" placeholder="mis. lantai 1, dekat IGD" class="col-span-2" height="h-16" />
          <CustomSwitch v-model="form.status" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogHapus" width="420px" headerBg="bg-danger-300">
      <template #header>Hapus Ruang</template>
      <template #body>
        <div class="pt-4 text-normal">
          Hapus <b>{{ akanDihapus?.nama }}</b>? Ruang yang masih memiliki jadwal aktif tidak dapat dihapus; riwayat pemeriksaan tetap tersimpan.
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogHapus = false" />
          <CustomButton label="Hapus" icon="PhTrash" backgroundColor="bg-danger-300" @click="hapus" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
