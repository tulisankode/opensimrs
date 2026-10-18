<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { cariItemMedis, daftarDializer, daftarRegistrasi, daftarkanDializer, hentikanDializer, izinHd, tampilWaktu } from "@/stores/penunjang/hemodialisa";

// Dializer per pasien (KF-9): serial unik, batas pemakaian disalin dari Aturan Reuse Dializer saat didaftarkan (tanpa
// aturan = sekali pakai), riwayat pemakaian per sesi, dan penghentian reuse beralasan.
const boleh = (aksi: string) => izinHd("Pemakaian BHP", aksi);

const registrasi = ref<any[]>([]);
const registrasiUuid = ref("");
const data = ref<any[]>([]);
const muat = async () => {
  data.value = (await daftarDializer({ registrasi_uuid: registrasiUuid.value || undefined }))?.payload ?? [];
};

const dialog = ref(false);
const form = ref<any>({});
const kataItem = ref("");
const item = ref<any[]>([]);
const buka = () => {
  form.value = { registrasiUuid: registrasiUuid.value, itemMedisUuid: "", serial: "" };
  kataItem.value = "";
  item.value = [];
  dialog.value = true;
};
const cariItem = async () => {
  item.value = ((await cariItemMedis(kataItem.value.trim()))?.payload ?? []).map((x: any) => ({ ...x, label: `${x.nama} (${x.kode})` }));
};
const simpan = async () => {
  const res = await daftarkanDializer({ registrasiUuid: form.value.registrasiUuid, itemMedisUuid: form.value.itemMedisUuid, serial: form.value.serial.trim() });
  if (res?.payload) {
    dialog.value = false;
    muat();
  }
};
const dialogHenti = ref(false);
const aktif = ref<any>(null);
const alasan = ref("");
const simpanHenti = async () => {
  if ((await hentikanDializer(aktif.value.uuid, alasan.value.trim()))?.payload) {
    dialogHenti.value = false;
    muat();
  }
};

onMounted(async () => {
  const r = await daftarRegistrasi({ status: "aktif", limit: 500 });
  registrasi.value = (r?.payload?.data ?? []).map((x: any) => ({ ...x, label: `${x.namaPasien} · ${x.noRm} · ${x.noRegHd}` }));
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Dializer Pasien</h1>
          <CustomSelect v-model="registrasiUuid" label="Pasien" placeHolder="Semua" :options="registrasi" optionValue="uuid" optionLabel="label" @update:modelValue="muat" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Daftarkan Dializer" @click="buka" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column field="serial" header="Serial" headerClass="bg-opensimrs-50" />
          <Column header="Pasien" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.namaPasien }}<div class="text-grey-400">{{ d.noRegHd }}</div></template></Column>
          <Column field="namaItem" header="Item" headerClass="bg-opensimrs-50" />
          <Column header="Pemakaian" headerClass="bg-opensimrs-50"><template #body="{ data: d }"><b>{{ d.jumlahPakai }}</b> / {{ d.pemakaianMaksimal }}</template></Column>
          <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.status }}<div v-if="d.alasanBerhenti" class="text-grey-400">{{ d.alasanBerhenti }}</div></template></Column>
          <Column header="Riwayat" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ (d.riwayat ?? []).map((r: any) => `ke-${r.pemakaianKe} ${tampilWaktu(r.createdAt)}`).join("; ") || "-" }}</template></Column>
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <CustomButton v-if="d.status === 'aktif' && boleh('CREATE')" label="Hentikan" size="small" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="(aktif = d), (alasan = ''), (dialogHenti = true)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="560px">
      <template #header>Daftarkan Dializer</template>
      <template #body>
        <div class="grid grid-cols-2 gap-3 pt-4">
          <CustomSelect v-model="form.registrasiUuid" class="col-span-2" label="Pasien" :options="registrasi" optionValue="uuid" optionLabel="label" required />
          <CustomTextfield v-model="kataItem" label="Cari item dializer" @keyup.enter="cariItem" />
          <CustomButton label="Cari" icon="PhMagnifyingGlass" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cariItem" />
          <CustomSelect v-model="form.itemMedisUuid" label="Item" :options="item" optionValue="uuid" optionLabel="label" required />
          <CustomTextfield v-model="form.serial" label="Serial / nomor lot" required :maxLength="100" />
          <div class="col-span-2 text-xs text-grey-400">Batas pemakaian mengikuti Aturan Reuse Dializer untuk item ini; tanpa aturan, dializer sekali pakai.</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" :disabled="!form.registrasiUuid || !form.itemMedisUuid || !form.serial?.trim()" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogHenti" width="440px">
      <template #header>Hentikan Reuse Dializer</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4 text-sm">
          <div>Serial {{ aktif?.serial }} tidak dapat dipakai lagi setelah dihentikan.</div>
          <CustomTextfield v-model="alasan" label="Alasan" required :maxLength="500" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogHenti = false" />
          <CustomButton label="Hentikan" backgroundColor="bg-[#B42318]" :disabled="!alasan.trim()" @click="simpanHenti" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
