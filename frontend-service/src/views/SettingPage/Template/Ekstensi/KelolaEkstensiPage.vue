<script setup lang="ts">
// Setting › Ekstensi (superadmin): kelola ekstensi tanpa kode di instalasi ini — termasuk produksi, tempat SIMRS Studio
// tidak berjalan. Paket dari Studio (staging) diimpor, diverifikasi tanda tangannya (EKSTENSI_KUNCI_PUBLIK), lalu dipasang.
import { onMounted, ref } from "vue";
import MainHeaderSetting from "../MainHeaderSetting.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiEkstensi } from "@/utils/apiHandler";
import { muatEkstensi } from "@/stores/ekstensi";

const daftar = ref<any[]>([]);
const sibuk = ref(false);
const masukan = ref<HTMLInputElement>();

const muat = async () => {
  daftar.value = (await apiEkstensi("laporan", "get", "/ekstensi/kelola"))?.payload ?? [];
};
onMounted(muat);

const impor = async (e: Event) => {
  const berkas = (e.target as HTMLInputElement).files?.[0];
  if (!berkas) return;
  let paket;
  try {
    paket = JSON.parse(await berkas.text());
  } catch {
    paket = null;
  }
  if (masukan.value) masukan.value.value = "";
  sibuk.value = true;
  await apiEkstensi("laporan", "post", "/ekstensi/impor", { paket });
  sibuk.value = false;
  muat();
};

const ubahStatus = async (e: any, aksi: "pasang" | "copot") => {
  sibuk.value = true;
  await apiEkstensi("laporan", "put", `/ekstensi/${e.uuid}/${aksi}`, {});
  sibuk.value = false;
  await muat();
  muatEkstensi();
};

const WARNA: Record<string, string> = { terpasang: "bg-success-50 text-success-400", draf: "bg-warning-50 text-warning-400", dicopot: "bg-grey-75 text-grey-400" };
const JENIS: Record<string, string> = { laporan: "Laporan", cetak: "Template cetak", formulir: "Formulir" };
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto">
    <template #header>
      <MainHeaderSetting heading="Ekstensi" />
    </template>
    <template #content>
      <div class="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-opensimrs-50 p-4">
        <div class="text-SM text-grey-500">
          <div class="font-semibold text-opensimrs-300">Ekstensi tanpa kode</div>
          <div class="text-XS text-grey-400">
            Laporan, template cetak, dan formulir tambahan yang dirakit di SIMRS Studio (instalasi pengembangan/staging). Impor paket
            <code>.json</code> bertanda tangan; instalasi ini memverifikasinya dengan <code>EKSTENSI_KUNCI_PUBLIK</code> di
            <code>laporan-service/.env</code>.
          </div>
        </div>
        <input ref="masukan" type="file" accept="application/json,.json" class="hidden" @change="impor" />
        <CustomButton label="Impor paket" icon="PhUploadSimple" :disabled="sibuk" @click="masukan?.click()" />
      </div>
      <div class="mt-3 overflow-auto rounded-lg border border-grey-200">
        <table class="w-full text-SM">
          <thead class="bg-grey-75 text-left text-XS text-grey-500">
            <tr><th class="p-2">Nama</th><th class="p-2">Jenis</th><th class="p-2">Versi</th><th class="p-2">Sumber</th><th class="p-2">Status</th><th class="p-2"></th></tr>
          </thead>
          <tbody>
            <tr v-for="e in daftar" :key="e.uuid" class="border-t border-grey-100 text-grey-500">
              <td class="p-2"><div class="font-semibold">{{ e.nama }}</div><div class="text-[11px] text-grey-400">{{ e.kode }}</div></td>
              <td class="p-2 text-XS">{{ JENIS[e.jenis] }}</td>
              <td class="p-2 text-XS">{{ e.versi }}</td>
              <td class="p-2 text-XS">{{ e.sumber }}{{ e.tanda_tangan ? " · bertanda tangan" : "" }}</td>
              <td class="p-2"><span class="rounded px-1.5 text-[10px] font-semibold" :class="WARNA[e.status]">{{ e.status }}</span></td>
              <td class="p-2 text-right">
                <CustomButton v-if="e.status !== 'terpasang'" label="Pasang" :disabled="sibuk" @click="ubahStatus(e, 'pasang')" />
                <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" v-else label="Copot" outlined :disabled="sibuk" @click="ubahStatus(e, 'copot')" />
              </td>
            </tr>
            <tr v-if="!daftar.length"><td colspan="6" class="p-4 text-center text-XS text-grey-300">Belum ada ekstensi.</td></tr>
          </tbody>
        </table>
      </div>
    </template>
  </Card>
</template>
