<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import ChipStatus from "./Komponen/ChipStatus.vue";
import GridSlot from "./Komponen/GridSlot.vue";
import DialogDetailOrder from "./Komponen/DialogDetailOrder.vue";
import { apiFisio, labelJam, labelJenis, tglIndo, keIso, dariIso, type JadwalFisio, type OrderFisio, type SlotJam } from "@/stores/penunjang/fisioterapi";

// Penjadwalan Terapi: papan slot (jam × bed) per tanggal, daftar sesi pada tanggal tsb, dan order tervalidasi
// yang masih memiliki sisa sesi untuk dijadwalkan.
const router = useRouter();
const tanggal = ref<Date>(new Date());
const cari = ref("");
const refGrid = ref<InstanceType<typeof GridSlot>>();
const ringkas = ref({ total: 0, terisi: 0 });

const jadwal = ref<JadwalFisio[]>([]);
const menunggu = ref<OrderFisio[]>([]);
const memuat = ref(false);

const muat = async () => {
  memuat.value = true;
  const tgl = keIso(tanggal.value);
  const [j, o] = await Promise.all([
    apiFisio.daftarJadwal({ tanggal: tgl, limit: 9999, cari: cari.value }),
    apiFisio.daftarOrder({ status: ["valid", "terjadwal"], limit: 100, cari: cari.value }),
  ]);
  jadwal.value = j?.payload?.data ?? [];
  menunggu.value = (o?.payload?.data ?? []).filter((x: OrderFisio) => x.sesiTerjadwal < x.jumlahSesi);
  memuat.value = false;
  refGrid.value?.muat();
};
const geser = (hari: number) => {
  const d = new Date(tanggal.value);
  d.setDate(d.getDate() + hari);
  tanggal.value = d;
  muat();
};
const hariIni = () => {
  tanggal.value = new Date();
  muat();
};
const saatDimuat = (jam: SlotJam[]) => {
  ringkas.value = { total: jam.reduce((n, s) => n + s.totalBed, 0), terisi: jam.reduce((n, s) => n + s.terisi, 0) };
};
const jadwalAktif = computed(() => jadwal.value.filter((j) => j.status !== "batal"));

// Detail order (jadwalkan / ubah / batal sesi).
const dialogDetail = ref(false);
const detailUuid = ref<string | null>(null);
const bukaJadwal = ref(false);
const bukaDetail = (uuid: string, jadwalkan = false) => {
  detailUuid.value = uuid;
  bukaJadwal.value = jadwalkan;
  dialogDetail.value = true;
};
const klikSel = (j: JadwalFisio) => {
  if (j.orderUuid) bukaDetail(j.orderUuid);
  else router.push({ path: "/fisioterapi/booking-terapi", query: { tanggal: j.tanggal } });
};
const hadir = async (j: JadwalFisio) => (await apiFisio.hadir(j.uuid)) && muat();
const keEvaluasi = (j: JadwalFisio) => router.push({ path: "/fisioterapi/evaluasi-terapi", query: { jadwal: j.uuid } });

onMounted(() => {
  const q = router.currentRoute.value.query.tanggal;
  if (q) tanggal.value = dariIso(String(q));
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-hidden" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Penjadwalan Terapi</h1>
          <CustomButton icon="PhCaretLeft" @click="geser(-1)" />
          <CustomDatePicker v-model="tanggal" label="Tanggal" class="toolbar-field--date" @date-select="muat" />
          <CustomButton icon="PhCaretRight" @click="geser(1)" />
          <CustomButton label="Hari ini" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="hariIni" />
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM / No. Order" @keydown.enter="muat" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-4 p-4">
          <section>
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 class="text-sm font-semibold">Ketersediaan Bed — {{ tglIndo(keIso(tanggal), true) }}</h2>
              <div class="flex flex-wrap gap-3 text-xs text-grey-500">
                <span>Terisi <b>{{ ringkas.terisi }}</b> / {{ ringkas.total }} slot</span>
                <span class="inline-flex items-center gap-1"><i class="w-3 h-3 border rounded bg-info-50 border-info-75" />Terjadwal</span>
                <span class="inline-flex items-center gap-1"><i class="w-3 h-3 border rounded bg-opensimrs-50 border-opensimrs-200" />Hadir</span>
                <span class="inline-flex items-center gap-1"><i class="w-3 h-3 border rounded bg-success-50 border-success-75" />Selesai</span>
                <span class="inline-flex items-center gap-1"><i class="w-3 h-3 border rounded bg-warning-50 border-warning-75" />Booking</span>
              </div>
            </div>
            <GridSlot ref="refGrid" :tanggal="keIso(tanggal)" @klik-jadwal="klikSel" @dimuat="saatDimuat" />
          </section>

          <div class="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
            <section class="border rounded-lg border-grey-100">
              <h2 class="px-3 py-2 text-sm font-semibold border-b border-grey-100">Sesi pada tanggal ini ({{ jadwalAktif.length }})</h2>
              <DataTable :value="jadwal" :loading="memuat" class="text-xs" dataKey="uuid" stripedRows>
                <template #empty><NoData /></template>
                <Column header="Jam" headerClass="bg-opensimrs-50"><template #body="{ data }">{{ labelJam(data.jamSlot) }}</template></Column>
                <Column field="bed" header="Bed" headerClass="bg-opensimrs-50" />
                <Column header="Pasien" headerClass="bg-opensimrs-50">
                  <template #body="{ data }">
                    <div class="font-semibold">{{ data.namaPasien }}</div>
                    <div class="text-grey-400">{{ data.noRm ?? data.noHp ?? "-" }}</div>
                  </template>
                </Column>
                <Column header="Order" headerClass="bg-opensimrs-50">
                  <template #body="{ data }">
                    <template v-if="data.noOrder">
                      <div>{{ data.noOrder }}</div>
                      <div class="text-grey-400">{{ labelJenis(data.jenisFisio) }} · Sesi {{ data.sesiKe }}/{{ data.jumlahSesi }}</div>
                    </template>
                    <span v-else class="text-warning-400">Booking</span>
                  </template>
                </Column>
                <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data }"><ChipStatus jenis="jadwal" :status="data.status" /></template></Column>
                <Column headerClass="bg-opensimrs-50">
                  <template #body="{ data }">
                    <div class="flex justify-end gap-1">
                      <button v-if="data.status === 'terjadwal' && data.statusOrder !== 'order'" class="px-2 py-0.5 rounded border border-opensimrs-300 text-opensimrs-400" @click="hadir(data)">Hadir</button>
                      <button v-if="['terjadwal', 'hadir'].includes(data.status) && data.orderUuid && data.statusOrder !== 'order'" class="px-2 py-0.5 rounded bg-opensimrs-300 text-white" @click="keEvaluasi(data)">Evaluasi</button>
                      <button v-if="data.orderUuid" class="px-2 py-0.5 rounded border border-grey-200" @click="bukaDetail(data.orderUuid)">Detail</button>
                    </div>
                  </template>
                </Column>
              </DataTable>
            </section>

            <section class="border rounded-lg border-grey-100">
              <h2 class="px-3 py-2 text-sm font-semibold border-b border-grey-100">Order menunggu jadwal ({{ menunggu.length }})</h2>
              <div v-if="!menunggu.length" class="p-4 text-xs text-center text-grey-400">Semua order tervalidasi sudah terjadwal penuh.</div>
              <ul v-else class="overflow-auto divide-y max-h-[420px] divide-grey-75">
                <li v-for="o in menunggu" :key="o.uuid" class="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div>
                    <div class="font-semibold">{{ o.namaPasien }} <span class="font-normal text-grey-400">· {{ o.noRm }}</span></div>
                    <div class="text-grey-500">{{ o.noOrder }} · {{ labelJenis(o.jenisFisio) }}</div>
                    <div>Terjadwal {{ o.sesiTerjadwal }}/{{ o.jumlahSesi }} sesi <ChipStatus class="ml-1" :status="o.status" /></div>
                  </div>
                  <CustomButton label="Jadwalkan" icon="PhCalendarPlus" size="small" @click="bukaDetail(o.uuid, true)" />
                </li>
              </ul>
            </section>
          </div>
        </div>
      </template>
    </Card>

    <DialogDetailOrder v-model:visible="dialogDetail" :uuid="detailUuid" :bukaJadwal="bukaJadwal" :tanggalAwal="keIso(tanggal)" @berubah="muat" />
  </div>
</template>
