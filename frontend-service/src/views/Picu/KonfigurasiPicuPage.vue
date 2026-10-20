<script setup lang="ts">
import { ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import NoData from "@/components/section/NoData.vue";
import StatusPicu from "./components/StatusPicu.vue";
import LencanaStatusPicu from "./components/LencanaStatusPicu.vue";
import { usePicu } from "./usePicu";

// Konfigurasi PICU: pemetaan tempat tidur sumber, draf versi formulir dokumentasi, dan penetapan versi.
const {
  boleh, fiturAktif, namaJenis, sibuk, pesan, gagal, konfigurasi, bedSumber, bedPicu, bedUuid,
  jenisKonfigurasi, namaKonfigurasi, kolom, referensiPenetapan, muat, simpan,
} = usePicu("konfigurasi");
const formBed = ref<HTMLFormElement>();
const formKonfigurasi = ref<HTMLFormElement>();
const formPenetapan = ref<Record<string, HTMLFormElement>>({});
const tombolGaris = { size: "small" as const, outlined: true, textColor: "text-opensimrs-300", borderColor: "border-opensimrs-300" };
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden picu-form">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="sibuk" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Konfigurasi PICU</h1>
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-4 p-4">
          <StatusPicu :gagal="gagal" :pesan="pesan" :sibuk="sibuk" />
          <div class="p-3 text-xs rounded-lg text-grey-400 bg-grey-25">
            Setiap konfigurasi adalah versi baru. Formulir yang berlaku dipertahankan untuk dokumentasi historis. Penetapan penggunaan harus merujuk keputusan pemilik proses klinis.
          </div>

          <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <!-- Pemetaan tempat tidur -->
            <form v-if="boleh('Tempat Tidur', 'KELOLA') && fiturAktif('picu_tempat_tidur')" ref="formBed" class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75" @submit.prevent="simpan('tempat-tidur', { tempatTidurUuid: bedUuid })">
              <h2 class="font-semibold">Pemetaan tempat tidur PICU</h2>
              <div class="flex flex-wrap items-end gap-2">
                <label class="label-picu grow">Tempat tidur sumber <select v-model="bedUuid" required><option value="">Pilih tempat tidur</option><option v-for="b in bedSumber" :key="b.uuid" :value="b.uuid">{{ b.lokasi }} · {{ b.noBed }}</option></select></label>
                <CustomButton label="Tambahkan pemetaan" icon="PhPlus" :disabled="sibuk" @click="formBed?.requestSubmit()" />
              </div>
              <DataTable :value="bedPicu" dataKey="uuid" class="text-sm" stripedRows>
                <template #empty><div class="py-4 text-center text-grey-400">Belum ada tempat tidur PICU yang dipetakan.</div></template>
                <Column field="lokasi" header="Lokasi" headerClass="bg-opensimrs-50" />
                <Column field="noBed" header="Kode" headerClass="bg-opensimrs-50" />
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: b }"><LencanaStatusPicu :status="b.status" /></template>
                </Column>
              </DataTable>
            </form>

            <!-- Draf versi formulir baru -->
            <form v-if="boleh('Konfigurasi', 'CREATE')" ref="formKonfigurasi" class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75" @submit.prevent="simpan('konfigurasi', { jenis: jenisKonfigurasi, nama: namaKonfigurasi, definisi: kolom })">
              <h2 class="font-semibold">Draf versi formulir baru</h2>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="label-picu">Jenis <select v-model="jenisKonfigurasi"><option v-for="(label, kode) in namaJenis" :key="kode" :value="kode">{{ label }}</option></select></label>
                <label class="label-picu">Nama formulir dan versi <input v-model="namaKonfigurasi" required maxlength="255" /></label>
              </div>
              <fieldset v-for="(k, i) in kolom" :key="i" class="flex flex-col gap-2 p-3 border rounded-lg border-grey-75">
                <legend class="px-1 text-sm font-semibold">Parameter {{ i + 1 }}</legend>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label class="label-picu">Kode <input v-model="k.kode" required pattern="[a-z][a-z0-9_]{0,49}" /></label>
                  <label class="label-picu">Nama <input v-model="k.nama" required /></label>
                  <label class="label-picu">Tipe <select v-model="k.tipe"><option value="angka">Angka</option><option value="teks">Teks</option></select></label>
                  <label class="label-picu">Satuan <input v-model="k.satuan" maxlength="50" /></label>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <label class="flex items-center gap-2 text-sm"><input v-model="k.wajib" type="checkbox" /> Wajib</label>
                  <CustomButton label="Hapus parameter draf" icon="PhTrash" size="small" outlined textColor="text-danger-300" borderColor="border-danger-300" @click="kolom.splice(i, 1)" />
                </div>
              </fieldset>
              <div class="flex flex-wrap gap-2">
                <CustomButton label="Tambah parameter" icon="PhPlus" v-bind="tombolGaris" size="large" @click="kolom.push({ kode: '', nama: '', tipe: 'teks', satuan: '', wajib: false })" />
                <CustomButton label="Simpan draf konfigurasi" icon="PhFloppyDisk" :disabled="sibuk || !kolom.length" @click="formKonfigurasi?.requestSubmit()" />
              </div>
            </form>
          </div>

          <!-- Daftar versi konfigurasi -->
          <div class="flex flex-col gap-3">
            <h2 class="font-semibold">Versi formulir dokumentasi</h2>
            <NoData v-if="!konfigurasi.length && !sibuk" title="Belum ada konfigurasi formulir" class="min-h-[12rem]" />
            <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <article v-for="k in konfigurasi" :key="k.uuid" class="flex flex-col gap-2 p-4 border rounded-lg border-grey-75">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 class="font-semibold">{{ k.nama }}</h3>
                    <div class="text-xs text-grey-400">{{ namaJenis[k.jenis] }}</div>
                  </div>
                  <LencanaStatusPicu :status="k.status" />
                </div>
                <ul class="flex flex-col gap-1 text-sm">
                  <li v-for="c in k.definisi" :key="c.kode" class="flex flex-wrap gap-1">
                    <span class="font-semibold">{{ c.nama }}</span><span class="text-grey-400">· {{ c.tipe }}<template v-if="c.satuan"> · {{ c.satuan }}</template></span>
                    <span v-if="c.wajib" class="px-1.5 text-xs rounded bg-danger-50 text-danger-400">wajib</span>
                  </li>
                </ul>
                <p v-if="k.referensiPenetapan" class="text-xs text-grey-500">Referensi penetapan: {{ k.referensiPenetapan }}</p>
                <form v-if="k.status === 'draf' && boleh('Konfigurasi', 'VALIDASI')" :ref="(el) => { if (el) formPenetapan[k.uuid] = el as HTMLFormElement; }" class="flex flex-col gap-2" @submit.prevent="simpan(`konfigurasi/${k.uuid}/pengesahan`, { referensiPenetapan: referensiPenetapan[k.uuid] })">
                  <label class="label-picu">Referensi keputusan pemilik proses klinis <textarea v-model="referensiPenetapan[k.uuid]" required maxlength="2000"></textarea></label>
                  <div><CustomButton label="Tetapkan versi sesuai kewenangan" icon="PhSealCheck" :disabled="sibuk" @click="formPenetapan[k.uuid]?.requestSubmit()" /></div>
                </form>
              </article>
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
