<script setup lang="ts">
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import NoData from "@/components/section/NoData.vue";
import StatusPicu from "./components/StatusPicu.vue";
import LencanaStatusPicu from "./components/LencanaStatusPicu.vue";
import { usePicu } from "./usePicu";

// Daftar episode PICU (25 per halaman) dengan tautan ke detail episode.
const router = useRouter();
const { sibuk, pesan, gagal, episode, halaman, total, muat, gantiHalaman } = usePicu("episode");
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="sibuk" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Episode PICU</h1>
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-4 p-4">
          <StatusPicu :gagal="gagal" :pesan="pesan" :sibuk="sibuk" />
          <NoData v-if="!episode.length && !sibuk" title="Belum ada episode PICU" class="min-h-[16rem]" />
          <template v-else>
            <DataTable :value="episode" dataKey="uuid" class="text-sm" stripedRows>
              <Column field="namaPasien" header="Pasien" headerClass="bg-opensimrs-50" />
              <Column field="noRm" header="Nomor rekam medis" headerClass="bg-opensimrs-50" />
              <Column field="noBed" header="Tempat tidur" headerClass="bg-opensimrs-50" />
              <Column header="Status" headerClass="bg-opensimrs-50">
                <template #body="{ data: e }"><LencanaStatusPicu :status="e.status" /></template>
              </Column>
              <Column header="Detail" headerClass="bg-opensimrs-50">
                <template #body="{ data: e }">
                  <CustomButton label="Buka episode" icon="PhArrowRight" iconPos="right" size="small" outlined textColor="text-opensimrs-300" borderColor="border-opensimrs-300" @click="router.push(`/picu/episode/${e.uuid}`)" />
                </template>
              </Column>
            </DataTable>
            <div class="flex items-center justify-end gap-3 text-sm">
              <CustomButton label="Sebelumnya" icon="PhCaretLeft" size="small" outlined textColor="text-opensimrs-300" borderColor="border-opensimrs-300" :disabled="halaman <= 1 || sibuk" @click="gantiHalaman(-1)" />
              <span>Halaman {{ halaman }} · {{ total }} episode</span>
              <CustomButton label="Berikutnya" icon="PhCaretRight" iconPos="right" size="small" outlined textColor="text-opensimrs-300" borderColor="border-opensimrs-300" :disabled="halaman * 25 >= total || sibuk" @click="gantiHalaman(1)" />
            </div>
          </template>
        </div>
      </template>
    </Card>
  </div>
</template>
