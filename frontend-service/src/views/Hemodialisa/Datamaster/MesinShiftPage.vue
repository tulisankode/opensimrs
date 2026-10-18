<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { STATUS_MESIN, daftarMesin, daftarShift, gayaMesin, hapusMesin, hapusShift, izinHd, opsi, simpanMesin, simpanShift } from "@/stores/penunjang/hemodialisa";

// Datamaster mesin HD & shift (kapasitas = satu pasien per mesin per shift per tanggal).
const boleh = (aksi: string) => izinHd("Datamaster", aksi, "Mesin & Shift");
const mesin = ref<any[]>([]);
const shift = ref<any[]>([]);
const muat = async () => {
  const [m, s] = await Promise.all([daftarMesin(), daftarShift()]);
  mesin.value = m?.payload ?? [];
  shift.value = s?.payload ?? [];
};

const dialogMesin = ref(false);
const fm = ref<any>({});
const bukaMesin = (m: any = null) => {
  fm.value = m ? { uuid: m.uuid, kode: m.kode, nama: m.nama, status: m.status, keterangan: m.keterangan ?? "" } : { uuid: null, kode: "", nama: "", status: "aktif", keterangan: "" };
  dialogMesin.value = true;
};
const simpanM = async () => {
  const { uuid, ...isi } = fm.value;
  if ((await simpanMesin(isi, uuid ?? undefined))?.payload) {
    dialogMesin.value = false;
    muat();
  }
};
const dialogShift = ref(false);
const fs = ref<any>({});
const bukaShift = (s: any = null) => {
  fs.value = s
    ? { uuid: s.uuid, kode: s.kode, nama: s.nama, jamMulai: String(s.jamMulai).slice(0, 5), jamSelesai: String(s.jamSelesai).slice(0, 5), urutan: String(s.urutan ?? 0), aktif: s.aktif }
    : { uuid: null, kode: "", nama: "", jamMulai: "07:00", jamSelesai: "12:00", urutan: String(shift.value.length + 1), aktif: true };
  dialogShift.value = true;
};
const simpanS = async () => {
  const { uuid, ...isi } = fs.value;
  if ((await simpanShift({ ...isi, urutan: Number(isi.urutan) || 0 }, uuid ?? undefined))?.payload) {
    dialogShift.value = false;
    muat();
  }
};
const hapus = async (jenis: "mesin" | "shift", uuid: string) => {
  if ((await (jenis === "mesin" ? hapusMesin(uuid) : hapusShift(uuid)))?.payload) muat();
};
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full gap-3 overflow-auto">
    <Card>
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Mesin HD</h1>
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Tambah Mesin" @click="bukaMesin()" />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable :value="mesin" stripedRows class="text-xs">
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
          <Column field="nama" header="Nama" headerClass="bg-opensimrs-50" />
          <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: d }"><span :class="['px-2 py-0.5 rounded', gayaMesin(d.status).bg, gayaMesin(d.status).text]">{{ gayaMesin(d.status).label }}</span></template></Column>
          <Column field="keterangan" header="Keterangan" headerClass="bg-opensimrs-50" />
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton v-if="boleh('UPDATE')" label="Ubah" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaMesin(d)" />
                <CustomButton v-if="boleh('DELETE')" label="Hapus" size="small" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="hapus('mesin', d.uuid)" />
              </div>
            </template>
          </Column>
          <template #empty><div class="py-3 text-center text-grey-400">Belum ada mesin.</div></template>
        </DataTable>
      </template>
    </Card>
    <Card>
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Shift HD</h1>
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Tambah Shift" @click="bukaShift()" />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable :value="shift" stripedRows class="text-xs">
          <Column field="urutan" header="Urutan" headerClass="bg-opensimrs-50" />
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
          <Column field="nama" header="Nama" headerClass="bg-opensimrs-50" />
          <Column header="Jam" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ String(d.jamMulai).slice(0, 5) }}–{{ String(d.jamSelesai).slice(0, 5) }}</template></Column>
          <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.aktif ? "Aktif" : "Nonaktif" }}</template></Column>
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton v-if="boleh('UPDATE')" label="Ubah" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaShift(d)" />
                <CustomButton v-if="boleh('DELETE')" label="Hapus" size="small" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="hapus('shift', d.uuid)" />
              </div>
            </template>
          </Column>
          <template #empty><div class="py-3 text-center text-grey-400">Belum ada shift.</div></template>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogMesin" width="520px">
      <template #header>{{ fm.uuid ? "Ubah Mesin" : "Tambah Mesin" }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-3 pt-4">
          <CustomTextfield v-model="fm.kode" label="Kode" required :maxLength="40" />
          <CustomTextfield v-model="fm.nama" label="Nama" required :maxLength="120" />
          <CustomSelect v-model="fm.status" label="Status" :options="opsi(STATUS_MESIN)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomTextfield v-model="fm.keterangan" label="Keterangan" :maxLength="500" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogMesin = false" />
          <CustomButton label="Simpan" @click="simpanM" />
        </div>
      </template>
    </CustomDialog>
    <CustomDialog v-model:visible="dialogShift" width="520px">
      <template #header>{{ fs.uuid ? "Ubah Shift" : "Tambah Shift" }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-3 pt-4">
          <CustomTextfield v-model="fs.kode" label="Kode" required :maxLength="40" />
          <CustomTextfield v-model="fs.nama" label="Nama" required :maxLength="100" />
          <CustomTextfield v-model="fs.jamMulai" label="Jam mulai (HH:MM)" required />
          <CustomTextfield v-model="fs.jamSelesai" label="Jam selesai (HH:MM)" required />
          <CustomTextfield v-model="fs.urutan" label="Urutan" type="number" />
          <CustomSwitch v-model="fs.aktif" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogShift = false" />
          <CustomButton label="Simpan" @click="simpanS" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
