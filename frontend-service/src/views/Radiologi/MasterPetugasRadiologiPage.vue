<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { PERAN_PETUGAS_RAD, daftarPetugasRad, daftarPraktisiRad, hapusPetugasRad, tambahPetugasRad, ubahPetugasRad } from "@/stores/penunjang/radiologi";

// Datamaster Petugas Radiologi: dokter radiologi (pembaca expertise, umumnya Sp.Rad) & radiografer dari data
// praktisi faskes. Bila belum ada dokter radiologi terdaftar, dialog expertise menampilkan semua dokter.
const storeUtils = utilsStore();
const data = ref<any[]>([]);
const praktisi = ref<any[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    data.value = (await daftarPetugasRad())?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
const kelompok = computed(() =>
  Object.entries(PERAN_PETUGAS_RAD).map(([peran, label]) => ({ peran, label, isi: data.value.filter((d) => d.peran === peran) }))
);

const dialog = ref(false);
const form = ref({ practitionerUuid: "", peran: "radiografer", keterangan: "" });
const galat = ref("");
const opsiPraktisi = computed(() =>
  praktisi.value
    .filter((p) => (form.value.peran === "dokter" ? p.isDoctor : true))
    .map((p) => ({ value: p.uuid, label: `${p.nama}${p.isDoctor ? " (dokter)" : ""}` }))
);
const buka = async (peran: string) => {
  galat.value = "";
  form.value = { practitionerUuid: "", peran, keterangan: "" };
  if (!praktisi.value.length) praktisi.value = (await daftarPraktisiRad())?.payload ?? [];
  dialog.value = true;
};
const simpan = async () => {
  if (!form.value.practitionerUuid) return (galat.value = "Pilih praktisi");
  if (await tambahPetugasRad(form.value)) {
    dialog.value = false;
    muat();
  }
};
const ubahStatus = async (d: any) => (await ubahPetugasRad(d.uuid, { status: !d.status })) && muat();
const hapus = async (d: any) => (await hapusPetugasRad(d.uuid)) && muat();

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Petugas Radiologi</h1>
          <CustomButton icon="PhPlus" label="Dokter Radiologi" @click="buka('dokter')" />
          <CustomButton icon="PhPlus" label="Radiografer" @click="buka('radiografer')" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
          <section v-for="k in kelompok" :key="k.peran" class="border rounded-lg border-grey-100">
            <h2 class="px-3 py-2 text-sm font-semibold border-b border-grey-100">{{ k.label }} ({{ k.isi.length }})</h2>
            <div v-if="!k.isi.length" class="p-4 text-xs text-grey-400">
              <NoData />
              <p v-if="k.peran === 'dokter'" class="mt-2 text-center">
                Belum ada dokter radiologi terdaftar — dialog expertise menampilkan semua dokter aktif.
              </p>
            </div>
            <DataTable v-else :value="k.isi" class="text-xs" stripedRows>
              <Column header="Nama" headerClass="bg-opensimrs-50">
                <template #body="{ data: d }">
                  <div class="font-semibold">{{ d.nama ?? "-" }}</div>
                  <div class="text-grey-400">{{ d.sip ? `SIP ${d.sip}` : d.str ? `STR ${d.str}` : "" }}</div>
                  <div v-if="d.praktisiNonaktif" class="text-danger-300">Data praktisi nonaktif</div>
                </template>
              </Column>
              <Column header="Keterangan" headerClass="bg-opensimrs-50">
                <template #body="{ data: d }">{{ d.keterangan || "-" }}</template>
              </Column>
              <Column header="Status" headerClass="bg-opensimrs-50">
                <template #body="{ data: d }">
                  <button type="button" :class="d.status ? 'text-mint-400' : 'text-grey-300'" :title="d.status ? 'Nonaktifkan' : 'Aktifkan'" @click="ubahStatus(d)">
                    {{ d.status ? "Aktif" : "Nonaktif" }}
                  </button>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50" class="w-[60px]">
                <template #body="{ data: d }">
                  <CustomButton icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus(d)" />
                </template>
              </Column>
            </DataTable>
          </section>
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="520px">
      <template #header>Tambah {{ PERAN_PETUGAS_RAD[form.peran] }}</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <CustomSelect v-model="form.practitionerUuid" label="Praktisi" placeHolder="Pilih praktisi" :options="opsiPraktisi" optionValue="value" optionLabel="label" required />
          <CustomTextfield v-model="form.keterangan" label="Keterangan" placeholder="mis. Sp.Rad, jadwal Senin–Kamis" :maxLength="200" />
          <div class="text-xs text-grey-400">Praktisi diambil dari Datamaster Praktisi. Dokter radiologi harus berstatus dokter.</div>
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
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
