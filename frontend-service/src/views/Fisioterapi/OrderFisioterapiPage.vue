<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import IsianOrderFisio from "@/components/RekamMedis/OrderFisio/IsianOrderFisio.vue";
import ChipStatus from "./Komponen/ChipStatus.vue";
import PilihPasien from "./Komponen/PilihPasien.vue";
import DialogDetailOrder from "./Komponen/DialogDetailOrder.vue";
import {
  apiFisio, JENIS_FISIO, STATUS_ORDER, SUMBER_ORDER, labelJenis, labelJam, labelGender, umur, tglIndo, waktuEpoch, rupiah, keIso,
  isianKosong, type OrderFisio, type PasienRingkas, type IsianOrder,
} from "@/stores/penunjang/fisioterapi";

// Order Fisioterapi: daftar order dari RME (dokter DPJP), APS, dan booking; validasi, batal, penjadwalan.
const route = useRoute();

const awalBulan = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const cari = ref("");
const status = ref<string[]>([]);
const jenis = ref("");
const mulai = ref<Date>(awalBulan());
const selesai = ref<Date>(new Date());
const halaman = ref({ page: 1, limit: 10 });

const daftar = ref<OrderFisio[]>([]);
const total = ref(0);
const ringkasan = ref<Record<string, number>>({});
const memuat = ref(false);

const muat = async () => {
  memuat.value = true;
  const [r, rk] = await Promise.all([
    apiFisio.daftarOrder({
      ...halaman.value,
      cari: cari.value,
      status: status.value,
      jenis_fisio: jenis.value,
      tanggal_mulai: keIso(mulai.value),
      tanggal_selesai: keIso(selesai.value),
    }),
    apiFisio.ringkasanOrder(),
  ]);
  daftar.value = r?.payload?.data ?? [];
  total.value = r?.payload?.pagination?.total ?? 0;
  ringkasan.value = rk?.payload ?? {};
  memuat.value = false;
};
const cariUlang = () => {
  halaman.value.page = 1;
  muat();
};
const reset = () => {
  cari.value = "";
  status.value = [];
  jenis.value = "";
  mulai.value = awalBulan();
  selesai.value = new Date();
  cariUlang();
};
const toggleStatus = (s: string) => {
  status.value = status.value.includes(s) ? status.value.filter((x) => x !== s) : [...status.value, s];
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  halaman.value = { page: e.page + 1, limit: e.rows };
  muat();
};

// ── Detail ──
const detailUuid = ref<string | null>(null);
const dialogDetail = ref(false);
const bukaJadwal = ref(false);
const bukaDetail = (o: { uuid: string }, jadwal = false) => {
  detailUuid.value = o.uuid;
  bukaJadwal.value = jadwal;
  dialogDetail.value = true;
};

// ── Order APS ──
const dialogAps = ref(false);
const pasien = ref<PasienRingkas | null>(null);
const isian = ref<IsianOrder>(isianKosong());
const caraBayar = ref(1);
const galatPasien = ref("");
const refIsian = ref<InstanceType<typeof IsianOrderFisio>>();
const menyimpan = ref(false);
const bukaAps = () => {
  pasien.value = null;
  isian.value = isianKosong();
  caraBayar.value = 1;
  galatPasien.value = "";
  dialogAps.value = true;
};
const simpanAps = async () => {
  galatPasien.value = pasien.value ? "" : "Pilih pasien terdaftar";
  const ok = refIsian.value?.validasi();
  if (!pasien.value || !ok || !refIsian.value) return;
  menyimpan.value = true;
  const r = await apiFisio.buatOrder({ sumber: "aps", patientUuid: pasien.value.uuid, paymentMethod: caraBayar.value, ...refIsian.value.payload() });
  menyimpan.value = false;
  if (!r) return;
  dialogAps.value = false;
  await muat();
  bukaDetail(r.payload);
};

onMounted(async () => {
  await muat();
  if (route.query.order) bukaDetail({ uuid: String(route.query.order) });
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Order Fisioterapi</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM / No. Order" @keydown.enter="cariUlang" />
          <CustomSelect
            v-model="jenis"
            label="Jenis Fisioterapi"
            placeHolder="Semua jenis"
            :options="JENIS_FISIO"
            optionLabel="label"
            optionValue="value"
            clearable
          />
          <CustomDatePicker v-model="mulai" label="Tanggal mulai" class="toolbar-field--date" :max-date="selesai" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="selesai" label="Tanggal selesai" class="toolbar-field--date" :min-date="mulai" />
          <ToolbarFilterMenu :count="status.length">
            <template #label>Status</template>
            <CustomChip
              v-for="(info, kode) in STATUS_ORDER"
              :key="kode"
              :label="`${info.label} (${ringkasan[kode] ?? 0})`"
              :value="kode"
              :isSelected="status.includes(kode)"
              @selected="toggleStatus(kode)"
            />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariUlang" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton icon="PhPlus" label="Order APS" class="toolbar-action" @click="bukaAps" />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable :value="daftar" :loading="memuat" stripedRows class="text-xs" scrollable scrollHeight="flex" dataKey="uuid" @row-click="(e: any) => bukaDetail(e.data)" rowHover>
          <template #empty><NoData /></template>
          <Column header="No." headerClass="bg-opensimrs-50">
            <template #body="{ index }">{{ (halaman.page - 1) * halaman.limit + index + 1 }}</template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ data.namaPasien }}</div>
              <div class="text-grey-400">{{ data.noRm }} · {{ labelGender(data.gender) }} · {{ umur(data.tanggalLahir) }}</div>
              <div class="text-grey-400">{{ data.noHp || "-" }}</div>
            </template>
          </Column>
          <Column header="Order" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ data.noOrder }}</div>
              <div class="text-grey-400">{{ waktuEpoch(data.createdAt) }}</div>
              <div>
                <span class="px-1.5 rounded bg-grey-75">{{ SUMBER_ORDER[data.sumber] ?? data.sumber }}</span>
                <span v-if="data.noReg" class="ml-1 text-grey-400">{{ data.noReg }}</span>
              </div>
              <div v-if="data.dokterPengirim" class="text-grey-400">{{ data.dokterPengirim }}</div>
            </template>
          </Column>
          <Column header="Terapi" headerClass="bg-opensimrs-50" class="max-w-[260px]">
            <template #body="{ data }">
              <div class="font-semibold">{{ labelJenis(data.jenisFisio) }}</div>
              <div class="truncate text-grey-500" :title="data.tindakanRingkas">{{ data.tindakanRingkas }}</div>
              <div>Sesi {{ data.sesiSelesai }}/{{ data.jumlahSesi }} selesai · {{ data.sesiTerjadwal }} terjadwal</div>
              <div v-if="data.jadwalBerikutnya" class="text-info-400">
                Berikutnya: {{ tglIndo(data.jadwalBerikutnya.tanggal) }} {{ labelJam(data.jadwalBerikutnya.jamSlot) }} · {{ data.jadwalBerikutnya.bed }}
              </div>
            </template>
          </Column>
          <Column header="Biaya" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ rupiah(data.totalBiaya) }}</div>
              <div class="text-grey-400">{{ data.paymentMethod === 1 ? "Tunai" : "Asuransi" }}</div>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data }"><ChipStatus :status="data.status" /></template>
          </Column>
          <Column headerClass="bg-opensimrs-50">
            <template #header><div class="w-full text-center">Aksi</div></template>
            <template #body="{ data }">
              <div class="flex justify-center gap-1" @click.stop>
                <CustomButton label="Detail" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaDetail(data)" />
                <CustomButton
                  v-if="['valid', 'terjadwal'].includes(data.status) && data.sesiTerjadwal < data.jumlahSesi"
                  label="Jadwalkan"
                  size="small"
                  @click="bukaDetail(data, true)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="halaman.limit" :totalRecords="total" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <DialogDetailOrder v-model:visible="dialogDetail" :uuid="detailUuid" :bukaJadwal="bukaJadwal" @berubah="muat" />

    <CustomDialog v-model:visible="dialogAps" width="min(860px, 96vw)">
      <template #header>Order Terapi APS (Atas Permintaan Sendiri)</template>
      <template #body>
        <div class="flex flex-col gap-4">
          <PilihPasien v-model="pasien" label="Pasien Terdaftar" :invalidMessage="galatPasien" />
          <CustomSelect
            v-model="caraBayar"
            label="Cara Bayar"
            :options="[{ value: 1, label: 'Tunai / Umum' }, { value: 2, label: 'Asuransi / Penjamin' }]"
            optionLabel="label"
            optionValue="value"
            class="md:w-1/2"
          />
          <IsianOrderFisio ref="refIsian" v-model="isian" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialogAps = false" />
          <CustomButton label="Simpan Order" icon="PhFloppyDisk" :loading="menyimpan" @click="simpanAps" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
