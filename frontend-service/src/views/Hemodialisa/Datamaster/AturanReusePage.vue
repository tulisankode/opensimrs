<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { cariItemMedis, daftarAturan, hapusAturan, izinHd, simpanAturan } from "@/stores/penunjang/hemodialisa";

// Batas pemakaian dializer per item BHP sesuai kebijakan klinis faskes (sistem tidak menetapkan batas sendiri).
// Perubahan batas berlaku untuk dializer yang didaftarkan sesudahnya.
const boleh = (aksi: string) => izinHd("Datamaster", aksi, "Aturan Reuse Dializer");
const data = ref<any[]>([]);
const muat = async () => {
  data.value = (await daftarAturan())?.payload ?? [];
};
const dialog = ref(false);
const form = ref<any>({});
const kata = ref("");
const item = ref<any[]>([]);
const buka = (a: any = null) => {
  form.value = a ? { uuid: a.uuid, namaItem: a.namaItem, pemakaianMaksimal: String(a.pemakaianMaksimal), dasarKebijakan: a.dasarKebijakan ?? "" } : { uuid: null, itemMedisUuid: "", pemakaianMaksimal: "1", dasarKebijakan: "" };
  item.value = [];
  kata.value = "";
  dialog.value = true;
};
const cari = async () => {
  item.value = ((await cariItemMedis(kata.value.trim()))?.payload ?? []).map((x: any) => ({ ...x, label: `${x.nama} (${x.kode})` }));
};
const simpan = async () => {
  const f = form.value;
  const isi = { pemakaianMaksimal: Number(f.pemakaianMaksimal), dasarKebijakan: f.dasarKebijakan };
  if ((await simpanAturan(f.uuid ? isi : { ...isi, itemMedisUuid: f.itemMedisUuid }, f.uuid ?? undefined))?.payload) {
    dialog.value = false;
    muat();
  }
};
const hapus = async (uuid: string) => {
  if ((await hapusAturan(uuid))?.payload) muat();
};
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Aturan Reuse Dializer</h1>
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Tambah Aturan" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="p-3 mb-3 text-xs rounded-md bg-opensimrs-50">Batas = jumlah pemakaian maksimal termasuk pemakaian pertama (1 = sekali pakai). Isi sesuai kebijakan/SPO reuse faskes yang disahkan.</div>
        <DataTable :value="data" stripedRows class="text-xs">
          <Column header="Item" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.namaItem }}<div class="text-grey-400">{{ d.kodeItem }}</div></template></Column>
          <Column field="pemakaianMaksimal" header="Batas pemakaian" headerClass="bg-opensimrs-50" />
          <Column field="dasarKebijakan" header="Dasar kebijakan" headerClass="bg-opensimrs-50" />
          <Column field="diubahOleh" header="Diubah oleh" headerClass="bg-opensimrs-50" />
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton v-if="boleh('UPDATE')" label="Ubah" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                <CustomButton v-if="boleh('DELETE')" label="Hapus" size="small" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="hapus(d.uuid)" />
              </div>
            </template>
          </Column>
          <template #empty><div class="py-3 text-center text-grey-400">Belum ada aturan; dializer baru diperlakukan sekali pakai.</div></template>
        </DataTable>
      </template>
    </Card>
    <CustomDialog v-model:visible="dialog" width="540px">
      <template #header>{{ form.uuid ? "Ubah Aturan" : "Tambah Aturan" }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-3 pt-4">
          <template v-if="!form.uuid">
            <CustomTextfield v-model="kata" label="Cari item dializer" @keyup.enter="cari" />
            <CustomButton label="Cari" icon="PhMagnifyingGlass" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cari" />
            <CustomSelect v-model="form.itemMedisUuid" class="col-span-2" label="Item" :options="item" optionValue="uuid" optionLabel="label" required />
          </template>
          <div v-else class="col-span-2 font-semibold">{{ form.namaItem }}</div>
          <CustomTextfield v-model="form.pemakaianMaksimal" label="Batas pemakaian (1–100)" type="number" required />
          <CustomTextfield v-model="form.dasarKebijakan" label="Dasar kebijakan (SPO/no. dokumen)" :maxLength="1000" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" @click="simpan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
