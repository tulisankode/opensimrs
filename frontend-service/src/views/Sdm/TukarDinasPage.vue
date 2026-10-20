<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { apiJadwal, bolehJadwal as boleh, kueriJadwal, tanggalJadwal } from "@/stores/penunjang/jadwalDinas";
import { KELAS_INPUT, KELAS_LABEL, kelasStatus, labelStatus } from "./components/jadwal/tampilan";

// Tukar Dinas (STD-0038): permohonan tukar shift antarpegawai. Pemohon dapat membatalkan, pengganti menanggapi, dan
// kepala ruangan (kewenangan putus_tukar) memutuskan antrean unit.
const referensi = ref<any>({ unit: [] });
const daftar = ref<any[]>([]);
const cakupan = ref("saya");
const unit = ref("");
const pesan = ref("");
const sibuk = ref(false);
const terpilih = ref<any>(null);
const alasan = ref("");
const aksi = ref("tanggapi");
const setuju = ref(true);

const opsiCakupan = computed(() => [
  { value: "saya", label: "Permohonan saya" },
  ...(referensi.value.unit.length ? [{ value: "unit", label: "Antrean unit" }] : []),
]);
// Dialog keputusan terbuka selama ada permohonan terpilih; menutupnya membatalkan pilihan.
const dialogKeputusan = computed({ get: () => !!terpilih.value, set: (buka: boolean) => { if (!buka) terpilih.value = null; } });
const PERAN: Record<string, string> = { pemohon: "Pemohon", pengganti: "Pengganti", kepala: "Kepala ruangan" };

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
const muat = async () => {
  daftar.value = await apiJadwal(`/tukar${kueriJadwal({ cakupan: cakupan.value, unitUuid: cakupan.value === "unit" ? unit.value : undefined, limit: 500 })}`);
  terpilih.value = null;
};
const proses = () => jalankan(async () => {
  await apiJadwal(`/tukar/${terpilih.value.uuid}/${aksi.value}`, "post", { versiKunci: terpilih.value.versiKunci, setuju: setuju.value, alasan: alasan.value });
  await muat();
});
const tinjau = (t: any) => {
  terpilih.value = t;
  alasan.value = "";
  aksi.value = cakupan.value === "unit" ? "putuskan" : "tanggapi";
};
onMounted(() => jalankan(async () => {
  referensi.value = await apiJadwal("/referensi");
  unit.value = referensi.value.unit[0]?.uuid ?? "";
  if (referensi.value.superAdmin || referensi.value.kewenangan?.some((x: any) => x.kewenangan === 'putus_tukar')) cakupan.value = "unit";
  if (cakupan.value === 'saya' || unit.value) await muat();
}));
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="sibuk" @click="jalankan(muat)" />
          <h1 class="toolbar-heading text-opensimrs-300">Tukar Dinas</h1>
          <CustomSelect
            v-model="cakupan"
            label="Cakupan"
            :options="opsiCakupan"
            optionValue="value"
            optionLabel="label"
            :showFilter="false"
            :clearable="false"
            :disabled="sibuk"
          />
          <CustomSelect
            v-if="cakupan === 'unit'"
            v-model="unit"
            label="Unit"
            :options="referensi.unit"
            optionValue="uuid"
            optionLabel="nama"
            :clearable="false"
            :disabled="sibuk"
          />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" :disabled="sibuk" @click="jalankan(muat)" />
        </PageToolbar>
      </template>

      <template #content>
        <div class="flex flex-col h-full gap-3 p-4">
          <div v-if="pesan && !terpilih" role="alert" class="flex items-start gap-2 px-3 py-2 text-sm rounded-lg bg-danger-50 text-danger-400">
            <PhWarningCircle :size="18" weight="bold" class="shrink-0" /> {{ pesan }}
          </div>
          <NoData v-if="!daftar.length" class="min-h-60" title="Tidak ada permohonan dalam cakupan ini." />
          <DataTable v-else :value="daftar" dataKey="uuid" stripedRows class="text-xs" tableStyle="min-width: 56rem">
            <Column header="Pengajuan" headerClass="bg-opensimrs-50">
              <template #body="{ data: t }">
                <div class="font-semibold">{{ tanggalJadwal(t.createdAt) }}</div>
                <div class="text-grey-500">{{ t.alasan }}</div>
              </template>
            </Column>
            <Column header="Shift asal" headerClass="bg-opensimrs-50"><template #body="{ data: t }">{{ tanggalJadwal(t.tanggalAsal) }}</template></Column>
            <Column header="Shift pengganti" headerClass="bg-opensimrs-50"><template #body="{ data: t }">{{ tanggalJadwal(t.tanggalPengganti) }}</template></Column>
            <Column header="Peran saya" headerClass="bg-opensimrs-50"><template #body="{ data: t }">{{ PERAN[t.peranSaya] ?? t.peranSaya ?? "-" }}</template></Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: t }">
                <span class="px-2 py-0.5 font-semibold rounded-full whitespace-nowrap" :class="kelasStatus(t.status)">{{ labelStatus(t.status) }}</span>
                <div v-if="t.alasanKeputusan" class="mt-1 text-grey-500">{{ t.alasanKeputusan }}</div>
              </template>
            </Column>
            <Column header="" headerClass="bg-opensimrs-50" class="w-28">
              <template #body="{ data: t }">
                <CustomButton
                  v-if="['menunggu_pengganti', 'menunggu_kepala'].includes(t.status)"
                  label="Tinjau"
                  icon="PhEye"
                  size="small"
                  outlined
                  borderColor="border-opensimrs-300"
                  textColor="text-opensimrs-300"
                  :disabled="sibuk"
                  @click="tinjau(t)"
                />
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </Card>

    <!-- Keputusan permohonan -->
    <CustomDialog v-model:visible="dialogKeputusan" width="600px">
      <template #header>Keputusan Permohonan Tukar Dinas</template>
      <template #body>
        <form v-if="terpilih" class="pt-4" @submit.prevent="proses">
          <fieldset :disabled="sibuk" class="flex flex-col min-w-0 gap-4 p-0 m-0 text-sm border-0">
            <div v-if="pesan" role="alert" class="px-3 py-2 rounded-lg bg-danger-50 text-danger-400">{{ pesan }}</div>
            <div class="grid grid-cols-2 gap-x-6 gap-y-1 p-3 rounded-lg bg-opensimrs-50">
              <div><span class="text-grey-400">Shift asal:</span> {{ tanggalJadwal(terpilih.tanggalAsal) }}</div>
              <div><span class="text-grey-400">Shift pengganti:</span> {{ tanggalJadwal(terpilih.tanggalPengganti) }}</div>
              <div>
                <span class="text-grey-400">Status:</span>
                <span class="ml-1 px-2 py-0.5 text-xs font-semibold rounded-full" :class="kelasStatus(terpilih.status)">{{ labelStatus(terpilih.status) }}</span>
              </div>
              <div><span class="text-grey-400">Peran saya:</span> {{ PERAN[terpilih.peranSaya] ?? terpilih.peranSaya ?? "-" }}</div>
              <div class="col-span-2"><span class="text-grey-400">Alasan pemohon:</span> {{ terpilih.alasan }}</div>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="flex flex-col">
                <span :class="KELAS_LABEL">Tindakan<span class="text-danger-300">*</span></span>
                <select v-model="aksi" required :class="KELAS_INPUT">
                  <option value="">Pilih tindakan</option>
                  <option
                    v-if="terpilih.peranSaya === 'pengganti' && boleh('Tukar Dinas', 'TANGGAPI') && terpilih.status === 'menunggu_pengganti'"
                    value="tanggapi"
                  >Tanggapan sebagai pengganti</option>
                  <option v-if="terpilih.peranSaya === 'pemohon' && boleh('Tukar Dinas', 'BATALKAN')" value="batalkan">Batalkan sebagai pemohon</option>
                  <option
                    v-if="terpilih.peranSaya === 'kepala' && terpilih.status === 'menunggu_kepala' && (boleh('Tukar Dinas', 'SETUJUI') || boleh('Tukar Dinas', 'TOLAK'))"
                    value="putuskan"
                  >Keputusan kepala ruangan</option>
                </select>
              </label>
              <label v-if="aksi && aksi !== 'batalkan'" class="flex flex-col">
                <span :class="KELAS_LABEL">Keputusan</span>
                <select v-model="setuju" aria-label="Keputusan" :class="KELAS_INPUT">
                  <option v-if="aksi === 'tanggapi' || boleh('Tukar Dinas', 'SETUJUI')" :value="true">Setuju</option>
                  <option v-if="aksi === 'tanggapi' || boleh('Tukar Dinas', 'TOLAK')" :value="false">Tolak</option>
                </select>
              </label>
            </div>
            <label class="flex flex-col">
              <span :class="KELAS_LABEL">Alasan<span v-if="!setuju || aksi === 'batalkan'" class="text-danger-300">*</span></span>
              <textarea
                v-model="alasan"
                :required="!setuju || aksi === 'batalkan'"
                maxlength="2000"
                rows="3"
                class="w-full px-3 py-2 bg-white border rounded-lg border-grey-200 text-SM disabled:bg-grey-100 disabled:text-grey-300"
              />
            </label>
            <div class="flex justify-end gap-2">
              <CustomButton type="button" label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKeputusan = false" />
              <CustomButton type="submit" icon="PhFloppyDisk" label="Simpan Keputusan" :disabled="!aksi || sibuk" />
            </div>
          </fieldset>
        </form>
      </template>
    </CustomDialog>
  </div>
</template>
