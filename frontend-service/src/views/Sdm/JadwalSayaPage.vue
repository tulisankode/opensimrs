<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { apiJadwal, bolehJadwal as boleh, epochWib, isoWib, kueriJadwal, tanggalJadwal } from "@/stores/penunjang/jadwalDinas";
import { KELAS_INPUT, KELAS_LABEL, keDate, keTanggal, warnaShift } from "./components/jadwal/tampilan";

// Jadwal Saya (STD-0038): jadwal terbit milik pegawai yang tertaut akun, dengan pengajuan tukar dinas ke pegawai lain
// dalam unit yang sama.
const mulai = ref(isoWib(Date.now() / 1000));
const selesai = ref(isoWib(Date.now() / 1000 + 31 * 86400));
const daftar = ref<any[]>([]);
const calon = ref<any[]>([]);
const asal = ref("");
const pengganti = ref("");
const alasan = ref("");
const pesan = ref("");
const sibuk = ref(false);
const PESAN_TERKIRIM = "Permohonan dikirim dan menunggu tanggapan pengganti.";

// Adaptor CustomDatePicker; nilai yang dikirim tetap string "YYYY-MM-DD" seperti semula.
const tanggalMulai = computed<Date | null>({ get: () => keDate(mulai.value), set: (d) => { mulai.value = keTanggal(d); } });
const tanggalSelesai = computed<Date | null>({ get: () => keDate(selesai.value), set: (d) => { selesai.value = keTanggal(d); } });
// Dialog pengajuan terbuka selama ada shift asal terpilih; menutupnya membatalkan pilihan.
const dialogTukar = computed({ get: () => !!asal.value, set: (buka: boolean) => { if (!buka) asal.value = ""; } });
const shiftAsal = computed(() => daftar.value.find((p) => p.uuid === asal.value));

const jalankan = async (fn: () => Promise<void>) => {
  if (sibuk.value) return;
  sibuk.value = true;
  pesan.value = "";
  try {
    await fn();
  } catch (e: any) {
    pesan.value = e.message;
  } finally {
    sibuk.value = false;
  }
};
const muat = () => jalankan(async () => {
  daftar.value = await apiJadwal(`/saya${kueriJadwal({ mulai: epochWib(mulai.value), selesai: epochWib(selesai.value) })}`);
  asal.value = "";
  calon.value = [];
});
const pilih = (uuid: string) => jalankan(async () => {
  asal.value = uuid;
  pengganti.value = "";
  calon.value = await apiJadwal(`/calon-tukar${kueriJadwal({ penempatanAsalUuid: uuid })}`);
});
const ajukan = () => jalankan(async () => {
  await apiJadwal("/tukar", "post", { penempatanAsalUuid: asal.value, penempatanPenggantiUuid: pengganti.value, alasan: alasan.value });
  pesan.value = PESAN_TERKIRIM;
  asal.value = "";
});
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="sibuk" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Jadwal Saya</h1>
          <CustomDatePicker v-model="tanggalMulai" label="Mulai" class="toolbar-field--date" :disabled="sibuk" />
          <CustomDatePicker v-model="tanggalSelesai" label="Sebelum tanggal" class="toolbar-field--date" :disabled="sibuk" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" :disabled="sibuk" @click="muat" />
          <RouterLink
            v-if="boleh('Tukar Dinas', 'READ')"
            to="/sdm/tukar-dinas"
            class="inline-flex items-center h-10 gap-2 px-4 font-semibold border-2 rounded-[10px] border-opensimrs-300 text-opensimrs-300 text-normal hover:bg-opensimrs-50"
          >
            <PhArrowsLeftRight :size="20" weight="bold" /> Lihat Permohonan Tukar Dinas
          </RouterLink>
        </PageToolbar>
      </template>

      <template #content>
        <div class="flex flex-col h-full gap-3 p-4">
          <p class="text-xs text-grey-400">Jadwal terbit berdasarkan tautan akun Kepegawaian SDM · Asia/Jakarta.</p>
          <div
            v-if="pesan && !asal"
            role="status"
            class="px-3 py-2 text-sm rounded-lg"
            :class="pesan === PESAN_TERKIRIM ? 'bg-success-50 text-success-400' : 'bg-danger-50 text-danger-400'"
          >{{ pesan }}</div>
          <NoData v-if="!daftar.length" class="min-h-60" title="Tidak ada jadwal dalam rentang yang dipilih." />
          <DataTable v-else :value="daftar" dataKey="uuid" stripedRows class="text-xs" tableStyle="min-width: 48rem">
            <Column header="Tanggal" headerClass="bg-opensimrs-50">
              <template #body="{ data: p }"><span class="font-semibold">{{ isoWib(p.tanggalKerja) }}</span></template>
            </Column>
            <Column header="Shift" headerClass="bg-opensimrs-50">
              <template #body="{ data: p }">
                <span class="px-2 py-0.5 mr-1 font-semibold border rounded-md" :class="warnaShift(p.potretShift?.kode, p.potretShift?.libur ?? p.libur)">
                  {{ p.potretShift?.kode }}
                </span>
                {{ p.potretShift.nama }}
              </template>
            </Column>
            <Column header="Mulai" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ tanggalJadwal(p.mulaiEpoch) }}</template></Column>
            <Column header="Selesai" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ tanggalJadwal(p.selesaiEpoch) }}</template></Column>
            <Column header="" headerClass="bg-opensimrs-50" class="w-36">
              <template #body="{ data: p }">
                <CustomButton
                  v-if="!p.libur && Number(p.mulaiEpoch) > Date.now() / 1000 && boleh('Tukar Dinas', 'CREATE')"
                  label="Ajukan Tukar"
                  icon="PhArrowsLeftRight"
                  size="small"
                  outlined
                  borderColor="border-opensimrs-300"
                  textColor="text-opensimrs-300"
                  :disabled="sibuk"
                  @click="pilih(p.uuid)"
                />
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </Card>

    <!-- Pengajuan tukar dinas -->
    <CustomDialog v-model:visible="dialogTukar" width="600px">
      <template #header>Ajukan Tukar Dinas</template>
      <template #body>
        <form class="pt-4" @submit.prevent="ajukan">
          <fieldset :disabled="sibuk" class="flex flex-col min-w-0 gap-4 p-0 m-0 text-sm border-0">
            <div v-if="pesan" role="alert" class="px-3 py-2 rounded-lg bg-danger-50 text-danger-400">{{ pesan }}</div>
            <div v-if="shiftAsal" class="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-opensimrs-50">
              <span class="text-grey-400">Shift asal:</span>
              <span class="px-2 py-0.5 font-semibold border rounded-md" :class="warnaShift(shiftAsal.potretShift?.kode, shiftAsal.potretShift?.libur)">
                {{ shiftAsal.potretShift?.kode }}
              </span>
              <span class="font-semibold">{{ shiftAsal.potretShift?.nama }}</span>
              <span>· {{ tanggalJadwal(shiftAsal.mulaiEpoch) }}</span>
            </div>
            <label class="flex flex-col">
              <span :class="KELAS_LABEL">Pengganti dalam unit yang sama<span class="text-danger-300">*</span></span>
              <select v-model="pengganti" required aria-label="Shift pengganti" :class="KELAS_INPUT">
                <option value="">Pilih shift pengganti</option>
                <option v-for="c in calon" :key="c.uuid" :value="c.uuid">{{ c.nama }} · {{ tanggalJadwal(c.mulaiEpoch) }} · {{ c.potretShift.nama }}</option>
              </select>
              <span v-if="!sibuk && !calon.length" class="mt-1 text-xs text-grey-400">Belum ada shift pengganti yang tersedia.</span>
            </label>
            <label class="flex flex-col">
              <span :class="KELAS_LABEL">Alasan<span class="text-danger-300">*</span></span>
              <input v-model="alasan" required maxlength="2000" :class="KELAS_INPUT" />
            </label>
            <p class="text-xs text-grey-400">
              Pengajuan menyatakan kehendak Anda untuk bertukar. Pertukaran berlaku setelah tanggapan pengganti, keputusan kepala ruangan, dan validasi ulang.
            </p>
            <div class="flex justify-end gap-2">
              <CustomButton type="button" label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogTukar = false" />
              <CustomButton type="submit" icon="PhPaperPlaneTilt" label="Kirim Permohonan" />
            </div>
          </fieldset>
        </form>
      </template>
    </CustomDialog>
  </div>
</template>
