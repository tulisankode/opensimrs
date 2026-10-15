<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import IsianOrderFisio from "@/components/RekamMedis/OrderFisio/IsianOrderFisio.vue";
import ChipStatus from "./ChipStatus.vue";
import GridSlot from "./GridSlot.vue";
import {
  apiFisio, labelJam, labelJenis, labelGender, tglIndo, umur, waktuEpoch, rupiah, keIso, dariIso, isianDariOrder,
  SUMBER_ORDER, type OrderFisio, type JadwalFisio, type IsianOrder,
} from "@/stores/penunjang/fisioterapi";
import { cetakJadwalTerapi, cetakAsuhanTerapi } from "@/utils/pdf/pdfFisioterapi/cetakFisioterapi";

// Detail order fisioterapi: identitas, tindakan, jadwal sesi, evaluasi + aksi validasi / ubah / batal /
// jadwalkan / cetak. Memancarkan `berubah` setiap ada perubahan agar daftar induk dimuat ulang.
const visible = defineModel<boolean>("visible", { default: false });
const props = defineProps<{ uuid?: string | null; bukaJadwal?: boolean; tanggalAwal?: string }>();
const emit = defineEmits<{ (e: "berubah"): void }>();
const router = useRouter();

const order = ref<OrderFisio | null>(null);
const memuat = ref(false);
const muat = async () => {
  if (!props.uuid) return;
  memuat.value = true;
  const r = await apiFisio.detailOrder(props.uuid);
  order.value = r?.payload ?? null;
  memuat.value = false;
};
watch(
  () => [visible.value, props.uuid],
  async () => {
    if (!visible.value) return;
    mode.value = "lihat";
    await muat();
    if (props.bukaJadwal && bisaJadwal.value) bukaFormJadwal();
  },
  { immediate: true },
);
const selesaiAksi = async (r: any) => {
  if (!r) return false;
  await muat();
  emit("berubah");
  return true;
};

const aktif = computed(() => order.value && !["batal", "selesai"].includes(order.value.status));
const sesiAktif = computed(() => (order.value?.jadwal ?? []).filter((j) => j.status !== "batal").length);
const bisaJadwal = computed(() => !!order.value && ["valid", "terjadwal"].includes(order.value.status) && sesiAktif.value < order.value.jumlahSesi);

// ── Validasi ──
const validasi = async () => {
  if (!order.value) return;
  await selesaiAksi(await apiFisio.validasiOrder(order.value.uuid));
};

// ── Ubah order ──
const mode = ref<"lihat" | "ubah">("lihat");
const isian = ref<IsianOrder>({ jenisFisio: "", tindakan: [], jumlahSesi: 1, diagnosis: "", keluhan: "", catatan: "" });
const refIsian = ref<InstanceType<typeof IsianOrderFisio>>();
const mulaiUbah = () => {
  if (!order.value) return;
  isian.value = isianDariOrder(order.value);
  mode.value = "ubah";
};
const simpanUbah = async () => {
  if (!order.value || !refIsian.value?.validasi()) return;
  if (await selesaiAksi(await apiFisio.ubahOrder(order.value.uuid, refIsian.value.payload()))) mode.value = "lihat";
};

// ── Batal order ──
const dialogBatal = ref(false);
const alasanBatal = ref("");
const batal = async () => {
  if (!order.value || !alasanBatal.value.trim()) return;
  if (await selesaiAksi(await apiFisio.batalOrder(order.value.uuid, alasanBatal.value.trim()))) {
    dialogBatal.value = false;
    alasanBatal.value = "";
  }
};

// ── Jadwal (tambah / ubah) ──
const dialogJadwal = ref(false);
const jadwalDiubah = ref<JadwalFisio | null>(null);
const tglJadwal = ref<Date>(new Date());
const pilihanSlot = ref<{ jamSlot: number; bedUuid: string } | null>(null);
const refGrid = ref<InstanceType<typeof GridSlot>>();
const bukaFormJadwal = (j?: JadwalFisio) => {
  jadwalDiubah.value = j ?? null;
  tglJadwal.value = j ? dariIso(j.tanggal) : props.tanggalAwal ? dariIso(props.tanggalAwal) : new Date();
  pilihanSlot.value = null;
  dialogJadwal.value = true;
};
const simpanJadwal = async () => {
  if (!order.value || !pilihanSlot.value) return;
  const data = { tanggal: keIso(tglJadwal.value), ...pilihanSlot.value };
  const r = jadwalDiubah.value
    ? await apiFisio.ubahJadwal(jadwalDiubah.value.uuid, data)
    : await apiFisio.buatJadwal({ orderUuid: order.value.uuid, ...data });
  if (await selesaiAksi(r)) {
    pilihanSlot.value = null;
    refGrid.value?.muat();
    // Tetap terbuka untuk menjadwalkan sesi berikutnya bila masih ada sisa sesi.
    if (jadwalDiubah.value || !bisaJadwal.value) dialogJadwal.value = false;
  }
};
const batalJadwal = async (j: JadwalFisio) => selesaiAksi(await apiFisio.batalJadwal(j.uuid));
const hadir = async (j: JadwalFisio) => selesaiAksi(await apiFisio.hadir(j.uuid));
const keEvaluasi = (j: JadwalFisio) => {
  visible.value = false;
  router.push({ path: "/fisioterapi/evaluasi-terapi", query: { jadwal: j.uuid } });
};
</script>

<template>
  <CustomDialog v-model:visible="visible" width="min(1000px, 96vw)">
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <span>Detail Order Fisioterapi</span>
        <span v-if="order" class="text-sm font-normal">· {{ order.noOrder }}</span>
      </div>
    </template>
    <template #body>
      <div v-if="memuat && !order" class="p-6 text-center text-grey-400">Memuat…</div>
      <div v-else-if="order" class="flex flex-col gap-4 text-sm">
        <!-- Identitas & order -->
        <div class="grid grid-cols-1 gap-3 p-3 border rounded-lg md:grid-cols-2 border-grey-100">
          <div class="flex flex-col gap-1">
            <div class="text-base font-semibold">{{ order.namaPasien }}</div>
            <div class="text-xs text-grey-500">
              {{ order.noRm }} · {{ labelGender(order.gender) }} · {{ umur(order.tanggalLahir) }} · {{ order.noHp || "-" }}
            </div>
            <div class="text-xs text-grey-500">{{ order.paymentMethod === 1 ? "Tunai / Umum" : "Asuransi / Penjamin" }}</div>
          </div>
          <div class="grid grid-cols-[110px_1fr] gap-x-2 gap-y-0.5 text-xs">
            <span class="text-grey-400">Status</span><span><ChipStatus :status="order.status" /></span>
            <span class="text-grey-400">Jenis</span><span>{{ labelJenis(order.jenisFisio) }}</span>
            <span class="text-grey-400">Asal</span><span>{{ SUMBER_ORDER[order.sumber] ?? order.sumber }}{{ order.noReg ? ` · ${order.noReg}` : "" }}</span>
            <span class="text-grey-400">Dokter Pengirim</span><span>{{ order.dokterPengirim ?? "-" }}</span>
            <span class="text-grey-400">Tgl. Order</span><span>{{ waktuEpoch(order.createdAt) }} · {{ order.dibuatOleh ?? "-" }}</span>
            <span class="text-grey-400">Validasi</span>
            <span>{{ order.divalidasiPada ? `${waktuEpoch(order.divalidasiPada)} · ${order.divalidasiOleh ?? "-"}` : "Belum" }}</span>
            <template v-if="order.status === 'batal'">
              <span class="text-grey-400">Alasan Batal</span><span class="text-danger-300">{{ order.alasanBatal }}</span>
            </template>
          </div>
        </div>

        <!-- Ubah order -->
        <div v-if="mode === 'ubah'" class="p-3 border rounded-lg border-opensimrs-200">
          <IsianOrderFisio ref="refIsian" v-model="isian" />
          <p v-if="order.divalidasiPada" class="mt-2 text-xs text-warning-400">Order sudah divalidasi: tagihan di Pembayaran akan diperbarui.</p>
          <div class="flex justify-end gap-2 mt-3">
            <CustomButton label="Batal" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="mode = 'lihat'" />
            <CustomButton label="Simpan Perubahan" icon="PhFloppyDisk" @click="simpanUbah" />
          </div>
        </div>
        <template v-else>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div><div class="text-xs text-grey-400">Diagnosis</div>{{ order.diagnosis || "-" }}</div>
            <div><div class="text-xs text-grey-400">Keluhan</div>{{ order.keluhan || "-" }}</div>
            <div v-if="order.catatan" class="md:col-span-2"><div class="text-xs text-grey-400">Catatan</div>{{ order.catatan }}</div>
          </div>
          <div v-if="order.paketNama" class="flex flex-wrap items-center gap-2 p-2 text-xs rounded bg-opensimrs-50">
            <span class="px-2 py-0.5 font-semibold text-white rounded-full bg-opensimrs-300">{{ order.paketNama }}</span>
            <span>Harga paket {{ rupiah(order.totalBiaya) }} untuk {{ order.jumlahSesi }} sesi</span>
            <span v-if="(order.totalSatuan ?? 0) > order.totalBiaya" class="text-grey-400">(tarif satuan {{ rupiah(order.totalSatuan) }})</span>
          </div>
          <table class="w-full text-xs border rounded border-grey-100">
            <thead class="bg-opensimrs-50">
              <tr><th class="px-2 py-1.5 text-left">Tindakan Terapi</th><th class="px-2 py-1.5">Qty/Sesi</th><th class="px-2 py-1.5 text-right">Tarif</th><th class="px-2 py-1.5 text-right">Subtotal</th></tr>
            </thead>
            <tbody>
              <tr v-for="t in order.tindakan" :key="t.uuid" class="border-t border-grey-75">
                <td class="px-2 py-1">{{ t.nama }}</td>
                <td class="px-2 py-1 text-center">{{ t.qty }} × {{ order.jumlahSesi }}</td>
                <td class="px-2 py-1 text-right">{{ rupiah(t.harga) }}</td>
                <td class="px-2 py-1 text-right">{{ rupiah(t.nilaiPaket ?? t.harga * t.qty * order.jumlahSesi) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="font-semibold border-t border-grey-100">
                <td colspan="3" class="px-2 py-1 text-right">Total ({{ order.jumlahSesi }} sesi)</td>
                <td class="px-2 py-1 text-right text-opensimrs-400">{{ rupiah(order.totalBiaya) }}</td>
              </tr>
            </tfoot>
          </table>
        </template>

        <!-- Jadwal sesi -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="font-semibold">Jadwal Sesi ({{ order.sesiSelesai }}/{{ order.jumlahSesi }} selesai · {{ sesiAktif }} terjadwal)</div>
            <CustomButton v-if="bisaJadwal" icon="PhCalendarPlus" label="Jadwalkan Sesi" @click="bukaFormJadwal()" />
            <span v-else-if="order.status === 'order'" class="text-xs text-warning-400">Validasi order sebelum menjadwalkan sesi.</span>
          </div>
          <table v-if="order.jadwal?.length" class="w-full text-xs border rounded border-grey-100">
            <thead class="bg-opensimrs-50">
              <tr>
                <th class="px-2 py-1.5">Sesi</th><th class="px-2 py-1.5 text-left">Tanggal</th><th class="px-2 py-1.5 text-left">Jam</th>
                <th class="px-2 py-1.5 text-left">Bed</th><th class="px-2 py-1.5">Status</th><th class="px-2 py-1.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="j in order.jadwal" :key="j.uuid" class="border-t border-grey-75" :class="{ 'opacity-50': j.status === 'batal' }">
                <td class="px-2 py-1 text-center">{{ j.sesiKe ?? "-" }}</td>
                <td class="px-2 py-1">{{ tglIndo(j.tanggal, true) }}</td>
                <td class="px-2 py-1">{{ labelJam(j.jamSlot) }}</td>
                <td class="px-2 py-1">{{ j.bed }}</td>
                <td class="px-2 py-1 text-center"><ChipStatus jenis="jadwal" :status="j.status" /></td>
                <td class="px-2 py-1">
                  <div v-if="aktif" class="flex justify-end gap-1">
                    <button v-if="j.status === 'terjadwal' && order.status !== 'order'" class="px-2 py-0.5 rounded border border-opensimrs-300 text-opensimrs-400" @click="hadir(j)">Hadir</button>
                    <button v-if="['terjadwal', 'hadir'].includes(j.status) && order.status !== 'order'" class="px-2 py-0.5 rounded bg-opensimrs-300 text-white" @click="keEvaluasi(j)">Evaluasi</button>
                    <button v-if="['terjadwal', 'hadir'].includes(j.status) && !j.evaluasiUuid" class="px-2 py-0.5 rounded border border-info-300 text-info-400" @click="bukaFormJadwal(j)">Ubah</button>
                    <button v-if="['terjadwal', 'hadir'].includes(j.status)" class="px-2 py-0.5 rounded border border-danger-200 text-danger-300" @click="batalJadwal(j)">Batal</button>
                  </div>
                  <div v-else-if="j.status === 'selesai'" class="text-right">
                    <button class="px-2 py-0.5 rounded border border-opensimrs-300 text-opensimrs-400" @click="keEvaluasi(j)">Lihat</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="p-3 text-xs text-center border border-dashed rounded text-grey-400 border-grey-100">Belum ada jadwal sesi.</div>
        </div>

        <!-- Evaluasi ringkas -->
        <div v-if="order.evaluasi?.length">
          <div class="mb-2 font-semibold">Evaluasi Rehab Medik</div>
          <div v-for="e in order.evaluasi" :key="e.uuid" class="p-2 mb-2 text-xs border rounded border-grey-100">
            <div class="flex justify-between font-semibold">
              <span>Sesi {{ e.sesiKe ?? "-" }} · {{ tglIndo(e.tanggal) }} · {{ e.faseRehabilitasi ? `Fase ${e.faseRehabilitasi}` : "Fase -" }}</span>
              <span class="text-grey-400">{{ e.terapis }}</span>
            </div>
            <div><b>A:</b> {{ e.asesmen || "-" }} · <b>P:</b> {{ e.intervensi || "-" }}</div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div v-if="order" class="flex flex-wrap justify-between gap-2">
        <div class="flex flex-wrap gap-2">
          <CustomButton icon="PhPrinter" label="Jadwal Terapi" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakJadwalTerapi(order)" />
          <CustomButton icon="PhPrinter" label="Asuhan Terapi" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakAsuhanTerapi(order)" />
        </div>
        <div v-if="aktif && mode === 'lihat'" class="flex flex-wrap gap-2">
          <CustomButton label="Batal Order" backgroundColor="bg-danger-300" icon="PhXCircle" @click="dialogBatal = true" />
          <CustomButton label="Ubah Order" outlined borderColor="border-info-300" textColor="text-info-300" icon="PhPencilSimple" @click="mulaiUbah" />
          <CustomButton v-if="order.status === 'order'" label="Validasi Order" icon="PhCheckCircle" @click="validasi" />
        </div>
      </div>
    </template>
  </CustomDialog>

  <!-- Batal order -->
  <CustomDialog v-model:visible="dialogBatal" width="min(460px, 94vw)" headerBg="bg-danger-300">
    <template #header>Batalkan Order {{ order?.noOrder }}</template>
    <template #body>
      <p class="mb-3 text-sm text-grey-500">Jadwal sesi yang belum selesai ikut dibatalkan{{ order?.divalidasiPada ? " dan tagihan di Pembayaran dihapus" : "" }}.</p>
      <CustomTextArea v-model="alasanBatal" label="Alasan Pembatalan" placeholder="Tuliskan alasan pembatalan" required />
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton label="Kembali" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialogBatal = false" />
        <CustomButton label="Ya, Batalkan" backgroundColor="bg-danger-300" :disabled="!alasanBatal.trim()" @click="batal" />
      </div>
    </template>
  </CustomDialog>

  <!-- Tambah / ubah jadwal -->
  <CustomDialog v-model:visible="dialogJadwal" width="min(1000px, 96vw)">
    <template #header>{{ jadwalDiubah ? `Ubah Jadwal Sesi ${jadwalDiubah.sesiKe ?? ""}` : "Jadwalkan Sesi Terapi" }} · {{ order?.namaPasien }}</template>
    <template #body>
      <div class="flex flex-wrap items-end gap-3 mb-3">
        <CustomDatePicker v-model="tglJadwal" label="Tanggal Terapi" class="w-48" />
        <span class="text-xs text-grey-400">Pilih sel "Tersedia" pada jam & bed yang diinginkan.</span>
        <span v-if="!jadwalDiubah && order" class="ml-auto text-xs font-semibold">Sesi terjadwal {{ sesiAktif }}/{{ order.jumlahSesi }}</span>
      </div>
      <GridSlot v-if="dialogJadwal" ref="refGrid" v-model:pilihan="pilihanSlot" :tanggal="keIso(tglJadwal)" :kecuali="jadwalDiubah?.uuid" bisaPilih />
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton label="Tutup" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialogJadwal = false" />
        <CustomButton label="Simpan Jadwal" icon="PhFloppyDisk" :disabled="!pilihanSlot" @click="simpanJadwal" />
      </div>
    </template>
  </CustomDialog>
</template>
