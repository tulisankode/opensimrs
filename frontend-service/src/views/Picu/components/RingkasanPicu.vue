<script setup lang="ts">
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import StatusPicu from "./StatusPicu.vue";
import LencanaStatusPicu from "./LencanaStatusPicu.vue";
import { usePicu } from "../usePicu";

// Ringkasan kapasitas tempat tidur dan arus pasien PICU; dipakai Dasbor dan Laporan operasional.
const props = defineProps<{ bagian: "dashboard" | "laporan"; judul: string }>();
const { sibuk, pesan, gagal, ringkasan, mulai, selesai, muat } = usePicu(props.bagian);
const KARTU: Record<string, string> = { kapasitas: "Kapasitas", tersedia: "Tersedia", terpakai: "Terpakai", tidakOperasional: "Tidak operasional", masuk: "Masuk", transferKeluar: "Transfer keluar", pulang: "Pulang" };
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="sibuk" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">{{ judul }}</h1>
          <CustomDatePicker v-model="mulai" label="Dari tanggal" />
          <CustomDatePicker v-model="selesai" label="Sampai tanggal" />
          <CustomButton label="Tampilkan" icon="PhMagnifyingGlass" :disabled="sibuk || !mulai || !selesai" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-4 p-4">
          <StatusPicu :gagal="gagal" :pesan="pesan" :sibuk="sibuk" />
          <NoData v-if="!ringkasan && !sibuk" title="Data PICU belum tersedia" class="min-h-[16rem]" />
          <template v-if="ringkasan">
            <div class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
              <div v-for="(label, k) in KARTU" :key="k" class="p-4 text-center border rounded-lg border-grey-75">
                <div class="text-xs text-grey-400">{{ label }}</div>
                <div class="text-2xl font-semibold">{{ ringkasan[k] }}</div>
              </div>
            </div>
            <div class="p-3 text-xs rounded-lg text-grey-400 bg-grey-25">
              Kapasitas dan okupansi mengikuti keadaan tempat tidur sumber saat ini. Ringkasan masuk dan keluar mengikuti periode terpilih.
            </div>
            <div class="p-4 border rounded-lg border-grey-75">
              <div class="mb-2 font-semibold">Tempat tidur PICU</div>
              <DataTable :value="ringkasan.tempatTidur" dataKey="uuid" class="text-sm" stripedRows>
                <template #empty><div class="py-4 text-center text-grey-400">Belum ada tempat tidur PICU yang dipetakan.</div></template>
                <Column field="noBed" header="Kode" headerClass="bg-opensimrs-50" />
                <Column field="lokasi" header="Lokasi" headerClass="bg-opensimrs-50" />
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: b }"><LencanaStatusPicu :status="b.status" /></template>
                </Column>
              </DataTable>
            </div>
          </template>
        </div>
      </template>
    </Card>
  </div>
</template>
