<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import PengirimanHdis from "@/views/SettingPage/Template/KonfigurasiIntegrasi/PengirimanHdis.vue";
import { daftarKoneksiHdis, daftarPetaMesin, izinHd, simpanPetaMesin } from "@/stores/penunjang/hemodialisa";

// Pemetaan mesin HD → kode mesin HDIS per koneksi (fitur hd_bridging_hdis) + riwayat pertukaran. Koneksi dikelola di
// Setting › Konfigurasi Integrasi › Hemodialisa › HDIS.
const boleh = izinHd("Datamaster", "UPDATE", "Mapping HDIS");
const koneksi = ref<any[]>([]);
const koneksiUuid = ref("");
const baris = ref<any[]>([]);
const tersedia = ref(true);

const muat = async () => {
  baris.value = koneksiUuid.value ? ((await daftarPetaMesin(koneksiUuid.value))?.payload ?? []).map((b: any) => ({ ...b, kodeBaru: b.kodeMesinHdis ?? "" })) : [];
};
const simpan = async (b: any) => {
  if ((await simpanPetaMesin({ koneksiUuid: koneksiUuid.value, mesinUuid: b.mesinUuid, kodeMesinHdis: b.kodeBaru.trim() }))?.payload) muat();
};
onMounted(async () => {
  const res = await daftarKoneksiHdis();
  tersedia.value = !!res;
  koneksi.value = res?.payload ?? [];
  koneksiUuid.value = koneksi.value.find((k) => k.bawaan)?.uuid ?? koneksi.value[0]?.uuid ?? "";
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full gap-3 overflow-auto">
    <Card>
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Mapping Mesin HDIS</h1>
          <CustomSelect v-model="koneksiUuid" label="Koneksi HDIS" :options="koneksi" optionValue="uuid" optionLabel="nama" :clearable="false" @update:modelValue="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="!tersedia" class="p-3 text-sm rounded-md bg-[#FEF0C7] text-[#B54708]">Fitur Bridging HDIS belum aktif untuk faskes ini atau Anda tidak memiliki izin.</div>
        <div v-else-if="!koneksi.length" class="p-3 text-sm text-grey-400">Belum ada koneksi HDIS. Tambahkan di Setting › Konfigurasi Integrasi › Hemodialisa › HDIS.</div>
        <DataTable v-else :value="baris" stripedRows class="text-xs">
          <Column field="kode" header="Mesin" headerClass="bg-opensimrs-50" />
          <Column field="nama" header="Nama" headerClass="bg-opensimrs-50" />
          <Column header="Kode mesin di HDIS" headerClass="bg-opensimrs-50"><template #body="{ data: b }"><CustomTextfield v-model="b.kodeBaru" :showLabel="false" placeholder="kosong = tidak dipetakan" :disabled="!boleh" :maxLength="60" /></template></Column>
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data: b }">
              <CustomButton v-if="boleh" label="Simpan" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="(b.kodeBaru ?? '') === (b.kodeMesinHdis ?? '')" @click="simpan(b)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
    <PengirimanHdis v-if="tersedia && koneksi.length" />
  </div>
</template>
