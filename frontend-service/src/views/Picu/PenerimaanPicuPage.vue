<script setup lang="ts">
import { ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import NoData from "@/components/section/NoData.vue";
import StatusPicu from "./components/StatusPicu.vue";
import { usePicu } from "./usePicu";

// Penerimaan PICU: verifikasi perpindahan dari rawat inap yang sudah selesai di modul sumber, lalu buka episode.
const { sibuk, pesan, gagal, calon, pilihanCalon, konfirmasiIdentitas, calonTerpilih, muat, terima } = usePicu("penerimaan");
const formTerima = ref<HTMLFormElement>();
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden picu-form">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="sibuk" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Penerimaan PICU</h1>
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-4 p-4">
          <StatusPicu :gagal="gagal" :pesan="pesan" :sibuk="sibuk" />
          <form ref="formTerima" class="flex flex-col max-w-3xl gap-4 p-4 border rounded-lg border-grey-75" @submit.prevent="terima">
            <div>
              <h2 class="font-semibold">Verifikasi penerimaan dari rawat inap</h2>
              <p class="text-sm text-grey-400">Selesaikan perpindahan dan penempatan melalui rawat inap terlebih dahulu.</p>
            </div>
            <NoData v-if="!calon.length && !sibuk" title="Tidak ada perpindahan sumber yang dapat diterima." class="min-h-[12rem]" />
            <template v-else>
              <label class="label-picu">Pasien dan kunjungan
                <select v-model="pilihanCalon" required><option value="">Pilih penerimaan sumber</option>
                  <option v-for="c in calon" :key="c.referensiPenerimaanUuid" :value="c.referensiPenerimaanUuid">{{ c.namaPasien }} · {{ c.noRm }} · {{ c.noReg }} · {{ c.noBed }}</option>
                </select>
              </label>
              <div v-if="calonTerpilih" class="flex flex-col gap-2 p-4 rounded-lg bg-opensimrs-50">
                <div class="font-semibold">{{ calonTerpilih.namaPasien }}</div>
                <div class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                  <div><div class="text-xs text-grey-400">Nomor rekam medis</div>{{ calonTerpilih.noRm }}</div>
                  <div><div class="text-xs text-grey-400">Kunjungan</div>{{ calonTerpilih.noReg }}</div>
                  <div><div class="text-xs text-grey-400">Tempat tidur</div>{{ calonTerpilih.noBed }}</div>
                </div>
                <label class="flex items-center gap-2 text-sm"><input v-model="konfirmasiIdentitas" type="checkbox" required /> Identitas, kunjungan, dan tempat tidur telah saya periksa.</label>
              </div>
              <div>
                <CustomButton label="Terima di PICU" icon="PhCheck" :disabled="sibuk || !konfirmasiIdentitas" @click="formTerima?.requestSubmit()" />
              </div>
            </template>
          </form>
        </div>
      </template>
    </Card>
  </div>
</template>
