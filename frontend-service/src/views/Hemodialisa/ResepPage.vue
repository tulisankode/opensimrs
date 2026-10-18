<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { daftarRegistrasi, daftarResep, gayaResep, izinHd, sahkanResep, simpanResep, tampilWaktu } from "@/stores/penunjang/hemodialisa";

// Resep HD (KF-4): durasi, QB, QD, sasaran UF, antikoagulan, dialisat, akses vaskular (semua wajib). Draf dapat diubah;
// pengesahan (izin Resep HD › SAHKAN, dokter) menonaktifkan resep sah sebelumnya. Nilai resep ditentukan dokter.
const boleh = (aksi: string) => izinHd("Resep HD", aksi);

const registrasi = ref<any[]>([]);
const registrasiUuid = ref("");
const data = ref<any[]>([]);

const muatRegistrasi = async () => {
  const r = await daftarRegistrasi({ status: "aktif", limit: 500 });
  registrasi.value = (r?.payload?.data ?? []).map((x: any) => ({ ...x, label: `${x.namaPasien} · ${x.noRm} · ${x.noRegHd} (${x.jenis})` }));
};
const muat = async () => {
  data.value = registrasiUuid.value ? ((await daftarResep({ registrasi_uuid: registrasiUuid.value }))?.payload ?? []) : [];
};

const dialog = ref(false);
const form = ref<any>({});
const galat = ref("");
const buka = (r: any = null) => {
  galat.value = "";
  const sumber = r ?? data.value.find((x) => x.status === "sah");
  form.value = {
    uuid: r?.uuid ?? null,
    durasiMenit: String(sumber?.durasiMenit ?? ""),
    qbMlMenit: String(sumber?.qbMlMenit ?? ""),
    qdMlMenit: String(sumber?.qdMlMenit ?? ""),
    ufGoalMl: String(sumber?.ufGoalMl ?? ""),
    antikoagulan: sumber?.antikoagulan ?? "",
    dialisat: sumber?.dialisat ?? "",
    aksesVaskular: sumber?.aksesVaskular ?? "",
    catatan: r?.catatan ?? "",
  };
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  const wajib = ["durasiMenit", "qbMlMenit", "qdMlMenit", "ufGoalMl", "antikoagulan", "dialisat", "aksesVaskular"];
  if (wajib.some((k) => !String(f[k] ?? "").trim())) return (galat.value = "Semua elemen resep wajib diisi");
  const isi = {
    durasiMenit: Number(f.durasiMenit), qbMlMenit: Number(f.qbMlMenit), qdMlMenit: Number(f.qdMlMenit), ufGoalMl: Number(f.ufGoalMl),
    antikoagulan: f.antikoagulan.trim(), dialisat: f.dialisat.trim(), aksesVaskular: f.aksesVaskular.trim(), catatan: f.catatan,
  };
  const res = await simpanResep(f.uuid ? isi : { ...isi, registrasiUuid: registrasiUuid.value }, f.uuid ?? undefined);
  if (res?.payload) {
    dialog.value = false;
    muat();
  }
};
const sahkan = async (r: any) => {
  if ((await sahkanResep(r.uuid))?.payload) muat();
};

onMounted(muatRegistrasi);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Resep HD</h1>
          <CustomSelect v-model="registrasiUuid" label="Pasien" :options="registrasi" optionValue="uuid" optionLabel="label" @update:modelValue="muat" />
          <CustomButton v-if="boleh('CREATE') && registrasiUuid" icon="PhPlus" label="Resep Baru" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" :title="registrasiUuid ? 'Belum ada resep' : 'Pilih pasien terlebih dahulu'" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 60rem">
          <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: d }"><span :class="['px-2 py-0.5 rounded', gayaResep(d.status).bg, gayaResep(d.status).text]">{{ gayaResep(d.status).label }}</span></template></Column>
          <Column header="Durasi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.durasiMenit }} menit</template></Column>
          <Column header="QB / QD" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.qbMlMenit) }} / {{ Number(d.qdMlMenit) }} mL/menit</template></Column>
          <Column header="Sasaran UF" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.ufGoalMl) }} mL</template></Column>
          <Column field="antikoagulan" header="Antikoagulan" headerClass="bg-opensimrs-50" />
          <Column field="dialisat" header="Dialisat" headerClass="bg-opensimrs-50" />
          <Column field="aksesVaskular" header="Akses Vaskular" headerClass="bg-opensimrs-50" />
          <Column header="Dibuat / Disahkan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.dibuatOleh }}<div v-if="d.disahkanOleh" class="text-grey-400">Sah: {{ d.disahkanOleh }}, {{ tampilWaktu(d.disahkanPada) }}</div></template>
          </Column>
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div v-if="d.status === 'draft'" class="flex gap-2">
                <CustomButton v-if="boleh('UPDATE')" label="Ubah" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                <CustomButton v-if="boleh('SAHKAN')" label="Sahkan" size="small" @click="sahkan(d)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="640px">
      <template #header>{{ form.uuid ? "Ubah Draf Resep HD" : "Resep HD Baru" }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.durasiMenit" label="Durasi (menit)" type="number" required />
          <CustomTextfield v-model="form.ufGoalMl" label="Sasaran UF (mL)" type="number" required />
          <CustomTextfield v-model="form.qbMlMenit" label="QB (mL/menit)" type="number" required />
          <CustomTextfield v-model="form.qdMlMenit" label="QD (mL/menit)" type="number" required />
          <CustomTextfield v-model="form.antikoagulan" class="col-span-2" label="Antikoagulan (jenis & dosis)" required :maxLength="500" />
          <CustomTextfield v-model="form.dialisat" class="col-span-2" label="Dialisat" required :maxLength="500" />
          <CustomTextfield v-model="form.aksesVaskular" class="col-span-2" label="Akses vaskular" required :maxLength="500" />
          <CustomTextfield v-model="form.catatan" class="col-span-2" label="Catatan (opsional)" :maxLength="1000" />
          <div class="col-span-2 text-xs text-grey-400">Resep baru tersimpan sebagai draf dan berlaku untuk sesi setelah disahkan dokter.</div>
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan Draf" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
